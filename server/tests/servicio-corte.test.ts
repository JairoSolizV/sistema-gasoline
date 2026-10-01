// Rebanada 4 del servicio de corte interno (docs/PLAN_SERVICIO_CORTE.md): procesos
// pagados por corte con los números del dueño — doblado 721 × 0.15 = 54.08 + 54.07,
// cortadores 1000 × (0.25 + 0.15 + 0.10) = 250 + 150 + 100, trazado 721 × 0.30 =
// 216.30, búsqueda 721 × 0.10 = 72.10 —, snapshot de tarifas, roles, cierre.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import type { ProcesoServicioDTO, ServicioCorteDTO } from '@taller/shared';
import { crearApp } from '../src/app.js';
import { prisma } from './helpers/db.js';
import { datosCorte } from './helpers/corte.js';
import { datosOperario } from './helpers/operario.js';

const app = crearApp();
const FECHA = '2026-09-10T12:00:00.000Z';

let versionId: string; // modelo con buscador activo
let versionSinBuscadorId: string; // modelo con buscador pendiente
const ids: Record<string, string> = {};

async function operario(clave: string, roles: string[], extra: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/v1/operarios')
    .send({ nombre: `TEST SERV ${clave}`, ...datosOperario({ roles, ...extra }) });
  ids[clave] = res.body.data.id;
}

async function limpiar() {
  const cortes = await prisma.corte.findMany({
    where: { version: { modelo: { nombre: { startsWith: 'TEST MODELO SERV' } } } },
    select: { id: true },
  });
  const corteIds = cortes.map((c) => c.id);
  await prisma.asignacion.deleteMany({ where: { corteOperacion: { corteId: { in: corteIds } } } });
  await prisma.corteOperacion.deleteMany({ where: { corteId: { in: corteIds } } });
  await prisma.corte.deleteMany({ where: { id: { in: corteIds } } }); // trabajos en cascada
  const filtroModelo = { modelo: { nombre: { startsWith: 'TEST MODELO SERV' } } };
  await prisma.operacion.deleteMany({ where: { version: filtroModelo } });
  await prisma.modeloVersion.deleteMany({ where: filtroModelo });
  await prisma.modelo.deleteMany({ where: { nombre: { startsWith: 'TEST MODELO SERV' } } });
  await prisma.operario.deleteMany({ where: { nombre: { startsWith: 'TEST SERV' } } });
}

beforeAll(async () => {
  await limpiar();
  await operario('BUSCADOR', ['buscador']);
  await operario('TRAZADOR', ['trazador']);
  await operario('DOBLA1', ['doblador']);
  await operario('DOBLA2', ['doblador']);
  await operario('CORTA1', ['cortador'], { tarifaCorte: 25 }); // el más rápido
  await operario('CORTA2', ['cortador'], { tarifaCorte: 15 });
  await operario('CORTA3', ['cortador']); // practicante, sin tarifa propia
  await operario('CLASIF', ['clasificador'], { tarifaClasificacion: 10 });
  await operario('COSTURA', ['costurero']);

  const ops = [{ grupo: 'G', n: '1', equipo: 'recta', proceso: 'pinza', pieza: null, ct: 20 }];
  versionId = (
    await request(app)
      .post('/api/v1/modelos')
      .send({ nombre: 'TEST MODELO SERV', operaciones: ops, buscadorId: ids.BUSCADOR })
  ).body.data.id;
  versionSinBuscadorId = (
    await request(app).post('/api/v1/modelos').send({ nombre: 'TEST MODELO SERV PEND', operaciones: ops })
  ).body.data.id;
});

afterAll(async () => {
  await limpiar();
  await prisma.$disconnect();
});

async function corteInterno(cantidad: number, version = versionId) {
  const creado = await request(app)
    .post('/api/v1/cortes')
    .send({
      ...(await datosCorte({ esInterno: true })),
      modeloVersionId: version,
      tallas: [1],
      cortePorTalla: [cantidad],
    });
  expect(creado.status).toBe(201);
  const abierto = await request(app).post(`/api/v1/cortes/${creado.body.data.id}/abrir`);
  return abierto.body.data as { id: string; operaciones: { id: string }[] };
}

const registrar = (corteId: string, proceso: string, body: Record<string, unknown>) =>
  request(app).put(`/api/v1/cortes/${corteId}/procesos/${proceso}`).send({ fecha: FECHA, ...body });

const proceso = (detalle: { servicio: ServicioCorteDTO }, p: string): ProcesoServicioDTO =>
  detalle.servicio.procesos.find((x) => x.proceso === p)!;

