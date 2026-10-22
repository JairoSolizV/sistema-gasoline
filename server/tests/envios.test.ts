// Lavandería y bordado externos (docs/PLAN_CUENTAS_SEPARADAS.md §5): envíos de
// prendas de un corte a proveedores, precio por prenda del proveedor (editable),
// varios envíos por corte sin pasar de sus prendas, ganado en la fecha de
// devolución y en la cuenta de cada servicio. Usa febrero de 2034.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import type { ConsolidadoDTO, CorteDetalleDTO, RendicionDTO } from '@taller/shared';
import { crearApp } from '../src/app.js';
import { prisma } from './helpers/db.js';
import { datosCorte } from './helpers/corte.js';
import { datosOperario } from './helpers/operario.js';
import { filaDe, saldoDe } from './helpers/cuentas.js';

const app = crearApp();
const ids: Record<string, string> = {};
let corteId: string;
let versionId: string;
const dia = (d: number) => `2034-02-${String(d).padStart(2, '0')}`;

async function limpiar() {
  await prisma.liquidacion.deleteMany({ where: { periodo: { anio: 2034 } } });
  await prisma.periodo.deleteMany({ where: { anio: 2034 } });
  const filtroModelo = { modelo: { nombre: { startsWith: 'TEST MODELO ENV' } } };
  const cortes = await prisma.corte.findMany({ where: { version: filtroModelo }, select: { id: true } });
  const corteIds = cortes.map((c) => c.id);
  await prisma.envioServicio.deleteMany({ where: { corteId: { in: corteIds } } });
  await prisma.asignacion.deleteMany({ where: { corteOperacion: { corteId: { in: corteIds } } } });
  await prisma.corteOperacion.deleteMany({ where: { corteId: { in: corteIds } } });
  await prisma.corte.deleteMany({ where: { id: { in: corteIds } } });
  await prisma.operacion.deleteMany({ where: { version: filtroModelo } });
  await prisma.modeloVersion.deleteMany({ where: filtroModelo });
  await prisma.modelo.deleteMany({ where: { nombre: { startsWith: 'TEST MODELO ENV' } } });
  await prisma.operario.deleteMany({ where: { nombre: { startsWith: 'TEST ENV' } } });
}

async function proveedor(clave: string, rol: 'lavanderia' | 'bordado', extra: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/v1/operarios')
    .send({
      nombre: `TEST ENV ${clave}`,
      tipo: 'proveedor_externo',
      roles: [rol],
      celular: '71234567',
      fechaIngreso: '2026-01-05T12:00:00.000Z',
      ...extra,
    });
  expect(res.status).toBe(201);
  ids[clave] = res.body.data.id;
}

const enviar = (body: Record<string, unknown>, corte = corteId) =>
  request(app).post(`/api/v1/cortes/${corte}/envios`).send(body);
const consolidado = async () =>
  (await request(app).get('/api/v1/liquidacion?anio=2034&mes=2')).body.data as ConsolidadoDTO;

beforeAll(async () => {
  await limpiar();
  await proveedor('LAVA', 'lavanderia', { tarifaLavanderia: 150 });
  await proveedor('LAVA2', 'lavanderia', { tarifaLavanderia: 140 });
  await proveedor('BORD', 'bordado'); // sin precio cargado
  const cos = await request(app)
    .post('/api/v1/operarios')
    .send({ nombre: 'TEST ENV COSTURA', ...datosOperario() });
  ids.COS = cos.body.data.id;

  // corte de 100 prendas (0.20), cerrado el 05/02
  const v = await request(app)
    .post('/api/v1/modelos')
    .send({
      nombre: 'TEST MODELO ENV',
      operaciones: [{ grupo: 'G', n: '1', equipo: 'recta', proceso: 'pinza', pieza: null, ct: 20 }],
    });
  versionId = v.body.data.id;
  const creado = await request(app)
    .post('/api/v1/cortes')
    .send({ ...(await datosCorte()), modeloVersionId: versionId, tallas: [1], cortePorTalla: [100] });
  corteId = creado.body.data.id;
  const corte = (await request(app).post(`/api/v1/cortes/${corteId}/abrir`)).body.data;
  await request(app)
    .put(`/api/v1/cortes/${corteId}/operaciones/${corte.operaciones[0].id}/asignaciones`)
    .send({ asignaciones: [{ operarioId: ids.COS, cantidad: 100 }] });
  const cierre = await request(app)
    .post(`/api/v1/cortes/${corteId}/cerrar`)
    .send({ fechaCierre: `${dia(5)}T12:00:00.000Z` });
  expect(cierre.status).toBe(200);
});

