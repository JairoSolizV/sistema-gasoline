// Rebanada 3 de ayudantes (docs/PLAN_AYUDANTES.md §2.10): operaciones de
// empaque. La marca vive en el modelo, la plantilla y el bloque del catálogo,
// se congela en el corte al abrirlo (como el CT) y el costo se informa aparte.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { prisma } from './helpers/db.js';
import { datosCorte } from './helpers/corte.js';

const app = crearApp();
const OPS = [
  { grupo: 'ENSAMBLE', n: '1', equipo: 'recta', proceso: 'pinza', pieza: 'trasero', ct: 20 },
  { grupo: 'EMPAQUE', n: '1', equipo: 'botonera', proceso: 'pegado', pieza: 'boton', ct: 10, esEmpaque: true },
  { grupo: 'EMPAQUE', n: '2', equipo: 'mesa', proceso: 'embolsado', pieza: null, ct: 5, esEmpaque: true },
];

async function limpiar() {
  const filtroModelo = { modelo: { nombre: { startsWith: 'TEST MODELO EMP' } } };
  const cortes = await prisma.corte.findMany({ where: { version: filtroModelo }, select: { id: true } });
  const ids = cortes.map((c) => c.id);
  await prisma.corteCambio.deleteMany({ where: { corteId: { in: ids } } });
  await prisma.corteOperacion.deleteMany({ where: { corteId: { in: ids } } });
  await prisma.corte.deleteMany({ where: { id: { in: ids } } });
  await prisma.operacion.deleteMany({ where: { version: filtroModelo } });
  await prisma.modeloVersion.deleteMany({ where: filtroModelo });
  await prisma.modelo.deleteMany({ where: { nombre: { startsWith: 'TEST MODELO EMP' } } });
  await prisma.plantilla.deleteMany({ where: { nombre: { startsWith: 'TEST PLANTILLA EMP' } } });
  await prisma.grupo.deleteMany({ where: { nombre: { startsWith: 'TEST GRUPO EMP' } } });
}

let versionId: string;
beforeAll(async () => {
  await limpiar();
  const res = await request(app).post('/api/v1/modelos').send({ nombre: 'TEST MODELO EMP', operaciones: OPS });
  expect(res.status).toBe(201);
  versionId = res.body.data.id;
});
afterAll(async () => {
  await limpiar();
  await prisma.$disconnect();
});

describe('modelo', () => {
  test('guarda la marca y separa el costo de empaque (incluido en la mano de obra)', async () => {
    const d = (await request(app).get(`/api/v1/versiones/${versionId}`)).body.data;
    expect(d.operaciones.map((o: { esEmpaque: boolean }) => o.esEmpaque)).toEqual([false, true, true]);
    expect(d.costoManoObraPrenda).toBe(35);
    expect(d.costoEmpaquePrenda).toBe(15);
  });

  test('editar solo el CT no borra la marca; se puede quitar explícitamente', async () => {
    const d = (await request(app).get(`/api/v1/versiones/${versionId}`)).body.data;
    const boton = d.operaciones[1];
    const ct = await request(app).patch(`/api/v1/operaciones/${boton.id}`).send({ ct: 12 });
    expect(ct.body.data.operaciones[1]).toMatchObject({ ct: 12, esEmpaque: true });
    expect(ct.body.data.costoEmpaquePrenda).toBe(17);

    const quitar = await request(app).patch(`/api/v1/operaciones/${boton.id}`).send({ esEmpaque: false });
    expect(quitar.body.data.operaciones[1].esEmpaque).toBe(false);
    await request(app).patch(`/api/v1/operaciones/${boton.id}`).send({ esEmpaque: true, ct: 10 });
  });

  test('la versión nueva copia la marca', async () => {
    const modeloId = (await request(app).get(`/api/v1/versiones/${versionId}`)).body.data.modeloId;
    const v2 = await request(app).post(`/api/v1/modelos/${modeloId}/versiones`).send({});
    expect(v2.body.data.operaciones.map((o: { esEmpaque: boolean }) => o.esEmpaque)).toEqual([false, true, true]);
    expect(v2.body.data.costoEmpaquePrenda).toBe(15);
  });
});

