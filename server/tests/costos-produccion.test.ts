// Costos etapas 3 y 4 (docs/PLAN_COSTOS.md §7b): stock (compras − consumo de
// cortes, corregido por conteo físico), costo real del corte con la tela del
// tizado real, y proyección del mes (plan + cortes abiertos).
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import type { CorteCostoDetalleDTO, InsumoDTO, ProyeccionDTO } from '@taller/shared';
import { crearApp } from '../src/app.js';
import { hoyEnBolivia } from '../src/lib/hoy.js';
import { prisma } from './helpers/db.js';
import { datosCorte } from './helpers/corte.js';

const app = crearApp();
const ids: Record<string, string> = {};

async function limpiar() {
  await prisma.fichaCosto.deleteMany({ where: { nombre: { startsWith: 'TEST FICHA PROD' } } }); // plan en cascada
  const filtroModelo = { modelo: { nombre: { startsWith: 'TEST MODELO PROD' } } };
  const cortes = await prisma.corte.findMany({ where: { version: filtroModelo }, select: { id: true } });
  const corteIds = cortes.map((c) => c.id);
  await prisma.corteOperacion.deleteMany({ where: { corteId: { in: corteIds } } });
  await prisma.corte.deleteMany({ where: { id: { in: corteIds } } });
  await prisma.operacion.deleteMany({ where: { version: filtroModelo } });
  await prisma.modeloVersion.deleteMany({ where: filtroModelo });
  await prisma.modelo.deleteMany({ where: { nombre: { startsWith: 'TEST MODELO PROD' } } });
  await prisma.compraInsumo.deleteMany({ where: { insumo: { nombre: { startsWith: 'TEST PROD' } } } });
  await prisma.insumo.deleteMany({ where: { nombre: { startsWith: 'TEST PROD' } } }); // conteos en cascada
}

async function insumo(clave: string, body: Record<string, unknown>, compra: { cantidad: number; precioTotal: number }) {
  const res = await request(app).post('/api/v1/costos/insumos').send({ nombre: `TEST PROD ${clave}`, ...body });
  ids[clave] = res.body.data.id;
  await request(app)
    .post('/api/v1/costos/compras')
    .send({ insumoId: ids[clave], fecha: '2026-01-10', tienda: 'X', ...compra });
}
const stockDe = async (clave: string) =>
  ((await request(app).get('/api/v1/costos/insumos')).body.data as InsumoDTO[]).find((i) => i.id === ids[clave])!
    .stock;

beforeAll(async () => {
  await limpiar();
  await insumo('TELA', { categoria: 'tela', unidad: 'metro' }, { cantidad: 1_000_000, precioTotal: 3_000_000 }); // 1000 m a Bs 30
  await insumo('BOTON', { categoria: 'boton', unidad: 'unidad' }, { cantidad: 1_000_000, precioTotal: 10_000 }); // 1000 u a Bs 0.10
  await insumo('HILO', { categoria: 'hilo', unidad: 'cono', rendimiento: 100 }, { cantidad: 10_000, precioTotal: 30_000 }); // 10 conos a Bs 30

  // modelo: costura 0.50 + empaque 0.10
  const m = await request(app)
    .post('/api/v1/modelos')
    .send({
      nombre: 'TEST MODELO PROD',
      operaciones: [
        { grupo: 'G', n: '1', equipo: 'recta', proceso: 'pinza', pieza: null, ct: 50 },
        { grupo: 'EMPAQUE', n: '1', equipo: 'mesa', proceso: 'embolsado', pieza: null, ct: 10, esEmpaque: true },
      ],
    });
  ids.VERSION = m.body.data.id;
  ids.MODELO = m.body.data.modeloId;

  // ficha vinculada: 1 m de tela (10 m ÷ 10), 1 botón, hilo (rinde 100), lavandería 8.00
  const f = await request(app)
    .post('/api/v1/costos/fichas')
    .send({
      nombre: 'TEST FICHA PROD',
      modeloId: ids.MODELO,
      servicioCorteInterno: false,
      lineas: [
        { tipo: 'tela_tizado', concepto: 'Tela', insumoId: ids.TELA, largoMm: 10_000, prendasPorCapa: 10 },
        { tipo: 'por_prenda', concepto: 'Botón', insumoId: ids.BOTON, cantidad: 1000 },
        { tipo: 'hilo', concepto: 'Hilo', insumoId: ids.HILO },
        { tipo: 'precio_prenda', concepto: 'Lavandería', precio: 800 },
      ],
    });
  expect(f.status).toBe(201);
  ids.FICHA = f.body.data.id;

  // corte de 100 prendas: trazado real 10.50 m con 10 prendas por capa → 10 capas = 105 m
  const creado = await request(app)
    .post('/api/v1/cortes')
    .send({
      ...(await datosCorte({ trazadoCm: 1050, prendasPorCapa: 10 })),
      modeloVersionId: ids.VERSION,
      tallas: [1],
      cortePorTalla: [100],
    });
  expect(creado.body.data.prendasPorCapa).toBe(10);
  ids.CORTE = creado.body.data.id;
  await request(app).post(`/api/v1/cortes/${ids.CORTE}/abrir`);
});

