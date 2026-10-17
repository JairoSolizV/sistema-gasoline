// Bloque reutilizable de un grupo del catálogo (ej. ACABADO): sus operaciones
// estándar se guardan en el grupo y se agregan de una vez a un modelo.
import { afterAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { prisma } from './helpers/db.js';

const app = crearApp();

afterAll(async () => {
  await prisma.grupo.deleteMany({ where: { nombre: { startsWith: 'TEST GRUPO' } } }); // bloque en cascada
  await prisma.maquina.deleteMany({ where: { nombre: { startsWith: 'zz maq bloque' } } });
  const filtro = { modelo: { nombre: 'TEST MODELO LOTE' } };
  await prisma.operacion.deleteMany({ where: { version: filtro } });
  await prisma.modeloVersion.deleteMany({ where: filtro });
  await prisma.modelo.deleteMany({ where: { nombre: 'TEST MODELO LOTE' } });
  await prisma.$disconnect();
});

async function crearGrupo(nombre: string): Promise<string> {
  return (await request(app).post('/api/v1/catalogo/grupos').send({ nombre })).body.data.id;
}

const bloque = (grupoId: string) => `/api/v1/catalogo/grupos/${grupoId}/operaciones`;

async function grupoDelArbol(id: string) {
  const arbol = await request(app).get('/api/v1/catalogo/arbol?soloActivos=false');
  return arbol.body.data.grupos.find((g: { id: string }) => g.id === id);
}

describe('bloque de operaciones de un grupo', () => {
  test('arranca vacío; se guarda la lista completa en orden, con textos normalizados', async () => {
    const id = await crearGrupo('TEST GRUPO ACABADO');
    const vacio = await request(app).get(bloque(id));
    expect(vacio.status).toBe(200);
    expect(vacio.body.data).toEqual({ grupo: { id, nombre: 'TEST GRUPO ACABADO' }, operaciones: [] });

    const res = await request(app)
      .put(bloque(id))
      .send({
        operaciones: [
          { n: '1', equipo: 'Recta', proceso: 'Atraque', pieza: 'Pretina', ctReferencia: 10 },
          { equipo: 'recta', proceso: 'basta', pieza: null },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.data.operaciones).toMatchObject([
      { orden: 1, n: '1', equipo: 'recta', proceso: 'atraque', pieza: 'pretina', ctReferencia: 10 },
      { orden: 2, n: null, equipo: 'recta', proceso: 'basta', pieza: null, ctReferencia: null },
    ]);

    const grupo = await grupoDelArbol(id);
    expect(grupo.operacionesBloque).toBe(2);
    // el bloque cuenta como uso del grupo: no se puede borrar mientras lo tenga
    expect(grupo.usos).toBe(2);
    expect((await request(app).delete(`/api/v1/catalogo/grupos/${id}`)).status).toBe(409);

    // guardar de nuevo reemplaza todo (acá: vaciarlo)
    const vaciado = await request(app).put(bloque(id)).send({ operaciones: [] });
    expect(vaciado.body.data.operaciones).toEqual([]);
  });

  test('validación: sin máquina o CT 0 → 400; grupo inexistente → 404', async () => {
    const id = await crearGrupo('TEST GRUPO VALIDA');
    expect(
      (await request(app).put(bloque(id)).send({ operaciones: [{ equipo: '', proceso: 'x' }] })).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .put(bloque(id))
          .send({ operaciones: [{ equipo: 'recta', proceso: 'x', ctReferencia: 0 }] })
      ).status,
    ).toBe(400);
    const otro = '00000000-0000-0000-0000-000000000000';
    expect((await request(app).get(bloque(otro))).status).toBe(404);
    expect((await request(app).put(bloque(otro)).send({ operaciones: [] })).status).toBe(404);
  });

  test('renombrar una máquina del catálogo también reescribe los bloques', async () => {
    const maq = await request(app).post('/api/v1/catalogo/maquinas').send({ nombre: 'zz maq bloque' });
    const id = await crearGrupo('TEST GRUPO RENOMBRE');
    await request(app)
      .put(bloque(id))
      .send({ operaciones: [{ equipo: 'zz maq bloque', proceso: 'pegado' }] });

    await request(app)
      .patch(`/api/v1/catalogo/maquinas/${maq.body.data.id}`)
      .send({ nombre: 'zz maq bloque nueva' });
    const res = await request(app).get(bloque(id));
    expect(res.body.data.operaciones[0].equipo).toBe('zz maq bloque nueva');
  });

  test('unir dos grupos: el bloque del absorbido se suma al final del destino', async () => {
    const a = await crearGrupo('TEST GRUPO UNIR A');
    const b = await crearGrupo('TEST GRUPO UNIR B');
    await request(app).put(bloque(a)).send({ operaciones: [{ equipo: 'recta', proceso: 'de a' }] });
    await request(app).put(bloque(b)).send({ operaciones: [{ equipo: 'recta', proceso: 'de b' }] });

    const fusion = await request(app).post(`/api/v1/catalogo/grupos/${a}/fusionar`).send({ destinoId: b });
    expect(fusion.status).toBe(200);
    const res = await request(app).get(bloque(b));
    expect(res.body.data.operaciones.map((o: { proceso: string; orden: number }) => [o.orden, o.proceso])).toEqual([
      [1, 'de b'],
      [2, 'de a'],
    ]);
  });
});

describe('POST /versiones/:id/operaciones/lote — agregar el bloque a un modelo', () => {
  test('agrega todas al final, en orden, y recalcula el costo por prenda', async () => {
    const modelo = await request(app)
      .post('/api/v1/modelos')
      .send({
        nombre: 'TEST MODELO LOTE',
        operaciones: [{ grupo: 'TRASEROS', equipo: 'recta', proceso: 'pinza', ct: 15 }],
      });
    const versionId = modelo.body.data.id;

    const res = await request(app)
      .post(`/api/v1/versiones/${versionId}/operaciones/lote`)
      .send({
        operaciones: [
          { grupo: 'ACABADO', n: '1', equipo: 'recta', proceso: 'atraque', pieza: 'pretina', ct: 10 },
          { grupo: 'ACABADO', n: '2', equipo: 'recta', proceso: 'basta', ct: 20 },
        ],
      });
    expect(res.status).toBe(201);
    expect(
      res.body.data.operaciones.map((o: { orden: number; proceso: string }) => [o.orden, o.proceso]),
    ).toEqual([
      [1, 'pinza'],
      [2, 'atraque'],
      [3, 'basta'],
    ]);
    expect(res.body.data.costoManoObraPrenda).toBe(45); // 15 + 10 + 20

    // vacío o CT faltante → 400 (en el modelo el CT es obligatorio)
    const url = `/api/v1/versiones/${versionId}/operaciones/lote`;
    expect((await request(app).post(url).send({ operaciones: [] })).status).toBe(400);
    expect(
      (await request(app).post(url).send({ operaciones: [{ grupo: 'ACABADO', equipo: 'recta', proceso: 'x' }] }))
        .status,
    ).toBe(400);
  });
});