describe('doblado: exactamente 2, mitad y mitad, centavo al primero', () => {
  test('721 por hoja × 0.15 = 108.15 → 54.08 + 54.07', async () => {
    const corte = await corteInterno(721);
    const res = await registrar(corte.id, 'doblado', {
      modalidad: 'hoja',
      personas: [{ operarioId: ids.DOBLA1 }, { operarioId: ids.DOBLA2 }],
    });
    expect(res.status).toBe(200);
    const d = proceso(res.body.data, 'doblado');
    expect(d.modalidad).toBe('hoja');
    expect(d.trabajos.map((t) => [t.operario.nombre, t.tarifa, t.total])).toEqual([
      ['TEST SERV DOBLA1', 15, 5408],
      ['TEST SERV DOBLA2', 15, 5407],
    ]);
    expect(d.subtotal).toBe(10815); // nunca 10 816

    // otro orden: el centavo va al que se anotó primero
    const otra = await registrar(corte.id, 'doblado', {
      modalidad: 'hoja',
      personas: [{ operarioId: ids.DOBLA2 }, { operarioId: ids.DOBLA1 }],
    });
    expect(proceso(otra.body.data, 'doblado').trabajos[0]).toMatchObject({
      operario: { nombre: 'TEST SERV DOBLA2' },
      total: 5408,
    });
  });

  test('1000 por pares × 0.10 → 50.00 + 50.00 (reemplaza al anterior, no suma)', async () => {
    const corte = await corteInterno(1000);
    await registrar(corte.id, 'doblado', {
      modalidad: 'hoja',
      personas: [{ operarioId: ids.DOBLA1 }, { operarioId: ids.DOBLA2 }],
    });
    const res = await registrar(corte.id, 'doblado', {
      modalidad: 'pares',
      personas: [{ operarioId: ids.DOBLA1 }, { operarioId: ids.DOBLA2 }],
    });
    const d = proceso(res.body.data, 'doblado');
    expect(d.modalidad).toBe('pares');
    expect(d.trabajos.map((t) => t.total)).toEqual([5000, 5000]);
    expect(res.body.data.servicio.total).toBe(10000);
  });

  test('una sola persona o sin modalidad: 400', async () => {
    const corte = await corteInterno(100);
    const uno = await registrar(corte.id, 'doblado', {
      modalidad: 'pares',
      personas: [{ operarioId: ids.DOBLA1 }],
    });
    expect(uno.status).toBe(400);
    const sinModalidad = await registrar(corte.id, 'doblado', {
      personas: [{ operarioId: ids.DOBLA1 }, { operarioId: ids.DOBLA2 }],
    });
    expect(sinModalidad.status).toBe(400);
  });
});

describe('corte: hasta 3 cortadores, cada uno con su tarifa', () => {
  test('1000 × (0.25 personal + 0.15 personal + 0.10 editada) = 250 + 150 + 100 = 500', async () => {
    const corte = await corteInterno(1000);
    const res = await registrar(corte.id, 'corte', {
      personas: [
        { operarioId: ids.CORTA1 },
        { operarioId: ids.CORTA2 },
        { operarioId: ids.CORTA3, tarifa: 10 },
      ],
    });
    expect(res.status).toBe(200);
    const c = proceso(res.body.data, 'corte');
    expect(c.trabajos.map((t) => [t.tarifa, t.total])).toEqual([
      [25, 25000],
      [15, 15000],
      [10, 10000],
    ]);
    expect(c.subtotal).toBe(50000);
  });

  test('sin tarifa propia ni editada usa el respaldo copiado al corte (0.15)', async () => {
    const corte = await corteInterno(100);
    const res = await registrar(corte.id, 'corte', { personas: [{ operarioId: ids.CORTA3 }] });
    expect(proceso(res.body.data, 'corte').trabajos[0]).toMatchObject({ tarifa: 15, total: 1500 });
  });

  test('4 cortadores: 400', async () => {
    const corte = await corteInterno(100);
    const res = await registrar(corte.id, 'corte', {
      personas: [ids.CORTA1, ids.CORTA2, ids.CORTA3, ids.BUSCADOR].map((operarioId) => ({ operarioId })),
    });
    expect(res.status).toBe(400);
  });

  test('búsqueda automática: al registrar el corte se paga al buscador del modelo (721 × 0.10)', async () => {
    const corte = await corteInterno(721);
    const res = await registrar(corte.id, 'corte', { personas: [{ operarioId: ids.CORTA1 }] });
    const b = proceso(res.body.data, 'busqueda');
    expect(b.trabajos[0]).toMatchObject({ operario: { nombre: 'TEST SERV BUSCADOR' }, tarifa: 10, total: 7210 });
    expect(b.fecha).toBe(FECHA);
  });
});

