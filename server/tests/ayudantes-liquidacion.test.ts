// Rebanada 4 de ayudantes (docs/PLAN_AYUDANTES.md §5-§7): el sueldo (por fecha
// de asistencia) y el empaque (por fechaCierre, aparte de la costura) entran a
// la liquidación y a la rendición; el cierre de mes exige la asistencia
// completa. Usa marzo de 2032 (el 1.º es lunes) para no cruzarse con otros tests.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import type { ConsolidadoDTO, LiquidacionFilaDTO, RendicionDTO } from '@taller/shared';
import { crearApp } from '../src/app.js';
import { asistenciaFaltante } from '../src/modules/asistencia/sueldoMes.js';
import { prisma } from './helpers/db.js';
import { datosCorte } from './helpers/corte.js';
import { datosOperario } from './helpers/operario.js';

const app = crearApp();
const ids: Record<string, string> = {};
const dia = (d: number) => `2032-03-${String(d).padStart(2, '0')}`;
// lunes a sábado de marzo 2032 (los domingos son 7, 14, 21 y 28): 27 días
const DIAS_HABILES = Array.from({ length: 31 }, (_, i) => i + 1).filter((d) => d % 7 !== 0);
// 25 días completos + 1 con 20 min de atraso + 1 falta:
// 40 000 × (25 × 540 + 520) ÷ 3240 = 1730.864… → Bs 1730.86
const SUELDO_MES = 173086;

async function operario(clave: string, roles: string[], extra: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/v1/operarios')
    .send({
      nombre: `TEST AYL ${clave}`,
      ...datosOperario({ roles, fechaIngreso: '2032-03-01T12:00:00.000Z', ...extra }),
    });
  expect(res.status).toBe(201);
  ids[clave] = res.body.data.id;
}

async function limpiar() {
  await prisma.liquidacion.deleteMany({ where: { periodo: { anio: 2032 } } });
  await prisma.periodo.deleteMany({ where: { anio: 2032 } });
  const filtroModelo = { modelo: { nombre: { startsWith: 'TEST MODELO AYL' } } };
  const cortes = await prisma.corte.findMany({ where: { version: filtroModelo }, select: { id: true } });
  const corteIds = cortes.map((c) => c.id);
  await prisma.asignacion.deleteMany({ where: { corteOperacion: { corteId: { in: corteIds } } } });
  await prisma.corteOperacion.deleteMany({ where: { corteId: { in: corteIds } } });
  await prisma.corte.deleteMany({ where: { id: { in: corteIds } } });
  await prisma.operacion.deleteMany({ where: { version: filtroModelo } });
  await prisma.modeloVersion.deleteMany({ where: filtroModelo });
  await prisma.modelo.deleteMany({ where: { nombre: { startsWith: 'TEST MODELO AYL' } } });
  const filtroOp = { operario: { nombre: { startsWith: 'TEST AYL' } } };
  await prisma.asistencia.deleteMany({ where: filtroOp });
  await prisma.operario.deleteMany({ where: { nombre: { startsWith: 'TEST AYL' } } });
}

const consolidado = async () =>
  (await request(app).get('/api/v1/liquidacion?anio=2032&mes=3')).body.data as ConsolidadoDTO;
const fila = (c: ConsolidadoDTO, clave: string) =>
  c.filas.find((x) => x.operarioId === ids[clave]) as LiquidacionFilaDTO;
const rendicion = async (clave: string) =>
  (await request(app).get(`/api/v1/rendicion/${ids[clave]}?anio=2032&mes=3`)).body
    .data as RendicionDTO;
const cerrarMes = () =>
  request(app).post('/api/v1/liquidacion/cerrar-mes').send({ anio: 2032, mes: 3, excepciones: [] });

beforeAll(async () => {
  await limpiar();
  await operario('AYU', ['ayudante'], { sueldoSemanal: 40000 });
  await operario('COS', ['costurero']);

  // asistencia: todos los días hábiles, luego atraso el 1.º y falta el 3
  await prisma.asistencia.createMany({
    data: DIAS_HABILES.map((d) => ({
      operarioId: ids.AYU,
      fecha: new Date(`${dia(d)}T00:00:00.000Z`),
      estado: 'trabajo' as const,
    })),
  });
  const atraso = await request(app)
    .put('/api/v1/asistencia')
    .send({ operarioId: ids.AYU, fecha: dia(1), estado: 'trabajo', minutosDescontados: 20, minutosOperaciones: 0 });
  expect(atraso.status).toBe(200);
  await request(app)
    .put('/api/v1/asistencia')
    .send({ operarioId: ids.AYU, fecha: dia(3), estado: 'falta', minutosDescontados: 0, minutosOperaciones: 0 });

  // corte de 100 prendas cerrado el 20/03: costura 0.20 (COS) y empaque 0.10 (AYU)
  const v = await request(app)
    .post('/api/v1/modelos')
    .send({
      nombre: 'TEST MODELO AYL',
      operaciones: [
        { grupo: 'G', n: '1', equipo: 'recta', proceso: 'pinza', pieza: null, ct: 20 },
        { grupo: 'EMPAQUE', n: '1', equipo: 'mesa', proceso: 'embolsado', pieza: null, ct: 10, esEmpaque: true },
      ],
    });
  const creado = await request(app)
    .post('/api/v1/cortes')
    .send({ ...(await datosCorte()), modeloVersionId: v.body.data.id, tallas: [1], cortePorTalla: [100] });
  const corte = (await request(app).post(`/api/v1/cortes/${creado.body.data.id}/abrir`)).body.data;
  const asignar = (opId: string, operarioId: string) =>
    request(app)
      .put(`/api/v1/cortes/${corte.id}/operaciones/${opId}/asignaciones`)
      .send({ asignaciones: [{ operarioId, cantidad: 100 }] });
  await asignar(corte.operaciones[0].id, ids.COS);
  await asignar(corte.operaciones[1].id, ids.AYU);
  const cierre = await request(app)
    .post(`/api/v1/cortes/${corte.id}/cerrar`)
    .send({ fechaCierre: `${dia(20)}T12:00:00.000Z` });
  expect(cierre.status).toBe(200);
});

