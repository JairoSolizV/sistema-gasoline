// Costos fijos del taller (docs/PLAN_COSTOS.md §7c): parte del taller de cada
// gasto (compartido con la casa), comida por compras (promedio de los meses
// anteriores para las fichas), cuota completa del préstamo, costo fijo por
// prenda ÷ 1500 en las fichas, tabla 1500/2000/3000/4000 y aviso de cuota.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import type { CostosFijosMesDTO } from '@taller/shared';
import { crearApp } from '../src/app.js';
import { hoyEnBolivia } from '../src/lib/hoy.js';
import { fijosService } from '../src/modules/costos/fijos.js';
import { prisma } from './helpers/db.js';

const app = crearApp();
const ids: Record<string, string> = {};
const hoy = hoyEnBolivia();
const [anio, mes] = hoy.split('-').map(Number);
/** El día 10 de hace `n` meses ('aaaa-mm-dd'). */
const haceMeses = (n: number) => {
  const d = new Date(Date.UTC(anio, mes - 1 - n, 10));
  return d.toISOString().slice(0, 10);
};

async function limpiar() {
  await prisma.fichaCosto.deleteMany({ where: { nombre: { startsWith: 'TEST FICHA FIJO' } } });
  await prisma.gastoFijo.deleteMany({ where: { nombre: { startsWith: 'TEST FIJO' } } });
  await prisma.prestamo.deleteMany({ where: { banco: { startsWith: 'TEST' } } });
}
const fijosDelMes = async () =>
  (await request(app).get(`/api/v1/costos/fijos?anio=${anio}&mes=${mes}`)).body.data as CostosFijosMesDTO;
const gasto = (d: CostosFijosMesDTO, nombre: string) => d.gastos.find((g) => g.nombre === nombre)!;

beforeAll(async () => {
  await limpiar();
  const crear = (body: Record<string, unknown>) => request(app).post('/api/v1/costos/fijos/gastos').send(body);
  expect(
    (await crear({ nombre: 'TEST FIJO Sueldo dueños', grupo: 'personal', monto: 1_402_500, vigenteDesde: '2026-01-01' }))
      .status,
  ).toBe(201);
  // CRE: mismo medidor que la casa → 85 % del taller
  await crear({ nombre: 'TEST FIJO CRE', grupo: 'servicios', monto: 125_000, vigenteDesde: '2026-01-01', porcentajeTaller: 8500 });
  // comida: por compras, 60 % del taller
  await crear({ nombre: 'TEST FIJO Comida', grupo: 'personal', tipo: 'por_compras', porcentajeTaller: 6000 });
  const d = await fijosDelMes();
  ids.SUELDO = gasto(d, 'TEST FIJO Sueldo dueños').id;
  ids.CRE = gasto(d, 'TEST FIJO CRE').id;
  ids.COMIDA = gasto(d, 'TEST FIJO Comida').id;
  const comprar = (fecha: string, monto: number) =>
    request(app).post(`/api/v1/costos/fijos/gastos/${ids.COMIDA}/compras`).send({ fecha, monto, nota: 'verduras' });
  await comprar(haceMeses(1), 100_000); // mes pasado: 1000 + 500
  await comprar(haceMeses(1), 50_000);
  await comprar(haceMeses(2), 90_000); // hace dos meses: 900
  await comprar(hoy, 30_000); // este mes: 300
  // FIE: cuota completa, vence hoy
  await request(app)
    .post('/api/v1/costos/fijos/prestamos')
    .send({ banco: 'TEST FIE', cuota: 1_050_000, diaVencimiento: Number(hoy.slice(8, 10)) });
});

afterAll(async () => {
  await limpiar();
  await prisma.$disconnect();
});