describe('trazado, clasificación y tarifas', () => {
  test('trazado 721 × 0.30 = 216.30; tarifa editable en el registro', async () => {
    const corte = await corteInterno(721);
    const res = await registrar(corte.id, 'trazado', { personas: [{ operarioId: ids.TRAZADOR }] });
    expect(proceso(res.body.data, 'trazado').trabajos[0]).toMatchObject({ tarifa: 30, total: 21630 });

    const editada = await registrar(corte.id, 'trazado', {
      tarifa: 40,
      personas: [{ operarioId: ids.TRAZADOR }],
    });
    expect(proceso(editada.body.data, 'trazado').subtotal).toBe(28840);
  });

  test('snapshot: cambiar Configuración no altera un corte ya creado', async () => {
    const viejo = await corteInterno(100);
    await prisma.configuracion.update({ where: { id: 1 }, data: { tarifaTrazado: 35 } });
    try {
      const nuevo = await corteInterno(100);
      const enViejo = await registrar(viejo.id, 'trazado', { personas: [{ operarioId: ids.TRAZADOR }] });
      const enNuevo = await registrar(nuevo.id, 'trazado', { personas: [{ operarioId: ids.TRAZADOR }] });
      expect(proceso(enViejo.body.data, 'trazado').trabajos[0].tarifa).toBe(30);
      expect(proceso(enNuevo.body.data, 'trazado').trabajos[0].tarifa).toBe(35);
    } finally {
      await prisma.configuracion.update({ where: { id: 1 }, data: { tarifaTrazado: 30 } });
    }
  });

  test('clasificación: hasta 2, tarifa personal; 3 personas → 400', async () => {
    const corte = await corteInterno(721);
    const res = await registrar(corte.id, 'clasificacion', {
      personas: [{ operarioId: ids.CLASIF }],
    });
    expect(proceso(res.body.data, 'clasificacion').subtotal).toBe(7210);
    const tres = await registrar(corte.id, 'clasificacion', {
      personas: [ids.CLASIF, ids.CORTA1, ids.CORTA2].map((operarioId) => ({ operarioId })),
    });
    expect(tres.status).toBe(400);
  });

  test('rol estricto: un cortador no puede figurar en el trazado (409)', async () => {
    const corte = await corteInterno(100);
    const res = await registrar(corte.id, 'trazado', { personas: [{ operarioId: ids.CORTA1 }] });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('OPERARIO_SIN_ROL');
  });
});

