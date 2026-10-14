// Rebanada 4 — módulo cortes: snapshot inmutable (CA-1.4), cantidad con PLUS
// (CA-2.x), asignación con suma exacta (CA-3.x), maestro externo (CA-4.1/4.2),
// cuadre de centavos (CA-8.1) y cierre bloqueado (CA-8.3).
// Limpieza total en afterAll: el seed no tiene cortes, así que se borran todos.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { prisma } from './helpers/db.js';
import { datosCorte } from './helpers/corte.js';
import { datosOperario } from './helpers/operario.js';

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
    ...(await datosCorte()),
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
      ...(await datosCorte()),
      modeloVersionId: versionTestId,
      tallas: [28],
      cortePorTalla: [0],
      plusPorTalla: [],
    });
    expect(res.status).toBe(400);
  });

  test('guarda los datos del tendido y crea interno con las tarifas de Configuración', async () => {
    const res = await request(app)
      .post('/api/v1/cortes')
      .send({
        ...(await datosCorte({ esInterno: true })),
        modeloVersionId: versionTestId,
        tallas: [28],
        cortePorTalla: [10],
      });
    expect(res.status).toBe(201);
    const d = res.body.data;
    expect(d.tela).toBe('DENIM 14 OZ');
    expect(d.anchoCm).toBe(160);
    expect(d.trazadoCm).toBe(525);
    expect(d.esInterno).toBe(true);
    expect(d.servicio.tarifas).toEqual({
      busqueda: 10,
      trazado: 30,
      dobladoHoja: 15,
      dobladoPares: 10,
      corteRespaldo: 15,
      clasificacionRespaldo: 10,
    });
  });

  test('corte externo: sin servicio, costo total = costura', async () => {
    const detalle = await crearCorteAbierto(); // datosCorte() = externo
    expect(detalle.esInterno).toBe(false);
    expect(detalle.servicio).toBeNull();
    expect(detalle.costoServicioCorte).toBe(0);
    expect(detalle.costoTotal).toBe(detalle.costoTotalCorte);
  });

  test.each(['tela', 'anchoCm', 'trazadoCm'])('sin %s el corte no se crea (400)', async (campo) => {
    const res = await request(app)
      .post('/api/v1/cortes')
      .send({
        ...(await datosCorte()),
        [campo]: undefined,
        modeloVersionId: versionTestId,
        tallas: [28],
        cortePorTalla: [10],
      });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain(campo);
  });

  test('PUT tendido corrige tela/medidas; cerrado 409; inexistente 404', async () => {
    const detalle = await crearCorteAbierto();
    const res = await request(app)
      .put(`/api/v1/cortes/${detalle.id}/tendido`)
      .send({ tela: 'GABARDINA', anchoCm: 152, trazadoCm: 600 });
    expect(res.status).toBe(200);
    expect([res.body.data.tela, res.body.data.anchoCm, res.body.data.trazadoCm]).toEqual([
      'GABARDINA',
      152,
      600,
    ]);

    const cerrado = await prisma.corte.create({
      data: {
        modeloVersionId: versionTestId,
        codigo: 900_001,
        tallas: [28],
        cortePorTalla: [10],
        plusPorTalla: [],
        cantidadTotal: 10,
        estado: 'cerrado',
        esInterno: false,
        fechaCierre: new Date('2026-09-15T12:00:00Z'),
      },
    });
    const tendido = { tela: 'X', anchoCm: 100, trazadoCm: 100 };
    expect((await request(app).put(`/api/v1/cortes/${cerrado.id}/tendido`).send(tendido)).status).toBe(409);
    expect(
      (await request(app).put('/api/v1/cortes/00000000-0000-0000-0000-000000000000/tendido').send(tendido))
        .status,
    ).toBe(404);
  });

  test('abrir dos veces responde 409', async () => {
    const detalle = await crearCorteAbierto();
    const otra = await request(app).post(`/api/v1/cortes/${detalle.id}/abrir`);
    expect(otra.status).toBe(409);
  });
});

