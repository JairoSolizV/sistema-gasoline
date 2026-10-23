// Tablero de dinero (docs/PLAN_TABLERO_DINERO.md): pedidos en puerta, despachos
// de un corte cerrado (con foto del costo) o de una ficha, cobros y por cobrar,
// compras a crédito − pagos al proveedor y resultado del mes.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import type { FichaCostoDetalleDTO, TableroDTO } from '@taller/shared';
import { crearApp } from '../src/app.js';
import { hoyEnBolivia } from '../src/lib/hoy.js';
import { prisma } from './helpers/db.js';
import { datosCorte } from './helpers/corte.js';
import { datosOperario } from './helpers/operario.js';

const app = crearApp();
const ids: Record<string, string> = {};
const hoy = hoyEnBolivia();
let ficha: FichaCostoDetalleDTO;
let costoFicha: number; // por prenda, sin costos fijos

async function limpiar() {
  const clientes = { cliente: { nombre: { startsWith: 'TEST CLI' } } };
  await prisma.cobro.deleteMany({ where: clientes });
  await prisma.despacho.deleteMany({ where: clientes });
  await prisma.pedido.deleteMany({ where: clientes });
  await prisma.cliente.deleteMany({ where: { nombre: { startsWith: 'TEST CLI' } } });
  await prisma.pagoProveedor.deleteMany({ where: { proveedor: { startsWith: 'TEST' } } });
  await prisma.compraInsumo.deleteMany({ where: { insumo: { nombre: { startsWith: 'TEST INS DIN' } } } });
  await prisma.insumo.deleteMany({ where: { nombre: { startsWith: 'TEST INS DIN' } } });
  await prisma.fichaCosto.deleteMany({ where: { nombre: { startsWith: 'TEST FICHA DIN' } } });
  const filtroModelo = { modelo: { nombre: { startsWith: 'TEST MODELO DIN' } } };
  const cortes = await prisma.corte.findMany({ where: { version: filtroModelo }, select: { id: true } });
  const corteIds = cortes.map((c) => c.id);
  await prisma.asignacion.deleteMany({ where: { corteOperacion: { corteId: { in: corteIds } } } });
  await prisma.corteOperacion.deleteMany({ where: { corteId: { in: corteIds } } });
  await prisma.corte.deleteMany({ where: { id: { in: corteIds } } });
  await prisma.operacion.deleteMany({ where: { version: filtroModelo } });
  await prisma.modeloVersion.deleteMany({ where: filtroModelo });
  await prisma.modelo.deleteMany({ where: { nombre: { startsWith: 'TEST MODELO DIN' } } });
  await prisma.operario.deleteMany({ where: { nombre: { startsWith: 'TEST DIN' } } });
}

const tablero = async () => (await request(app).get('/api/v1/dinero/tablero')).body.data as TableroDTO;
const despachar = (body: Record<string, unknown>) =>
  request(app).post('/api/v1/dinero/despachos').send({ clienteId: ids.CLI, fecha: hoy, ...body });

beforeAll(async () => {
  await limpiar();
  const cli = await request(app).post('/api/v1/dinero/clientes').send({ nombre: 'TEST CLI TIENDA' });
  expect(cli.status).toBe(201);
  ids.CLI = cli.body.data.id;
  const f = await request(app)
    .post('/api/v1/costos/fichas')
    .send({ nombre: 'TEST FICHA DIN', manoDeObra: 1000, servicioCorteInterno: false, margen: 5000 });
  ficha = f.body.data;
  costoFicha = ficha.total - ficha.costoFijo;

  // corte de 100 prendas (costura 0.20), cerrado hoy, de un modelo sin ficha
  const cos = await request(app).post('/api/v1/operarios').send({ nombre: 'TEST DIN COSTURA', ...datosOperario() });
  const v = await request(app)
    .post('/api/v1/modelos')
    .send({
      nombre: 'TEST MODELO DIN',
      operaciones: [{ grupo: 'G', n: '1', equipo: 'recta', proceso: 'pinza', pieza: null, ct: 20 }],
    });
  const creado = await request(app)
    .post('/api/v1/cortes')
    .send({ ...(await datosCorte()), modeloVersionId: v.body.data.id, tallas: [1], cortePorTalla: [100] });
  ids.CORTE = creado.body.data.id;
  const corte = (await request(app).post(`/api/v1/cortes/${ids.CORTE}/abrir`)).body.data;
  await request(app)
    .put(`/api/v1/cortes/${ids.CORTE}/operaciones/${corte.operaciones[0].id}/asignaciones`)
    .send({ asignaciones: [{ operarioId: cos.body.data.id, cantidad: 100 }] });
});

afterAll(async () => {
  await limpiar();
  await prisma.$disconnect();
});

describe('pedidos en puerta', () => {
  test('sin precio toma el de venta de la ficha; el tablero lo muestra a costo y a venta', async () => {
    const res = await request(app)
      .post('/api/v1/dinero/pedidos')
      .send({ clienteId: ids.CLI, fichaId: ficha.id, prendas: 120, fechaEntrega: '2099-01-15' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      precioPrenda: ficha.precioVenta,
      costoPrenda: costoFicha,
      venta: 120 * ficha.precioVenta,
      costo: 120 * costoFicha,
      estado: 'pendiente',
    });
    ids.PEDIDO = res.body.data.id;
    const item = (await tablero()).enPuerta.items.find((i) => i.id === ids.PEDIDO);
    expect(item).toMatchObject({ prendas: 120, costo: 120 * costoFicha, venta: 120 * ficha.precioVenta });
  });

  test('vincular un corte lo pasa a producción y deja de estar en puerta', async () => {
    const res = await request(app).patch(`/api/v1/dinero/pedidos/${ids.PEDIDO}`).send({ corteId: ids.CORTE });
    expect(res.body.data).toMatchObject({ estado: 'en_produccion', corte: { id: ids.CORTE } });
    expect((await tablero()).enPuerta.items.find((i) => i.id === ids.PEDIDO)).toBeUndefined();
  });
});

