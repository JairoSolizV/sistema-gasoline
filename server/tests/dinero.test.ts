// Tablero de dinero (docs/PLAN_TABLERO_DINERO.md): pedidos en puerta, despachos
// de un corte cerrado (con foto del costo) o de una ficha, cobros y por cobrar,
// compras a crédito − pagos al proveedor y resultado del mes. Ventas y cobros en
// $us con el tipo de cambio de cada día (docs/PLAN_DOLARES.md).
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import { totalPorDocena, usdABs, type FichaCostoDetalleDTO, type TableroDTO } from '@taller/shared';
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
let docena: number; // precio de la docena en $us de la ficha (calculado)
let tasaOriginal: number;
const TASA = 70_000; // 7.00 Bs por $us

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
  tasaOriginal = (await prisma.configuracion.findUniqueOrThrow({ where: { id: 1 } })).tasaCambioUsd;
  await prisma.configuracion.update({ where: { id: 1 }, data: { tasaCambioUsd: TASA } });
  const cli = await request(app).post('/api/v1/dinero/clientes').send({ nombre: 'TEST CLI TIENDA' });
  expect(cli.status).toBe(201);
  ids.CLI = cli.body.data.id;
  const f = await request(app)
    .post('/api/v1/costos/fichas')
    .send({ nombre: 'TEST FICHA DIN', manoDeObra: 1000, servicioCorteInterno: false, margen: 5000 });
  ficha = f.body.data;
  costoFicha = ficha.total - ficha.costoFijo;
  docena = ficha.ventaDocenaUsd;

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
  await prisma.configuracion.update({ where: { id: 1 }, data: { tasaCambioUsd: tasaOriginal } });
  await prisma.$disconnect();
});

describe('precio fijo de la docena en $us', () => {
  test('la ficha usa la docena fija y saca el precio por prenda en Bs al último tipo de cambio', async () => {
    const res = await request(app)
      .post('/api/v1/costos/fichas')
      .send({ nombre: 'TEST FICHA DIN FIJA', manoDeObra: 1000, servicioCorteInterno: false, precioDocenaUsd: 3600 });
    expect(res.status).toBe(201);
    // $us 36.00 la docena × 7.00 ÷ 12 = Bs 21.00 por prenda
    expect(res.body.data).toMatchObject({ ventaDocenaUsd: 3600, precioDocenaFijo: true, precioVenta: 2100 });
    expect(ficha).toMatchObject({ precioDocenaFijo: false });
  });
});

