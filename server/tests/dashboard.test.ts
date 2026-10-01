// Rebanada 8 — dashboard: KPIs del mes, cortes activos y alertas.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { prisma } from './helpers/db.js';
import { datosCorte } from './helpers/corte.js';

const app = crearApp();

let versionId: string;
let corteAbiertoId: string;

async function limpiar() {
  const cortes = await prisma.corte.findMany({
    where: { version: { modelo: { nombre: 'TEST MODELO DASH' } } },
    select: { id: true },
  });
  const ids = cortes.map((c) => c.id);
  await prisma.asignacion.deleteMany({ where: { corteOperacion: { corteId: { in: ids } } } });
  await prisma.corteOperacion.deleteMany({ where: { corteId: { in: ids } } });
  await prisma.corte.deleteMany({ where: { id: { in: ids } } });
  await prisma.operacion.deleteMany({ where: { version: { modelo: { nombre: 'TEST MODELO DASH' } } } });
  await prisma.modeloVersion.deleteMany({ where: { modelo: { nombre: 'TEST MODELO DASH' } } });
  await prisma.modelo.deleteMany({ where: { nombre: 'TEST MODELO DASH' } });
}

beforeAll(async () => {
  await limpiar();
  const modelo = await request(app)
    .post('/api/v1/modelos')
    .send({
      nombre: 'TEST MODELO DASH',
      operaciones: [
        { grupo: 'G', n: '1', equipo: 'recta', proceso: 'p1', pieza: null, ct: 10 },
        { grupo: 'G', n: '2', equipo: 'recta', proceso: 'p2', pieza: null, ct: 10 },
      ],
    });
  versionId = modelo.body.data.id;
  // corte abierto y sin asignar → debe generar alerta y contar como activo
  const corte = await request(app)
    .post('/api/v1/cortes')
    .send({ ...(await datosCorte()), modeloVersionId: versionId, tallas: [1], cortePorTalla: [50], plusPorTalla: [] });
  corteAbiertoId = corte.body.data.id;
  await request(app).post(`/api/v1/cortes/${corteAbiertoId}/abrir`);
});

afterAll(async () => {
  await limpiar();
  await prisma.$disconnect();
});

describe('GET /api/v1/dashboard', () => {
  test('cuenta el corte abierto y alerta que no se puede cerrar', async () => {
    const res = await request(app).get('/api/v1/dashboard?anio=2097&mes=5');
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.kpis.cortesActivos).toBeGreaterThanOrEqual(1);
    expect(d.cortesActivos.some((c: { id: string }) => c.id === corteAbiertoId)).toBe(true);
    // el corte abierto tiene 2 operaciones sin asignar → alerta de error
    expect(d.alertas.some((a: { tipo: string; texto: string }) => a.tipo === 'error')).toBe(true);
  });

  test('sin anio/mes usa el mes en curso (no falla)', async () => {
    const res = await request(app).get('/api/v1/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.data.kpis).toHaveProperty('totalAPagar');
  });
});
