// Rebanada 7 — rendición de cuentas: vista filtrada por operario (CA-7.1) y
// sin fuga de datos de terceros ni en la UI ni en el payload (CA-7.2).
// Dos operarios trabajan el MISMO corte; la rendición de uno no debe contener
// nada del otro. Usa año 2098 para aislar; limpia todo en afterAll.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { prisma } from './helpers/db.js';

const app = crearApp();

let versionId: string;
let clarisId: string;
let rubenId: string;
const NOMBRE_CLARIS = 'TEST REND CLARIS';
const NOMBRE_RUBEN = 'TEST REND RUBEN';

async function limpiar() {
  await prisma.liquidacion.deleteMany({});
  await prisma.periodo.deleteMany({});
  await prisma.anticipo.deleteMany({ where: { operario: { nombre: { startsWith: 'TEST REND' } } } });
  const cortes = await prisma.corte.findMany({
    where: { version: { modelo: { nombre: 'TEST MODELO REND' } } },
    select: { id: true },
  });
  const ids = cortes.map((c) => c.id);
  await prisma.asignacion.deleteMany({ where: { corteOperacion: { corteId: { in: ids } } } });
  await prisma.corteOperacion.deleteMany({ where: { corteId: { in: ids } } });
  await prisma.corte.deleteMany({ where: { id: { in: ids } } });
  await prisma.operacion.deleteMany({ where: { version: { modelo: { nombre: 'TEST MODELO REND' } } } });
  await prisma.modeloVersion.deleteMany({ where: { modelo: { nombre: 'TEST MODELO REND' } } });
  await prisma.modelo.deleteMany({ where: { nombre: 'TEST MODELO REND' } });
  await prisma.operario.deleteMany({ where: { nombre: { startsWith: 'TEST REND' } } });
}

beforeAll(async () => {
  await limpiar();
  clarisId = (await request(app).post('/api/v1/operarios').send({ nombre: NOMBRE_CLARIS })).body.data.id;
  rubenId = (await request(app).post('/api/v1/operarios').send({ nombre: NOMBRE_RUBEN })).body.data.id;

  // modelo con 2 operaciones: op1 ct=15 (CLARIS), op2 ct=20 (RUBEN)
  const modelo = await request(app)
    .post('/api/v1/modelos')
    .send({
      nombre: 'TEST MODELO REND',
      operaciones: [
        { grupo: 'G', n: '1', equipo: 'recta', proceso: 'pinza', pieza: 'trasero', ct: 15 },
        { grupo: 'G', n: '2', equipo: 'plana', proceso: 'ensamble', pieza: 'delantero', ct: 20 },
      ],
    });
  versionId = modelo.body.data.id;

  // corte de 100, cerrado en marzo 2098: CLARIS hace op1, RUBEN op2
  const corte = await request(app)
    .post('/api/v1/cortes')
    .send({ modeloVersionId: versionId, tallas: [1], cortePorTalla: [100], plusPorTalla: [] });
  const abierto = await request(app).post(`/api/v1/cortes/${corte.body.data.id}/abrir`);
  const [op1, op2] = abierto.body.data.operaciones;
  await request(app)
    .put(`/api/v1/cortes/${corte.body.data.id}/operaciones/${op1.id}/asignaciones`)
    .send({ asignaciones: [{ operarioId: clarisId, cantidad: 100 }] });
  await request(app)
    .put(`/api/v1/cortes/${corte.body.data.id}/operaciones/${op2.id}/asignaciones`)
    .send({ asignaciones: [{ operarioId: rubenId, cantidad: 100 }] });
  await request(app)
    .post(`/api/v1/cortes/${corte.body.data.id}/cerrar`)
    .send({ fechaCierre: '2098-03-10T12:00:00.000Z' });

  // un anticipo de CLARIS en el mismo mes
  await request(app)
    .post('/api/v1/anticipos')
    .send({ operarioId: clarisId, fecha: '2098-03-12T12:00:00.000Z', monto: 3000 });
});

afterAll(async () => {
  await limpiar();
  await prisma.$disconnect();
});

describe('CA-7.1 — vista filtrada por operario', () => {
  test('CLARIS ve solo su operación, su ganado, su anticipo y su saldo', async () => {
    const res = await request(app).get(`/api/v1/rendicion/${clarisId}?anio=2098&mes=3`);
    expect(res.status).toBe(200);
    const r = res.body.data;
    expect(r.operarioId).toBe(clarisId);
    expect(r.nombre).toBe(NOMBRE_CLARIS);

    expect(r.cortes).toHaveLength(1);
    const corte = r.cortes[0];
    expect(corte.operaciones).toHaveLength(1); // solo op1, no op2 de RUBEN
    expect(corte.operaciones[0].proceso).toBe('pinza');
    expect(corte.operaciones[0].total).toBe(1500); // 100 × 15
    expect(corte.totalCorte).toBe(1500);

    expect(r.totalGanado).toBe(1500);
    expect(r.totalAnticipos).toBe(3000);
    expect(r.saldoPeriodo).toBe(-1500); // 0 + 1500 − 3000
    expect(r.anticipos).toHaveLength(1);
    expect(r.anticipos[0].monto).toBe(3000);
  });
});

describe('CA-7.2 — sin fuga en el payload', () => {
  test('la respuesta de CLARIS no contiene el nombre de RUBEN', async () => {
    const res = await request(app).get(`/api/v1/rendicion/${clarisId}?anio=2098&mes=3`);
    const payload = JSON.stringify(res.body);
    expect(payload).not.toContain(NOMBRE_RUBEN);
    expect(payload).not.toContain(rubenId);
  });

  test('la respuesta de RUBEN no contiene el nombre de CLARIS', async () => {
    const res = await request(app).get(`/api/v1/rendicion/${rubenId}?anio=2098&mes=3`);
    const payload = JSON.stringify(res.body);
    expect(payload).not.toContain(NOMBRE_CLARIS);
    expect(payload).not.toContain(clarisId);
    // RUBEN sí ve lo suyo: op2 (ensamble), 100 × 20 = 2000
    expect(res.body.data.totalGanado).toBe(2000);
    expect(res.body.data.cortes[0].operaciones[0].proceso).toBe('ensamble');
  });
});

describe('casos borde', () => {
  test('operario sin actividad en el mes → cortes y anticipos vacíos, saldo 0', async () => {
    const res = await request(app).get(`/api/v1/rendicion/${clarisId}?anio=2098&mes=1`);
    expect(res.status).toBe(200);
    expect(res.body.data.cortes).toHaveLength(0);
    expect(res.body.data.anticipos).toHaveLength(0);
    expect(res.body.data.saldoPeriodo).toBe(0);
  });

  test('operario inexistente responde 404', async () => {
    const res = await request(app).get(
      '/api/v1/rendicion/00000000-0000-0000-0000-000000000000?anio=2098&mes=3',
    );
    expect(res.status).toBe(404);
  });
});