describe('despachos y cobranzas', () => {
  test('un corte abierto está en producción y no se despacha; al cerrar pasa al depósito', async () => {
    const t = await tablero();
    // precio del pedido vinculado; falta pagar la costura (se paga al cerrar)
    expect(t.enProduccion.items.find((i) => i.id === ids.CORTE)).toMatchObject({
      prendas: 100,
      costo: 2000,
      venta: 100 * ficha.precioVenta,
      faltaPagar: 2000,
    });
    const abierto = await despachar({ lineas: [{ corteId: ids.CORTE, prendas: 10 }] });
    expect(abierto.status).toBe(409);
    expect(abierto.body.error.code).toBe('CORTE_ABIERTO');

    const cierre = await request(app).post(`/api/v1/cortes/${ids.CORTE}/cerrar`).send({ fechaCierre: `${hoy}T12:00:00.000Z` });
    expect(cierre.status).toBe(200);
    expect((await tablero()).deposito.items.find((i) => i.id === ids.CORTE)).toMatchObject({
      prendas: 100,
      costo: 2000,
      faltaPagar: 0,
    });
  });

  test('despacho de un corte: foto del costo, no pasa de lo disponible', async () => {
    const res = await despachar({ lineas: [{ corteId: ids.CORTE, prendas: 40, precioPrenda: 1500 }] });
    expect(res.status).toBe(201);
    expect(res.body.data.lineas[0]).toMatchObject({ prendas: 40, precioPrenda: 1500, costoPrenda: 20, total: 60_000 });
    const deMas = await despachar({ lineas: [{ corteId: ids.CORTE, prendas: 61 }] });
    expect(deMas.body.error.code).toBe('CANTIDAD_EXCEDIDA');
    expect((await tablero()).deposito.items.find((i) => i.id === ids.CORTE)).toMatchObject({ prendas: 60, costo: 1200 });
  });

  test('despacho de una ficha y cobro parcial: por cobrar = despachado − cobrado', async () => {
    const res = await despachar({ lineas: [{ fichaId: ficha.id, prendas: 24, precioPrenda: 2000, detalle: '12 de la 30 negro' }] });
    expect(res.body.data).toMatchObject({ total: 48_000, costo: 24 * costoFicha });
    expect(res.body.data.lineas[0].detalle).toBe('12 de la 30 negro');
    const cobro = await request(app).post('/api/v1/dinero/cobros').send({ clienteId: ids.CLI, fecha: hoy, monto: 30_000 });
    expect(cobro.status).toBe(201);
    const t = await tablero();
    expect(t.porCobrar.clientes.find((c) => c.id === ids.CLI)!.monto).toBe(60_000 + 48_000 - 30_000);
    expect(t.resultadoMes).toMatchObject({
      ventas: 108_000,
      costoVendido: 40 * 20 + 24 * costoFicha,
      cobrado: 30_000,
      prendasDespachadas: 64,
    });
    expect(t.resultadoMes.margen).toBe(t.resultadoMes.ventas - t.resultadoMes.costoVendido);
    expect(t.resultadoMes.queda).toBe(t.resultadoMes.margen - t.resultadoMes.gastosFijos - t.resultadoMes.cuotaBanco);
  });

  test('un cliente con movimientos no se elimina', async () => {
    const res = await request(app).delete(`/api/v1/dinero/clientes/${ids.CLI}`);
    expect(res.status).toBe(409);
  });
});

describe('deudas con proveedores', () => {
  test('compras a crédito − pagos, agrupado por el nombre normalizado', async () => {
    const ins = await request(app).post('/api/v1/costos/insumos').send({ nombre: 'TEST INS DIN TELA', categoria: 'tela', unidad: 'metro' });
    const comprar = (condicion: string, monto: number) =>
      request(app)
        .post('/api/v1/costos/compras')
        .send({ insumoId: ins.body.data.id, fecha: hoy, tienda: ' test  nancy ', cantidad: 100_000, precioTotal: monto, condicion, vence: '2099-01-31' });
    expect((await comprar('credito', 100_000)).body.data.condicion).toBe('credito');
    await comprar('contado', 50_000); // al contado no es deuda
    const pago = await request(app)
      .post('/api/v1/dinero/proveedores/pagos')
      .send({ proveedor: 'Test Nancy', fecha: hoy, monto: 40_000 });
    expect(pago.status).toBe(201);
    const nancy = pago.body.data.find((p: { proveedor: string }) => p.proveedor === 'TEST NANCY');
    expect(nancy).toMatchObject({ comprasCredito: 100_000, pagado: 40_000, deuda: 60_000 });
    const t = await tablero();
    expect(t.deudas.proveedores.lista).toContainEqual({ proveedor: 'TEST NANCY', monto: 60_000 });
    expect(t.capitalDeTrabajo).toBe(t.tenes - t.deudas.total);

    // cuentas por pagar: el pago cancela primero la compra más vieja; queda lo demás con su vencimiento
    const cxp = (await request(app).get('/api/v1/dinero/cuentas-por-pagar')).body.data;
    const deNancy = cxp.items.filter((i: { acreedor: string }) => i.acreedor === 'TEST NANCY');
    expect(deNancy).toEqual([
      expect.objectContaining({ tipo: 'proveedor', monto: 60_000, vence: '2099-01-31', enlace: '/compras?tab=proveedores' }),
    ]);
    expect(cxp.total).toBe(cxp.items.reduce((a: number, i: { monto: number }) => a + i.monto, 0));
  });
});
