// Caja (docs/PLAN_CAJA.md): efectivo y banco con inicio y saldo inicial; lo
// registrado en otras pantallas entra solo (cobros, compras al contado, pagos
// a proveedores, anticipos); gastos a mano por categoría; transferencias,
// arqueo con su diferencia y cambio de caja. Usa marzo de 2035.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import type { CajaMesDTO } from '@taller/shared';
import { crearApp } from '../src/app.js';
import { prisma } from './helpers/db.js';
import { datosOperario } from './helpers/operario.js';

const app = crearApp();
const ids: Record<string, string> = {};
const dia = (d: number) => `2035-03-${String(d).padStart(2, '0')}`;

async function limpiar() {
  const enMarzo = { gte: new Date('2035-02-25'), lt: new Date('2035-04-05') };
  await prisma.movimientoCaja.deleteMany({ where: { fecha: enMarzo } });
  await prisma.arqueoCaja.deleteMany({ where: { fecha: enMarzo } });
  await prisma.cajaInicio.deleteMany({});
  await prisma.categoriaCaja.deleteMany({ where: { nombre: { startsWith: 'TEST' } } });
  await prisma.cobro.deleteMany({ where: { cliente: { nombre: { startsWith: 'TEST CLI CAJA' } } } });
  await prisma.cliente.deleteMany({ where: { nombre: { startsWith: 'TEST CLI CAJA' } } });
  await prisma.pagoProveedor.deleteMany({ where: { proveedor: 'TEST CAJA PROV' } });
  await prisma.compraInsumo.deleteMany({ where: { insumo: { nombre: 'TEST INS CAJA' } } });
  await prisma.insumo.deleteMany({ where: { nombre: 'TEST INS CAJA' } });
  await prisma.anticipo.deleteMany({ where: { operario: { nombre: 'TEST CAJA OPERARIO' } } });
  await prisma.operario.deleteMany({ where: { nombre: 'TEST CAJA OPERARIO' } });
}

const caja = async () => (await request(app).get('/api/v1/caja?anio=2035&mes=3')).body.data as CajaMesDTO;
const resumen = (d: CajaMesDTO, c: 'efectivo' | 'banco') => d.cajas.find((x) => x.caja === c)!;
const categoria = (d: CajaMesDTO, clave: string) => d.categorias.find((c) => c.clave === clave)!;
const mover = (body: Record<string, unknown>) => request(app).post('/api/v1/caja/movimientos').send(body);

beforeAll(async () => {
  await limpiar();
  await request(app).put('/api/v1/caja/inicio/efectivo').send({ desde: dia(1), saldoInicial: 100_000 });
  await request(app).put('/api/v1/caja/inicio/banco').send({ desde: dia(1), saldoInicial: 0 });
  const cli = await request(app).post('/api/v1/dinero/clientes').send({ nombre: 'TEST CLI CAJA' });
  ids.CLI = cli.body.data.id;
  const ins = await request(app).post('/api/v1/costos/insumos').send({ nombre: 'TEST INS CAJA', categoria: 'tela', unidad: 'metro' });
  ids.INS = ins.body.data.id;
});

afterAll(async () => {
  await limpiar();
  await prisma.$disconnect();
});