afterAll(async () => {
  await limpiar();
  await prisma.$disconnect();
});

describe('envíos del corte', () => {
  test('sin precio usa el del proveedor; el corte suma la lavandería a su costo', async () => {
    const res = await enviar({ servicio: 'lavanderia', operarioId: ids.LAVA, cantidad: 60, fechaEnvio: dia(6) });
    expect(res.status).toBe(201);
    const c = res.body.data as CorteDetalleDTO;
    expect(c.envios).toHaveLength(1);
    expect(c.envios[0]).toMatchObject({
      servicio: 'lavanderia',
      operario: { id: ids.LAVA },
      cantidad: 60,
      precioPrenda: 150,
      total: 9000, // 60 × 1.50
      fechaEnvio: dia(6),
      fechaDevolucion: null,
      bloqueado: false,
    });
    expect(c.costoLavanderiaCorte).toBe(9000);
    expect(c.costoTotal).toBe(2000 + 9000); // costura 100 × 0.20 + lavandería
  });

  test('varios envíos del mismo servicio, sin pasar de las prendas del corte', async () => {
    const otro = await enviar({ servicio: 'lavanderia', operarioId: ids.LAVA2, cantidad: 40, fechaEnvio: dia(6) });
    expect(otro.status).toBe(201);
    const deMas = await enviar({ servicio: 'lavanderia', operarioId: ids.LAVA, cantidad: 1, fechaEnvio: dia(7) });
    expect(deMas.status).toBe(409);
    expect(deMas.body.error.code).toBe('CANTIDAD_EXCEDIDA');
  });

  test('bordado: sin precio en la ficha hay que indicarlo; un costurero no es proveedor', async () => {
    const sinPrecio = await enviar({ servicio: 'bordado', operarioId: ids.BORD, cantidad: 100, fechaEnvio: dia(6) });
    expect(sinPrecio.status).toBe(400);
    expect(sinPrecio.body.error.code).toBe('SIN_PRECIO');
    const conPrecio = await enviar({
      servicio: 'bordado',
      operarioId: ids.BORD,
      cantidad: 100,
      precioPrenda: 80,
      fechaEnvio: dia(6),
    });
    expect(conPrecio.status).toBe(201);
    expect(conPrecio.body.data.costoBordadoCorte).toBe(8000);
    const costurero = await enviar({ servicio: 'bordado', operarioId: ids.COS, cantidad: 1, precioPrenda: 80, fechaEnvio: dia(6) });
    expect(costurero.status).toBe(409);
    expect(costurero.body.error.code).toBe('OPERARIO_SIN_ROL');
  });

  test('un corte en borrador no manda prendas', async () => {
    const borrador = await request(app)
      .post('/api/v1/cortes')
      .send({ ...(await datosCorte()), modeloVersionId: versionId, tallas: [1], cortePorTalla: [10] });
    const res = await enviar(
      { servicio: 'lavanderia', operarioId: ids.LAVA, cantidad: 10, fechaEnvio: dia(6) },
      borrador.body.data.id,
    );
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ESTADO_INVALIDO');
  });
});