describe('cierre, costos, externo y mes liquidado', () => {
  test('no cierra sin el servicio completo; con todo registrado cierra y suma los 3 costos', async () => {
    const corte = await corteInterno(721);
    // costura completa: 721 × 0.20 = 144.20
    await request(app)
      .put(`/api/v1/cortes/${corte.id}/operaciones/${corte.operaciones[0].id}/asignaciones`)
      .send({ asignaciones: [{ operarioId: ids.COSTURA, cantidad: 721 }] });

    const incompleto = await request(app).post(`/api/v1/cortes/${corte.id}/cerrar`).send({ fechaCierre: FECHA });
    expect(incompleto.status).toBe(409);
    expect(incompleto.body.error.code).toBe('SERVICIO_INCOMPLETO');
    expect(incompleto.body.error.message).toContain('trazado');

    await registrar(corte.id, 'trazado', { personas: [{ operarioId: ids.TRAZADOR }] }); // 216.30
    await registrar(corte.id, 'doblado', {
      modalidad: 'hoja',
      personas: [{ operarioId: ids.DOBLA1 }, { operarioId: ids.DOBLA2 }],
    }); // 108.15
    await registrar(corte.id, 'corte', { personas: [{ operarioId: ids.CORTA1 }] }); // 180.25 + búsqueda 72.10
    const ultimo = await registrar(corte.id, 'clasificacion', {
      personas: [{ operarioId: ids.CLASIF }],
    }); // 72.10
    const d = ultimo.body.data;
    expect(d.servicio.faltantes).toEqual([]);
    expect(d.costoTotalCorte).toBe(14420); // costura
    expect(d.costoServicioCorte).toBe(21630 + 10815 + 18025 + 7210 + 7210);
    expect(d.costoTotal).toBe(d.costoTotalCorte + d.costoServicioCorte);

    const cerrado = await request(app).post(`/api/v1/cortes/${corte.id}/cerrar`).send({ fechaCierre: FECHA });
    expect(cerrado.status).toBe(200);
    // cerrado: ya no se tocan los procesos
    const tarde = await registrar(corte.id, 'trazado', { personas: [{ operarioId: ids.TRAZADOR }] });
    expect(tarde.status).toBe(409);
  });

  test('búsqueda pendiente en el modelo bloquea; "sin buscador" no', async () => {
    const corte = await corteInterno(10, versionSinBuscadorId);
    const antes = await request(app).get(`/api/v1/cortes/${corte.id}`);
    expect(antes.body.data.servicio.faltantes).toContain('busqueda');

    const modelo = await prisma.modeloVersion.findUniqueOrThrow({ where: { id: versionSinBuscadorId } });
    await request(app)
      .patch(`/api/v1/modelos/${modelo.modeloId}/buscador`)
      .send({ buscadorId: null, sinBuscador: true });
    const despues = await request(app).get(`/api/v1/cortes/${corte.id}`);
    expect(despues.body.data.servicio.faltantes).not.toContain('busqueda');
    await request(app)
      .patch(`/api/v1/modelos/${modelo.modeloId}/buscador`)
      .send({ buscadorId: null, sinBuscador: false });
  });

  test('quitar un proceso: DELETE lo borra; la segunda vez 404', async () => {
    const corte = await corteInterno(50);
    await registrar(corte.id, 'doblado', {
      modalidad: 'pares',
      personas: [{ operarioId: ids.DOBLA1 }, { operarioId: ids.DOBLA2 }],
    });
    const quitado = await request(app).delete(`/api/v1/cortes/${corte.id}/procesos/doblado`);
    expect(quitado.status).toBe(200);
    expect(quitado.body.data.servicio.procesos).toEqual([]);
    expect((await request(app).delete(`/api/v1/cortes/${corte.id}/procesos/doblado`)).status).toBe(404);
    expect((await request(app).delete(`/api/v1/cortes/${corte.id}/procesos/planchado`)).status).toBe(400);
  });

  test('corte externo no lleva procesos; para volverlo externo no debe tener trabajos', async () => {
    const externo = await request(app)
      .post('/api/v1/cortes')
      .send({ ...(await datosCorte()), modeloVersionId: versionId, tallas: [1], cortePorTalla: [10] });
    const res = await registrar(externo.body.data.id, 'trazado', { personas: [{ operarioId: ids.TRAZADOR }] });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CORTE_EXTERNO');

    const interno = await corteInterno(10);
    await registrar(interno.id, 'trazado', { personas: [{ operarioId: ids.TRAZADOR }] });
    const aExterno = await request(app).patch(`/api/v1/cortes/${interno.id}/servicio`).send({ esInterno: false });
    expect(aExterno.status).toBe(409);
    await request(app).delete(`/api/v1/cortes/${interno.id}/procesos/trazado`);
    const ok = await request(app).patch(`/api/v1/cortes/${interno.id}/servicio`).send({ esInterno: false });
    expect(ok.status).toBe(200);
    expect(ok.body.data.servicio).toBeNull();

    // y de vuelta a interno: conserva el snapshot que ya tenía
    const otraVez = await request(app).patch(`/api/v1/cortes/${interno.id}/servicio`).send({ esInterno: true });
    expect(otraVez.body.data.servicio.tarifas.trazado).toBe(30);
  });

  test('fecha en un mes liquidado: 409 MES_LIQUIDADO', async () => {
    const periodo = await prisma.periodo.create({
      data: { anio: 2020, mes: 1, estado: 'cerrado', fechaCierre: new Date('2020-02-01T12:00:00Z') },
    });
    try {
      const corte = await corteInterno(10);
      const res = await request(app)
        .put(`/api/v1/cortes/${corte.id}/procesos/trazado`)
        .send({ fecha: '2020-01-20T12:00:00.000Z', personas: [{ operarioId: ids.TRAZADOR }] });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('MES_LIQUIDADO');
    } finally {
      await prisma.periodo.delete({ where: { id: periodo.id } });
    }
  });

  test('quien tiene trabajos del servicio cuenta como historial: no se puede eliminar', async () => {
    await request(app).patch(`/api/v1/operarios/${ids.TRAZADOR}`).send({ activo: false });
    const res = await request(app).delete(`/api/v1/operarios/${ids.TRAZADOR}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CON_HISTORIAL');
    await request(app).patch(`/api/v1/operarios/${ids.TRAZADOR}`).send({ activo: true });
  });
});