describe('pedidos en puerta', () => {
  test('sin precio toma la docena en $us de la ficha; el tablero lo muestra a costo y a venta', async () => {
    const res = await request(app)
      .post('/api/v1/dinero/pedidos')
      .send({ clienteId: ids.CLI, fichaId: ficha.id, prendas: 120, fechaEntrega: '2099-01-15' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      precioDocenaUsd: docena,
      costoPrenda: costoFicha,
      ventaUsd: 10 * docena,
      costo: 120 * costoFicha,
      estado: 'pendiente',
    });
    ids.PEDIDO = res.body.data.id;
    const item = (await tablero()).enPuerta.items.find((i) => i.id === ids.PEDIDO);
    expect(item).toMatchObject({ prendas: 120, costo: 120 * costoFicha, ventaUsd: 10 * docena, venta: usdABs(10 * docena, TASA) });
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
      ventaUsd: totalPorDocena(100, docena),
      venta: usdABs(totalPorDocena(100, docena), TASA),
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

  test('despacho de un corte: foto del costo, total en $us y en Bs a la tasa del día, no pasa de lo disponible', async () => {
    // 40 prendas a $us 24.00 la docena = $us 80.00; a 7.00 = Bs 560.00
    const res = await despachar({ tasaCambio: TASA, lineas: [{ corteId: ids.CORTE, prendas: 40, precioDocenaUsd: 2400 }] });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ tasaCambio: TASA, totalUsd: 8000, totalBs: 56_000 });
    expect(res.body.data.lineas[0]).toMatchObject({ prendas: 40, precioDocenaUsd: 2400, costoPrenda: 20, totalUsd: 8000, totalBs: 56_000 });
    const deMas = await despachar({ lineas: [{ corteId: ids.CORTE, prendas: 61 }] });
    expect(deMas.body.error.code).toBe('CANTIDAD_EXCEDIDA');
    expect((await tablero()).deposito.items.find((i) => i.id === ids.CORTE)).toMatchObject({ prendas: 60, costo: 1200 });
  });

  test('despacho de una ficha y cobros en $us y en Bs: por cobrar = despachado − cobrado, en $us', async () => {
    // 24 prendas a $us 30.00 = $us 60.00; a 6.96 = Bs 417.60. Esa tasa pasa a ser la última
    const res = await despachar({
      tasaCambio: 69_600,
      lineas: [{ fichaId: ficha.id, prendas: 24, precioDocenaUsd: 3000, detalle: '12 de la 30 negro' }],
    });
    expect(res.body.data).toMatchObject({ totalUsd: 6000, totalBs: 41_760, costo: 24 * costoFicha });
    expect(res.body.data.lineas[0].detalle).toBe('12 de la 30 negro');
    // $us 50.00 a la caja de dólares; Bs 69.60 = $us 10.00 a la tasa del día (la última)
    const usd = await request(app).post('/api/v1/dinero/cobros').send({ clienteId: ids.CLI, fecha: hoy, monto: 5000 });
    expect(usd.status).toBe(201);
    expect(usd.body.data).toMatchObject({ moneda: 'USD', monto: 5000, tasaCambio: 69_600, usd: 5000, bs: 34_800, caja: 'dolares' });
    const bs = await request(app).post('/api/v1/dinero/cobros').send({ clienteId: ids.CLI, fecha: hoy, moneda: 'BOB', monto: 6960 });
    expect(bs.body.data).toMatchObject({ moneda: 'BOB', usd: 1000, bs: 6960, caja: 'efectivo' });
    const t = await tablero();
    expect(t.tasaCambio).toBe(69_600);
    expect(t.porCobrar.clientes.find((c) => c.id === ids.CLI)!.montoUsd).toBe(8000 + 6000 - 5000 - 1000);
    expect(t.resultadoMes).toMatchObject({
      ventas: 56_000 + 41_760,
      ventasUsd: 14_000,
      costoVendido: 40 * 20 + 24 * costoFicha,
      cobrado: 34_800 + 6960,
      cobradoUsd: 6000,
      prendasDespachadas: 64,
    });
    expect(t.resultadoMes.margen).toBe(t.resultadoMes.ventas - t.resultadoMes.costoVendido);
    expect(t.resultadoMes.queda).toBe(t.resultadoMes.margen - t.resultadoMes.gastosFijos - t.resultadoMes.cuotaBanco);
  });

  test('cuentas por cobrar: el cobro va al despacho más viejo; vence según el plazo del cliente', async () => {
    const enDias = (n: number) => {
      const d = new Date(`${hoy}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + n);
      return d.toISOString().slice(0, 10);
    };
    const cxc = (await request(app).get('/api/v1/dinero/cuentas-por-cobrar')).body.data;
    const mios = cxc.items.filter((i: { cliente: { id: string } }) => i.cliente.id === ids.CLI);
    // en $us: despacho del corte (80.00) cobrado 60.00; despacho de la ficha (60.00) sin cobrar
    expect(mios).toHaveLength(2);
    expect(mios).toEqual(expect.arrayContaining([
      expect.objectContaining({ totalUsd: 8000, cobradoUsd: 6000, pendienteUsd: 2000, vence: enDias(30) }),
      expect.objectContaining({ totalUsd: 6000, cobradoUsd: 0, pendienteUsd: 6000, vence: enDias(30) }),
    ]));
    expect(cxc.tasaCambio).toBe(69_600);
    // con plazo de 15 días, un despacho nuevo vence a los 15
    await request(app).patch(`/api/v1/dinero/clientes/${ids.CLI}`).send({ plazoDias: 15 });
    const nuevo = await despachar({ lineas: [{ fichaId: ficha.id, prendas: 12, precioDocenaUsd: 1000 }] });
    expect(nuevo.body.data.vence).toBe(enDias(15));
  });

  test('un cliente con movimientos no se elimina', async () => {
    const res = await request(app).delete(`/api/v1/dinero/clientes/${ids.CLI}`);
    expect(res.status).toBe(409);
  });
});

describe('deudas con proveedores', () => {
  test('compras a crédito − pagos, agrupado por el nombre normalizado y la moneda', async () => {
    const ins = await request(app).post('/api/v1/costos/insumos').send({ nombre: 'TEST INS DIN TELA', categoria: 'tela', unidad: 'metro' });
    const comprar = (condicion: string, monto: number) =>
      request(app)
        .post('/api/v1/costos/compras')
        .send({ insumoId: ins.body.data.id, fecha: hoy, tienda: ' test  nancy ', cantidad: 100_000, precioTotal: monto, condicion, vence: '2099-01-31' });
    expect((await comprar('credito', 100_000)).body.data.condicion).toBe('credito');
    await comprar('contado', 50_000); // al contado no es deuda
    // la tela en dólares: $us 1 000 a crédito y un pago de $us 400
    const enUsd = await request(app)
      .post('/api/v1/costos/compras')
      .send({ insumoId: ins.body.data.id, fecha: hoy, tienda: 'Test Nancy', cantidad: 100_000, moneda: 'USD', montoUsd: 100_000, tasaCambio: 69_600, condicion: 'credito', vence: '2099-02-28' });
    expect(enUsd.status).toBe(201);
    const pagar = (body: Record<string, unknown>) =>
      request(app).post('/api/v1/dinero/proveedores/pagos').send({ proveedor: 'Test Nancy', fecha: hoy, ...body });
    expect((await pagar({ moneda: 'USD', monto: 40_000 })).status).toBe(201);
    const pago = await pagar({ monto: 40_000 });
    expect(pago.status).toBe(201);
    const nancy = pago.body.data.filter((p: { proveedor: string }) => p.proveedor === 'TEST NANCY');
    expect(nancy).toEqual(expect.arrayContaining([
      expect.objectContaining({ moneda: 'BOB', comprasCredito: 100_000, pagado: 40_000, deuda: 60_000 }),
      expect.objectContaining({ moneda: 'USD', comprasCredito: 100_000, pagado: 40_000, deuda: 60_000 }),
    ]));
    expect(nancy).toHaveLength(2);
    const pagoUsd = await prisma.pagoProveedor.findFirst({ where: { proveedor: { equals: 'test nancy', mode: 'insensitive' }, moneda: 'USD' } });
    expect(pagoUsd!.caja).toBe('dolares');
    const t = await tablero();
    expect(t.deudas.proveedores.lista).toEqual(expect.arrayContaining([
      { proveedor: 'TEST NANCY', moneda: 'BOB', monto: 60_000, montoBs: 60_000 },
      { proveedor: 'TEST NANCY', moneda: 'USD', monto: 60_000, montoBs: usdABs(60_000, t.tasaCambio) },
    ]));
    expect(t.capitalDeTrabajo).toBe(t.tenes - t.deudas.total);

    // cuentas por pagar: el pago cancela primero la compra más vieja; queda lo demás con su vencimiento
    const cxp = (await request(app).get('/api/v1/dinero/cuentas-por-pagar')).body.data;
    const deNancy = cxp.items.filter((i: { acreedor: string }) => i.acreedor === 'TEST NANCY');
    expect(deNancy).toEqual([
      expect.objectContaining({ tipo: 'proveedor', moneda: 'BOB', monto: 60_000, montoBs: 60_000, vence: '2099-01-31', enlace: '/compras?tab=proveedores' }),
      expect.objectContaining({ tipo: 'proveedor', moneda: 'USD', monto: 60_000, montoBs: usdABs(60_000, cxp.tasaCambio), vence: '2099-02-28' }),
    ]);
    expect(cxp.total).toBe(cxp.items.reduce((a: number, i: { montoBs: number }) => a + i.montoBs, 0));
    expect(cxp.totalUsd).toBeGreaterThanOrEqual(60_000);
  });
});

describe('el camino de la plata', () => {
  test('lo puesto y lo que falta dependen del paso en que está el corte', async () => {
    const paso = (p: string) => request(app).patch(`/api/v1/dinero/cortes/${ids.CORTE}/paso`).send({ paso: p });
    const enCamino = async () => {
      const c = (await request(app).get('/api/v1/dinero/camino')).body.data;
      for (const p of c.pasos) {
        const x = p.cortes.find((y: { corteId: string }) => y.corteId === ids.CORTE);
        if (x) return x;
      }
      return null;
    };
    // en mesa: la costura (Bs 20.00 = 100 × 0.20) todavía falta
    expect((await paso('mesa')).status).toBe(200);
    expect(await enCamino()).toMatchObject({ paso: 'mesa', invertido: 0, falta: 2000, dias: 0, semaforo: 'ok' });
    // en lavandería la costura ya está puesta
    await paso('lavanderia');
    expect(await enCamino()).toMatchObject({ paso: 'lavanderia', invertido: 2000, falta: 0 });
    // en depósito cuenta solo lo que queda sin entregar (60 de 100)
    await paso('deposito');
    expect(await enCamino()).toMatchObject({ paso: 'deposito', prendas: 60, invertido: 1200, falta: 0, valeUsd: totalPorDocena(60, docena) });
    expect((await paso('volando')).status).toBe(400);
  });
});
