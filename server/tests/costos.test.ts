// Costos de producción por API (docs/PLAN_COSTOS.md etapas 1 y 2): insumos,
// compras (en Bs y en $us con la tasa oficial del día), fichas vinculadas a un
// modelo (mano de obra y empaque de sus CT) o con mano de obra a mano, el precio
// de la última compra y el margen general o propio.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import type { ConfiguracionDTO, FichaCostoDetalleDTO, InsumoDTO } from '@taller/shared';
import { crearApp } from '../src/app.js';
import { prisma } from './helpers/db.js';

const app = crearApp();
const ids: Record<string, string> = {};
let config: ConfiguracionDTO;

async function limpiar() {
  await prisma.fichaCosto.deleteMany({ where: { nombre: { startsWith: 'TEST FICHA' } } });
  const insumos = { insumo: { nombre: { startsWith: 'TEST INS' } } };
  await prisma.compraInsumo.deleteMany({ where: insumos });
  await prisma.insumo.deleteMany({ where: { nombre: { startsWith: 'TEST INS' } } });
  const filtroModelo = { modelo: { nombre: { startsWith: 'TEST MODELO COSTO' } } };
  await prisma.operacion.deleteMany({ where: { version: filtroModelo } });
  await prisma.modeloVersion.deleteMany({ where: filtroModelo });
  await prisma.modelo.deleteMany({ where: { nombre: { startsWith: 'TEST MODELO COSTO' } } });
}

async function insumo(clave: string, body: Record<string, unknown>) {
  const res = await request(app).post('/api/v1/costos/insumos').send({ nombre: `TEST INS ${clave}`, ...body });
  expect(res.status).toBe(201);
  ids[clave] = res.body.data.id;
}
const comprar = (body: Record<string, unknown>) =>
  request(app).post('/api/v1/costos/compras').send({ fecha: '2026-09-22', tienda: 'NANCY', ...body });
const servicio = () =>
  config.tarifaBusqueda +
  config.tarifaTrazado +
  config.tarifaDobladoHoja +
  config.tarifaCorteRespaldo +
  config.tarifaClasificacionRespaldo;

beforeAll(async () => {
  await limpiar();
  config = (await request(app).get('/api/v1/configuracion')).body.data;
  await insumo('TELA', { categoria: 'tela', unidad: 'metro', anchoCm: 190, color: 'AZUL' });
  await insumo('HILO', { categoria: 'hilo', unidad: 'cono', titulo: '20/3', color: '2930', rendimiento: 100 });
  await insumo('BOTON', { categoria: 'boton', unidad: 'unidad' });
  await insumo('BOLSA', { categoria: 'bolsa', unidad: 'unidad' }); // sin compras
  // modelo de Taller · Pagos: 0.20 de costura + 0.10 de empaque
  const m = await request(app)
    .post('/api/v1/modelos')
    .send({
      nombre: 'TEST MODELO COSTO',
      operaciones: [
        { grupo: 'G', n: '1', equipo: 'recta', proceso: 'pinza', pieza: null, ct: 20 },
        { grupo: 'EMPAQUE', n: '1', equipo: 'mesa', proceso: 'embolsado', pieza: null, ct: 10, esEmpaque: true },
      ],
    });
  ids.MODELO = m.body.data.modeloId;
});

afterAll(async () => {
  await limpiar();
  await prisma.$disconnect();
});

describe('compras', () => {
  test('en dólares: monto × tasa oficial del día; el insumo toma el precio de la última', async () => {
    // 1 800 m a $us 3.00 el metro (5 400 $us) con tasa 11.85 → Bs 63 990.00
    const usd = await comprar({
      insumoId: ids.TELA,
      cantidad: 1_800_000,
      moneda: 'USD',
      montoUsd: 540_000,
      tasaCambio: 118_500,
      origen: 'mayorista',
      ciudad: 'Santa Cruz',
    });
    expect(usd.status).toBe(201);
    expect(usd.body.data).toMatchObject({ precioTotal: 6_399_000, moneda: 'USD', precioUnitarioBs: 35.55 });

    const sinTasa = await comprar({ insumoId: ids.TELA, cantidad: 1000, moneda: 'USD', montoUsd: 300 });
    expect(sinTasa.status).toBe(400);

    await comprar({ insumoId: ids.HILO, cantidad: 1000, precioTotal: 2800 }); // cono a Bs 28
    await comprar({ insumoId: ids.BOTON, cantidad: 144_000, precioTotal: 5000, presentacion: 'paquete de 144' });
    const insumos = (await request(app).get('/api/v1/costos/insumos')).body.data as InsumoDTO[];
    const boton = insumos.find((i) => i.id === ids.BOTON)!;
    expect(boton.precioUnitarioBs).toBeCloseTo(0.3472, 4);
    expect(insumos.find((i) => i.id === ids.BOLSA)!.ultimaCompra).toBeNull();
  });

  test('cada compra guarda el corte para el que se compró; el insumo lista sus cortes', async () => {
    const res = await comprar({ insumoId: ids.HILO, cantidad: 1000, precioTotal: 2800, codigoCorte: '28-1' });
    expect(res.body.data.codigoCorte).toBe('28-1');
    await comprar({ insumoId: ids.HILO, cantidad: 1000, precioTotal: 2800, codigoCorte: '31' });
    await comprar({ insumoId: ids.HILO, cantidad: 1000, precioTotal: 2800, codigoCorte: '28-1' });
    const insumos = (await request(app).get('/api/v1/costos/insumos')).body.data as InsumoDTO[];
    // sin repetir, la compra más reciente primero
    expect(insumos.find((i) => i.id === ids.HILO)!.codigosCorte).toEqual(['28-1', '31']);
    expect(insumos.find((i) => i.id === ids.BOLSA)!.codigosCorte).toEqual([]);
  });
});

