// Cuentas separadas (docs/PLAN_CUENTAS_SEPARADAS.md §2-§3): el anticipo se carga
// a una cuenta y solo descuenta de ella; cada cuenta tiene su saldo y su
// arrastre; un saldo negativo no se compensa con otra cuenta; un solo cierre de
// mes con excepciones por cuenta. Usa abril y mayo de 2033.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import type { ConsolidadoDTO, RendicionDTO } from '@taller/shared';
import { crearApp } from '../src/app.js';
import { prisma } from './helpers/db.js';
import { datosCorte } from './helpers/corte.js';
import { datosOperario } from './helpers/operario.js';
import { filaDe, saldoDe } from './helpers/cuentas.js';

const app = crearApp();
const f = (dia: number, mes = 4) =>
  `2033-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}T12:00:00.000Z`;
let opId: string;

async function limpiar() {
  await prisma.liquidacion.deleteMany({ where: { periodo: { anio: 2033 } } });
  await prisma.periodo.deleteMany({ where: { anio: 2033 } });
  const filtroModelo = { modelo: { nombre: { startsWith: 'TEST MODELO CTA' } } };
  const cortes = await prisma.corte.findMany({ where: { version: filtroModelo }, select: { id: true } });
  const corteIds = cortes.map((c) => c.id);
  await prisma.asignacion.deleteMany({ where: { corteOperacion: { corteId: { in: corteIds } } } });
  await prisma.corteOperacion.deleteMany({ where: { corteId: { in: corteIds } } });
  await prisma.corte.deleteMany({ where: { id: { in: corteIds } } });
  await prisma.operacion.deleteMany({ where: { version: filtroModelo } });
  await prisma.modeloVersion.deleteMany({ where: filtroModelo }); // moldes en cascada
  await prisma.modelo.deleteMany({ where: { nombre: { startsWith: 'TEST MODELO CTA' } } });
  const filtroOp = { operario: { nombre: { startsWith: 'TEST CTA' } } };
  await prisma.anticipo.deleteMany({ where: filtroOp });
  await prisma.operario.deleteMany({ where: { nombre: { startsWith: 'TEST CTA' } } });
}

const consolidado = async (mes = 4) =>
  (await request(app).get(`/api/v1/liquidacion?anio=2033&mes=${mes}`)).body.data as ConsolidadoDTO;
const anticipo = (monto: number, extra: Record<string, unknown> = {}) =>
  request(app).post('/api/v1/anticipos').send({ operarioId: opId, fecha: f(12), monto, ...extra });

beforeAll(async () => {
  await limpiar();
  const op = await request(app)
    .post('/api/v1/operarios')
    .send({ nombre: 'TEST CTA MARIO', ...datosOperario({ roles: ['costurero', 'moldista'] }) });
  opId = op.body.data.id;

  // moldes del 03/04 (Bs 200) y costura: corte de 100 prendas × 0.20 cerrado el 10/04
  const v = await request(app)
    .post('/api/v1/modelos')
    .send({
      nombre: 'TEST MODELO CTA',
      operaciones: [{ grupo: 'G', n: '1', equipo: 'recta', proceso: 'pinza', pieza: null, ct: 20 }],
      sinBuscador: true,
      molde: { moldistaId: opId, fecha: f(3) },
    });
  expect(v.status).toBe(201);
  const creado = await request(app)
    .post('/api/v1/cortes')
    .send({ ...(await datosCorte()), modeloVersionId: v.body.data.id, tallas: [1], cortePorTalla: [100] });
  const corte = (await request(app).post(`/api/v1/cortes/${creado.body.data.id}/abrir`)).body.data;
  await request(app)
    .put(`/api/v1/cortes/${corte.id}/operaciones/${corte.operaciones[0].id}/asignaciones`)
    .send({ asignaciones: [{ operarioId: opId, cantidad: 100 }] });
  const cierre = await request(app).post(`/api/v1/cortes/${corte.id}/cerrar`).send({ fechaCierre: f(10) });
  expect(cierre.status).toBe(200);
});

