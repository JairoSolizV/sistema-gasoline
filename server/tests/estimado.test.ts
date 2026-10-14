// Tiempos estimados: se cargan en el catálogo (proceso y, si hace falta,
// pieza), se congelan al abrir el corte y dan la duración estimada (el operario
// más cargado). Solo informativo: no toca pagos. Usa su propia máquina de
// prueba en el catálogo y la borra al final.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { prisma } from './helpers/db.js';
import { datosCorte } from './helpers/corte.js';

const app = crearApp();
const MAQ = 'zz maquina tiempos';

let rubenId: string;
let clarisId: string;
let versionId: string;
let pinzaId: string; // proceso con tiempo 20 s
let piezaId: string; // pieza "trasero" de pinza con tiempo propio 25 s
let urladoId: string; // proceso con tiempo 30 s

beforeAll(async () => {
  const operarios = await prisma.operario.findMany();
  rubenId = operarios.find((o) => o.nombre === 'RUBEN')!.id;
  clarisId = operarios.find((o) => o.nombre === 'CLARIS')!.id;

  const maq = await request(app).post('/api/v1/catalogo/maquinas').send({ nombre: MAQ });
  const pinza = await request(app)
    .post(`/api/v1/catalogo/maquinas/${maq.body.data.id}/procesos`)
    .send({ nombre: 'pinza' });
  pinzaId = pinza.body.data.id;
  const pieza = await request(app)
    .post(`/api/v1/catalogo/procesos/${pinzaId}/piezas`)
    .send({ nombre: 'trasero' });
  piezaId = pieza.body.data.id;
  const urlado = await request(app)
    .post(`/api/v1/catalogo/maquinas/${maq.body.data.id}/procesos`)
    .send({ nombre: 'urlado' });
  urladoId = urlado.body.data.id;

  const modelo = await request(app)
    .post('/api/v1/modelos')
    .send({
      nombre: 'TEST MODELO ESTIMADO',
      operaciones: [
        { grupo: 'TRASEROS', equipo: MAQ, proceso: 'pinza', pieza: 'trasero', ct: 15 },
        { grupo: 'TRASEROS', equipo: MAQ, proceso: 'pinza', pieza: 'delantero', ct: 15 },
        { grupo: 'TRASEROS', equipo: MAQ, proceso: 'urlado', pieza: null, ct: 20 },
      ],
    });
  versionId = modelo.body.data.id;
});

afterAll(async () => {
  const cortes = await prisma.corte.findMany({
    where: { version: { modelo: { nombre: 'TEST MODELO ESTIMADO' } } },
    select: { id: true },
  });
  const ids = cortes.map((c) => c.id);
  await prisma.asignacion.deleteMany({ where: { corteOperacion: { corteId: { in: ids } } } });
  await prisma.corteOperacion.deleteMany({ where: { corteId: { in: ids } } });
  await prisma.corte.deleteMany({ where: { id: { in: ids } } });
  const filtro = { modelo: { nombre: 'TEST MODELO ESTIMADO' } };
  await prisma.operacion.deleteMany({ where: { version: filtro } });
  await prisma.modeloVersion.deleteMany({ where: filtro });
  await prisma.modelo.deleteMany({ where: { nombre: 'TEST MODELO ESTIMADO' } });
  await prisma.maquina.deleteMany({ where: { nombre: MAQ } }); // procesos/piezas en cascada
  await prisma.$disconnect();
});

async function corteAbierto() {
  const creado = await request(app)
    .post('/api/v1/cortes')
    .send({ ...(await datosCorte()), modeloVersionId: versionId, tallas: [28], cortePorTalla: [100] });
  return (await request(app).post(`/api/v1/cortes/${creado.body.data.id}/abrir`)).body.data;
}

type Op = { id: string; proceso: string; pieza: string | null; tiempoSeg: number | null };
const op = (detalle: { operaciones: Op[] }, proceso: string, pieza: string | null) =>
  detalle.operaciones.find((o) => o.proceso === proceso && o.pieza === pieza)!;