describe('código (numeración) del corte', () => {
  const nuevo = async (codigo?: number | null) =>
    request(app)
      .post('/api/v1/cortes')
      .send({
        ...(await datosCorte()),
        modeloVersionId: versionTestId,
        tallas: [28],
        cortePorTalla: [10],
        ...(codigo !== undefined ? { codigo } : {}),
      });
  // otros tests ya crearon cortes: los números se toman relativos al siguiente libre
  const siguiente = async (): Promise<number> =>
    (await request(app).get('/api/v1/cortes/siguiente-codigo')).body.data.codigo;

  test('sin código se numera automático: mayor + 1, y lo anticipa siguiente-codigo', async () => {
    const a = await nuevo();
    expect(a.status).toBe(201);
    expect(await siguiente()).toBe(a.body.data.codigo + 1);
    const b = await nuevo(null); // null / vacío = automático
    expect(b.status).toBe(201);
    expect(b.body.data.codigo).toBe(a.body.data.codigo + 1);
  });

  test('código elegido a mano (con huecos); la automática sigue después del mayor', async () => {
    const elegido = (await siguiente()) + 100;
    const manual = await nuevo(elegido);
    expect(manual.status).toBe(201);
    expect(manual.body.data.codigo).toBe(elegido);
    const auto = await nuevo();
    expect(auto.body.data.codigo).toBe(elegido + 1);
  });

  test('no se repite: al crear ni al editar (409); inválidos 400', async () => {
    const base = await siguiente();
    const a = await nuevo(base);
    const b = await nuevo(base + 1);
    const repetido = await nuevo(base);
    expect(repetido.status).toBe(409);
    expect(repetido.body.error.code).toBe('CODIGO_REPETIDO');

    const editarB = (codigo: unknown) =>
      request(app).patch(`/api/v1/cortes/${b.body.data.id}/codigo`).send({ codigo });
    expect((await editarB(base)).status).toBe(409);
    for (const malo of [0, -3, 1.5, 'abc', null]) {
      expect((await editarB(malo)).status).toBe(400);
    }
    expect((await nuevo(0)).status).toBe(400);

    const ok = await editarB(base + 50);
    expect(ok.status).toBe(200);
    expect(ok.body.data.codigo).toBe(base + 50);
    // guardar el mismo código que ya tiene no choca consigo mismo
    expect((await editarB(base + 50)).status).toBe(200);
    // el número anterior de b quedó libre
    expect((await nuevo(base + 1)).status).toBe(201);
    expect(a.body.data.codigo).toBe(base);
  });

  test('se puede corregir con el corte cerrado (no toca pagos); 404 si no existe', async () => {
    const base = await siguiente();
    const cerrado = await prisma.corte.create({
      data: {
        modeloVersionId: versionTestId,
        codigo: base,
        tallas: [28],
        cortePorTalla: [10],
        plusPorTalla: [],
        cantidadTotal: 10,
        estado: 'cerrado',
        esInterno: false,
        fechaCierre: new Date('2026-09-15T12:00:00Z'),
      },
    });
    const res = await request(app)
      .patch(`/api/v1/cortes/${cerrado.id}/codigo`)
      .send({ codigo: base + 10 });
    expect(res.status).toBe(200);
    expect(res.body.data.codigo).toBe(base + 10);
    const nada = await request(app)
      .patch('/api/v1/cortes/00000000-0000-0000-0000-000000000000/codigo')
      .send({ codigo: base + 20 });
    expect(nada.status).toBe(404);
  });
});

