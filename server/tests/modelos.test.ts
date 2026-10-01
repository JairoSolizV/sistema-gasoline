// Rebanada 3 — módulo modelos: catálogo, versionado (CA-1.3) y recálculo de
// la suma de CT en cada mutación de operaciones (CA-1.1/CA-1.2 en vivo).
// Limpieza: todo lo creado aquí se borra en afterAll para no alterar los
// conteos del seed que verifica ca-1.test.ts.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { prisma } from './helpers/db.js';
import { datosOperario } from './helpers/operario.js';

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

// ── Servicio de corte: buscador del modelo y moldes (PLAN_SERVICIO_CORTE §2.8-2.9) ──
describe('buscador del modelo y pago de moldes', () => {
  let buscadorId: string;
  let moldistaId: string;
  let soloCostureroId: string;

  async function operario(nombre: string, roles: string[]) {
    const res = await request(app)
      .post('/api/v1/operarios')
      .send({ nombre, ...datosOperario({ roles }) });
    return res.body.data.id as string;
  }

  beforeAll(async () => {
    buscadorId = await operario('TEST MOL BUSCADOR', ['buscador']);
    moldistaId = await operario('TEST MOL MOLDISTA', ['moldista']);
    soloCostureroId = await operario('TEST MOL COSTURERO', ['costurero']);
  });

  afterAll(async () => {
    // los modelos TEST (y sus moldes, en cascada) se borran en el afterAll general;
    // acá se sueltan las referencias para poder borrar estos operarios
    await prisma.pagoMolde.deleteMany({
      where: { operario: { nombre: { startsWith: 'TEST MOL' } } },
    });
    await prisma.modelo.updateMany({
      where: { buscador: { nombre: { startsWith: 'TEST MOL' } } },
      data: { buscadorId: null },
    });
    await prisma.operario.deleteMany({ where: { nombre: { startsWith: 'TEST MOL' } } });
  });

  const molde = (extra: Record<string, unknown> = {}) => ({
    moldistaId,
    fecha: '2026-09-10T12:00:00.000Z',
    ...extra,
  });

  test('modelo nuevo con buscador y moldes: Bs 200 de Configuración, tipo nuevo', async () => {
    const res = await request(app)
      .post('/api/v1/modelos')
      .send({ nombre: 'TEST MODELO DISENO', operaciones: OPS_BASE, buscadorId, molde: molde() });
    expect(res.status).toBe(201);
    const d = res.body.data;
    expect(d.buscador).toEqual({ id: buscadorId, nombre: 'TEST MOL BUSCADOR' });
    expect(d.sinBuscador).toBe(false);
    expect(d.molde.tipo).toBe('nuevo');
    expect(d.molde.monto).toBe(20000);
    expect(d.molde.operario.nombre).toBe('TEST MOL MOLDISTA');
    expect(d.molde.fecha).toBe('2026-09-10T12:00:00.000Z');
  });

  test('el monto de los moldes se puede editar al registrarlos', async () => {
    const res = await request(app)
      .post('/api/v1/modelos')
      .send({ nombre: 'TEST MODELO MONTO', operaciones: OPS_BASE, molde: molde({ monto: 18000 }) });
    expect(res.body.data.molde.monto).toBe(18000);
    expect(res.body.data.buscador).toBeNull(); // pendiente
    expect(res.body.data.sinBuscador).toBe(false);
  });

  test('roles estrictos: buscador y creador de moldes necesitan su rol', async () => {
    const malBuscador = await request(app)
      .post('/api/v1/modelos')
      .send({ nombre: 'TEST MODELO ROL B', operaciones: OPS_BASE, buscadorId: soloCostureroId });
    expect(malBuscador.status).toBe(409);
    expect(malBuscador.body.error.code).toBe('OPERARIO_SIN_ROL');

    const malMoldista = await request(app)
      .post('/api/v1/modelos')
      .send({
        nombre: 'TEST MODELO ROL M',
        operaciones: OPS_BASE,
        molde: molde({ moldistaId: soloCostureroId }),
      });
    expect(malMoldista.status).toBe(409);
    expect(malMoldista.body.error.code).toBe('OPERARIO_SIN_ROL');
  });

  test('buscador y "sin buscador" a la vez: 400', async () => {
    const res = await request(app)
      .post('/api/v1/modelos')
      .send({ nombre: 'TEST MODELO AMBOS', operaciones: OPS_BASE, buscadorId, sinBuscador: true });
    expect(res.status).toBe(400);
  });

  test('versión nueva: moldes modificados = Bs 50; sin casilla no paga; no copia los de v1', async () => {
    const v1 = await request(app)
      .post('/api/v1/modelos')
      .send({ nombre: 'TEST MODELO VERSIONES', operaciones: OPS_BASE, molde: molde() });
    const modeloId = v1.body.data.modeloId;

    const sinMoldes = await request(app).post(`/api/v1/modelos/${modeloId}/versiones`).send({});
    expect(sinMoldes.status).toBe(201);
    expect(sinMoldes.body.data.molde).toBeNull();

    const conMoldes = await request(app)
      .post(`/api/v1/modelos/${modeloId}/versiones`)
      .send({ molde: molde() });
    expect(conMoldes.body.data.molde.tipo).toBe('modificacion');
    expect(conMoldes.body.data.molde.monto).toBe(5000);

    const lista = await request(app).get('/api/v1/modelos');
    const modelo = lista.body.data.find((m: { id: string }) => m.id === modeloId);
    expect(
      modelo.versiones.map((v: { numeroVersion: number; molde: { monto: number } | null }) => [
        v.numeroVersion,
        v.molde?.monto ?? null,
      ]),
    ).toEqual([
      [3, 5000],
      [2, null],
      [1, 20000],
    ]);
  });

  test('PATCH buscador: asignar, marcar "sin buscador" y volver a pendiente', async () => {
    const creado = await crearModeloTest('TEST MODELO BUSCADOR');
    const modeloId = creado.body.data.modeloId;

    const asignar = await request(app)
      .patch(`/api/v1/modelos/${modeloId}/buscador`)
      .send({ buscadorId, sinBuscador: false });
    expect(asignar.status).toBe(200);
    expect(asignar.body.data.buscador.nombre).toBe('TEST MOL BUSCADOR');

    const sin = await request(app)
      .patch(`/api/v1/modelos/${modeloId}/buscador`)
      .send({ buscadorId: null, sinBuscador: true });
    expect(sin.body.data.buscador).toBeNull();
    expect(sin.body.data.sinBuscador).toBe(true);

    const pendiente = await request(app)
      .patch(`/api/v1/modelos/${modeloId}/buscador`)
      .send({ buscadorId: null, sinBuscador: false });
    expect(pendiente.body.data.sinBuscador).toBe(false);
  });

  test('PUT / DELETE moldes de una versión existente', async () => {
    const creado = await crearModeloTest('TEST MODELO MOLDE TARDE');
    const versionId = creado.body.data.id;

    const puesto = await request(app).put(`/api/v1/versiones/${versionId}/molde`).send(molde());
    expect(puesto.status).toBe(200);
    expect(puesto.body.data.molde.tipo).toBe('nuevo'); // es la v1

    const corregido = await request(app)
      .put(`/api/v1/versiones/${versionId}/molde`)
      .send(molde({ monto: 19000 }));
    expect(corregido.body.data.molde.monto).toBe(19000); // reemplaza, no duplica

    const quitado = await request(app).delete(`/api/v1/versiones/${versionId}/molde`);
    expect(quitado.status).toBe(200);
    expect(quitado.body.data.molde).toBeNull();

    const otraVez = await request(app).delete(`/api/v1/versiones/${versionId}/molde`);
    expect(otraVez.status).toBe(404);
  });

  test('moldes con fecha en un mes liquidado: 409 MES_LIQUIDADO', async () => {
    const periodo = await prisma.periodo.create({
      data: {
        anio: 2020,
        mes: 1,
        estado: 'cerrado',
        fechaCierre: new Date('2020-02-01T12:00:00Z'),
      },
    });
    try {
      const creado = await crearModeloTest('TEST MODELO MES CERRADO');
      const res = await request(app)
        .put(`/api/v1/versiones/${creado.body.data.id}/molde`)
        .send(molde({ fecha: '2020-01-15T12:00:00.000Z' }));
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('MES_LIQUIDADO');
    } finally {
      await prisma.periodo.delete({ where: { id: periodo.id } });
    }
  });

  test('quien hizo moldes cuenta como historial: no se puede eliminar', async () => {
    await request(app).patch(`/api/v1/operarios/${moldistaId}`).send({ activo: false });
    const res = await request(app).delete(`/api/v1/operarios/${moldistaId}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CON_HISTORIAL');
    await request(app).patch(`/api/v1/operarios/${moldistaId}`).send({ activo: true });
  });
});
