// Rebanada 8 — configuración: GET/PATCH y CA-4.3 (el diferencial editable
// afecta asignaciones NUEVAS; las guardadas conservan su tarifa).
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { prisma } from './helpers/db.js';

const app = crearApp();

let versionId: string;
let rubenId: string;

async function limpiar() {
  await prisma.asignacion.deleteMany({ where: { corteOperacion: { corte: { version: { modelo: { nombre: 'TEST MODELO CFG' } } } } } });
  const cortes = await prisma.corte.findMany({
    where: { version: { modelo: { nombre: 'TEST MODELO CFG' } } },
    select: { id: true },
  });
  await prisma.corteOperacion.deleteMany({ where: { corteId: { in: cortes.map((c) => c.id) } } });
  await prisma.corte.deleteMany({ where: { id: { in: cortes.map((c) => c.id) } } });
  await prisma.operacion.deleteMany({ where: { version: { modelo: { nombre: 'TEST MODELO CFG' } } } });
  await prisma.modeloVersion.deleteMany({ where: { modelo: { nombre: 'TEST MODELO CFG' } } });
  await prisma.modelo.deleteMany({ where: { nombre: 'TEST MODELO CFG' } });
}

beforeAll(async () => {
  await limpiar();
  rubenId = (await prisma.operario.findFirst({ where: { nombre: 'RUBEN' } }))!.id;
  const modelo = await request(app)
    .post('/api/v1/modelos')
    .send({
      nombre: 'TEST MODELO CFG',
      operaciones: [{ grupo: 'G', n: '1', equipo: 'over', proceso: 'ensamble', pieza: null, ct: 20 }],
    });
  versionId = modelo.body.data.id;
});

afterEach(async () => {
  // dejar el diferencial en su valor por defecto (10) para no afectar otros tests
  await prisma.configuracion.update({
    where: { id: 1 },
    data: { diferencialMaestroExterno: 10, topeAnticipoAdvertencia: 200000 },
  });
});

afterAll(async () => {
  await limpiar();
  await prisma.$disconnect();
});

describe('GET / PATCH /api/v1/configuracion', () => {
  test('devuelve los valores del seed y permite editarlos', async () => {
    const get = await request(app).get('/api/v1/configuracion');
    expect(get.status).toBe(200);
    expect(get.body.data.topeAnticipoAdvertencia).toBe(200000);
    expect(get.body.data.diferencialMaestroExterno).toBe(10);

    const patch = await request(app)
      .patch('/api/v1/configuracion')
      .send({ nombreTaller: 'Taller Central', topeAnticipoAdvertencia: 150000 });
    expect(patch.status).toBe(200);
    expect(patch.body.data.nombreTaller).toBe('Taller Central');
    expect(patch.body.data.topeAnticipoAdvertencia).toBe(150000);
  });

  test('PATCH vacío es error de validación', async () => {
    const res = await request(app).patch('/api/v1/configuracion').send({});
    expect(res.status).toBe(400);
  });
});

describe('CA-4.3 — diferencial editable afecta solo asignaciones nuevas', () => {
  test('maestro antes (dif 10 → tarifa 30) y después del cambio (dif 15 → tarifa 35)', async () => {
    // corte con 1 operación (ct 20), cantidad 100
    const corte = await request(app)
      .post('/api/v1/cortes')
      .send({ modeloVersionId: versionId, tallas: [1], cortePorTalla: [100], plusPorTalla: [] });
    const abierto = await request(app).post(`/api/v1/cortes/${corte.body.data.id}/abrir`);
    const opId = abierto.body.data.operaciones[0].id;

    // asignación de maestro con el diferencial por defecto (10) → tarifa 30
    const antes = await request(app)
      .put(`/api/v1/cortes/${corte.body.data.id}/operaciones/${opId}/asignaciones`)
      .send({ asignaciones: [{ operarioId: rubenId, cantidad: 100, esMaestroExterno: true }] });
    expect(antes.body.data.operaciones[0].asignaciones[0].tarifaEfectiva).toBe(30); // CA-4.1

    // cambiar el diferencial de configuración a 15
    const cfg = await request(app)
      .patch('/api/v1/configuracion')
      .send({ diferencialMaestroExterno: 15 });
    expect(cfg.body.data.diferencialMaestroExterno).toBe(15);

    // nueva asignación de maestro → usa el nuevo diferencial → tarifa 35
    const despues = await request(app)
      .put(`/api/v1/cortes/${corte.body.data.id}/operaciones/${opId}/asignaciones`)
      .send({ asignaciones: [{ operarioId: rubenId, cantidad: 100, esMaestroExterno: true }] });
    expect(despues.body.data.operaciones[0].asignaciones[0].tarifaEfectiva).toBe(35); // CA-4.3
  });
});

describe('el tope editado se usa como advertencia (refuerzo CA-5.6)', () => {
  test('bajar el tope hace que un anticipo lo supere', async () => {
    await request(app).patch('/api/v1/configuracion').send({ topeAnticipoAdvertencia: 10000 });
    const res = await request(app)
      .post('/api/v1/anticipos')
      .send({ operarioId: rubenId, fecha: '2097-01-10T12:00:00.000Z', monto: 20000 });
    expect(res.status).toBe(201);
    expect(res.body.data.advertenciaTope).toBe(true);
    expect(res.body.data.topeAnticipoAdvertencia).toBe(10000);
    await prisma.anticipo.delete({ where: { id: res.body.data.anticipo.id } });
  });
});