describe('tiempo en el catálogo (segundos por prenda)', () => {
  test('se carga en proceso y pieza, se ve en el árbol y null lo borra; inválidos 400', async () => {
    expect(
      (await request(app).patch(`/api/v1/catalogo/procesos/${pinzaId}`).send({ tiempoSeg: 20 })).body
        .data.tiempoSeg,
    ).toBe(20);
    await request(app).patch(`/api/v1/catalogo/piezas/${piezaId}`).send({ tiempoSeg: 99 });
    const borrado = await request(app)
      .patch(`/api/v1/catalogo/piezas/${piezaId}`)
      .send({ tiempoSeg: null });
    expect(borrado.body.data.tiempoSeg).toBeNull();
    await request(app).patch(`/api/v1/catalogo/piezas/${piezaId}`).send({ tiempoSeg: 25 });
    await request(app).patch(`/api/v1/catalogo/procesos/${urladoId}`).send({ tiempoSeg: 30 });

    for (const malo of [0, -5, 1.5, 'veinte']) {
      const res = await request(app)
        .patch(`/api/v1/catalogo/procesos/${pinzaId}`)
        .send({ tiempoSeg: malo });
      expect(res.status).toBe(400);
    }

    const arbol = await request(app).get('/api/v1/catalogo/arbol?soloActivos=false');
    const maquina = arbol.body.data.maquinas.find((m: { nombre: string }) => m.nombre === MAQ);
    const pinza = maquina.procesos.find((p: { nombre: string }) => p.nombre === 'pinza');
    expect(pinza.tiempoSeg).toBe(20);
    expect(pinza.piezas[0]).toMatchObject({ nombre: 'trasero', tiempoSeg: 25 });
  });
});

describe('duración estimada del corte', () => {
  test('al abrir congela el tiempo: manda la pieza, si no el proceso; sin catálogo = null', async () => {
    const detalle = await corteAbierto();
    expect(op(detalle, 'pinza', 'trasero').tiempoSeg).toBe(25); // la pieza tiene el suyo
    expect(op(detalle, 'pinza', 'delantero').tiempoSeg).toBe(20); // pieza fuera del catálogo → proceso
    expect(op(detalle, 'urlado', null).tiempoSeg).toBe(30); // sin pieza → proceso
    expect(detalle.estimado).toEqual({
      duracionSeg: null, // nada asignado todavía
      operarioMasCargado: null,
      operacionesSinTiempo: [],
      operacionesSinAsignar: 3,
    });
  });

  test('el más cargado manda: RUBEN 100×25 + 100×20 = 4500 s; CLARIS 100×30 = 3000 s', async () => {
    const detalle = await corteAbierto();
    const asignar = (opId: string, operarioId: string) =>
      request(app)
        .put(`/api/v1/cortes/${detalle.id}/operaciones/${opId}/asignaciones`)
        .send({ asignaciones: [{ operarioId, cantidad: 100 }] });
    await asignar(op(detalle, 'pinza', 'trasero').id, rubenId);
    await asignar(op(detalle, 'pinza', 'delantero').id, rubenId);
    const res = await asignar(op(detalle, 'urlado', null).id, clarisId);

    expect(res.body.data.estimado).toEqual({
      duracionSeg: 4500,
      operarioMasCargado: { id: rubenId, nombre: 'RUBEN' },
      operacionesSinTiempo: [],
      operacionesSinAsignar: 0,
    });
    // solo estimado: los pagos no cambian (100 × 0.15)
    expect(res.body.data.operaciones[0].asignaciones[0].total).toBe(1500);
  });

  test('cambiar el catálogo después NO cambia un corte ya abierto (congelado)', async () => {
    const detalle = await corteAbierto();
    await request(app).patch(`/api/v1/catalogo/procesos/${urladoId}`).send({ tiempoSeg: 99 });
    const releido = await request(app).get(`/api/v1/cortes/${detalle.id}`);
    expect(op(releido.body.data, 'urlado', null).tiempoSeg).toBe(30);
    await request(app).patch(`/api/v1/catalogo/procesos/${urladoId}`).send({ tiempoSeg: 30 });
  });

  test('en el corte: cambiar a otro proceso toma su tiempo; agregar trae el del catálogo; sin tiempo se avisa', async () => {
    const detalle = await corteAbierto();
    const delantero = op(detalle, 'pinza', 'delantero');
    // pasa a urlado (sin pieza) → 30 s del catálogo
    const editado = await request(app)
      .patch(`/api/v1/cortes/${detalle.id}/operaciones/${delantero.id}`)
      .send({ proceso: 'urlado', pieza: null });
    expect(editado.body.data.operaciones.find((o: Op) => o.id === delantero.id).tiempoSeg).toBe(30);

    // operación que el catálogo no conoce → sin tiempo, y el estimado lo avisa
    const agregado = await request(app)
      .post(`/api/v1/cortes/${detalle.id}/operaciones`)
      .send({ grupo: 'TRASEROS', equipo: MAQ, proceso: 'remate', pieza: 'trasero', ct: 5 });
    expect(op(agregado.body.data, 'remate', 'trasero').tiempoSeg).toBeNull();
    expect(agregado.body.data.estimado.operacionesSinTiempo).toEqual(['remate · trasero']);
  });
});