describe('ficha de costo', () => {
  const lineas = () => [
    { tipo: 'tela_tizado', concepto: 'Tela', insumoId: ids.TELA, largoMm: 10_120, prendasPorCapa: 10 },
    { tipo: 'hilo', concepto: 'Hilo 20/3', insumoId: ids.HILO }, // rinde 100 (el del insumo)
    { tipo: 'por_prenda', concepto: 'Botón', insumoId: ids.BOTON, cantidad: 1000 },
    { tipo: 'precio_prenda', concepto: 'Lavandería', precio: 850 },
  ];

  test('vinculada a un modelo: mano de obra y empaque salen de sus CT', async () => {
    const res = await request(app)
      .post('/api/v1/costos/fichas')
      .send({ nombre: 'TEST FICHA VINCULADA', codigo: '31', modeloId: ids.MODELO, manoDeObra: 99_999, lineas: lineas() });
    expect(res.status).toBe(201);
    const f = res.body.data as FichaCostoDetalleDTO;
    ids.FICHA = f.id;
    expect(f).toMatchObject({ origenManoDeObra: 'modelo', manoDeObra: 20, empaque: 10, manoDeObraManual: null });
    expect(f.servicioCorte).toBe(servicio());
    expect(f.lineas.map((l) => l.costo)).toEqual([3598, 28, 35, 850]); // botón 0.3472 → 0.35
    // materiales exactos: 35.9766 + 0.28 + 0.347222 + 8.50 = 45.103822
    expect(f.materiales).toBe(4510);
    const totalExacto = 4510.3822 + 20 + 10 + servicio();
    expect(f.total).toBe(Math.round(totalExacto));
    expect(f.margen).toBe(config.margenVenta);
    expect(f.precioVenta).toBe(Math.round((totalExacto * (10_000 + config.margenVenta)) / 10_000));
    expect(f.incompleto).toBe(false);
  });

  test('sin vincular: mano de obra a mano, sin servicio de corte, margen propio', async () => {
    const res = await request(app)
      .post('/api/v1/costos/fichas')
      .send({
        nombre: 'TEST FICHA SUELTA',
        manoDeObra: 736,
        empaque: 100,
        servicioCorteInterno: false,
        margen: 5000,
        lineas: [{ tipo: 'precio_prenda', concepto: 'Bordado', precio: 100 }],
      });
    const f = res.body.data as FichaCostoDetalleDTO;
    expect(f).toMatchObject({ origenManoDeObra: 'manual', manoDeObra: 736, empaque: 100, servicioCorte: 0 });
    expect(f.total).toBe(936);
    expect(f.precioVenta).toBe(1404); // 9.36 × 1.5
    // docena en $us con el tipo de cambio de Configuración, redondeada una vez
    const docena = (bs: number) => Math.round((bs * 12 * 10_000) / config.tasaCambioUsd);
    expect(f).toMatchObject({ costoDocenaUsd: docena(936), ventaDocenaUsd: docena(1404) });
    const lista = (await request(app).get('/api/v1/costos/fichas')).body.data;
    expect(lista.find((x: { id: string }) => x.id === f.id)).toMatchObject({ costoDocenaUsd: docena(936) });
  });

  test('una línea con un insumo sin compras deja la ficha incompleta', async () => {
    const res = await request(app)
      .put(`/api/v1/costos/fichas/${ids.FICHA}`)
      .send({
        nombre: 'TEST FICHA VINCULADA',
        modeloId: ids.MODELO,
        lineas: [...lineas(), { tipo: 'por_prenda', concepto: 'Bolsa', insumoId: ids.BOLSA, cantidad: 1000 }],
      });
    expect(res.status).toBe(200);
    expect(res.body.data.incompleto).toBe(true);
    expect(res.body.data.lineas.at(-1).costo).toBeNull();
  });

  test('una compra nueva cambia el costo (manda la última)', async () => {
    await comprar({ insumoId: ids.HILO, fecha: '2026-10-15', cantidad: 1000, precioTotal: 3000 }); // cono a Bs 30
    const f = (await request(app).get(`/api/v1/costos/fichas/${ids.FICHA}`)).body.data as FichaCostoDetalleDTO;
    expect(f.lineas[1].costo).toBe(30);
  });

  test('nombre repetido y modelo inexistente se rechazan', async () => {
    const repetido = await request(app).post('/api/v1/costos/fichas').send({ nombre: 'TEST FICHA SUELTA' });
    expect(repetido.status).toBe(409);
    const sinModelo = await request(app)
      .post('/api/v1/costos/fichas')
      .send({ nombre: 'TEST FICHA X', modeloId: '00000000-0000-0000-0000-000000000000' });
    expect(sinModelo.status).toBe(404);
  });

  test('un insumo con compras o usado en fichas no se elimina', async () => {
    const res = await request(app).delete(`/api/v1/costos/insumos/${ids.TELA}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EN_USO');
  });
});
