// Rebanada 4 — módulo cortes: snapshot inmutable (CA-1.4), cantidad con PLUS
// (CA-2.x), asignación con suma exacta (CA-3.x), maestro externo (CA-4.1/4.2),
// cuadre de centavos (CA-8.1) y cierre bloqueado (CA-8.3).
// Limpieza total en afterAll: el seed no tiene cortes, así que se borran todos.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { prisma } from './helpers/db.js';

const app = crearApp();

let rubenId: string;
let clarisId: string;
let marioId: string;
// modelo de prueba con CTs conocidos: pinza 15, urlado 20, ensamble 50 → Σ 85
let versionTestId: string;

beforeAll(async () => {
  const operarios = await prisma.operario.findMany();
  rubenId = operarios.find((o) => o.nombre === 'RUBEN')!.id;
  clarisId = operarios.find((o) => o.nombre === 'CLARIS')!.id;
  marioId = operarios.find((o) => o.nombre === 'MARIO')!.id;

  const res = await request(app)
    .post('/api/v1/modelos')
    .send({
      nombre: 'TEST MODELO CORTES',
      operaciones: [
        { grupo: 'TRASEROS', n: '1', equipo: 'recta', proceso: 'pinza', pieza: 'trasero', ct: 15 },
        { grupo: 'TRASEROS', n: '2', equipo: 'codo', proceso: 'urlado', pieza: 'trasero', ct: 20 },
        { grupo: 'ENSAMBLE', n: '1', equipo: 'plana', proceso: 'ensamble', pieza: 'delantero', ct: 50 },
      ],
    });
  versionTestId = res.body.data.id;
});

afterAll(async () => {
  await prisma.asignacion.deleteMany({});
  await prisma.corteOperacion.deleteMany({});
  await prisma.corte.deleteMany({});
  const modelosTest = await prisma.modelo.findMany({
    where: { nombre: { startsWith: 'TEST MODELO' } },
    select: { id: true },
  });
  const ids = modelosTest.map((m) => m.id);
  await prisma.operacion.deleteMany({ where: { version: { modeloId: { in: ids } } } });
  await prisma.modeloVersion.deleteMany({ where: { modeloId: { in: ids } } });
  await prisma.modelo.deleteMany({ where: { id: { in: ids } } });
  await prisma.operario.deleteMany({ where: { nombre: { startsWith: 'TEST ' } } });
  await prisma.$disconnect();
});

async function crearCorteAbierto(
  cortePorTalla = [62, 62, 62, 62, 62, 62],
  plusPorTalla: number[] = [],
  versionId = versionTestId,
) {
  const creado = await request(app).post('/api/v1/cortes').send({
    modeloVersionId: versionId,
    tallas: [28, 30, 32, 34, 36, 38].slice(0, cortePorTalla.length),
    cortePorTalla,
    plusPorTalla,
  });
  expect(creado.status).toBe(201);
  const abierto = await request(app).post(`/api/v1/cortes/${creado.body.data.id}/abrir`);
  expect(abierto.status).toBe(200);
  return abierto.body.data;
}