describe('lo registrado entra solo y lo demás se anota a mano', () => {
  test('cobros, compras al contado (no a crédito), pagos a proveedores, gastos y transferencias', async () => {
    const cobro = await request(app).post('/api/v1/dinero/cobros').send({ clienteId: ids.CLI, fecha: dia(5), monto: 50_000 });
    ids.COBRO = cobro.body.data.id;
    await request(app).post('/api/v1/dinero/cobros').send({ clienteId: ids.CLI, fecha: dia(6), monto: 20_000, caja: 'banco' });
    const comprar = (condicion: string, precioTotal: number) =>
      request(app)
        .post('/api/v1/costos/compras')
        .send({ insumoId: ids.INS, fecha: dia(7), tienda: 'TEST CAJA PROV', cantidad: 1000, precioTotal, condicion });
    ids.COMPRA = (await comprar('contado', 30_000)).body.data.id;
    await comprar('credito', 40_000); // a crédito: no sale plata
    await request(app).post('/api/v1/dinero/proveedores/pagos').send({ proveedor: 'TEST CAJA PROV', fecha: dia(8), monto: 10_000 });

    const d0 = await caja();
    const luz = await mover({
      tipo: 'egreso',
      caja: 'efectivo',
      fecha: dia(9),
      monto: 12_500,
      categoriaId: categoria(d0, 'servicios_basicos').id,
      descripcion: 'Luz CRE',
    });
    expect(luz.status).toBe(201);
    expect((await mover({ tipo: 'transferencia', caja: 'efectivo', cajaDestino: 'banco', fecha: dia(10), monto: 20_000, descripcion: 'Depósito' })).status).toBe(201);

    const d = await caja();
    // 100 000 + 50 000 − 30 000 − 10 000 − 12 500 − 20 000
    expect(resumen(d, 'efectivo')).toMatchObject({ saldoInicioMes: 100_000, ingresos: 50_000, egresos: 72_500, saldoFinal: 77_500 });
    expect(resumen(d, 'banco')).toMatchObject({ ingresos: 40_000, egresos: 0, saldoFinal: 40_000 });
    const monto = (clave: string) => d.porCategoria.find((p) => p.categoria.id === categoria(d, clave).id)?.monto;
    expect(monto('cobros')).toBe(70_000);
    expect(monto('insumos')).toBe(40_000);
    expect(monto('servicios_basicos')).toBe(12_500);
  });

  test('los anticipos salen de la caja como gasto de operarios', async () => {
    const op = await request(app).post('/api/v1/operarios').send({ nombre: 'TEST CAJA OPERARIO', ...datosOperario() });
    const ant = await request(app)
      .post('/api/v1/anticipos')
      .send({ operarioId: op.body.data.id, fecha: `${dia(11)}T15:00:00.000Z`, monto: 40_000 });
    expect(ant.status).toBe(201);
    const d = await caja();
    const m = d.movimientos.find((x) => x.origen === 'anticipo');
    expect(m).toMatchObject({ caja: 'efectivo', tipo: 'egreso', monto: 40_000, fecha: dia(11) });
    expect(m!.categoria!.id).toBe(categoria(d, 'operarios').id);
    expect(resumen(d, 'efectivo').saldoFinal).toBe(37_500);
  });

  test('validaciones: antes del inicio, categoría de otro tipo, categoría del sistema', async () => {
    const d = await caja();
    const antes = await mover({ tipo: 'egreso', caja: 'efectivo', fecha: '2035-02-28', monto: 1, categoriaId: categoria(d, 'transporte').id, descripcion: 'x' });
    expect(antes.status).toBe(400);
    const tipo = await mover({ tipo: 'egreso', caja: 'efectivo', fecha: dia(9), monto: 1, categoriaId: categoria(d, 'cobros').id, descripcion: 'x' });
    expect(tipo.status).toBe(400);
    const desactivar = await request(app).patch(`/api/v1/caja/categorias/${categoria(d, 'insumos').id}`).send({ activo: false });
    expect(desactivar.status).toBe(409);
    const nueva = await request(app).post('/api/v1/caja/categorias').send({ nombre: 'TEST Fotocopias', tipo: 'egreso' });
    expect(nueva.status).toBe(201);
    expect((await request(app).patch(`/api/v1/caja/categorias/${nueva.body.data.id}`).send({ activo: false })).body.data.activo).toBe(false);
  });
});

describe('arqueo y cambio de caja', () => {
  test('el arqueo guarda la diferencia como sobrante o faltante', async () => {
    const res = await request(app).post('/api/v1/caja/arqueos').send({ caja: 'efectivo', fecha: dia(11), contado: 37_000 });
    expect(res.body.data).toEqual({ sistema: 37_500, diferencia: -500 });
    const d = await caja();
    expect(resumen(d, 'efectivo')).toMatchObject({ ajustes: -500, saldoFinal: 37_000, ultimoArqueo: { contado: 37_000, diferencia: -500 } });
    expect(d.movimientos.find((m) => m.origen === 'arqueo')).toMatchObject({ tipo: 'egreso', monto: 500 });
  });

  test('un cobro que entró por QR se pasa al banco desde la caja', async () => {
    const res = await request(app).patch(`/api/v1/caja/origen/cobro/${ids.COBRO}`).send({ caja: 'banco' });
    expect(res.status).toBe(200);
    const d = await caja();
    expect(resumen(d, 'efectivo').saldoFinal).toBe(37_000 - 50_000);
    expect(resumen(d, 'banco').saldoFinal).toBe(90_000);
  });

  test('una compra que en realidad fue a crédito se corrige y sale de la caja', async () => {
    const res = await request(app).patch(`/api/v1/costos/compras/${ids.COMPRA}`).send({ condicion: 'credito', tienda: 'TEST CAJA PROV' });
    expect(res.body.data).toMatchObject({ condicion: 'credito', precioTotal: 30_000 });
    expect(resumen(await caja(), 'efectivo').saldoFinal).toBe(37_000 - 50_000 + 30_000);
    const prov = (await request(app).get('/api/v1/dinero/proveedores')).body.data.find((p: { proveedor: string }) => p.proveedor === 'TEST CAJA PROV');
    expect(prov).toMatchObject({ comprasCredito: 70_000, pagado: 10_000, deuda: 60_000 });
  });
});
