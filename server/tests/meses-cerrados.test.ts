// Integridad de meses liquidados (invariantes 5 y 6, CLAUDE.md §6):
//  - ningún movimiento (cierre de corte, anticipo) puede caer en un mes ya
//    liquidado ni antes del último cierre — quedaría fuera de toda liquidación;
//  - los meses se cierran hacia adelante y sin saltarse meses con movimientos;
//  - el arrastre atraviesa meses vacíos sin cerrar (no se pierde);
//  - la rendición de un mes cerrado muestra los valores persistidos.
// Usa año 2097 para aislar Periodos; limpia todo en afterAll.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { prisma } from './helpers/db.js';
import { datosCorte } from './helpers/corte.js';
import { datosOperario } from './helpers/operario.js';

const app = crearApp();

// modelo de prueba con 1 operación ct=1 centavo → ganado = cantidad asignada
let versionId: string;

async function crearOperario(nombre: string): Promise<string> {
  const res = await request(app).post('/api/v1/operarios').send({ nombre, ...datosOperario() });
  return res.body.data.id;
}

/** Deja un corte asignado (listo para cerrar) que gana `monto` centavos. */
async function corteAsignado(operarioId: string, monto: number): Promise<string> {
  const creado = await request(app)
    .post('/api/v1/cortes')
    .send({ ...(await datosCorte()), modeloVersionId: versionId, tallas: [1], cortePorTalla: [monto], plusPorTalla: [] });
  const corteId = creado.body.data.id;
  const abierto = await request(app).post(`/api/v1/cortes/${corteId}/abrir`);
  const opId = abierto.body.data.operaciones[0].id;
  await request(app)
    .put(`/api/v1/cortes/${corteId}/operaciones/${opId}/asignaciones`)
    .send({ asignaciones: [{ operarioId, cantidad: monto }] });
  return corteId;
}

async function corteCerrado(operarioId: string, monto: number, fechaCierreISO: string) {
  const corteId = await corteAsignado(operarioId, monto);
  const cierre = await request(app)
    .post(`/api/v1/cortes/${corteId}/cerrar`)
    .send({ fechaCierre: fechaCierreISO });
  expect(cierre.status).toBe(200);
  return corteId;
}

function cerrarMes(anio: number, mes: number, excepciones: object[] = []) {
  return request(app).post('/api/v1/liquidacion/cerrar-mes').send({ anio, mes, excepciones });
}

async function limpiar() {
  await prisma.liquidacion.deleteMany({});
  await prisma.periodo.deleteMany({});
  await prisma.anticipo.deleteMany({ where: { operario: { nombre: { startsWith: 'TEST MC' } } } });
  await prisma.asignacion.deleteMany({ where: { operario: { nombre: { startsWith: 'TEST MC' } } } });
  const cortes = await prisma.corte.findMany({
    where: { version: { modelo: { nombre: 'TEST MODELO MC' } } },
    select: { id: true },
  });
  const ids = cortes.map((c) => c.id);
  await prisma.asignacion.deleteMany({ where: { corteOperacion: { corteId: { in: ids } } } });
  await prisma.corteOperacion.deleteMany({ where: { corteId: { in: ids } } });
  await prisma.corte.deleteMany({ where: { id: { in: ids } } });
  await prisma.operacion.deleteMany({ where: { version: { modelo: { nombre: 'TEST MODELO MC' } } } });
  await prisma.modeloVersion.deleteMany({ where: { modelo: { nombre: 'TEST MODELO MC' } } });
  await prisma.modelo.deleteMany({ where: { nombre: 'TEST MODELO MC' } });
  await prisma.operario.deleteMany({ where: { nombre: { startsWith: 'TEST MC' } } });
}

let anaId: string;

beforeAll(async () => {
  await limpiar();
  const modelo = await request(app)
    .post('/api/v1/modelos')
    .send({
      nombre: 'TEST MODELO MC',
      operaciones: [{ grupo: 'G', n: '1', equipo: 'recta', proceso: 'p', pieza: null, ct: 1 }],
    });
  versionId = modelo.body.data.id;
  anaId = await crearOperario('TEST MC ANA');
});

afterAll(async () => {
  await limpiar();
  await prisma.$disconnect();
});

