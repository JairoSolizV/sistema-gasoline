// Rebanada 5 — módulo anticipos: registro con advertencia de tope (CA-5.6),
// varios por semana (CA-5.5), histórico filtrable, editar/eliminar.
// Limpieza: se borran todos los anticipos creados (el seed no crea ninguno).
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { prisma } from './helpers/db.js';

const app = crearApp();

let rubenId: string;
let clarisId: string;

beforeAll(async () => {
  const operarios = await prisma.operario.findMany();
  rubenId = operarios.find((o) => o.nombre === 'RUBEN')!.id;
  clarisId = operarios.find((o) => o.nombre === 'CLARIS')!.id;
});

afterAll(async () => {
  await prisma.anticipo.deleteMany({});
  await prisma.$disconnect();
});

function crearAnticipo(body: Record<string, unknown>) {
  return request(app).post('/api/v1/anticipos').send(body);
}

describe('POST /api/v1/anticipos — registro', () => {
  test('guarda un anticipo con la forma del DTO y sin advertencia bajo el tope', async () => {
    const res = await crearAnticipo({ operarioId: rubenId, fecha: '2026-06-06', monto: 30000 });
    expect(res.status).toBe(201);
    expect(res.body.data.advertenciaTope).toBe(false);
    const dto = res.body.data.anticipo;
    expect(dto.operarioId).toBe(rubenId);
    expect(dto.operarioNombre).toBe('RUBEN');
    expect(dto.monto).toBe(30000);
    expect(dto.fecha).toContain('2026-06-06');
  });

  test('CA-5.6: monto 2500 con tope 2000 → guardado + advertenciaTope true (no bloquea)', async () => {
    const res = await crearAnticipo({ operarioId: rubenId, fecha: '2026-06-13', monto: 250000 });
    expect(res.status).toBe(201); // se guarda igual
    expect(res.body.data.advertenciaTope).toBe(true);
    expect(res.body.data.topeAnticipoAdvertencia).toBe(200000);

    const guardado = await prisma.anticipo.findUnique({ where: { id: res.body.data.anticipo.id } });
    expect(guardado).not.toBeNull();
    expect(guardado!.monto).toBe(250000);
  });

  test('rechaza monto 0 y operario inexistente', async () => {
    const cero = await crearAnticipo({ operarioId: rubenId, fecha: '2026-06-06', monto: 0 });
    expect(cero.status).toBe(400);

    const noExiste = await crearAnticipo({
      operarioId: '00000000-0000-0000-0000-000000000000',
      fecha: '2026-06-06',
      monto: 10000,
    });
    expect(noExiste.status).toBe(404);
  });
});

describe('CA-5.5 — varios anticipos por semana', () => {
  test('sábado 300 + emergencia miércoles 150 → ambos guardados, suman 45000 centavos', async () => {
    await crearAnticipo({ operarioId: clarisId, fecha: '2026-06-06', monto: 30000, nota: 'sábado' });
    await crearAnticipo({
      operarioId: clarisId,
      fecha: '2026-06-10',
      monto: 15000,
      nota: 'emergencia',
    });

    const res = await request(app).get(`/api/v1/anticipos?operarioId=${clarisId}`);
    expect(res.status).toBe(200);
    const deClaris = res.body.data;
    expect(deClaris).toHaveLength(2);
    const suma = deClaris.reduce((a: number, x: { monto: number }) => a + x.monto, 0);
    expect(suma).toBe(45000);
    expect(deClaris.map((x: { nota: string }) => x.nota)).toContain('emergencia');
  });
});

describe('GET /api/v1/anticipos — filtros', () => {
  test('filtra por operario y por rango de fechas', async () => {
    const soloRuben = await request(app).get(`/api/v1/anticipos?operarioId=${rubenId}`);
    expect(soloRuben.body.data.every((a: { operarioId: string }) => a.operarioId === rubenId)).toBe(
      true,
    );

    const rango = await request(app).get(
      `/api/v1/anticipos?operarioId=${rubenId}&desde=2026-06-10&hasta=2026-06-20`,
    );
    expect(rango.body.data.every((a: { fecha: string }) => a.fecha >= '2026-06-10')).toBe(true);
    // el del 06-06 quedó fuera del rango
    expect(rango.body.data.some((a: { fecha: string }) => a.fecha.startsWith('2026-06-06'))).toBe(
      false,
    );
  });

  test('lista completa ordenada por fecha descendente', async () => {
    const res = await request(app).get('/api/v1/anticipos');
    const fechas = res.body.data.map((a: { fecha: string }) => a.fecha);
    const ordenadas = [...fechas].sort((a, b) => b.localeCompare(a));
    expect(fechas).toEqual(ordenadas);
  });
});

describe('PATCH / DELETE — editar y eliminar', () => {
  test('editar el monto puede disparar la advertencia', async () => {
    const alta = await crearAnticipo({ operarioId: rubenId, fecha: '2026-07-04', monto: 10000 });
    const id = alta.body.data.anticipo.id;

    const editado = await request(app).patch(`/api/v1/anticipos/${id}`).send({ monto: 300000 });
    expect(editado.status).toBe(200);
    expect(editado.body.data.advertenciaTope).toBe(true);
    expect(editado.body.data.anticipo.monto).toBe(300000);
  });

  test('eliminar quita el anticipo', async () => {
    const alta = await crearAnticipo({ operarioId: rubenId, fecha: '2026-07-04', monto: 5000 });
    const id = alta.body.data.anticipo.id;

    const del = await request(app).delete(`/api/v1/anticipos/${id}`);
    expect(del.status).toBe(200);

    const buscar = await prisma.anticipo.findUnique({ where: { id } });
    expect(buscar).toBeNull();
  });

  test('editar/eliminar inexistente responde 404', async () => {
    const noExiste = '00000000-0000-0000-0000-000000000000';
    const patch = await request(app).patch(`/api/v1/anticipos/${noExiste}`).send({ monto: 100 });
    expect(patch.status).toBe(404);
    const del = await request(app).delete(`/api/v1/anticipos/${noExiste}`);
    expect(del.status).toBe(404);
  });
});