afterAll(async () => {
  await limpiar();
  await prisma.$disconnect();
});

describe('stock', () => {
  test('compras − consumo de los cortes (tela según el tizado real)', async () => {
    expect((await stockDe('TELA')).stock).toBe(895_000); // 1000 − 105 m
    expect((await stockDe('BOTON')).stock).toBe(900_000); // 1000 − 100
    expect((await stockDe('HILO')).stock).toBe(9_000); // 10 − 1 cono
  });

  test('un conteo físico pone el stock en lo contado (lo del mismo día ya está incluido)', async () => {
    const res = await request(app)
      .post('/api/v1/costos/conteos')
      .send({ insumoId: ids.TELA, fecha: hoyEnBolivia(), cantidad: 500_000 });
    expect(res.status).toBe(201);
    expect(await stockDe('TELA')).toMatchObject({ stock: 500_000, compras: 0, consumo: 0 });
  });
});

describe('costo real del corte', () => {
  test('frente a la ficha, rubro por rubro', async () => {
    const res = await request(app).get(`/api/v1/costos/cortes/${ids.CORTE}`);
    expect(res.status).toBe(200);
    const d = res.body.data as CorteCostoDetalleDTO;
    expect(d.ficha?.id).toBe(ids.FICHA);
    expect(d.telaReal).toEqual({ metros: 105_000, capas: 10 });
    const rubro = (r: string) => d.rubros.find((x) => x.rubro === r)!;
    expect(rubro('tela')).toMatchObject({ ficha: 300_000, real: 315_000 }); // 100 m vs 105 m a Bs 30
    expect(rubro('materiales')).toMatchObject({ ficha: 4_000, real: 4_000 }); // botón 10 + hilo 30
    expect(rubro('externos')).toMatchObject({ ficha: 80_000, real: 0 }); // sin envíos todavía
    expect(rubro('costura')).toMatchObject({ ficha: 5_000, real: 5_000 }); // sin asignar: a su CT
    expect(rubro('empaque')).toMatchObject({ ficha: 1_000, real: 1_000 });
    expect(d.realTotal).toBe(315_000 + 4_000 + 5_000 + 1_000);
    expect(d.realPorPrenda).toBe(3250);

    const lista = (await request(app).get('/api/v1/costos/cortes')).body.data;
    expect(lista.find((c: { corteId: string }) => c.corteId === ids.CORTE)).toMatchObject({ realPorPrenda: 3250 });
  });
});

describe('proyección del mes', () => {
  test('plan × ficha − stock = lo que falta comprar; más lo pendiente de los cortes abiertos', async () => {
    const res = await request(app)
      .put('/api/v1/costos/plan')
      .send({ anio: 2035, mes: 1, items: [{ fichaId: ids.FICHA, prendas: 1000 }] });
    expect(res.status).toBe(200);
    const p = res.body.data as ProyeccionDTO;
    const nec = (clave: string) => p.necesidades.find((n) => n.insumo.id === ids[clave])!;
    expect(nec('TELA')).toMatchObject({ necesario: 1_000_000, stock: 500_000, faltante: 500_000, costoFaltante: 1_500_000 });
    expect(nec('BOTON')).toMatchObject({ necesario: 1_000_000, faltante: 100_000, costoFaltante: 1_000 });
    expect(nec('HILO')).toMatchObject({ necesario: 10_000, faltante: 1_000, costoFaltante: 3_000 });
    expect(p.totales.comprarMateriales).toBe(1_504_000);
    expect(p.totales.producirPlan).toBe((800 + 50 + 10) * 1000); // lavandería + costura + empaque
    expect(p.cortesAbiertos.find((c) => c.corteId === ids.CORTE)).toMatchObject({ costuraYEmpaque: 6_000 });
    expect(p.totales.total).toBe(p.totales.comprarMateriales + p.totales.producirPlan + p.totales.terminarCortes);

    const otra = await request(app).get('/api/v1/costos/proyeccion?anio=2035&mes=1');
    expect(otra.body.data.plan).toEqual([expect.objectContaining({ prendas: 1000 })]);
  });

  test('una ficha que no existe no entra al plan', async () => {
    const res = await request(app)
      .put('/api/v1/costos/plan')
      .send({ anio: 2035, mes: 2, items: [{ fichaId: '00000000-0000-0000-0000-000000000000', prendas: 10 }] });
    expect(res.status).toBe(404);
  });
});
