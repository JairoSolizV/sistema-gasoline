// Requerimiento de insumos de un corte (docs/PLAN_REQUERIMIENTO.md): cierres por
// la regla talla → cierre de la ficha, talla tejida (un rollo por talla), avíos
// de la ficha en envases, hilo elegido por corte, precio de la última compra o
// de referencia y descuento del stock (sin pedir dos veces lo que el stock ya
// descontó por el mismo corte).
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import type { RequerimientoCorteDTO } from '@taller/shared';
import { crearApp } from '../src/app.js';
import { prisma } from './helpers/db.js';
import { datosCorte } from './helpers/corte.js';

const app = crearApp();
const ids: Record<string, string> = {};

async function limpiar() {
  await prisma.fichaCosto.deleteMany({ where: { nombre: { startsWith: 'TEST FICHA REQ' } } });
  const filtroModelo = { modelo: { nombre: { startsWith: 'TEST MODELO REQ' } } };
  const cortes = await prisma.corte.findMany({ where: { version: filtroModelo }, select: { id: true } });
  const corteIds = cortes.map((c) => c.id);
  await prisma.corteOperacion.deleteMany({ where: { corteId: { in: corteIds } } });
  await prisma.corte.deleteMany({ where: { id: { in: corteIds } } });
  await prisma.operacion.deleteMany({ where: { version: filtroModelo } });
  await prisma.modeloVersion.deleteMany({ where: filtroModelo });
  await prisma.modelo.deleteMany({ where: { nombre: { startsWith: 'TEST MODELO REQ' } } });
  await prisma.compraInsumo.deleteMany({ where: { insumo: { nombre: { startsWith: 'TEST REQ' } } } });
  await prisma.insumo.deleteMany({ where: { nombre: { startsWith: 'TEST REQ' } } });
}

async function insumo(clave: string, body: Record<string, unknown>) {
  const res = await request(app)
    .post('/api/v1/costos/insumos')
    .send({ nombre: `TEST REQ ${clave}`, unidad: 'unidad', ...body });
  expect(res.status).toBe(201);
  ids[clave] = res.body.data.id;
}

const requerimiento = async () => {
  const res = await request(app).get(`/api/v1/cortes/${ids.CORTE}/requerimiento`);
  expect(res.status).toBe(200);
  return res.body.data as RequerimientoCorteDTO;
};
const linea = (r: RequerimientoCorteDTO, clave: string) =>
  r.lineas.find((l) => l.nombre === `TEST REQ ${clave}`)!;

beforeAll(async () => {
  await limpiar();
  // medida 97 cm: ningún otro cierre la usa, así el test no depende de los datos
  await insumo('CIERRE', { categoria: 'cierre', medidaCm: 97, unidadesPorEnvase: 120, precioEnvase: 17000 });
  await insumo('TALLA', { categoria: 'etiqueta', unidadesPorEnvase: 500, precioEnvase: 1000, porTalla: true });
  await insumo('BOLSA', { categoria: 'bolsa', unidadesPorEnvase: 100, precioEnvase: 3100 });
  await insumo('HILO', { categoria: 'hilo', unidad: 'cono', titulo: '20/3', rendimiento: 100, precioEnvase: 3000 });

  const m = await request(app)
    .post('/api/v1/modelos')
    .send({
      nombre: 'TEST MODELO REQ',
      operaciones: [{ grupo: 'G', n: '1', equipo: 'recta', proceso: 'pinza', pieza: null, ct: 50 }],
    });
  const f = await request(app)
    .post('/api/v1/costos/fichas')
    .send({
      nombre: 'TEST FICHA REQ',
      modeloId: m.body.data.modeloId,
      servicioCorteInterno: false,
      cierresPorTalla: [
        { talla: 40, medidaCm: 97 },
        { talla: 42, medidaCm: 97 },
      ],
      lineas: [
        { tipo: 'por_prenda', concepto: 'Talla tejida', insumoId: ids.TALLA, cantidad: 1000 },
        { tipo: 'por_prenda', concepto: 'Bolsa', insumoId: ids.BOLSA, cantidad: 1000 },
      ],
    });
  expect(f.status).toBe(201);
  expect(f.body.data.cierresPorTalla).toHaveLength(2);

  const corte = await request(app)
    .post('/api/v1/cortes')
    .send({ ...(await datosCorte()), modeloVersionId: m.body.data.id, tallas: [40, 42], cortePorTalla: [100, 50] });
  ids.CORTE = corte.body.data.id;
});

afterAll(async () => {
  await limpiar();
  await prisma.$disconnect();
});

describe('requerimiento del corte', () => {
  test('REQ-A1: cierres por la regla de la ficha, en bolsas completas', async () => {
    const r = await requerimiento();
    expect(r.ficha?.nombre).toBe('TEST FICHA REQ');
    expect(r.reglaCierres).toBe('ficha');
    expect(r.prendas).toBe(150);
    expect(linea(r, 'CIERRE')).toMatchObject({
      grupo: 'Cierres',
      detalle: 'tallas 40, 42',
      necesita: 150,
      envases: 2,
      sobran: 90,
      precioEnvase: 17000,
      monto: 34000,
    });
  });

  test('REQ-A2: talla tejida un rollo por talla; bolsas por prenda', async () => {
    const r = await requerimiento();
    expect(linea(r, 'TALLA')).toMatchObject({ grupo: 'Empaque', envases: 2, monto: 2000, hay: null });
    expect(linea(r, 'BOLSA')).toMatchObject({ necesita: 150, envases: 2, monto: 6200 });
  });

  test('REQ-A3: con una compra usa su precio y descuenta lo que hay', async () => {
    // 50 bolsas a Bs 0.40 → hay 50, faltan 100 = 1 paquete de 100 a Bs 40
    await request(app)
      .post('/api/v1/costos/compras')
      .send({ insumoId: ids.BOLSA, fecha: '2026-01-10', tienda: 'X', cantidad: 50_000, precioTotal: 2000 })
      .expect(201);
    const r = await requerimiento();
    expect(linea(r, 'BOLSA')).toMatchObject({ hay: 50, falta: 100, envases: 1, precioEnvase: 4000, monto: 4000 });
  });

  test('REQ-A4: al abrir el corte no pide dos veces lo que el stock ya le descontó', async () => {
    await request(app).post(`/api/v1/cortes/${ids.CORTE}/abrir`).expect(200);
    const r = await requerimiento();
    expect(linea(r, 'BOLSA')).toMatchObject({ hay: 50, falta: 100, envases: 1 });
  });

  test('REQ-A5: el hilo se elige en el corte; conos fijos por máquina', async () => {
    const sin = await requerimiento();
    const h203 = sin.hilos.find((h) => h.titulo === '20/3')!;
    expect(h203.opciones.some((o) => o.id === ids.HILO)).toBe(true);

    const res = await request(app)
      .put(`/api/v1/cortes/${ids.CORTE}/requerimiento/hilos`)
      .send({ hilos: { '20/3': ids.HILO } });
    expect(res.status).toBe(200);
    const r = res.body.data as RequerimientoCorteDTO;
    const conos = r.maquinas.reduce((a, maq) => a + maq.conos['20/3'], 0);
    expect(linea(r, 'HILO')).toMatchObject({ grupo: 'Hilos', necesita: conos, monto: conos * 3000 });

    const malo = await request(app)
      .put(`/api/v1/cortes/${ids.CORTE}/requerimiento/hilos`)
      .send({ hilos: { '40/2': ids.HILO } });
    expect(malo.status).toBe(400);
  });
});