describe('crear y abrir corte (snapshot)', () => {
  test('CA-2.1: borrador calcula cantidad 372 y abrir genera snapshot sin_asignar', async () => {
    const detalle = await crearCorteAbierto();
    expect(detalle.cantidadTotal).toBe(372);
    expect(detalle.estado).toBe('abierto');
    expect(detalle.operaciones).toHaveLength(3);
    expect(detalle.operaciones.every((o: { estado: string }) => o.estado === 'sin_asignar')).toBe(true);
    expect(detalle.operaciones.every((o: { cantidadObjetivo: number }) => o.cantidadObjetivo === 372)).toBe(true);
    expect(detalle.costoManoObraPrenda).toBe(85);
  });

  test('CA-2.2: el PLUS se paga — 5×62 + plus 62 → objetivo 372, no 310', async () => {
    const detalle = await crearCorteAbierto([62, 62, 62, 62, 62], [62]);
    expect(detalle.cantidadTotal).toBe(372);
    expect(detalle.operaciones[0].cantidadObjetivo).toBe(372);
  });

  test('corte sin piezas no se puede crear', async () => {
    const res = await request(app).post('/api/v1/cortes').send({
      modeloVersionId: versionTestId,
      tallas: [28],
      cortePorTalla: [0],
      plusPorTalla: [],
    });
    expect(res.status).toBe(400);
  });

  test('abrir dos veces responde 409', async () => {
    const detalle = await crearCorteAbierto();
    const otra = await request(app).post(`/api/v1/cortes/${detalle.id}/abrir`);
    expect(otra.status).toBe(409);
  });

  test('CA-1.4: editar la tarifa de la versión NO cambia el corte ya abierto', async () => {
    const detalle = await crearCorteAbierto();
    const opPinza = detalle.operaciones.find((o: { proceso: string }) => o.proceso === 'pinza');
    expect(opPinza.ct).toBe(15);

    // editar la plantilla: pinza 15 → 99
    const version = await request(app).get(`/api/v1/versiones/${versionTestId}`);
    const plantillaPinza = version.body.data.operaciones.find(
      (o: { proceso: string }) => o.proceso === 'pinza',
    );
    await request(app).patch(`/api/v1/operaciones/${plantillaPinza.id}`).send({ ct: 99 });

    // el snapshot sigue en 15 y el pago usa 15
    const releido = await request(app).get(`/api/v1/cortes/${detalle.id}`);
    const opReleida = releido.body.data.operaciones.find(
      (o: { proceso: string }) => o.proceso === 'pinza',
    );
    expect(opReleida.ct).toBe(15);

    const asignado = await request(app)
      .put(`/api/v1/cortes/${detalle.id}/operaciones/${opReleida.id}/asignaciones`)
      .send({ asignaciones: [{ operarioId: rubenId, cantidad: 372 }] });
    expect(asignado.status).toBe(200);
    const opAsignada = asignado.body.data.operaciones.find(
      (o: { proceso: string }) => o.proceso === 'pinza',
    );
    expect(opAsignada.asignaciones[0].total).toBe(5580); // 372×15, no 372×99

    // restaurar la plantilla para no ensuciar otros tests
    await request(app).patch(`/api/v1/operaciones/${plantillaPinza.id}`).send({ ct: 15 });
  });
});

describe('asignaciones — suma exacta y límites', () => {
  test('CA-3.1: un solo operario con las 372 → asignada, Bs 55.80', async () => {
    const detalle = await crearCorteAbierto();
    const op = detalle.operaciones[0]; // pinza ct 15
    const res = await request(app)
      .put(`/api/v1/cortes/${detalle.id}/operaciones/${op.id}/asignaciones`)
      .send({ asignaciones: [{ operarioId: rubenId, cantidad: 372 }] });
    expect(res.status).toBe(200);
    const opRes = res.body.data.operaciones[0];
    expect(opRes.estado).toBe('asignada');
    expect(opRes.asignaciones[0].total).toBe(5580);
    expect(opRes.asignaciones[0].tarifaEfectiva).toBe(15);
  });

  test('CA-3.2: división 300 + 72 → asignada con Bs 45.00 y Bs 10.80', async () => {
    const detalle = await crearCorteAbierto();
    const op = detalle.operaciones[0];
    const res = await request(app)
      .put(`/api/v1/cortes/${detalle.id}/operaciones/${op.id}/asignaciones`)
      .send({
        asignaciones: [
          { operarioId: rubenId, cantidad: 300 },
          { operarioId: clarisId, cantidad: 72 },
        ],
      });
    const opRes = res.body.data.operaciones[0];
    expect(opRes.estado).toBe('asignada');
    expect(opRes.diferencia).toBe(0);
    expect(opRes.asignaciones.map((a: { total: number }) => a.total)).toEqual([4500, 1080]);
  });

  test('CA-3.3 / CA-8.3: suma incompleta queda parcial (faltan 22) y bloquea el cierre', async () => {
    const detalle = await crearCorteAbierto();
    const op = detalle.operaciones[0];
    const res = await request(app)
      .put(`/api/v1/cortes/${detalle.id}/operaciones/${op.id}/asignaciones`)
      .send({
        asignaciones: [
          { operarioId: rubenId, cantidad: 300 },
          { operarioId: clarisId, cantidad: 50 },
        ],
      });
    const opRes = res.body.data.operaciones[0];
    expect(opRes.estado).toBe('parcial');
    expect(opRes.diferencia).toBe(22);

    const cierre = await request(app).post(`/api/v1/cortes/${detalle.id}/cerrar`).send({});
    expect(cierre.status).toBe(409);
    expect(cierre.body.error.code).toBe('CORTE_INCOMPLETO');
  });

  test('CA-3.4: suma excedida (400) queda parcial con sobrante 28', async () => {
    const detalle = await crearCorteAbierto();
    const op = detalle.operaciones[0];
    const res = await request(app)
      .put(`/api/v1/cortes/${detalle.id}/operaciones/${op.id}/asignaciones`)
      .send({ asignaciones: [{ operarioId: rubenId, cantidad: 400 }] });
    const opRes = res.body.data.operaciones[0];
    expect(opRes.estado).toBe('parcial');
    expect(opRes.diferencia).toBe(-28);
  });

  test('CA-3.5: un 4º operario es rechazado', async () => {
    const detalle = await crearCorteAbierto();
    const operarios = await prisma.operario.findMany({ take: 4, where: { activo: true } });
    const res = await request(app)
      .put(`/api/v1/cortes/${detalle.id}/operaciones/${detalle.operaciones[0].id}/asignaciones`)
      .send({ asignaciones: operarios.map((o) => ({ operarioId: o.id, cantidad: 93 })) });
    expect(res.status).toBe(400);
  });

  test('cantidad 0, operario repetido y operario inactivo se rechazan', async () => {
    const detalle = await crearCorteAbierto();
    const opId = detalle.operaciones[0].id;
    const ruta = `/api/v1/cortes/${detalle.id}/operaciones/${opId}/asignaciones`;

    const cero = await request(app)
      .put(ruta)
      .send({ asignaciones: [{ operarioId: rubenId, cantidad: 0 }] });
    expect(cero.status).toBe(400);

    const repetido = await request(app)
      .put(ruta)
      .send({
        asignaciones: [
          { operarioId: rubenId, cantidad: 200 },
          { operarioId: rubenId, cantidad: 172 },
        ],
      });
    expect(repetido.status).toBe(400);

    const baja = await request(app).post('/api/v1/operarios').send({ nombre: 'TEST INACTIVO R4' });
    await request(app).patch(`/api/v1/operarios/${baja.body.data.id}`).send({ activo: false });
    const inactivo = await request(app)
      .put(ruta)
      .send({ asignaciones: [{ operarioId: baja.body.data.id, cantidad: 372 }] });
    expect(inactivo.status).toBe(409);
    expect(inactivo.body.error.code).toBe('OPERARIO_INACTIVO');
  });
});

