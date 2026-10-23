// Surtido por colores para la lavandería (docs/PLAN_SURTIDO.md): la lista de
// colores de lavado, guardar el surtido del corte y registrar un envío a
// lavandería por color. Corte de la hoja del dueño: 1690 prendas
// (NORMAL 40-46: 169/338/338/169; ESPECIAL 48-54: 169 cada una).
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import type { ColorLavadoDTO, CorteDetalleDTO } from '@taller/shared';
import { crearApp } from '../src/app.js';
import { prisma } from './helpers/db.js';
import { datosCorte } from './helpers/corte.js';

const app = crearApp();
const ids: Record<string, string> = {};
let corteId: string;
let borradorId: string;
const MODELO = 'TEST MODELO SURTIDO';

async function limpiar() {
  const filtroModelo = { modelo: { nombre: MODELO } };
  const cortes = await prisma.corte.findMany({ where: { version: filtroModelo }, select: { id: true } });
  const corteIds = cortes.map((c) => c.id);
  await prisma.envioServicio.deleteMany({ where: { corteId: { in: corteIds } } });
  await prisma.corteOperacion.deleteMany({ where: { corteId: { in: corteIds } } });
  await prisma.corte.deleteMany({ where: { id: { in: corteIds } } });
  await prisma.operacion.deleteMany({ where: { version: filtroModelo } });
  await prisma.modeloVersion.deleteMany({ where: filtroModelo });
  await prisma.modelo.deleteMany({ where: { nombre: MODELO } });
  await prisma.operario.deleteMany({ where: { nombre: { startsWith: 'TEST SUR' } } });
  await prisma.colorLavado.deleteMany({ where: { nombre: { startsWith: 'TEST ' } } });
}

async function proveedor(clave: string, rol: 'lavanderia' | 'bordado') {
  const res = await request(app)
    .post('/api/v1/operarios')
    .send({
      nombre: `TEST SUR ${clave}`,
      tipo: 'proveedor_externo',
      roles: [rol],
      celular: '71234567',
      fechaIngreso: '2026-01-05T12:00:00.000Z',
      ...(rol === 'lavanderia' ? { tarifaLavanderia: 150 } : {}),
    });
  expect(res.status).toBe(201);
  ids[clave] = res.body.data.id;
}

const guardar = (body: Record<string, unknown>, corte = corteId) =>
  request(app).put(`/api/v1/cortes/${corte}/surtido`).send(body);
const enviar = (body: Record<string, unknown>) =>
  request(app).post(`/api/v1/cortes/${corteId}/surtido/envios`).send(body);

beforeAll(async () => {
  await limpiar();
  await proveedor('LAVA', 'lavanderia');
  await proveedor('BORD', 'bordado');
  const v = await request(app)
    .post('/api/v1/modelos')
    .send({
      nombre: MODELO,
      operaciones: [{ grupo: 'G', n: '1', equipo: 'recta', proceso: 'pinza', pieza: null, ct: 20 }],
    });
  const base = {
    ...(await datosCorte()),
    modeloVersionId: v.body.data.id,
    tallas: [40, 42, 44, 46, 48, 50, 52, 54],
    cortePorTalla: [169, 338, 338, 169, 169, 169, 169, 169],
  };
  corteId = (await request(app).post('/api/v1/cortes').send(base)).body.data.id;
  await request(app).post(`/api/v1/cortes/${corteId}/abrir`).expect(200);
  borradorId = (await request(app).post('/api/v1/cortes').send(base)).body.data.id;
});

afterAll(async () => {
  await limpiar();
  await prisma.$disconnect();
});