describe('se gana al devolver, en la cuenta del servicio', () => {
  test('sin devolver no paga, pero cuenta como corte activo en el inicio', async () => {
    const c = await consolidado();
    expect(filaDe(c, ids.LAVA, 'lavanderia')).toBeUndefined();
    const inicio = (await request(app).get('/api/v1/dashboard?anio=2034&mes=2')).body.data;
    const lav = inicio.kpis.cuentas.find((x: { cuenta: string }) => x.cuenta === 'lavanderia');
    expect(lav.cortesActivos).toBeGreaterThanOrEqual(1);
  });

  test('al devolver entra en Lavandería, sin tocar Operaciones ni Bordado', async () => {
    const corte = (await request(app).get(`/api/v1/cortes/${corteId}`)).body.data as CorteDetalleDTO;
    const envio = corte.envios.find((e) => e.operario.id === ids.LAVA)!;
    const antes = await request(app)
      .patch(`/api/v1/cortes/${corteId}/envios/${envio.id}`)
      .send({ fechaDevolucion: dia(5) });
    expect(antes.status).toBe(400); // antes del envío

    const res = await request(app)
      .patch(`/api/v1/cortes/${corteId}/envios/${envio.id}`)
      .send({ fechaDevolucion: dia(20) });
    expect(res.status).toBe(200);
    const c = await consolidado();
    expect(filaDe(c, ids.LAVA, 'lavanderia')).toMatchObject({ ganado: 9000, saldoPeriodo: 9000 });
    expect(filaDe(c, ids.LAVA2, 'lavanderia')).toBeUndefined(); // su envío no volvió
    expect(filaDe(c, ids.BORD, 'bordado')).toBeUndefined();
    expect(filaDe(c, ids.COS, 'operaciones').ganado).toBe(2000);
  });

  test('la rendición del proveedor muestra su envío y su cuenta, sin datos de otros', async () => {
    const r = (await request(app).get(`/api/v1/rendicion/${ids.LAVA}?anio=2034&mes=2`)).body
      .data as RendicionDTO;
    expect(r.envios).toEqual([
      expect.objectContaining({ servicio: 'lavanderia', cantidad: 60, total: 9000, fechaDevolucion: dia(20) }),
    ]);
    expect(r.cuentas.map((x) => x.cuenta)).toEqual(['lavanderia']);
    expect(saldoDe(r, 'lavanderia').ganado).toBe(9000);
    expect(JSON.stringify(r)).not.toContain(ids.LAVA2);
  });
});

describe('mes liquidado', () => {
  test('un envío devuelto en un mes cerrado queda bloqueado', async () => {
    // el envío a LAVA2 y el bordado siguen sin devolver: no impiden el cierre
    const cierre = await request(app)
      .post('/api/v1/liquidacion/cerrar-mes')
      .send({ anio: 2034, mes: 2, excepciones: [] });
    expect(cierre.status).toBe(200);
    expect(filaDe(cierre.body.data, ids.LAVA, 'lavanderia')).toMatchObject({ pagado: 9000, saldoSalida: 0 });

    const corte = (await request(app).get(`/api/v1/cortes/${corteId}`)).body.data as CorteDetalleDTO;
    const devuelto = corte.envios.find((e) => e.operario.id === ids.LAVA)!;
    expect(devuelto.bloqueado).toBe(true);
    const editar = await request(app).patch(`/api/v1/cortes/${corteId}/envios/${devuelto.id}`).send({ cantidad: 50 });
    expect(editar.status).toBe(409);
    expect(editar.body.error.code).toBe('MES_LIQUIDADO');
    const quitar = await request(app).delete(`/api/v1/cortes/${corteId}/envios/${devuelto.id}`);
    expect(quitar.status).toBe(409);

    // la devolución pendiente no puede caer en el mes ya cerrado
    const pendiente = corte.envios.find((e) => e.operario.id === ids.LAVA2)!;
    const tarde = await request(app)
      .patch(`/api/v1/cortes/${corteId}/envios/${pendiente.id}`)
      .send({ fechaDevolucion: dia(25) });
    expect(tarde.status).toBe(409);
  });
});
