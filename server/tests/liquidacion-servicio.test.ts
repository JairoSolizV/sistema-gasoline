// Rebanada 5 del servicio de corte (docs/PLAN_SERVICIO_CORTE.md), con cuentas
// separadas (PLAN_CUENTAS_SEPARADAS.md): costura (por fechaCierre), servicio de
// corte y moldes (por la fecha de cada trabajo) van cada uno en su cuenta, con
// sus filas, semanas y totales; se persisten al cerrar el mes; la rendición
// muestra cada cuenta aparte y sin datos de compañeros.
// Usa marzo de 2031 para no cruzarse con los meses de otros tests.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import type { ConsolidadoDTO, Cuenta } from '@taller/shared';
import { crearApp } from '../src/app.js';
import { prisma } from './helpers/db.js';
import { datosCorte } from './helpers/corte.js';
import { datosOperario } from './helpers/operario.js';
import { cuentaDe, filaDe, saldoDe } from './helpers/cuentas.js';

const app = crearApp();
const ids: Record<string, string> = {};
const f = (dia: number, mes = 3) => `2031-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}T12:00:00.000Z`;

async function operario(clave: string, roles: string[], extra: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/v1/operarios')
    .send({ nombre: `TEST LS ${clave}`, ...datosOperario({ roles, ...extra }) });
  ids[clave] = res.body.data.id;
}

async function limpiar() {
  await prisma.liquidacion.deleteMany({ where: { periodo: { anio: 2031 } } });
  await prisma.periodo.deleteMany({ where: { anio: 2031 } });
  const filtroModelo = { modelo: { nombre: { startsWith: 'TEST MODELO LS' } } };
  const cortes = await prisma.corte.findMany({ where: { version: filtroModelo }, select: { id: true } });
  const corteIds = cortes.map((c) => c.id);
  await prisma.asignacion.deleteMany({ where: { corteOperacion: { corteId: { in: corteIds } } } });
  await prisma.corteOperacion.deleteMany({ where: { corteId: { in: corteIds } } });
  await prisma.corte.deleteMany({ where: { id: { in: corteIds } } }); // trabajos en cascada
  await prisma.operacion.deleteMany({ where: { version: filtroModelo } });
  await prisma.modeloVersion.deleteMany({ where: filtroModelo }); // moldes en cascada
  await prisma.modelo.deleteMany({ where: { nombre: { startsWith: 'TEST MODELO LS' } } });
  await prisma.operario.deleteMany({ where: { nombre: { startsWith: 'TEST LS' } } });
}

const consolidado = async () =>
  (await request(app).get('/api/v1/liquidacion?anio=2031&mes=3')).body.data as ConsolidadoDTO;
const fila = (c: ConsolidadoDTO, clave: string, cuenta: Cuenta) => filaDe(c, ids[clave], cuenta);

beforeAll(async () => {
  await limpiar();
  await operario('COSTURA', ['costurero']);
  await operario('TRAZ', ['trazador']);
  await operario('DOB1', ['doblador']);
  await operario('DOB2', ['doblador']);
  await operario('CORT', ['cortador'], { tarifaCorte: 25 });
  await operario('CLAS', ['clasificador']);
  await operario('BUSC', ['buscador']);
  await operario('MOLD', ['moldista']);

  // modelo con buscador y moldes del 03/03 (Bs 200)
  const v1 = await request(app)
    .post('/api/v1/modelos')
    .send({
      nombre: 'TEST MODELO LS',
      operaciones: [{ grupo: 'G', n: '1', equipo: 'recta', proceso: 'pinza', pieza: null, ct: 20 }],
      buscadorId: ids.BUSC,
      molde: { moldistaId: ids.MOLD, fecha: f(3) },
    });
  const versionId = v1.body.data.id;

  // corte interno de 721 prendas
  const creado = await request(app)
    .post('/api/v1/cortes')
    .send({ ...(await datosCorte({ esInterno: true })), modeloVersionId: versionId, tallas: [1], cortePorTalla: [721] });
  const corte = (await request(app).post(`/api/v1/cortes/${creado.body.data.id}/abrir`)).body.data;
  const proc = (p: string, body: Record<string, unknown>) =>
    request(app).put(`/api/v1/cortes/${corte.id}/procesos/${p}`).send(body);

  await proc('trazado', { fecha: f(4), personas: [{ operarioId: ids.TRAZ }] }); // 216.30
  await proc('doblado', {
    fecha: f(4),
    modalidad: 'hoja',
    personas: [{ operarioId: ids.DOB1 }, { operarioId: ids.DOB2 }],
  }); // 54.08 + 54.07
  await proc('corte', { fecha: f(11), personas: [{ operarioId: ids.CORT }] }); // 180.25 + búsqueda 72.10
  await proc('clasificacion', { fecha: f(12), personas: [{ operarioId: ids.CLAS }] }); // 72.10

  // costura: 721 × 0.20 = 144.20, corte cerrado el 20/03
  await request(app)
    .put(`/api/v1/cortes/${corte.id}/operaciones/${corte.operaciones[0].id}/asignaciones`)
    .send({ asignaciones: [{ operarioId: ids.COSTURA, cantidad: 721 }] });
  const cierre = await request(app).post(`/api/v1/cortes/${corte.id}/cerrar`).send({ fechaCierre: f(20) });
  expect(cierre.status).toBe(200);
});