describe('meses liquidados: integridad de fechas y orden de cierre', () => {
  test('el arrastre atraviesa un mes vacío sin cerrar', async () => {
    // enero 2097: ANA gana 50000, cobra 20000 y arrastra 30000
    await corteCerrado(anaId, 50000, '2097-01-10T12:00:00.000Z');
    const cierre = await cerrarMes(2097, 1, [
      { operarioId: anaId, pagado: 20000, arrastraSaldo: true },
    ]);
    expect(cierre.status).toBe(200);

    // febrero queda vacío y sin cerrar; en marzo el arrastre NO debe perderse
    const marzo = await request(app).get('/api/v1/liquidacion?anio=2097&mes=3');
    const fila = marzo.body.data.filas.find((f: { operarioId: string }) => f.operarioId === anaId);
    expect(fila.saldoEntrada).toBe(30000);
  });

  test('no se puede cerrar un mes saltando otro con movimientos', async () => {
    // febrero 2097 tiene un corte cerrado sin liquidar
    await corteCerrado(anaId, 10000, '2097-02-10T12:00:00.000Z');

    const marzo = await cerrarMes(2097, 3);
    expect(marzo.status).toBe(409);
    expect(marzo.body.error.code).toBe('CIERRE_FUERA_DE_ORDEN');
  });

  test('no se puede cerrar un mes anterior al último cierre', async () => {
    const dic96 = await cerrarMes(2096, 12);
    expect(dic96.status).toBe(409);
    expect(dic96.body.error.code).toBe('CIERRE_FUERA_DE_ORDEN');
  });

  test('no se puede cerrar un corte con fecha en un mes ya liquidado', async () => {
    const corteId = await corteAsignado(anaId, 5000);
    const enero = await request(app)
      .post(`/api/v1/cortes/${corteId}/cerrar`)
      .send({ fechaCierre: '2097-01-15T12:00:00.000Z' });
    expect(enero.status).toBe(409);
    expect(enero.body.error.code).toBe('MES_LIQUIDADO');

    // tampoco con fecha anterior al último cierre aunque ese mes no tenga Periodo
    const dic96 = await request(app)
      .post(`/api/v1/cortes/${corteId}/cerrar`)
      .send({ fechaCierre: '2096-12-15T12:00:00.000Z' });
    expect(dic96.status).toBe(409);
    expect(dic96.body.error.code).toBe('MES_LIQUIDADO');

    // con fecha en mes abierto sí se cierra
    const feb = await request(app)
      .post(`/api/v1/cortes/${corteId}/cerrar`)
      .send({ fechaCierre: '2097-02-20T12:00:00.000Z' });
    expect(feb.status).toBe(200);
  });

  test('no se puede registrar un anticipo con fecha en un mes ya liquidado', async () => {
    const res = await request(app)
      .post('/api/v1/anticipos')
      .send({ operarioId: anaId, fecha: '2097-01-10T12:00:00.000Z', monto: 1000 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MES_LIQUIDADO');
  });

  test('no se puede mover un anticipo hacia un mes ya liquidado', async () => {
    const creado = await request(app)
      .post('/api/v1/anticipos')
      .send({ operarioId: anaId, fecha: '2097-02-14T12:00:00.000Z', monto: 1000 });
    expect(creado.status).toBe(201);
    const id = creado.body.data.anticipo.id;

    const movido = await request(app)
      .patch(`/api/v1/anticipos/${id}`)
      .send({ fecha: '2097-01-14T12:00:00.000Z' });
    expect(movido.status).toBe(409);
    expect(movido.body.error.code).toBe('MES_LIQUIDADO');
  });

  test('un anticipo ya liquidado no se puede editar ni eliminar', async () => {
    // se inserta directo en BD: la API ya no permite crearlo en un mes cerrado
    const liquidado = await prisma.anticipo.create({
      data: { operarioId: anaId, fecha: new Date('2097-01-20T12:00:00.000Z'), monto: 2000 },
    });

    const editado = await request(app)
      .patch(`/api/v1/anticipos/${liquidado.id}`)
      .send({ monto: 9999 });
    expect(editado.status).toBe(409);
    expect(editado.body.error.code).toBe('MES_LIQUIDADO');

    const borrado = await request(app).delete(`/api/v1/anticipos/${liquidado.id}`);
    expect(borrado.status).toBe(409);
    expect(borrado.body.error.code).toBe('MES_LIQUIDADO');
  });

  test('la rendición de un mes cerrado muestra los valores persistidos', async () => {
    // cerrar febrero (corte 10000 + corte 5000 + anticipo 1000 de los tests previos)
    const cierre = await cerrarMes(2097, 2);
    expect(cierre.status).toBe(200);

    // si los datos vivos divergieran (no debería pasar con los guards), manda lo persistido
    await prisma.liquidacion.updateMany({
      where: { operarioId: anaId, periodo: { anio: 2097, mes: 2 } },
      data: { totalGanado: 777777 },
    });

    const res = await request(app).get(`/api/v1/rendicion/${anaId}?anio=2097&mes=2`);
    expect(res.status).toBe(200);
    expect(res.body.data.cerrado).toBe(true);
    expect(res.body.data.totalGanado).toBe(777777);
  });
});

describe('validación de plus por talla', () => {
  test('el plus no puede tener más entradas que tallas', async () => {
    const res = await request(app)
      .post('/api/v1/cortes')
      .send({ ...(await datosCorte()), modeloVersionId: versionId, tallas: [1], cortePorTalla: [10], plusPorTalla: [1, 2] });
    expect(res.status).toBe(400);
  });
});