afterAll(async () => {
  await limpiar();
  await prisma.$disconnect();
});

describe('anticipos por cuenta', () => {
  test('cada anticipo solo descuenta de su cuenta; sin cuenta va a Operaciones', async () => {
    const aOperaciones = await anticipo(3000); // sin cuenta → operaciones
    expect(aOperaciones.status).toBe(201);
    expect(aOperaciones.body.data.anticipo.cuenta).toBe('operaciones');
    const aMoldes = await anticipo(5000, { cuenta: 'moldes' });
    expect(aMoldes.body.data.anticipo.cuenta).toBe('moldes');

    const c = await consolidado();
    // operaciones: 20.00 − 30.00 = −10.00; NO se compensa con los moldes
    expect(filaDe(c, opId, 'operaciones')).toMatchObject({ ganado: 2000, anticipos: 3000, saldoPeriodo: -1000 });
    expect(filaDe(c, opId, 'moldes')).toMatchObject({ ganado: 20000, anticipos: 5000, saldoPeriodo: 15000 });
  });

  test('se puede cambiar la cuenta de un anticipo del mes abierto', async () => {
    const nuevo = await anticipo(1000, { cuenta: 'moldes' });
    const id = nuevo.body.data.anticipo.id;
    const editado = await request(app).patch(`/api/v1/anticipos/${id}`).send({ cuenta: 'operaciones' });
    expect(editado.status).toBe(200);
    expect(editado.body.data.anticipo.cuenta).toBe('operaciones');
    await request(app).delete(`/api/v1/anticipos/${id}`);
  });

  test('una cuenta que no existe se rechaza', async () => {
    const res = await anticipo(1000, { cuenta: 'alimentacion' });
    expect(res.status).toBe(400);
  });
});

describe('rendición por cuenta', () => {
  test('cada cuenta con su propio saldo; los anticipos dicen de qué cuenta salieron', async () => {
    const r = (await request(app).get(`/api/v1/rendicion/${opId}?anio=2033&mes=4`)).body
      .data as RendicionDTO;
    expect(r.cuentas.map((x) => x.cuenta)).toEqual(['moldes', 'operaciones']);
    expect(saldoDe(r, 'operaciones').saldoPeriodo).toBe(-1000);
    expect(saldoDe(r, 'moldes').saldoPeriodo).toBe(15000);
    expect(r.anticipos.map((a) => [a.cuenta, a.monto]).sort()).toEqual(
      [
        ['moldes', 5000],
        ['operaciones', 3000],
      ].sort(),
    );
  });
});

describe('cierre de mes: un solo cierre, excepciones y arrastre por cuenta', () => {
  test('moldes cobra una parte y arrastra; operaciones negativa arrastra sola', async () => {
    const res = await request(app)
      .post('/api/v1/liquidacion/cerrar-mes')
      .send({
        anio: 2033,
        mes: 4,
        excepciones: [{ operarioId: opId, cuenta: 'moldes', pagado: 10000, arrastraSaldo: true }],
      });
    expect(res.status).toBe(200);
    const c = res.body.data as ConsolidadoDTO;
    expect(filaDe(c, opId, 'moldes')).toMatchObject({ pagado: 10000, saldoSalida: 5000 });
    expect(filaDe(c, opId, 'operaciones')).toMatchObject({ pagado: 0, saldoSalida: -1000 });

    // mayo arranca con cada saldo en su cuenta, sin mezclarse
    const mayo = await consolidado(5);
    expect(filaDe(mayo, opId, 'operaciones').saldoEntrada).toBe(-1000);
    expect(filaDe(mayo, opId, 'moldes').saldoEntrada).toBe(5000);
    expect(filaDe(mayo, opId, 'servicio_corte')).toBeUndefined();
  });
});
