// Rebanada 6 — módulo liquidación: consolidado por mes (ganado de cortes cerrados
// + anticipos + saldo con arrastre) y cierre de mes persistido con la excepción
// arrastra_saldo. Usa año 2099 para aislar Periodos; limpia todo en afterAll.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { prisma } from './helpers/db.js';

const app = crearApp();

// modelo de prueba con 1 operación ct=1 centavo → ganado = cantidad asignada
let versionId: string;

async function crearOperario(nombre: string): Promise<string> {
  const res = await request(app).post('/api/v1/operarios').send({ nombre });
  return res.body.data.id;
}

/** Crea un corte cerrado que hace ganar exactamente `monto` centavos al operario. */
async function corteCerrado(operarioId: string, monto: number, fechaCierreISO: string) {
  const creado = await request(app)
    .post('/api/v1/cortes')
    .send({ modeloVersionId: versionId, tallas: [1], cortePorTalla: [monto], plusPorTalla: [] });
  const corteId = creado.body.data.id;
  const abierto = await request(app).post(`/api/v1/cortes/${corteId}/abrir`);
  const opId = abierto.body.data.operaciones[0].id;
  await request(app)
    .put(`/api/v1/cortes/${corteId}/operaciones/${opId}/asignaciones`)
    .send({ asignaciones: [{ operarioId, cantidad: monto }] });
  const cierre = await request(app)
    .post(`/api/v1/cortes/${corteId}/cerrar`)
    .send({ fechaCierre: fechaCierreISO });
  expect(cierre.status).toBe(200);
  return corteId;
}

function anticipo(operarioId: string, monto: number, fechaISO: string) {
  return request(app).post('/api/v1/anticipos').send({ operarioId, fecha: fechaISO, monto });
}

async function limpiar() {
  await prisma.liquidacion.deleteMany({});
  await prisma.periodo.deleteMany({});
  await prisma.anticipo.deleteMany({ where: { operario: { nombre: { startsWith: 'TEST LIQ' } } } });
  await prisma.asignacion.deleteMany({ where: { operario: { nombre: { startsWith: 'TEST LIQ' } } } });
  // borra cortes de prueba (todos los que apunten al modelo de prueba)
  const cortes = await prisma.corte.findMany({
    where: { version: { modelo: { nombre: 'TEST MODELO LIQ' } } },
    select: { id: true },
  });
  const ids = cortes.map((c) => c.id);
  await prisma.asignacion.deleteMany({ where: { corteOperacion: { corteId: { in: ids } } } });
  await prisma.corteOperacion.deleteMany({ where: { corteId: { in: ids } } });
  await prisma.corte.deleteMany({ where: { id: { in: ids } } });
  await prisma.operacion.deleteMany({ where: { version: { modelo: { nombre: 'TEST MODELO LIQ' } } } });
  await prisma.modeloVersion.deleteMany({ where: { modelo: { nombre: 'TEST MODELO LIQ' } } });
  await prisma.modelo.deleteMany({ where: { nombre: 'TEST MODELO LIQ' } });
  await prisma.operario.deleteMany({ where: { nombre: { startsWith: 'TEST LIQ' } } });
}

beforeAll(async () => {
  await limpiar();
  const modelo = await request(app)
    .post('/api/v1/modelos')
    .send({
      nombre: 'TEST MODELO LIQ',
      operaciones: [
        { grupo: 'G', n: '1', equipo: 'recta', proceso: 'p', pieza: null, ct: 1 },
      ],
    });
  versionId = modelo.body.data.id;
});

afterAll(async () => {
  await limpiar();
  await prisma.$disconnect();
});

describe('GET /api/v1/liquidacion — consolidado en vivo', () => {
  test('CA-5.1: ganado suma varios cortes cerrados del mes por operario', async () => {
    const rubenT = await crearOperario('TEST LIQ RUBEN');
    await corteCerrado(rubenT, 124620, '2099-03-10T12:00:00.000Z');
    await corteCerrado(rubenT, 46500, '2099-03-20T12:00:00.000Z');

    const res = await request(app).get('/api/v1/liquidacion?anio=2099&mes=3');
    expect(res.status).toBe(200);
    const fila = res.body.data.filas.find((f: { operarioId: string }) => f.operarioId === rubenT);
    expect(fila.ganado).toBe(171120); // CA-5.1
    expect(fila.saldoPeriodo).toBe(171120); // sin anticipos ni entrada
    expect(res.body.data.cerrado).toBe(false);
  });

  test('CA-5.3: saldo = ganado − anticipos (CHEMA 243.60 − 500 = −256.40)', async () => {
    const chemaT = await crearOperario('TEST LIQ CHEMA');
    await corteCerrado(chemaT, 24360, '2099-04-15T12:00:00.000Z');
    await anticipo(chemaT, 50000, '2099-04-18T12:00:00.000Z');

    const res = await request(app).get('/api/v1/liquidacion?anio=2099&mes=4');
    const fila = res.body.data.filas.find((f: { operarioId: string }) => f.operarioId === chemaT);
    expect(fila.ganado).toBe(24360);
    expect(fila.anticipos).toBe(50000);
    expect(fila.saldoPeriodo).toBe(-25640); // CA-5.3
  });

  test('CA-5.2: un corte abierto no entra en el ganado del mes', async () => {
    const opT = await crearOperario('TEST LIQ ABIERTO');
    // corte abierto (no cerrado) en mayo 2099
    const creado = await request(app)
      .post('/api/v1/cortes')
      .send({ modeloVersionId: versionId, tallas: [1], cortePorTalla: [99999], plusPorTalla: [] });
    const abierto = await request(app).post(`/api/v1/cortes/${creado.body.data.id}/abrir`);
    await request(app)
      .put(`/api/v1/cortes/${creado.body.data.id}/operaciones/${abierto.body.data.operaciones[0].id}/asignaciones`)
      .send({ asignaciones: [{ operarioId: opT, cantidad: 99999 }] });

    const res = await request(app).get('/api/v1/liquidacion?anio=2099&mes=5');
    const fila = res.body.data.filas.find((f: { operarioId: string }) => f.operarioId === opT);
    // aparece (es activo) pero con ganado 0
    expect(fila.ganado).toBe(0);
  });
});

