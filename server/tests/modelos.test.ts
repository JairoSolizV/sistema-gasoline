// Rebanada 3 — módulo modelos: catálogo, versionado (CA-1.3) y recálculo de
// la suma de CT en cada mutación de operaciones (CA-1.1/CA-1.2 en vivo).
// Limpieza: todo lo creado aquí se borra en afterAll para no alterar los
// conteos del seed que verifica ca-1.test.ts.
import { afterAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { prisma } from './helpers/db.js';

const app = crearApp();

const OPS_BASE = [
  { grupo: 'TRASEROS', n: '1', equipo: 'recta', proceso: 'pinza', pieza: 'trasero', ct: 15 },
  { grupo: 'TRASEROS', n: '2', equipo: 'codo', proceso: 'urlado', pieza: 'trasero', ct: 20 },
  { grupo: 'ENSAMBLE', n: '1', equipo: 'plana', proceso: 'ensamble', pieza: 'delantero', ct: 50 },
];

async function crearModeloTest(nombre: string, operaciones = OPS_BASE) {
  return request(app).post('/api/v1/modelos').send({ nombre, operaciones });
}

afterAll(async () => {
  // borra modelos de prueba (y sus versiones/operaciones) y versiones extra
  // creadas sobre modelos del seed (ej. la v2 de DOBLE PRET de CA-1.3)
  const modelosTest = await prisma.modelo.findMany({
    where: { nombre: { startsWith: 'TEST MODELO' } },
    select: { id: true },
  });
  const idsTest = modelosTest.map((m) => m.id);
  await prisma.operacion.deleteMany({ where: { version: { modeloId: { in: idsTest } } } });
  await prisma.modeloVersion.deleteMany({ where: { modeloId: { in: idsTest } } });
  await prisma.modelo.deleteMany({ where: { id: { in: idsTest } } });

  await prisma.operacion.deleteMany({ where: { version: { numeroVersion: { gt: 1 } } } });
  await prisma.modeloVersion.deleteMany({ where: { numeroVersion: { gt: 1 } } });
  await prisma.$disconnect();
});

describe('POST /api/v1/modelos — crear modelo con v1', () => {
  test('crea el modelo, suma los CT en centavos y ordena las operaciones', async () => {
    const res = await crearModeloTest('TEST MODELO CREAR');
    expect(res.status).toBe(201);
    const detalle = res.body.data;
    expect(detalle.numeroVersion).toBe(1);
    expect(detalle.costoManoObraPrenda).toBe(85); // 15+20+50
    expect(detalle.operaciones.map((o: { orden: number }) => o.orden)).toEqual([1, 2, 3]);
    expect(detalle.modeloNombre).toBe('TEST MODELO CREAR');
  });

  test('rechaza nombre duplicado con 409', async () => {
    await crearModeloTest('TEST MODELO DUP');
    const res = await crearModeloTest('TEST MODELO DUP');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NOMBRE_DUPLICADO');
  });

  test('rechaza modelo sin operaciones y CT no entero', async () => {
    const sinOps = await request(app)
      .post('/api/v1/modelos')
      .send({ nombre: 'TEST MODELO VACIO', operaciones: [] });
    expect(sinOps.status).toBe(400);

    const ctMalo = await crearModeloTest('TEST MODELO CT MALO', [
      { ...OPS_BASE[0], ct: 0.15 }, // Bs en vez de centavos → rechazado
    ]);
    expect(ctMalo.status).toBe(400);
  });
});

describe('GET /api/v1/modelos y /api/v1/versiones/:id', () => {
  test('lista incluye los modelos del seed con su costo por prenda', async () => {
    const res = await request(app).get('/api/v1/modelos');
    expect(res.status).toBe(200);
    const doblePret = res.body.data.find(
      (m: { nombre: string }) => m.nombre === 'black DOBLE PRET 06',
    );
    expect(doblePret).toBeDefined();
    expect(doblePret.versiones[0].costoManoObraPrenda).toBe(810);
    expect(doblePret.versiones[0].cantidadOperaciones).toBe(47);
  });

  test('detalle de versión trae operaciones ordenadas y el nombre del modelo', async () => {
    const alta = await crearModeloTest('TEST MODELO DETALLE');
    const res = await request(app).get(`/api/v1/versiones/${alta.body.data.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.modeloNombre).toBe('TEST MODELO DETALLE');
    expect(res.body.data.operaciones).toHaveLength(3);
  });

  test('versión inexistente responde 404', async () => {
    const res = await request(app).get(
      '/api/v1/versiones/00000000-0000-0000-0000-000000000000',
    );
    expect(res.status).toBe(404);
  });
});

describe('operaciones de una versión — recálculo del costo', () => {
  test('agregar operación suma su CT y le da el siguiente orden', async () => {
    const alta = await crearModeloTest('TEST MODELO AGREGAR');
    const versionId = alta.body.data.id;
    const res = await request(app)
      .post(`/api/v1/versiones/${versionId}/operaciones`)
      .send({ grupo: 'ACABADO', n: null, equipo: 'pretina', proceso: 'cintura', pieza: 'pretina', ct: 50 });
    expect(res.status).toBe(201);
    expect(res.body.data.costoManoObraPrenda).toBe(135); // 85 + 50
    const nueva = res.body.data.operaciones.find((o: { grupo: string }) => o.grupo === 'ACABADO');
    expect(nueva.orden).toBe(4);
  });

  test('editar el CT de una operación recalcula el costo', async () => {
    const alta = await crearModeloTest('TEST MODELO EDITAR');
    const op = alta.body.data.operaciones[1]; // ct 20
    const res = await request(app).patch(`/api/v1/operaciones/${op.id}`).send({ ct: 25 });
    expect(res.status).toBe(200);
    expect(res.body.data.costoManoObraPrenda).toBe(90); // 85 - 20 + 25
  });

  test('eliminar una operación resta su CT', async () => {
    const alta = await crearModeloTest('TEST MODELO ELIMINAR');
    const op = alta.body.data.operaciones[2]; // ct 50
    const res = await request(app).delete(`/api/v1/operaciones/${op.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.costoManoObraPrenda).toBe(35); // 85 - 50
  });
});

describe('CA-1.3 — versionado conserva el original', () => {
  test('v2 de DOBLE PRET sin una operación de 0.20 queda en 7.90 y v1 sigue en 8.10', async () => {
    const modelos = await request(app).get('/api/v1/modelos');
    const doblePret = modelos.body.data.find(
      (m: { nombre: string }) => m.nombre === 'black DOBLE PRET 06',
    );
    const v1Id = doblePret.versiones.find((v: { numeroVersion: number }) => v.numeroVersion === 1).id;

    // crear v2 (copia de v1)
    const v2Res = await request(app)
      .post(`/api/v1/modelos/${doblePret.id}/versiones`)
      .send({ notas: 'optimización de prueba CA-1.3' });
    expect(v2Res.status).toBe(201);
    const v2 = v2Res.body.data;
    expect(v2.numeroVersion).toBe(2);
    expect(v2.costoManoObraPrenda).toBe(810); // copia exacta
    expect(v2.operaciones).toHaveLength(47);

    // quitar de v2 una operación de CT 0.20 (20 centavos)
    const opCt20 = v2.operaciones.find((o: { ct: number }) => o.ct === 20);
    const borrado = await request(app).delete(`/api/v1/operaciones/${opCt20.id}`);
    expect(borrado.status).toBe(200);
    expect(borrado.body.data.costoManoObraPrenda).toBe(790); // CA-1.3: v2 = 7.90

    // v1 queda intacta: 8.10 y 47 operaciones
    const v1 = await request(app).get(`/api/v1/versiones/${v1Id}`);
    expect(v1.body.data.costoManoObraPrenda).toBe(810);
    expect(v1.body.data.operaciones).toHaveLength(47);
  });
});
