// Rebanada 2 — módulo operarios: CRUD con baja lógica (CA-8.2 parcial),
// datos personales obligatorios en el alta y eliminación acotada.
// Los tests solo tocan operarios creados por ellos mismos (prefijo "TEST ")
// para no alterar el roster del seed que verifican los tests de CA-1.
import { afterAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { prisma } from './helpers/db.js';
import { datosOperario } from './helpers/operario.js';

const app = crearApp();

afterAll(async () => {
  await prisma.anticipo.deleteMany({ where: { operario: { nombre: { startsWith: 'TEST ' } } } });
  await prisma.operario.deleteMany({ where: { nombre: { startsWith: 'TEST ' } } });
  await prisma.$disconnect();
});

async function crearOperarioTest(nombre: string, extra: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/v1/operarios')
    .send({ nombre, ...datosOperario(), ...extra });
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

  test('guarda los datos personales normalizados; la fecha de salida es opcional', async () => {
    const res = await crearOperarioTest('TEST DATOS', {
      ci: '  4455667   lp ',
      celular: '712 345-67',
      fechaSalida: '2026-12-31T12:00:00.000Z',
    });
    expect(res.status).toBe(201);
    const dto = res.body.data;
    expect(dto.ci).toBe('4455667 LP');
    expect(dto.celular).toBe('71234567');
    expect(dto.fechaNacimiento).toBe('1990-05-15T12:00:00.000Z');
    expect(dto.fechaIngreso).toBe('2026-01-05T12:00:00.000Z');
    expect(dto.fechaSalida).toBe('2026-12-31T12:00:00.000Z');
    expect(dto.activo).toBe(true); // la salida prevista NO da de baja
    expect(dto.tieneHistorial).toBe(false);

    const sinSalida = await crearOperarioTest('TEST SIN SALIDA');
    expect(sinSalida.status).toBe(201);
    expect(sinSalida.body.data.fechaSalida).toBeNull();
  });

  test.each(['ci', 'celular', 'fechaNacimiento', 'fechaIngreso'])(
    'rechaza el alta sin %s',
    async (campo) => {
      const res = await request(app)
        .post('/api/v1/operarios')
        .send({ nombre: 'TEST FALTA DATO', ...datosOperario(), [campo]: undefined });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDACION');
      expect(res.body.error.message).toContain(campo);
    },
  );

  test('rechaza celular inválido y nacimiento futuro', async () => {
    const cel = await crearOperarioTest('TEST CEL MALO', { celular: '12ab' });
    expect(cel.status).toBe(400);
    const nac = await crearOperarioTest('TEST NAC FUTURO', { fechaNacimiento: '2999-01-01' });
    expect(nac.status).toBe(400);
  });

  test('rechaza salida anterior al ingreso', async () => {
    const res = await crearOperarioTest('TEST SALIDA ANTES', {
      fechaIngreso: '2026-06-01T12:00:00.000Z',
      fechaSalida: '2026-05-01T12:00:00.000Z',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('fechaSalida');
  });

  test('la cédula es única (409), sin importar mayúsculas/espacios', async () => {
    const a = await crearOperarioTest('TEST CI A', { ci: '8877665 SC' });
    expect(a.status).toBe(201);
    const b = await crearOperarioTest('TEST CI B', { ci: '8877665  sc' });
    expect(b.status).toBe(409);
    expect(b.body.error.code).toBe('CI_DUPLICADO');
  });
});

describe('roles y tarifas personales', () => {
  test('sin roles en el alta queda como costurero, sin tarifas personales', async () => {
    const res = await crearOperarioTest('TEST ROL DEFECTO');
    expect(res.status).toBe(201);
    expect(res.body.data.roles).toEqual(['costurero']);
    expect(res.body.data.tarifaCorte).toBeNull();
    expect(res.body.data.tarifaClasificacion).toBeNull();
  });

  test('varios roles: sin repetidos y en orden fijo; guarda tarifas personales', async () => {
    const res = await crearOperarioTest('TEST VARIOS ROLES', {
      roles: ['doblador', 'cortador', 'doblador'],
      tarifaCorte: 25,
      tarifaClasificacion: 12,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.roles).toEqual(['cortador', 'doblador']);
    expect(res.body.data.tarifaCorte).toBe(25);
    expect(res.body.data.tarifaClasificacion).toBe(12);
  });

  test('roles vacíos o desconocidos: 400', async () => {
    const vacio = await crearOperarioTest('TEST SIN ROL', { roles: [] });
    expect(vacio.status).toBe(400);
    const raro = await crearOperarioTest('TEST ROL RARO', { roles: ['bordador'] });
    expect(raro.status).toBe(400);
  });

  test('PATCH cambia roles y limpia una tarifa con null', async () => {
    const alta = await crearOperarioTest('TEST CAMBIA ROL', {
      roles: ['cortador'],
      tarifaCorte: 15,
    });
    const id = alta.body.data.id;
    const res = await request(app)
      .patch(`/api/v1/operarios/${id}`)
      .send({ roles: ['costurero', 'trazador'], tarifaCorte: null });
    expect(res.status).toBe(200);
    expect(res.body.data.roles).toEqual(['costurero', 'trazador']);
    expect(res.body.data.tarifaCorte).toBeNull();
  });

  test('GET ?rol= filtra por rol', async () => {
    await crearOperarioTest('TEST FILTRO MOLDISTA', { roles: ['moldista'] });
    const res = await request(app).get('/api/v1/operarios?rol=moldista');
    expect(res.status).toBe(200);
    const nombres = res.body.data.map((o: { nombre: string }) => o.nombre);
    expect(nombres).toContain('TEST FILTRO MOLDISTA');
    expect(
      res.body.data.every((o: { roles: string[] }) => o.roles.includes('moldista')),
    ).toBe(true);

    const malo = await request(app).get('/api/v1/operarios?rol=bordador');
    expect(malo.status).toBe(400);
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

  test('edita datos personales; null los limpia', async () => {
    const alta = await crearOperarioTest('TEST EDITAR DATOS');
    const id = alta.body.data.id;
    const res = await request(app)
      .patch(`/api/v1/operarios/${id}`)
      .send({ celular: '69998877', fechaSalida: '2026-11-30T12:00:00.000Z' });
    expect(res.status).toBe(200);
    expect(res.body.data.celular).toBe('69998877');
    expect(res.body.data.fechaSalida).toBe('2026-11-30T12:00:00.000Z');

    const limpiar = await request(app).patch(`/api/v1/operarios/${id}`).send({ fechaSalida: null });
    expect(limpiar.body.data.fechaSalida).toBeNull();
  });

  test('PATCH valida la salida contra el ingreso ya guardado', async () => {
    const alta = await crearOperarioTest('TEST PATCH SALIDA'); // ingreso 2026-01-05
    const res = await request(app)
      .patch(`/api/v1/operarios/${alta.body.data.id}`)
      .send({ fechaSalida: '2025-12-01T12:00:00.000Z' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDACION');
  });
});

describe('DELETE /api/v1/operarios/:id — solo de baja y sin historial', () => {
  test('un operario activo no se elimina (409)', async () => {
    const alta = await crearOperarioTest('TEST DEL ACTIVO');
    const res = await request(app).delete(`/api/v1/operarios/${alta.body.data.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('OPERARIO_ACTIVO');
  });

  test('de baja y sin historial: se elimina físicamente', async () => {
    const alta = await crearOperarioTest('TEST DEL OK');
    const id = alta.body.data.id;
    await request(app).patch(`/api/v1/operarios/${id}`).send({ activo: false });

    const res = await request(app).delete(`/api/v1/operarios/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.eliminado).toBe(true);
    expect((await request(app).get(`/api/v1/operarios/${id}`)).status).toBe(404);
  });

  test('CA-8.2: de baja pero con historial de pagos no se elimina (409)', async () => {
    const alta = await crearOperarioTest('TEST DEL HISTORIAL');
    const id = alta.body.data.id;
    await prisma.anticipo.create({
      data: { operarioId: id, fecha: new Date('2026-09-10T12:00:00Z'), monto: 5000 },
    });
    await request(app).patch(`/api/v1/operarios/${id}`).send({ activo: false });

    const lista = await request(app).get('/api/v1/operarios?estado=todos');
    const dto = lista.body.data.find((o: { id: string }) => o.id === id);
    expect(dto.tieneHistorial).toBe(true);

    const res = await request(app).delete(`/api/v1/operarios/${id}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CON_HISTORIAL');
    // el histórico sigue intacto y consultable
    expect((await request(app).get(`/api/v1/operarios/${id}`)).status).toBe(200);
    expect(await prisma.anticipo.count({ where: { operarioId: id } })).toBe(1);
  });

  test('inexistente responde 404', async () => {
    const res = await request(app).delete('/api/v1/operarios/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});

// ── Ayudantes: sueldo semanal con historial (docs/PLAN_AYUDANTES.md) ──
describe('ayudantes: sueldo semanal', () => {
  const ayudante = (nombre: string, extra: Record<string, unknown> = {}) =>
    crearOperarioTest(nombre, { roles: ['ayudante'], sueldoSemanal: 40000, ...extra });

  test('alta de ayudante: el sueldo es obligatorio y rige desde su ingreso', async () => {
    const sin = await crearOperarioTest('TEST AYU SIN', { roles: ['ayudante'] });
    expect(sin.status).toBe(400);
    expect(sin.body.error.message).toContain('sueldoSemanal');

    const res = await ayudante('TEST AYU ALTA'); // ingreso 2026-01-05 (datosOperario)
    expect(res.status).toBe(201);
    expect(res.body.data.roles).toEqual(['ayudante']);
    expect(res.body.data.sueldos).toEqual([
      { id: expect.any(String), montoSemanal: 40000, vigenteDesde: '2026-01-05' },
    ]);
    expect(res.body.data.sueldoVigente).toBe(40000);
  });

  test('el sueldo se ajusta: el vigente es el último que ya empezó a regir', async () => {
    const alta = await ayudante('TEST AYU AJUSTE');
    const id = alta.body.data.id;

    const futuro = await request(app)
      .post(`/api/v1/operarios/${id}/sueldos`)
      .send({ montoSemanal: 60000, vigenteDesde: '2099-01-01' });
    expect(futuro.status).toBe(200);
    expect(futuro.body.data.sueldoVigente).toBe(40000); // todavía no rige

    const subida = await request(app)
      .post(`/api/v1/operarios/${id}/sueldos`)
      .send({ montoSemanal: 45000, vigenteDesde: '2026-02-01' });
    expect(subida.body.data.sueldoVigente).toBe(45000);
    expect(subida.body.data.sueldos.map((s: { vigenteDesde: string }) => s.vigenteDesde)).toEqual([
      '2099-01-01',
      '2026-02-01',
      '2026-01-05',
    ]);

    // misma fecha: reemplaza, no duplica
    const corregido = await request(app)
      .post(`/api/v1/operarios/${id}/sueldos`)
      .send({ montoSemanal: 50000, vigenteDesde: '2026-02-01' });
    expect(corregido.body.data.sueldos).toHaveLength(3);
    expect(corregido.body.data.sueldoVigente).toBe(50000);
  });

  test('validaciones: rol ayudante, fecha real, monto > 0', async () => {
    const costurero = await crearOperarioTest('TEST AYU NO ES');
    const sinRol = await request(app)
      .post(`/api/v1/operarios/${costurero.body.data.id}/sueldos`)
      .send({ montoSemanal: 40000, vigenteDesde: '2026-02-01' });
    expect(sinRol.status).toBe(409);

    const alta = await ayudante('TEST AYU VALID');
    const id = alta.body.data.id;
    const fechaFalsa = await request(app)
      .post(`/api/v1/operarios/${id}/sueldos`)
      .send({ montoSemanal: 40000, vigenteDesde: '2026-02-30' });
    expect(fechaFalsa.status).toBe(400);
    const cero = await request(app)
      .post(`/api/v1/operarios/${id}/sueldos`)
      .send({ montoSemanal: 0, vigenteDesde: '2026-02-01' });
    expect(cero.status).toBe(400);
  });

  test('quitar un sueldo: nunca el único; desde un mes liquidado no', async () => {
    const alta = await ayudante('TEST AYU QUITAR');
    const id = alta.body.data.id;
    const unico = alta.body.data.sueldos[0].id;
    const solo = await request(app).delete(`/api/v1/operarios/${id}/sueldos/${unico}`);
    expect(solo.status).toBe(409);
    expect(solo.body.error.code).toBe('SUELDO_UNICO');

    const otro = await request(app)
      .post(`/api/v1/operarios/${id}/sueldos`)
      .send({ montoSemanal: 45000, vigenteDesde: '2026-03-01' });
    const nuevoId = otro.body.data.sueldos[0].id;
    const ok = await request(app).delete(`/api/v1/operarios/${id}/sueldos/${nuevoId}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.sueldos).toHaveLength(1);

    const periodo = await prisma.periodo.create({
      data: { anio: 2020, mes: 1, estado: 'cerrado', fechaCierre: new Date('2020-02-01T12:00:00Z') },
    });
    try {
      const viejo = await request(app)
        .post(`/api/v1/operarios/${id}/sueldos`)
        .send({ montoSemanal: 30000, vigenteDesde: '2020-01-10' });
      expect(viejo.status).toBe(409);
      expect(viejo.body.error.code).toBe('MES_LIQUIDADO');
    } finally {
      await prisma.periodo.delete({ where: { id: periodo.id } });
    }
  });

  test('un ayudante de baja sin historial se elimina junto con su sueldo', async () => {
    const alta = await ayudante('TEST AYU BORRAR');
    const id = alta.body.data.id;
    await request(app).patch(`/api/v1/operarios/${id}`).send({ activo: false });
    const res = await request(app).delete(`/api/v1/operarios/${id}`);
    expect(res.status).toBe(200);
    expect(await prisma.sueldoAyudante.count({ where: { operarioId: id } })).toBe(0);
  });
});
