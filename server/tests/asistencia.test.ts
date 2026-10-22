// Rebanada 2 de ayudantes (docs/PLAN_AYUDANTES.md): asistencia diaria y sueldo
// semanal calculado. Semana del lunes 19 al sábado 24 de octubre de 2026,
// sueldo Bs 400 (40 000 centavos).
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import type { AsistenciaAyudanteDTO, SemanaAsistenciaDTO } from '@taller/shared';
import { crearApp } from '../src/app.js';
import { prisma } from './helpers/db.js';
import { datosOperario } from './helpers/operario.js';

const app = crearApp();
const LUNES = '2026-10-19';
const DIAS = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24'];

async function ayudante(nombre: string, extra: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/v1/operarios')
    .send({ nombre, ...datosOperario({ roles: ['ayudante'], sueldoSemanal: 40000, ...extra }) });
  expect(res.status).toBe(201);
  return res.body.data.id as string;
}

async function limpiar() {
  const filtro = { operario: { nombre: { startsWith: 'TEST ASIS' } } };
  await prisma.asistencia.deleteMany({ where: filtro });
  await prisma.operario.deleteMany({ where: { nombre: { startsWith: 'TEST ASIS' } } }); // sueldos en cascada
}

const semana = async (lunes = LUNES) =>
  (await request(app).get(`/api/v1/asistencia/semana?lunes=${lunes}`)).body.data as SemanaAsistenciaDTO;
const fila = (s: SemanaAsistenciaDTO, id: string) =>
  s.ayudantes.find((a) => a.operarioId === id) as AsistenciaAyudanteDTO;
const marcar = (body: Record<string, unknown>) => request(app).put('/api/v1/asistencia').send(body);

beforeAll(limpiar);
afterAll(async () => {
  await limpiar();
  await prisma.$disconnect();
});

describe('grilla semanal y sueldo', () => {
  let id: string;
  beforeAll(async () => {
    id = await ayudante('TEST ASIS JUAN');
  });

  test('semana sin marcar: 6 días hábiles, Bs 0', async () => {
    const f = fila(await semana(), id);
    expect(f.dias.map((d) => d.fecha)).toEqual(DIAS);
    expect(f.dias.every((d) => d.habil && d.estado === null)).toBe(true);
    expect(f.diasSinMarcar).toBe(6);
    expect(f.totalSemana).toBe(0);
  });

  test('"marcar todos presentes" día por día → semana completa = 400.00 exactos', async () => {
    for (const fecha of DIAS) {
      const r = await request(app).post('/api/v1/asistencia/presentes').send({ fecha });
      expect(r.status).toBe(200);
    }
    const f = fila(await semana(), id);
    expect(f.totalSemana).toBe(40000);
    expect(f.dias.map((d) => d.monto)).toEqual([6667, 6667, 6667, 6667, 6666, 6666]);
    expect(f.diasSinMarcar).toBe(0);
  });

  test('falta el miércoles → 333.33; además llegó 8:20 el lunes → 330.86', async () => {
    let r = await marcar({ operarioId: id, fecha: '2026-10-21', estado: 'falta' });
    expect(r.status).toBe(200);
    expect(fila(r.body.data, id).totalSemana).toBe(33333);

    r = await marcar({ operarioId: id, fecha: '2026-10-19', estado: 'trabajo', minutosDescontados: 20 });
    const f = fila(r.body.data, id);
    expect(f.totalSemana).toBe(33086); // 40 000 × 2680 / 3240
    expect(f.dias[2]).toMatchObject({ estado: 'falta', minutosPagados: 0, monto: 0 });
  });

  test('una tarde en operaciones (5 h) se descuenta del sueldo', async () => {
    await marcar({ operarioId: id, fecha: '2026-10-19', estado: 'trabajo' });
    await marcar({ operarioId: id, fecha: '2026-10-21', estado: 'trabajo' });
    const r = await marcar({
      operarioId: id,
      fecha: '2026-10-22',
      estado: 'trabajo',
      minutosOperaciones: 300,
      nota: 'tarde: embolsado',
    });
    const f = fila(r.body.data, id);
    expect(f.totalSemana).toBe(36296);
    expect(f.dias[3]).toMatchObject({ minutosOperaciones: 300, minutosPagados: 240, nota: 'tarde: embolsado' });
  });

  test('"marcar presentes" no pisa un día ya marcado', async () => {
    await marcar({ operarioId: id, fecha: '2026-10-23', estado: 'feriado' });
    await request(app).post('/api/v1/asistencia/presentes').send({ fecha: '2026-10-23' });
    expect(fila(await semana(), id).dias[4].estado).toBe('feriado');
  });

  test('desmarcar un día lo deja sin marcar; la segunda vez 404', async () => {
    const r = await request(app).delete(`/api/v1/asistencia?operarioId=${id}&fecha=2026-10-24`);
    expect(r.status).toBe(200);
    expect(fila(r.body.data, id).dias[5].estado).toBeNull();
    const otra = await request(app).delete(`/api/v1/asistencia?operarioId=${id}&fecha=2026-10-24`);
    expect(otra.status).toBe(404);
  });
});

