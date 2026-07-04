// Rebanada 2 — módulo operarios: CRUD con baja lógica (CA-8.2 parcial).
// Los tests solo tocan operarios creados por ellos mismos (prefijo "TEST ")
// para no alterar el roster del seed que verifican los tests de CA-1.
import { afterAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { prisma } from './helpers/db.js';

const app = crearApp();

afterAll(async () => {
  await prisma.operario.deleteMany({ where: { nombre: { startsWith: 'TEST ' } } });
  await prisma.$disconnect();
});

async function crearOperarioTest(nombre: string, extra: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/v1/operarios')
    .send({ nombre, ...extra });
  return res;
}

describe('POST /api/v1/operarios — alta', () => {
  test('crea un operario regular activo con la forma del DTO', async () => {
    const res = await crearOperarioTest('TEST NUEVA');
    expect(res.status).toBe(201);
    const dto = res.body.data;
    expect(dto.nombre).toBe('TEST NUEVA');
    expect(dto.tipo).toBe('regular');
    expect(dto.activo).toBe(true);
    expect(dto.fechaBaja).toBeNull();
    expect(typeof dto.id).toBe('string');
    expect(new Date(dto.fechaIngreso).getTime()).not.toBeNaN();
  });

  test('acepta tipo maestro_externo', async () => {
    const res = await crearOperarioTest('TEST MAESTRO', { tipo: 'maestro_externo' });
    expect(res.status).toBe(201);
    expect(res.body.data.tipo).toBe('maestro_externo');
  });

  test('rechaza nombre vacío con error de validación', async () => {
    const res = await crearOperarioTest('   ');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDACION');
  });

  test('rechaza tipo desconocido', async () => {
    const res = await crearOperarioTest('TEST TIPO MALO', { tipo: 'gerente' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDACION');
  });
});

describe('GET /api/v1/operarios — lista y filtro', () => {
  test('por defecto lista solo activos; con estado=todos incluye inactivos', async () => {
    const alta = await crearOperarioTest('TEST DE BAJA');
    const id = alta.body.data.id;
    await request(app).patch(`/api/v1/operarios/${id}`).send({ activo: false });

    const activos = await request(app).get('/api/v1/operarios');
    expect(activos.status).toBe(200);
    const nombresActivos = activos.body.data.map((o: { nombre: string }) => o.nombre);
    expect(nombresActivos).not.toContain('TEST DE BAJA');
    expect(nombresActivos).toContain('RUBEN'); // roster del seed

    const todos = await request(app).get('/api/v1/operarios?estado=todos');
    const nombresTodos = todos.body.data.map((o: { nombre: string }) => o.nombre);
    expect(nombresTodos).toContain('TEST DE BAJA');
  });

  test('rechaza un estado de filtro inválido', async () => {
    const res = await request(app).get('/api/v1/operarios?estado=fantasma');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDACION');
  });
});

describe('PATCH /api/v1/operarios/:id — edición y baja lógica', () => {
  test('edita nombre y tipo', async () => {
    const alta = await crearOperarioTest('TEST EDITAR');
    const id = alta.body.data.id;
    const res = await request(app)
      .patch(`/api/v1/operarios/${id}`)
      .send({ nombre: 'TEST EDITADA', tipo: 'maestro_externo' });
    expect(res.status).toBe(200);
    expect(res.body.data.nombre).toBe('TEST EDITADA');
    expect(res.body.data.tipo).toBe('maestro_externo');
  });

  test('baja lógica: activo=false fija fechaBaja y conserva el registro (CA-8.2)', async () => {
    const alta = await crearOperarioTest('TEST BAJA LOGICA');
    const id = alta.body.data.id;

    const baja = await request(app).patch(`/api/v1/operarios/${id}`).send({ activo: false });
    expect(baja.status).toBe(200);
    expect(baja.body.data.activo).toBe(false);
    expect(baja.body.data.fechaBaja).not.toBeNull();

    // sigue existiendo y consultable, nunca borrado físico
    const detalle = await request(app).get(`/api/v1/operarios/${id}`);
    expect(detalle.status).toBe(200);
    expect(detalle.body.data.nombre).toBe('TEST BAJA LOGICA');
  });

  test('reactivación: activo=true limpia fechaBaja', async () => {
    const alta = await crearOperarioTest('TEST REACTIVAR');
    const id = alta.body.data.id;
    await request(app).patch(`/api/v1/operarios/${id}`).send({ activo: false });

    const reactivar = await request(app).patch(`/api/v1/operarios/${id}`).send({ activo: true });
    expect(reactivar.status).toBe(200);
    expect(reactivar.body.data.activo).toBe(true);
    expect(reactivar.body.data.fechaBaja).toBeNull();
  });

  test('PATCH vacío es error de validación', async () => {
    const alta = await crearOperarioTest('TEST PATCH VACIO');
    const res = await request(app).patch(`/api/v1/operarios/${alta.body.data.id}`).send({});
    expect(res.status).toBe(400);
  });

  test('operario inexistente responde 404', async () => {
    const res = await request(app)
      .patch('/api/v1/operarios/00000000-0000-0000-0000-000000000000')
      .send({ nombre: 'X' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NO_ENCONTRADO');
  });
});

describe('borrado físico no existe (CA-8.2)', () => {
  test('DELETE responde 404 — la baja es solo lógica', async () => {
    const alta = await crearOperarioTest('TEST SIN DELETE');
    const res = await request(app).delete(`/api/v1/operarios/${alta.body.data.id}`);
    expect(res.status).toBe(404);
  });
});