afterAll(async () => {
  await limpiar();
  await prisma.$disconnect();
});

describe('consolidado: sueldo y empaque en columnas propias', () => {
  test('el ayudante cobra sueldo + empaque; el costurero, costura', async () => {
    const c = await consolidado();
    expect(fila(c, 'AYU').desglose).toEqual({
      sueldo: SUELDO_MES,
      costura: 0,
      empaque: 1000,
      servicioCorte: 0,
      moldes: 0,
    });
    expect(fila(c, 'AYU').ganado).toBe(SUELDO_MES + 1000);
    expect(fila(c, 'COS').desglose).toEqual({ sueldo: 0, costura: 2000, empaque: 0, servicioCorte: 0, moldes: 0 });
  });

  test('una semana completa paga exacto Bs 400 y las semanas suman el mes', async () => {
    const c = await consolidado();
    const semana = (lunes: string) => c.semanas.find((s) => s.inicioISO.startsWith(lunes))!;
    expect(semana('2032-03-08').desglose.sueldo).toBe(40000);
    expect(semana('2032-03-15').desglose.sueldo).toBe(40000);
    expect(semana('2032-03-15').desglose.empaque).toBeGreaterThanOrEqual(1000); // cierre del 20
    const sueldoSemanas = c.semanas.reduce((a, s) => a + s.desglose.sueldo, 0);
    expect(sueldoSemanas).toBe(c.totales.desglose.sueldo);
  });
});

describe('rendición', () => {
  test('el ayudante ve sus días, el sueldo y el empaque aparte de la costura', async () => {
    const r = await rendicion('AYU');
    expect(r.sueldo).toMatchObject({
      diasTrabajados: 26,
      faltas: 1,
      feriados: 0,
      minutosDescontados: 20,
      total: SUELDO_MES,
    });
    expect(r.sueldo!.dias).toHaveLength(27);
    expect(r.sueldo!.dias.reduce((a, d) => a + d.monto, 0)).toBe(SUELDO_MES);
    expect(r.cortes).toEqual([]);
    expect(r.empaque).toHaveLength(1);
    expect(r.empaque[0].operaciones[0]).toMatchObject({ proceso: 'embolsado', esEmpaque: true, total: 1000 });
    expect(r.totalGanado).toBe(SUELDO_MES + 1000);
  });

  test('privacidad: el costurero no recibe el sueldo ni el empaque del ayudante', async () => {
    const r = await rendicion('COS');
    expect(r.sueldo).toBeNull();
    expect(r.empaque).toEqual([]);
    expect(r.cortes[0].operaciones).toHaveLength(1);
    expect(JSON.stringify(r)).not.toContain(ids.AYU);
  });
});

describe('cierre de mes', () => {
  test('con un día sin marcar no cierra y dice quién y qué día', async () => {
    const fecha = new Date(`${dia(15)}T00:00:00.000Z`);
    const guardado = await prisma.asistencia.findFirstOrThrow({ where: { operarioId: ids.AYU, fecha } });
    await prisma.asistencia.delete({ where: { id: guardado.id } });
    try {
      // el aviso del inicio usa la misma cuenta, hasta el día de hoy
      expect(await asistenciaFaltante(2032, 3, dia(14))).toEqual([]);
      expect(await asistenciaFaltante(2032, 3, dia(16))).toEqual([
        { operarioId: ids.AYU, nombre: 'TEST AYL AYU', dias: [dia(15)] },
      ]);
      const res = await cerrarMes();
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ASISTENCIA_INCOMPLETA');
      expect(res.body.error.message).toContain('TEST AYL AYU (15)');
    } finally {
      await prisma.asistencia.create({
        data: { operarioId: ids.AYU, fecha, estado: 'trabajo' },
      });
    }
  });

  test('completo: guarda sueldo y empaque, y la rendición usa lo liquidado', async () => {
    const res = await cerrarMes();
    expect(res.status).toBe(200);
    const c = res.body.data as ConsolidadoDTO;
    expect(fila(c, 'AYU').desglose).toEqual({
      sueldo: SUELDO_MES,
      costura: 0,
      empaque: 1000,
      servicioCorte: 0,
      moldes: 0,
    });
    const guardada = await prisma.liquidacion.findFirstOrThrow({
      where: { operarioId: ids.AYU, periodo: { anio: 2032, mes: 3 } },
    });
    expect([guardada.totalGanado, guardada.ganadoSueldo, guardada.ganadoEmpaque]).toEqual([
      SUELDO_MES + 1000,
      SUELDO_MES,
      1000,
    ]);
    const r = await rendicion('AYU');
    expect(r.cerrado).toBe(true);
    expect(r.desglose.sueldo).toBe(SUELDO_MES);

    // mes liquidado: la asistencia de marzo ya no se toca
    const tarde = await request(app)
      .put('/api/v1/asistencia')
      .send({ operarioId: ids.AYU, fecha: dia(2), estado: 'falta', minutosDescontados: 0, minutosOperaciones: 0 });
    expect(tarde.status).toBe(409);
  });
});