describe('lista de colores de lavado', () => {
  test('SUR-A1: vienen los colores de la hoja del dueño, en orden', async () => {
    const res = await request(app).get('/api/v1/colores-lavado');
    expect(res.status).toBe(200);
    const nombres = (res.body.data as ColorLavadoDTO[]).map((c) => c.nombre);
    expect(nombres.slice(0, 7)).toEqual([
      'VERDE A',
      'ENZIMÁTICO',
      'BLEACH',
      'MAÍS',
      'TABACO',
      'STONE 4GL',
      'MARENGO',
    ]);
  });

  test('SUR-A2: se agrega (en mayúsculas), no se repite, se renombra y se borra', async () => {
    const creado = await request(app).post('/api/v1/colores-lavado').send({ nombre: 'test rosa' });
    expect(creado.status).toBe(201);
    const color = (creado.body.data as ColorLavadoDTO[]).find((c) => c.nombre === 'TEST ROSA')!;
    expect(color).toBeDefined();

    const repetido = await request(app).post('/api/v1/colores-lavado').send({ nombre: 'TEST ROSA' });
    expect(repetido.status).toBe(409);

    const renombrado = await request(app)
      .patch(`/api/v1/colores-lavado/${color.id}`)
      .send({ nombre: 'test fucsia' });
    expect(renombrado.body.data.some((c: ColorLavadoDTO) => c.nombre === 'TEST FUCSIA')).toBe(true);

    const borrado = await request(app).delete(`/api/v1/colores-lavado/${color.id}`);
    expect(borrado.body.data.some((c: ColorLavadoDTO) => c.id === color.id)).toBe(false);
  });
});

describe('surtido del corte', () => {
  test('SUR-A3: sin surtido, ESPECIAL es desde la 48 y no se puede enviar', async () => {
    const corte = (await request(app).get(`/api/v1/cortes/${corteId}`)).body.data as CorteDetalleDTO;
    expect(corte.surtidoColores).toEqual([]);
    expect(corte.tallasEspeciales).toEqual([48, 50, 52, 54]);

    const res = await enviar({ operarioId: ids.LAVA, fechaEnvio: '2035-03-06' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SIN_SURTIDO');
  });

  test('SUR-A4: se guarda; rechaza colores repetidos, tallas ajenas y borradores', async () => {
    const colores = ['VERDE A', 'ENZIMÁTICO', 'BLEACH', 'MAÍS', 'TABACO'];
    const ok = await guardar({ colores, tallasEspeciales: [48, 50, 52, 54] });
    expect(ok.status).toBe(200);
    expect((ok.body.data as CorteDetalleDTO).surtidoColores).toEqual(colores);

    expect((await guardar({ colores: ['BLEACH', 'bleach'], tallasEspeciales: [] })).status).toBe(400);
    expect((await guardar({ colores, tallasEspeciales: [56] })).status).toBe(400);
    const borrador = await guardar({ colores, tallasEspeciales: [] }, borradorId);
    expect(borrador.status).toBe(409);
  });

  test('SUR-A5: el envío a una lavandería es de su rol', async () => {
    const res = await enviar({ operarioId: ids.BORD, fechaEnvio: '2035-03-06' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('OPERARIO_SIN_ROL');
  });

  test('SUR-A6: un envío por color con sus prendas; no toca la costura', async () => {
    const antes = (await request(app).get(`/api/v1/cortes/${corteId}`)).body.data as CorteDetalleDTO;
    const res = await enviar({ operarioId: ids.LAVA, fechaEnvio: '2035-03-06' });
    expect(res.status).toBe(201);
    const corte = res.body.data as CorteDetalleDTO;

    // 169 juegos ÷ 5 = 34, 34, 34, 34, 33 en cada grupo (NORMAL 6 prendas, ESPECIAL 4)
    expect(corte.envios.map((e) => [e.color, e.cantidad])).toEqual([
      ['VERDE A', 340],
      ['ENZIMÁTICO', 340],
      ['BLEACH', 340],
      ['MAÍS', 340],
      ['TABACO', 330],
    ]);
    expect(corte.envios.every((e) => e.servicio === 'lavanderia' && e.precioPrenda === 150)).toBe(
      true,
    );
    expect(corte.envios.reduce((a, e) => a + e.cantidad, 0)).toBe(1690);
    expect(corte.costoExternos.lavanderia).toBe(1690 * 150);
    expect(corte.costoTotalCorte).toBe(antes.costoTotalCorte);
  });

  test('SUR-A7: no se puede mandar dos veces (pasaría de las prendas del corte)', async () => {
    const res = await enviar({ operarioId: ids.LAVA, fechaEnvio: '2035-03-07' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CANTIDAD_EXCEDIDA');
    const corte = (await request(app).get(`/api/v1/cortes/${corteId}`)).body.data as CorteDetalleDTO;
    expect(corte.envios).toHaveLength(5);
  });
});