describe('CA-4.1 / CA-4.2 — maestro externo en la asignación', () => {
  test('diferencial por defecto de configuración (0.10) y convivencia con regular', async () => {
    const detalle = await crearCorteAbierto();
    const opUrlado = detalle.operaciones.find((o: { proceso: string }) => o.proceso === 'urlado'); // ct 20
    const res = await request(app)
      .put(`/api/v1/cortes/${detalle.id}/operaciones/${opUrlado.id}/asignaciones`)
      .send({
        asignaciones: [
          { operarioId: marioId, cantidad: 272 },
          { operarioId: rubenId, cantidad: 100, esMaestroExterno: true },
        ],
      });
    expect(res.status).toBe(200);
    const opRes = res.body.data.operaciones.find(
      (o: { proceso: string }) => o.proceso === 'urlado',
    );
    const [regular, maestro] = opRes.asignaciones;
    expect(regular.tarifaEfectiva).toBe(20);
    expect(regular.total).toBe(5440); // CA-4.2
    expect(maestro.diferencial).toBe(10); // tomado de configuración
    expect(maestro.tarifaEfectiva).toBe(30); // CA-4.1
    expect(maestro.total).toBe(3000);
    expect(opRes.totalOperacion).toBe(8440);
  });

  test('diferencial editable por asignación (0.15 → tarifa 0.35)', async () => {
    const detalle = await crearCorteAbierto();
    const opUrlado = detalle.operaciones.find((o: { proceso: string }) => o.proceso === 'urlado');
    const res = await request(app)
      .put(`/api/v1/cortes/${detalle.id}/operaciones/${opUrlado.id}/asignaciones`)
      .send({
        asignaciones: [
          { operarioId: rubenId, cantidad: 372, esMaestroExterno: true, diferencial: 15 },
        ],
      });
    const asignacion = res.body.data.operaciones.find(
      (o: { proceso: string }) => o.proceso === 'urlado',
    ).asignaciones[0];
    expect(asignacion.tarifaEfectiva).toBe(35);
    expect(asignacion.total).toBe(372 * 35);
  });
});