describe('POST /api/v1/liquidacion/cerrar-mes', () => {
  test('CA-5.4: cerrar con saldo negativo arrastra −25640 al mes siguiente', async () => {
    const chemaT = await crearOperario('TEST LIQ CHEMA2');
    await corteCerrado(chemaT, 24360, '2099-06-15T12:00:00.000Z');
    await anticipo(chemaT, 50000, '2099-06-18T12:00:00.000Z');

    const cierre = await request(app)
      .post('/api/v1/liquidacion/cerrar-mes')
      .send({ anio: 2099, mes: 6, excepciones: [] });
    expect(cierre.status).toBe(200);
    expect(cierre.body.data.cerrado).toBe(true);
    const filaCierre = cierre.body.data.filas.find(
      (f: { operarioId: string }) => f.operarioId === chemaT,
    );
    expect(filaCierre.saldoPeriodo).toBe(-25640);
    expect(filaCierre.pagado).toBe(0);
    expect(filaCierre.saldoSalida).toBe(-25640);

    // el mes siguiente (julio) arranca con saldoEntrada −25640 para CHEMA
    const julio = await request(app).get('/api/v1/liquidacion?anio=2099&mes=7');
    const filaJulio = julio.body.data.filas.find(
      (f: { operarioId: string }) => f.operarioId === chemaT,
    );
    expect(filaJulio.saldoEntrada).toBe(-25640); // CA-5.4
  });

  test('CA-6.1 / CA-6.2 / CA-6.3: cierre normal y excepción de arrastre', async () => {
    const normalT = await crearOperario('TEST LIQ NORMAL');
    const teoT = await crearOperario('TEST LIQ TEO');
    await corteCerrado(normalT, 80000, '2099-08-10T12:00:00.000Z');
    await corteCerrado(teoT, 80000, '2099-08-12T12:00:00.000Z');

    const cierre = await request(app)
      .post('/api/v1/liquidacion/cerrar-mes')
      .send({
        anio: 2099,
        mes: 8,
        // TEO viaja: cobra solo 50000, arrastra el resto (CA-6.2)
        excepciones: [{ operarioId: teoT, pagado: 50000, arrastraSaldo: true }],
      });
    expect(cierre.status).toBe(200);

    const normal = cierre.body.data.filas.find((f: { operarioId: string }) => f.operarioId === normalT);
    expect(normal.pagado).toBe(80000); // CA-6.1
    expect(normal.saldoSalida).toBe(0);

    const teo = cierre.body.data.filas.find((f: { operarioId: string }) => f.operarioId === teoT);
    expect(teo.pagado).toBe(50000); // CA-6.2
    expect(teo.saldoSalida).toBe(30000);

    // CA-6.3: septiembre arranca en 0 para el operario normal; TEO con 30000
    const sep = await request(app).get('/api/v1/liquidacion?anio=2099&mes=9');
    const normalSep = sep.body.data.filas.find((f: { operarioId: string }) => f.operarioId === normalT);
    expect(normalSep.saldoEntrada).toBe(0); // CA-6.3
    const teoSep = sep.body.data.filas.find((f: { operarioId: string }) => f.operarioId === teoT);
    expect(teoSep.saldoEntrada).toBe(30000);
  });

  test('no se puede cerrar dos veces el mismo mes', async () => {
    const opT = await crearOperario('TEST LIQ DOBLE');
    await corteCerrado(opT, 10000, '2099-10-10T12:00:00.000Z');
    const primero = await request(app)
      .post('/api/v1/liquidacion/cerrar-mes')
      .send({ anio: 2099, mes: 10, excepciones: [] });
    expect(primero.status).toBe(200);

    const segundo = await request(app)
      .post('/api/v1/liquidacion/cerrar-mes')
      .send({ anio: 2099, mes: 10, excepciones: [] });
    expect(segundo.status).toBe(409);
    expect(segundo.body.error.code).toBe('MES_YA_CERRADO');
  });

  test('un mes cerrado se muestra con sus valores persistidos', async () => {
    // el mes 6 quedó cerrado en un test anterior
    const res = await request(app).get('/api/v1/liquidacion?anio=2099&mes=6');
    expect(res.body.data.cerrado).toBe(true);
    expect(res.body.data.fechaCierre).not.toBeNull();
  });
});