describe('costos fijos del mes', () => {
  test('cada gasto cuenta su parte del taller; el préstamo, la cuota completa', async () => {
    const d = await fijosDelMes();
    expect(gasto(d, 'TEST FIJO Sueldo dueños')).toMatchObject({ base: 1_402_500, parteTaller: 1_402_500 });
    expect(gasto(d, 'TEST FIJO CRE')).toMatchObject({ base: 125_000, parteTaller: 106_250 }); // 85 %
    expect(gasto(d, 'TEST FIJO Comida')).toMatchObject({ base: 30_000, parteTaller: 18_000 }); // 60 % de 300
    expect(gasto(d, 'TEST FIJO Comida').compras).toHaveLength(1);
    expect(d.totalGastos).toBe(1_402_500 + 106_250 + 18_000);
    expect(d.totalDeuda).toBe(1_050_000);
    expect(d.total).toBe(1_526_750 + 1_050_000);
  });

  test('presupuesto para las fichas: comida = promedio de los meses anteriores; ÷ 1500 prendas', async () => {
    const d = await fijosDelMes();
    // 14 025 + 1 062.50 + 60 % × (1500 + 900) / 2 + 10 500 = 26 307.50
    expect(d.presupuestoMensual).toBe(2_630_750);
    expect(d.prendasReferencia).toBe(1500);
    expect(d.porPrendaFicha).toBe(1754); // 17.5383…
    expect(d.simulacion).toEqual([
      { prendas: 1500, porPrenda: 1754 },
      { prendas: 2000, porPrenda: 1315 },
      { prendas: 3000, porPrenda: 877 },
      { prendas: 4000, porPrenda: 658 },
    ]);
  });

  test('un monto nuevo que rige más adelante no cambia el de hoy', async () => {
    const res = await request(app)
      .post(`/api/v1/costos/fijos/gastos/${ids.CRE}/montos`)
      .send({ monto: 150_000, vigenteDesde: '2099-01-01' });
    expect(res.status).toBe(200);
    expect(gasto(await fijosDelMes(), 'TEST FIJO CRE').base).toBe(125_000);
  });

  test('las fichas suman el costo fijo por prenda (exacto, redondeado una vez)', async () => {
    const res = await request(app)
      .post('/api/v1/costos/fichas')
      .send({ nombre: 'TEST FICHA FIJO', manoDeObra: 1000, servicioCorteInterno: false, margen: 0 });
    expect(res.body.data).toMatchObject({ costoFijo: 1754, total: 2754 }); // 10.00 + 17.5383 = 27.5383
  });
});

describe('préstamo', () => {
  test('la cuota que vence hoy avisa hasta que se marca pagada', async () => {
    const antes = await fijosService.cuotasPorVencer();
    expect(antes.find((c) => c.banco === 'TEST FIE')).toMatchObject({ vence: hoy, vencida: false });
    const p = (await fijosDelMes()).prestamos.find((x) => x.banco === 'TEST FIE')!;
    const pago = await request(app)
      .put(`/api/v1/costos/fijos/prestamos/${p.id}/pagos`)
      .send({ anio, mes, fecha: hoy, monto: 1_050_000 });
    expect(pago.status).toBe(200);
    expect((await fijosService.cuotasPorVencer()).find((c) => c.banco === 'TEST FIE')).toBeUndefined();
    expect((await fijosDelMes()).prestamos.find((x) => x.id === p.id)!.pago).toEqual({ fecha: hoy, monto: 1_050_000 });
  });
});

describe('validaciones', () => {
  test('compras solo en gastos por compras, montos solo en mensuales, nombre único', async () => {
    const compra = await request(app)
      .post(`/api/v1/costos/fijos/gastos/${ids.CRE}/compras`)
      .send({ fecha: hoy, monto: 100 });
    expect(compra.status).toBe(400);
    const monto = await request(app)
      .post(`/api/v1/costos/fijos/gastos/${ids.COMIDA}/montos`)
      .send({ monto: 100, vigenteDesde: hoy });
    expect(monto.status).toBe(400);
    const repetido = await request(app)
      .post('/api/v1/costos/fijos/gastos')
      .send({ nombre: 'TEST FIJO CRE', grupo: 'servicios', monto: 1, vigenteDesde: hoy });
    expect(repetido.status).toBe(409);
  });
});
