// Reportes (docs/PLAN_DIDACTICO_REPORTES.md): ventas y cobros por mes, cliente y
// modelo; compras por mes (tela, costura, empaque) y proveedor; ganancia por
// modelo. Usa mayo de 2035.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { prisma } from './helpers/db.js';

const app = crearApp();
const ids: Record<string, string> = {};
const rango = 'desde=2035-04&hasta=2035-05';

async function limpiar() {
  const clientes = { cliente: { nombre: { startsWith: 'TEST REP' } } };
  await prisma.cobro.deleteMany({ where: clientes });
  await prisma.despacho.deleteMany({ where: clientes });
  await prisma.cliente.deleteMany({ where: { nombre: { startsWith: 'TEST REP' } } });
  await prisma.compraInsumo.deleteMany({ where: { insumo: { nombre: { startsWith: 'TEST REP' } } } });
  await prisma.insumo.deleteMany({ where: { nombre: { startsWith: 'TEST REP' } } });
  await prisma.fichaCosto.deleteMany({ where: { nombre: { startsWith: 'TEST REP' } } });
}

beforeAll(async () => {
  await limpiar();
  ids.CLI = (await request(app).post('/api/v1/dinero/clientes').send({ nombre: 'TEST REP CLIENTE' })).body.data.id;
  const f = await request(app)
    .post('/api/v1/costos/fichas')
    .send({ nombre: 'TEST REP JEAN', manoDeObra: 1000, servicioCorteInterno: false, margen: 0 });
  ids.FICHA = f.body.data.id;
  await request(app)
    .post('/api/v1/dinero/despachos')
    .send({ clienteId: ids.CLI, fecha: '2035-05-10', tasaCambio: 70_000, lineas: [{ fichaId: ids.FICHA, prendas: 24, precioDocenaUsd: 2500 }] });
  await request(app).post('/api/v1/dinero/cobros').send({ clienteId: ids.CLI, fecha: '2035-05-20', monto: 3000, tasaCambio: 70_000 });
  const tela = await request(app).post('/api/v1/costos/insumos').send({ nombre: 'TEST REP TELA', categoria: 'tela', unidad: 'metro' });
  const bolsa = await request(app).post('/api/v1/costos/insumos').send({ nombre: 'TEST REP BOLSA', categoria: 'bolsa', unidad: 'unidad' });
  const comprar = (insumoId: string, precioTotal: number, condicion = 'contado') =>
    request(app)
      .post('/api/v1/costos/compras')
      .send({ insumoId, fecha: '2035-05-03', tienda: 'test rep prov', cantidad: 1000, precioTotal, condicion });
  await comprar(tela.body.data.id, 50_000, 'credito');
  await comprar(bolsa.body.data.id, 3000);
});

afterAll(async () => {
  await limpiar();
  await prisma.$disconnect();
});

describe('reportes', () => {
  test('ventas: por mes (con meses vacíos), por cliente y por modelo', async () => {
    const r = (await request(app).get(`/api/v1/reportes/ventas?${rango}`)).body.data;
    expect(r.meses.map((m: { mes: string }) => m.mes)).toEqual(['2035-04', '2035-05']);
    expect(r.meses[0]).toMatchObject({ vendido: 0, cobrado: 0 });
    // 24 prendas a $us 25.00 la docena = $us 50.00 = Bs 350.00; cobrado $us 30.00 = Bs 210.00
    const mayo = r.meses[1];
    expect(mayo).toMatchObject({ prendas: 24, vendidoUsd: 5000, vendido: 35_000, cobradoUsd: 3000, cobrado: 21_000 });
    expect(mayo.ganancia).toBe(mayo.vendido - mayo.costo);
    expect(r.clientes.find((c: { id: string }) => c.id === ids.CLI)).toMatchObject({ vendidoUsd: 5000, cobradoUsd: 3000, debeHoyUsd: 2000 });
    expect(r.modelos).toContainEqual({ modelo: 'TEST REP JEAN', prendas: 24, vendidoUsd: 5000 });
  });

  test('compras: tela, insumos de empaque y proveedor (con lo comprado a crédito)', async () => {
    const r = (await request(app).get(`/api/v1/reportes/compras?${rango}`)).body.data;
    expect(r.meses[1]).toMatchObject({ tela: 50_000, insumosEmpaque: 3000 });
    expect(r.proveedores).toContainEqual({ proveedor: 'TEST REP PROV', total: 53_000, aCredito: 50_000, compras: 2 });
  });

  test('ganancia por modelo: lo vendido menos el costo de esas prendas', async () => {
    const r = (await request(app).get(`/api/v1/reportes/ganancia?${rango}`)).body.data;
    const jean = r.vendidos.find((m: { modelo: string }) => m.modelo === 'TEST REP JEAN');
    expect(jean).toMatchObject({ vendidoUsd: 5000, vendido: 35_000 });
    expect(jean.ganancia).toBe(jean.vendido - jean.costo);
    expect(jean.porPrenda).toBe(Math.round(jean.ganancia / 24));
    expect(r.fichas.some((f: { id: string }) => f.id === ids.FICHA)).toBe(true);
  });

  test('rango inválido', async () => {
    expect((await request(app).get('/api/v1/reportes/ventas?desde=2035-06&hasta=2035-05')).status).toBe(400);
  });
});