describe('CA-3.6 — asignar grupo completo', () => {
  test('todas las operaciones del grupo quedan asignadas al operario con la cantidad total', async () => {
    const detalle = await crearCorteAbierto();
    const res = await request(app)
      .post(`/api/v1/cortes/${detalle.id}/asignar-grupo`)
      .send({ grupo: 'TRASEROS', operarioId: rubenId });
    expect(res.status).toBe(200);
    const opsTraseros = res.body.data.operaciones.filter(
      (o: { grupo: string }) => o.grupo === 'TRASEROS',
    );
    expect(opsTraseros).toHaveLength(2);
    for (const op of opsTraseros) {
      expect(op.estado).toBe('asignada');
      expect(op.asignaciones).toHaveLength(1);
      expect(op.asignaciones[0].operarioId).toBe(rubenId);
      expect(op.asignaciones[0].cantidad).toBe(372);
    }
    // el otro grupo sigue sin asignar
    const ensamble = res.body.data.operaciones.find(
      (o: { grupo: string }) => o.grupo === 'ENSAMBLE',
    );
    expect(ensamble.estado).toBe('sin_asignar');
  });
});

describe('cierre del corte y CA-8.1 (cuadre de centavos)', () => {
  test('cierre feliz sobre DOBLE PRET real: totales cuadran con 372 × 8.10 = 3013.20', async () => {
    const modelos = await request(app).get('/api/v1/modelos');
    const doblePret = modelos.body.data.find(
      (m: { nombre: string }) => m.nombre === 'black DOBLE PRET 06',
    );
    const v1Id = doblePret.versiones.find(
      (v: { numeroVersion: number }) => v.numeroVersion === 1,
    ).id;

    const detalle = await crearCorteAbierto([62, 62, 62, 62, 62, 62], [], v1Id);
    expect(detalle.costoTotalCorte).toBe(301320); // CA-2.3

    // asignación híbrida: cada grupo completo a un operario
    const grupos = [...new Set(detalle.operaciones.map((o: { grupo: string }) => o.grupo))];
    const operarios = [rubenId, clarisId, marioId];
    for (let i = 0; i < grupos.length; i++) {
      const res = await request(app)
        .post(`/api/v1/cortes/${detalle.id}/asignar-grupo`)
        .send({ grupo: grupos[i], operarioId: operarios[i % operarios.length] });
      expect(res.status).toBe(200);
    }

    const cierre = await request(app)
      .post(`/api/v1/cortes/${detalle.id}/cerrar`)
      .send({ fechaCierre: '2026-06-20' });
    expect(cierre.status).toBe(200);
    expect(cierre.body.data.estado).toBe('cerrado');
    expect(cierre.body.data.fechaCierre).toContain('2026-06-20');

    // CA-8.1: la suma de los totales por operario cuadra EXACTAMENTE
    const totales = cierre.body.data.totalesPorOperario;
    const suma = totales.reduce((a: number, t: { total: number }) => a + t.total, 0);
    expect(suma).toBe(301320);

    // un corte cerrado ya no se puede reasignar
    const opCerrada = cierre.body.data.operaciones[0];
    const reasignar = await request(app)
      .put(`/api/v1/cortes/${detalle.id}/operaciones/${opCerrada.id}/asignaciones`)
      .send({ asignaciones: [{ operarioId: rubenId, cantidad: 372 }] });
    expect(reasignar.status).toBe(409);
  });

  test('CA-8.2: la baja de un operario conserva sus asignaciones históricas', async () => {
    const alta = await request(app).post('/api/v1/operarios').send({ nombre: 'TEST HISTORICO R4' });
    const operarioId = alta.body.data.id;

    const detalle = await crearCorteAbierto();
    const op = detalle.operaciones[0];
    await request(app)
      .put(`/api/v1/cortes/${detalle.id}/operaciones/${op.id}/asignaciones`)
      .send({ asignaciones: [{ operarioId, cantidad: 372 }] });

    await request(app).patch(`/api/v1/operarios/${operarioId}`).send({ activo: false });

    const releido = await request(app).get(`/api/v1/cortes/${detalle.id}`);
    const asignacion = releido.body.data.operaciones[0].asignaciones[0];
    expect(asignacion.operarioId).toBe(operarioId);
    expect(asignacion.total).toBe(5580);
  });
});