describe('snapshot inmutable', () => {
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

describe('roles: restricción estricta (PLAN_SERVICIO_CORTE §3)', () => {
  test('costura solo a costureros: operario sin el rol → 409 OPERARIO_SIN_ROL', async () => {
    const alta = await request(app)
      .post('/api/v1/operarios')
      .send({ nombre: 'TEST SOLO TRAZADOR', ...datosOperario({ roles: ['trazador'] }) });
    const id = alta.body.data.id;
    const detalle = await crearCorteAbierto();
    const op = detalle.operaciones[0];

    const res = await request(app)
      .put(`/api/v1/cortes/${detalle.id}/operaciones/${op.id}/asignaciones`)
      .send({ asignaciones: [{ operarioId: id, cantidad: 372 }] });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('OPERARIO_SIN_ROL');

    const grupo = await request(app)
      .post(`/api/v1/cortes/${detalle.id}/asignar-grupo`)
      .send({ grupo: op.grupo, operarioId: id });
    expect(grupo.status).toBe(409);
    expect(grupo.body.error.code).toBe('OPERARIO_SIN_ROL');
  });

  test('un ayudante también recibe operaciones de costura (PLAN_AYUDANTES §2.11)', async () => {
    const alta = await request(app)
      .post('/api/v1/operarios')
      .send({ nombre: 'TEST AYUDANTE COSE', ...datosOperario({ roles: ['ayudante'], sueldoSemanal: 40000 }) });
    const detalle = await crearCorteAbierto();
    const op = detalle.operaciones[0];
    const res = await request(app)
      .put(`/api/v1/cortes/${detalle.id}/operaciones/${op.id}/asignaciones`)
      .send({ asignaciones: [{ operarioId: alta.body.data.id, cantidad: 372 }] });
    expect(res.status).toBe(200);
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

    const baja = await request(app).post('/api/v1/operarios').send({ nombre: 'TEST INACTIVO R4', ...datosOperario() });
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
    const alta = await request(app).post('/api/v1/operarios').send({ nombre: 'TEST HISTORICO R4', ...datosOperario() });
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

// Cambios de último momento: solo el snapshot del corte, nunca el modelo, y
// cada uno queda en el historial (CorteCambio).
describe('cambios de último momento a las operaciones del corte', () => {
  type Op = { id: string; proceso: string; ct: number; estado: string };
  const opDe = (detalle: { operaciones: Op[] }, proceso: string) =>
    detalle.operaciones.find((o) => o.proceso === proceso)!;
  const versionOps = async () =>
    (await request(app).get(`/api/v1/versiones/${versionTestId}`)).body.data.operaciones as Op[];

  test('reordenar: cambia el orden del corte, no el del modelo, y queda en el historial', async () => {
    const detalle = await crearCorteAbierto();
    const [pinza, urlado, ensamble] = detalle.operaciones.map((o: Op) => o.id);
    const url = `/api/v1/cortes/${detalle.id}/operaciones/orden`;

    const res = await request(app).put(url).send({ operacionIds: [urlado, pinza, ensamble] });
    expect(res.status).toBe(200);
    expect(res.body.data.operaciones.map((o: Op) => o.proceso)).toEqual(['urlado', 'pinza', 'ensamble']);
    expect(res.body.data.cambios).toHaveLength(1);
    const cambio = res.body.data.cambios[0];
    expect(cambio.grupo).toBe('TRASEROS');
    expect(cambio.detalle).toEqual({
      tipo: 'reordenar',
      antes: ['pinza · trasero', 'urlado · trasero'],
      despues: ['urlado · trasero', 'pinza · trasero'],
    });
    // el modelo conserva su orden
    expect((await versionOps()).map((o) => o.proceso)).toEqual(['pinza', 'urlado', 'ensamble']);

    // mismo orden = sin cambios ni historial; orden ajeno = 409
    const igual = await request(app).put(url).send({ operacionIds: [urlado, pinza, ensamble] });
    expect(igual.body.data.cambios).toHaveLength(1);
    expect((await request(app).put(url).send({ operacionIds: [urlado, pinza] })).status).toBe(409);
  });

  test('editar el CT recalcula los pagos de sus asignaciones (con maestro) y no toca el modelo', async () => {
    const detalle = await crearCorteAbierto();
    const pinza = opDe(detalle, 'pinza');
    await request(app)
      .put(`/api/v1/cortes/${detalle.id}/operaciones/${pinza.id}/asignaciones`)
      .send({
        asignaciones: [
          { operarioId: rubenId, cantidad: 300 },
          { operarioId: clarisId, cantidad: 72, esMaestroExterno: true, diferencial: 10 },
        ],
      });

    const res = await request(app)
      .patch(`/api/v1/cortes/${detalle.id}/operaciones/${pinza.id}`)
      .send({ ct: 20, equipo: 'plana' });
    expect(res.status).toBe(200);
    const op = opDe(res.body.data, 'pinza') as Op & {
      equipo: string;
      modificadaEnCorte: boolean;
      asignaciones: { tarifaEfectiva: number; total: number }[];
    };
    expect(op.ct).toBe(20);
    expect(op.equipo).toBe('plana');
    expect(op.estado).toBe('asignada'); // la suma de piezas no cambia
    expect(op.asignaciones.map((a) => [a.tarifaEfectiva, a.total])).toEqual([
      [20, 6000], // 300 × 0.20
      [30, 2160], // 72 × (0.20 + 0.10 maestro)
    ]);
    expect(op.modificadaEnCorte).toBe(true);
    expect(res.body.data.costoManoObraPrenda).toBe(90); // 20 + 20 + 50
    expect(res.body.data.cambios[0].detalle).toEqual({
      tipo: 'editar',
      campos: [
        { campo: 'equipo', antes: 'recta', despues: 'plana' },
        { campo: 'ct', antes: 15, despues: 20 },
      ],
    });
    // el modelo sigue igual
    const pinzaModelo = (await versionOps()).find((o) => o.proceso === 'pinza') as Op & {
      equipo: string;
    };
    expect([pinzaModelo.ct, pinzaModelo.equipo]).toEqual([15, 'recta']);
  });

  test('volver al valor original deja de marcarla como modificada (el historial queda)', async () => {
    const detalle = await crearCorteAbierto();
    const urlado = opDe(detalle, 'urlado');
    const url = `/api/v1/cortes/${detalle.id}/operaciones/${urlado.id}`;
    await request(app).patch(url).send({ equipo: 'recta' });
    const vuelta = await request(app).patch(url).send({ equipo: 'codo' });
    expect(opDe(vuelta.body.data, 'urlado')).toMatchObject({ modificadaEnCorte: false });
    expect(vuelta.body.data.cambios).toHaveLength(2);
    // sin diferencias reales no se registra nada
    const nada = await request(app).patch(url).send({ equipo: 'codo' });
    expect(nada.body.data.cambios).toHaveLength(2);
  });

  test('agregar: operación extra sin asignar, bloquea el cierre hasta asignarla; el modelo no cambia', async () => {
    const detalle = await crearCorteAbierto();
    for (const op of detalle.operaciones) {
      await request(app)
        .put(`/api/v1/cortes/${detalle.id}/operaciones/${op.id}/asignaciones`)
        .send({ asignaciones: [{ operarioId: rubenId, cantidad: 372 }] });
    }
    const res = await request(app)
      .post(`/api/v1/cortes/${detalle.id}/operaciones`)
      .send({ grupo: 'TRASEROS', n: '3', equipo: 'recta', proceso: 'remate', pieza: 'trasero', ct: 5 });
    expect(res.status).toBe(201);
    expect(opDe(res.body.data, 'remate')).toMatchObject({
      estado: 'sin_asignar',
      agregadaEnCorte: true,
      cantidadObjetivo: 372,
    });
    expect(res.body.data.cambios[0].detalle.tipo).toBe('agregar');
    expect(await versionOps()).toHaveLength(3);

    const cierre = await request(app).post(`/api/v1/cortes/${detalle.id}/cerrar`).send({});
    expect(cierre.status).toBe(409);
    expect(cierre.body.error.code).toBe('CORTE_INCOMPLETO');
  });

  test('quitar: con operarios asignados 409; sin asignar se quita y queda en el historial', async () => {
    const detalle = await crearCorteAbierto();
    const pinza = opDe(detalle, 'pinza');
    const urlado = opDe(detalle, 'urlado');
    await request(app)
      .put(`/api/v1/cortes/${detalle.id}/operaciones/${pinza.id}/asignaciones`)
      .send({ asignaciones: [{ operarioId: rubenId, cantidad: 372 }] });

    const conAsignacion = await request(app).delete(
      `/api/v1/cortes/${detalle.id}/operaciones/${pinza.id}`,
    );
    expect(conAsignacion.status).toBe(409);
    expect(conAsignacion.body.error.code).toBe('OPERACION_CON_ASIGNACIONES');

    const res = await request(app).delete(`/api/v1/cortes/${detalle.id}/operaciones/${urlado.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.operaciones.map((o: Op) => o.proceso)).toEqual(['pinza', 'ensamble']);
    expect(res.body.data.cambios[0]).toMatchObject({
      grupo: 'TRASEROS',
      etiqueta: 'urlado · trasero',
      detalle: { tipo: 'quitar', operacion: { proceso: 'urlado', ct: 20 } },
    });
    expect(res.body.data.costoManoObraPrenda).toBe(65); // 15 + 50
    expect(await versionOps()).toHaveLength(3);
  });

  test('solo con el corte abierto: cerrado o borrador → 409', async () => {
    const detalle = await crearCorteAbierto();
    const op = detalle.operaciones[0];
    const ids = detalle.operaciones.map((o: Op) => o.id);
    const nueva = { grupo: 'X', equipo: 'recta', proceso: 'p', ct: 1 };
    await prisma.corte.update({ where: { id: detalle.id }, data: { estado: 'cerrado' } });
    const base = `/api/v1/cortes/${detalle.id}/operaciones`;
    expect((await request(app).patch(`${base}/${op.id}`).send({ ct: 99 })).status).toBe(409);
    expect((await request(app).delete(`${base}/${op.id}`)).status).toBe(409);
    expect((await request(app).put(`${base}/orden`).send({ operacionIds: ids })).status).toBe(409);
    expect((await request(app).post(base).send(nueva)).status).toBe(409);

    const borrador = await request(app)
      .post('/api/v1/cortes')
      .send({ ...(await datosCorte()), modeloVersionId: versionTestId, tallas: [28], cortePorTalla: [10] });
    const enBorrador = await request(app)
      .post(`/api/v1/cortes/${borrador.body.data.id}/operaciones`)
      .send(nueva);
    expect(enBorrador.status).toBe(409);
  });
});