describe('sueldo que cambia a mitad de semana', () => {
  test('400 hasta el miércoles y 450 desde el jueves → semana completa 425.00', async () => {
    const id = await ayudante('TEST ASIS AJUSTE');
    await request(app)
      .post(`/api/v1/operarios/${id}/sueldos`)
      .send({ montoSemanal: 45000, vigenteDesde: '2026-10-22' });
    for (const fecha of DIAS) await marcar({ operarioId: id, fecha, estado: 'trabajo' });
    const f = fila(await semana(), id);
    expect(f.dias.map((d) => d.sueldoSemanal)).toEqual([40000, 40000, 40000, 45000, 45000, 45000]);
    expect(f.totalSemana).toBe(42500);
  });
});

describe('validaciones', () => {
  let id: string;
  beforeAll(async () => {
    id = await ayudante('TEST ASIS VALID');
  });

  test('domingo, antes del ingreso y fecha inválida: 400', async () => {
    expect((await marcar({ operarioId: id, fecha: '2026-10-25', estado: 'trabajo' })).status).toBe(400);
    expect((await marcar({ operarioId: id, fecha: '2025-12-01', estado: 'trabajo' })).status).toBe(400);
    expect((await marcar({ operarioId: id, fecha: '2026-02-30', estado: 'trabajo' })).status).toBe(400);
    const semanaMal = await request(app).get('/api/v1/asistencia/semana?lunes=2026-10-21');
    expect(semanaMal.status).toBe(400); // no es lunes
  });

  test('minutos: más que la jornada, o con falta/feriado: 400', async () => {
    const pasado = await marcar({
      operarioId: id,
      fecha: LUNES,
      estado: 'trabajo',
      minutosDescontados: 300,
      minutosOperaciones: 300,
    });
    expect(pasado.status).toBe(400);
    const faltaConMinutos = await marcar({
      operarioId: id,
      fecha: LUNES,
      estado: 'falta',
      minutosDescontados: 30,
    });
    expect(faltaConMinutos.status).toBe(400);
  });

  test('solo ayudantes: un costurero → 409 OPERARIO_SIN_ROL', async () => {
    const costurero = await request(app)
      .post('/api/v1/operarios')
      .send({ nombre: 'TEST ASIS COSTURERO', ...datosOperario() });
    const r = await marcar({ operarioId: costurero.body.data.id, fecha: LUNES, estado: 'trabajo' });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('OPERARIO_SIN_ROL');
  });

  test('sin sueldo vigente ese día → 409 SIN_SUELDO', async () => {
    // ingresa en enero pero su primer sueldo rige recién desde noviembre
    const otro = await ayudante('TEST ASIS SIN SUELDO');
    const sueldos = await prisma.sueldoAyudante.findMany({ where: { operarioId: otro } });
    await prisma.sueldoAyudante.update({
      where: { id: sueldos[0].id },
      data: { vigenteDesde: new Date('2026-11-02T00:00:00Z') },
    });
    const r = await marcar({ operarioId: otro, fecha: LUNES, estado: 'trabajo' });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('SIN_SUELDO');
  });

  test('mes liquidado → 409 MES_LIQUIDADO', async () => {
    const viejo = await ayudante('TEST ASIS VIEJO', { fechaIngreso: '2019-06-03T12:00:00.000Z' });
    const periodo = await prisma.periodo.create({
      data: { anio: 2020, mes: 1, estado: 'cerrado', fechaCierre: new Date('2020-02-01T12:00:00Z') },
    });
    try {
      const r = await marcar({ operarioId: viejo, fecha: '2020-01-13', estado: 'trabajo' }); // lunes
      expect(r.status).toBe(409);
      expect(r.body.error.code).toBe('MES_LIQUIDADO');
      const s = await semana('2020-01-13');
      expect(fila(s, viejo).dias.every((d) => d.bloqueado)).toBe(true);
    } finally {
      await prisma.periodo.delete({ where: { id: periodo.id } });
    }
  });

  test('con días marcados el ayudante es historial: no se puede eliminar', async () => {
    await marcar({ operarioId: id, fecha: LUNES, estado: 'trabajo' });
    await request(app).patch(`/api/v1/operarios/${id}`).send({ activo: false });
    const r = await request(app).delete(`/api/v1/operarios/${id}`);
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('CON_HISTORIAL');
  });
});