afterAll(async () => {
  await limpiar();
  await prisma.$disconnect();
});

describe('consolidado del mes con servicio de corte y moldes', () => {
  test('cada operario gana lo suyo, en la cuenta de cada tipo de trabajo', async () => {
    const c = await consolidado();
    const esperado: Record<string, [number, number, number]> = {
      // [operaciones, servicio de corte, moldes]
      COSTURA: [14420, 0, 0],
      TRAZ: [0, 21630, 0],
      DOB1: [0, 5408, 0],
      DOB2: [0, 5407, 0],
      CORT: [0, 18025, 0],
      CLAS: [0, 7210, 0],
      BUSC: [0, 7210, 0],
      MOLD: [0, 0, 20000],
    };
    for (const [clave, montos] of Object.entries(esperado)) {
      (['operaciones', 'servicio_corte', 'moldes'] as const).forEach((cuenta, i) => {
        const fl = fila(c, clave, cuenta);
        if (montos[i] === 0) {
          expect(fl, `${clave} no tiene fila en ${cuenta}`).toBeUndefined();
        } else {
          expect(fl.ganado, `${clave} ${cuenta}`).toBe(montos[i]);
          expect(fl.saldoPeriodo, `${clave} ${cuenta}`).toBe(montos[i]); // sin anticipos ni arrastre
        }
      });
    }
  });

  test('en cada cuenta, totales y semanas cuadran con sus filas', async () => {
    const c = await consolidado();
    for (const cuenta of c.cuentas) {
      expect(cuenta.totales.ganado, cuenta.cuenta).toBe(cuenta.filas.reduce((a, x) => a + x.ganado, 0));
      // lo de este test está entero en las semanas de marzo
      expect(cuenta.semanas.reduce((a, s) => a + s.ganado, 0), cuenta.cuenta).toBe(cuenta.totales.ganado);
    }
    expect(cuentaDe(c, 'servicio_corte').totales.ganado).toBeGreaterThanOrEqual(
      21630 + 10815 + 18025 + 7210 + 7210,
    );
    // la semana del 3 y 4 de marzo trae moldes + trazado + doblado, y ningún cierre de costura
    const semana = (cuenta: Cuenta) =>
      cuentaDe(c, cuenta).semanas.find((x) => x.inicioISO <= f(4) && f(4) <= x.finISO)!;
    expect(semana('moldes').ganado).toBeGreaterThanOrEqual(20000);
    expect(semana('servicio_corte').ganado).toBeGreaterThanOrEqual(21630 + 10815);
    expect(semana('operaciones').cortesCerrados).toBe(0);
  });
});