describe('corte', () => {
  async function corteAbierto() {
    const creado = await request(app)
      .post('/api/v1/cortes')
      .send({ ...(await datosCorte()), modeloVersionId: versionId, tallas: [1], cortePorTalla: [100] });
    return (await request(app).post(`/api/v1/cortes/${creado.body.data.id}/abrir`)).body.data;
  }

  test('el snapshot congela la marca y el corte informa el costo de empaque aparte', async () => {
    const c = await corteAbierto();
    expect(c.operaciones.map((o: { esEmpaque: boolean }) => o.esEmpaque)).toEqual([false, true, true]);
    expect(c.costoTotalCorte).toBe(3500); // 100 × 0.35 (costura + empaque)
    expect(c.costoEmpaqueCorte).toBe(1500); // 100 × 0.15

    // cambiar el modelo después NO toca el corte ya abierto (como el CT, CA-1.4)
    const v = (await request(app).get(`/api/v1/versiones/${versionId}`)).body.data;
    await request(app).patch(`/api/v1/operaciones/${v.operaciones[2].id}`).send({ esEmpaque: false });
    const igual = (await request(app).get(`/api/v1/cortes/${c.id}`)).body.data;
    expect(igual.costoEmpaqueCorte).toBe(1500);
    await request(app).patch(`/api/v1/operaciones/${v.operaciones[2].id}`).send({ esEmpaque: true });
  });

  test('cambiar la marca dentro del corte queda en el historial', async () => {
    const c = await corteAbierto();
    const op = c.operaciones[0];
    const res = await request(app)
      .patch(`/api/v1/cortes/${c.id}/operaciones/${op.id}`)
      .send({ esEmpaque: true });
    expect(res.status).toBe(200);
    expect(res.body.data.operaciones[0]).toMatchObject({ esEmpaque: true, modificadaEnCorte: true });
    expect(res.body.data.costoEmpaqueCorte).toBe(3500);
    const cambio = await prisma.corteCambio.findFirstOrThrow({
      where: { corteId: c.id, tipo: 'editar' },
    });
    expect(cambio.detalle).toMatchObject({
      tipo: 'editar',
      campos: [{ campo: 'esEmpaque', antes: false, despues: true }],
    });
  });

  test('una operación de empaque agregada solo en el corte', async () => {
    const c = await corteAbierto();
    const res = await request(app)
      .post(`/api/v1/cortes/${c.id}/operaciones`)
      .send({ grupo: 'EMPAQUE', n: '3', equipo: 'mesa', proceso: 'etiquetado', pieza: null, ct: 4, esEmpaque: true });
    expect(res.status).toBe(201);
    expect(res.body.data.costoEmpaqueCorte).toBe(1900);
  });
});

describe('plantillas y bloques del catálogo llevan la marca', () => {
  test('plantilla: crear, leer y duplicar', async () => {
    const p = await request(app)
      .post('/api/v1/plantillas')
      .send({
        nombre: 'TEST PLANTILLA EMP',
        operaciones: [
          { grupo: 'EMPAQUE', equipo: 'mesa', proceso: 'embolsado', ctReferencia: 5, esEmpaque: true },
          { grupo: 'ENSAMBLE', equipo: 'recta', proceso: 'pinza' },
        ],
      });
    expect(p.status).toBe(201);
    expect(p.body.data.operaciones.map((o: { esEmpaque: boolean }) => o.esEmpaque)).toEqual([true, false]);
    const copia = await request(app)
      .post(`/api/v1/plantillas/${p.body.data.id}/duplicar`)
      .send({ nombre: 'TEST PLANTILLA EMP copia' });
    expect(copia.body.data.operaciones[0].esEmpaque).toBe(true);
  });

  test('bloque de un grupo del catálogo', async () => {
    const g = await request(app).post('/api/v1/catalogo/grupos').send({ nombre: 'TEST GRUPO EMP' });
    expect(g.status).toBe(201);
    const b = await request(app)
      .put(`/api/v1/catalogo/grupos/${g.body.data.id}/operaciones`)
      .send({ operaciones: [{ equipo: 'remachadora', proceso: 'remache', ctReferencia: 8, esEmpaque: true }] });
    expect(b.status).toBe(200);
    expect(b.body.data.operaciones[0].esEmpaque).toBe(true);
  });
});