describe('rendición: separada por tipo y sin datos de compañeros', () => {
  test('el doblador ve solo su mitad, sin el nombre ni la parte del otro', async () => {
    const res = await request(app).get(`/api/v1/rendicion/${ids.DOB1}?anio=2031&mes=3`);
    expect(res.status).toBe(200);
    const r = res.body.data;
    expect(r.cortes).toEqual([]); // no cosió
    expect(r.servicioCorte).toHaveLength(1);
    expect(r.servicioCorte[0]).toMatchObject({
      proceso: 'doblado',
      modalidad: 'hoja',
      cantidad: 721,
      tarifa: 15,
      total: 5408,
      fecha: f(4),
      modeloNombre: 'TEST MODELO LS',
    });
    // solo la cuenta del servicio de corte: no se mezcla con operaciones
    expect(r.cuentas.map((x: { cuenta: string }) => x.cuenta)).toEqual(['servicio_corte']);
    expect(saldoDe(r, 'servicio_corte')).toMatchObject({ ganado: 5408, anticipos: 0, saldoPeriodo: 5408 });
    const json = JSON.stringify(r);
    expect(json).not.toContain('TEST LS DOB2');
    expect(json).not.toContain('5407');
  });

  test('moldes y búsqueda aparecen en su propia sección', async () => {
    const mold = (await request(app).get(`/api/v1/rendicion/${ids.MOLD}?anio=2031&mes=3`)).body.data;
    expect(mold.moldes).toEqual([
      { modeloNombre: 'TEST MODELO LS', numeroVersion: 1, tipo: 'nuevo', fecha: f(3), monto: 20000 },
    ]);
    expect(saldoDe(mold, 'moldes').ganado).toBe(20000);

    const busc = (await request(app).get(`/api/v1/rendicion/${ids.BUSC}?anio=2031&mes=3`)).body.data;
    expect(busc.servicioCorte.map((t: { proceso: string; total: number }) => [t.proceso, t.total])).toEqual([
      ['busqueda', 7210],
    ]);
  });
});

describe('cierre del mes', () => {
  test('no se puede cerrar marzo si febrero tiene trabajos sin liquidar', async () => {
    // último cierre en enero; un molde fechado en febrero queda en el medio
    await prisma.periodo.create({
      data: { anio: 2031, mes: 1, estado: 'cerrado', fechaCierre: new Date(f(1, 2)) },
    });
    const otro = await request(app)
      .post('/api/v1/modelos')
      .send({
        nombre: 'TEST MODELO LS FEB',
        operaciones: [{ grupo: 'G', n: '1', equipo: 'recta', proceso: 'pinza', pieza: null, ct: 20 }],
        molde: { moldistaId: ids.MOLD, fecha: f(10, 2) },
      });
    try {
      const res = await request(app).post('/api/v1/liquidacion/cerrar-mes').send({ anio: 2031, mes: 3, excepciones: [] });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CIERRE_FUERA_DE_ORDEN');
    } finally {
      await prisma.pagoMolde.deleteMany({ where: { modeloVersionId: otro.body.data.id } });
      await prisma.periodo.deleteMany({ where: { anio: 2031, mes: 1 } });
    }
  });

  test('al cerrar, cada cuenta queda guardada aparte y la rendición usa lo liquidado', async () => {
    const res = await request(app).post('/api/v1/liquidacion/cerrar-mes').send({ anio: 2031, mes: 3, excepciones: [] });
    expect(res.status).toBe(200);
    const c = res.body.data as ConsolidadoDTO;
    expect(c.cerrado).toBe(true);
    expect(fila(c, 'DOB2', 'servicio_corte')).toMatchObject({ ganado: 5407, pagado: 5407, saldoSalida: 0 });
    expect(fila(c, 'MOLD', 'moldes').ganado).toBe(20000);
    expect(fila(c, 'COSTURA', 'operaciones').ganado).toBe(14420);
    expect(fila(c, 'COSTURA', 'servicio_corte')).toBeUndefined();

    const guardadas = await prisma.liquidacion.findMany({
      where: { operarioId: ids.TRAZ, periodo: { anio: 2031, mes: 3 } },
    });
    expect(guardadas.map((l) => [l.cuenta, l.totalGanado])).toEqual([['servicio_corte', 21630]]);

    const r = (await request(app).get(`/api/v1/rendicion/${ids.TRAZ}?anio=2031&mes=3`)).body.data;
    expect(r.cerrado).toBe(true);
    expect(r.cuentas).toEqual([
      {
        cuenta: 'servicio_corte',
        saldoEntrada: 0,
        ganado: 21630,
        anticipos: 0,
        saldoPeriodo: 21630,
        pagado: 21630,
        saldoSalida: 0,
      },
    ]);

    // mes liquidado: ya no se puede tocar un trabajo de ese mes
    const corte = await prisma.trabajoCorte.findFirstOrThrow({ where: { operarioId: ids.TRAZ } });
    const tarde = await request(app)
      .delete(`/api/v1/cortes/${corte.corteId}/procesos/trazado`);
    expect(tarde.status).toBe(409); // el corte ya está cerrado
  });
});
