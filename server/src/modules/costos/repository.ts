// Único acceso a Prisma del módulo de costos (docs/PLAN_COSTOS.md). Solo
// consulta: lee modelos y configuración, nunca toca pagos.
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

/** La última compra de un insumo (la que fija su precio en las fichas). */
const ultimaCompra = {
  orderBy: [{ fecha: 'desc' as const }, { creadoEn: 'desc' as const }],
  take: 1,
};

const incluirInsumo = {
  compras: ultimaCompra,
  _count: { select: { compras: true, lineas: true } },
};
export type InsumoConCompra = Prisma.InsumoGetPayload<{ include: typeof incluirInsumo }>;

const incluirFicha = {
  lineas: {
    orderBy: { orden: 'asc' as const },
    include: { insumo: { include: { compras: ultimaCompra } } },
  },
  // mano de obra y empaque: CT de la última versión del modelo vinculado
  modelo: {
    select: {
      id: true,
      nombre: true,
      versiones: {
        orderBy: { numeroVersion: 'desc' as const },
        take: 1,
        select: { operaciones: { select: { ct: true, esEmpaque: true } } },
      },
    },
  },
};
export type FichaConDatos = Prisma.FichaCostoGetPayload<{ include: typeof incluirFicha }>;

type LineaData = Omit<Prisma.LineaCostoCreateManyInput, 'fichaId'>;
type FichaData = Omit<Prisma.FichaCostoUncheckedCreateInput, 'lineas'>;

export const costosRepository = {
  // ── Insumos ──
  listarInsumos() {
    return prisma.insumo.findMany({
      orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }],
      include: incluirInsumo,
    });
  },
  /** Códigos de corte de las compras de cada insumo, sin repetir, el más
   *  reciente primero. */
  async codigosCortePorInsumo(): Promise<Map<string, string[]>> {
    const compras = await prisma.compraInsumo.findMany({
      where: { codigoCorte: { not: null } },
      select: { insumoId: true, codigoCorte: true },
      orderBy: [{ fecha: 'desc' }, { creadoEn: 'desc' }],
    });
    const mapa = new Map<string, string[]>();
    for (const c of compras) {
      const lista = mapa.get(c.insumoId) ?? [];
      if (!lista.includes(c.codigoCorte!)) lista.push(c.codigoCorte!);
      mapa.set(c.insumoId, lista);
    }
    return mapa;
  },
  /** Fichas con sus datos de catálogo y si tienen foto (sin bajar la imagen). */
  catalogo() {
    return prisma.fichaCosto.findMany({
      orderBy: [{ codigo: 'asc' }, { nombre: 'asc' }],
      include: { ...incluirFicha, foto: { select: { actualizadoEn: true } } },
    });
  },
  obtenerFoto(fichaId: string) {
    return prisma.fotoFicha.findUnique({ where: { fichaId } });
  },
  guardarFoto(fichaId: string, mime: string, datos: Uint8Array<ArrayBuffer>) {
    return prisma.fotoFicha.upsert({
      where: { fichaId },
      create: { fichaId, mime, datos },
      update: { mime, datos },
    });
  },
  quitarFoto(fichaId: string) {
    return prisma.fotoFicha.deleteMany({ where: { fichaId } });
  },
  actualizarCatalogo(id: string, data: Prisma.FichaCostoUpdateInput) {
    return prisma.fichaCosto.update({ where: { id }, data });
  },
  pedidosDeFicha(fichaId: string) {
    return prisma.pedido.count({ where: { fichaId } });
  },
  obtenerInsumo(id: string): Promise<InsumoConCompra | null> {
    return prisma.insumo.findUnique({ where: { id }, include: incluirInsumo });
  },
  crearInsumo(data: Prisma.InsumoCreateInput) {
    return prisma.insumo.create({ data, include: incluirInsumo });
  },
  actualizarInsumo(id: string, data: Prisma.InsumoUpdateInput) {
    return prisma.insumo.update({ where: { id }, data, include: incluirInsumo });
  },
  eliminarInsumo(id: string) {
    return prisma.insumo.delete({ where: { id } });
  },

  // ── Compras ──
  listarCompras(insumoId?: string) {
    return prisma.compraInsumo.findMany({
      where: insumoId ? { insumoId } : {},
      orderBy: [{ fecha: 'desc' }, { creadoEn: 'desc' }],
      include: { insumo: { select: { id: true, nombre: true, unidad: true } } },
    });
  },
  crearCompra(data: Prisma.CompraInsumoUncheckedCreateInput) {
    return prisma.compraInsumo.create({
      data,
      include: { insumo: { select: { id: true, nombre: true, unidad: true } } },
    });
  },
  obtenerCompra(id: string) {
    return prisma.compraInsumo.findUnique({ where: { id } });
  },
  actualizarCompra(id: string, data: Prisma.CompraInsumoUncheckedUpdateInput) {
    return prisma.compraInsumo.update({
      where: { id },
      data,
      include: { insumo: { select: { id: true, nombre: true, unidad: true } } },
    });
  },
  eliminarCompra(id: string) {
    return prisma.compraInsumo.delete({ where: { id } });
  },

  // ── Fichas ──
  listarFichas(): Promise<FichaConDatos[]> {
    return prisma.fichaCosto.findMany({
      orderBy: [{ codigo: 'asc' }, { nombre: 'asc' }],
      include: incluirFicha,
    });
  },
  obtenerFicha(id: string): Promise<FichaConDatos | null> {
    return prisma.fichaCosto.findUnique({ where: { id }, include: incluirFicha });
  },
  buscarFichaPorNombre(nombre: string) {
    return prisma.fichaCosto.findUnique({ where: { nombre }, select: { id: true } });
  },
  /** Alta o reemplazo completo (datos + líneas), atómico. */
  guardarFicha(id: string | null, data: FichaData, lineas: LineaData[]) {
    return prisma.$transaction(async (tx) => {
      const ficha = id
        ? await tx.fichaCosto.update({ where: { id }, data })
        : await tx.fichaCosto.create({ data });
      await tx.lineaCosto.deleteMany({ where: { fichaId: ficha.id } });
      if (lineas.length > 0) {
        await tx.lineaCosto.createMany({ data: lineas.map((l) => ({ ...l, fichaId: ficha.id })) });
      }
      return ficha.id;
    });
  },
  eliminarFicha(id: string) {
    return prisma.fichaCosto.delete({ where: { id } }); // líneas en cascada
  },

  // ── Etapas 3 y 4: stock, costo real del corte y plan ──

  /** Todas las compras (solo lo que mueve stock). */
  comprasDeInsumo(insumoId: string) {
    return prisma.compraInsumo.findMany({
      where: { insumoId },
      select: { fecha: true, cantidad: true, tienda: true, codigoCorte: true },
    });
  },
  movimientosCompra() {
    return prisma.compraInsumo.findMany({ select: { insumoId: true, fecha: true, cantidad: true } });
  },

  /** El conteo más reciente de cada insumo. */
  ultimosConteos() {
    return prisma.conteoInsumo.findMany({
      orderBy: [{ fecha: 'desc' }, { creadoEn: 'desc' }],
      distinct: ['insumoId'],
    });
  },
  listarConteos(insumoId?: string) {
    return prisma.conteoInsumo.findMany({
      where: insumoId ? { insumoId } : {},
      orderBy: [{ fecha: 'desc' }, { creadoEn: 'desc' }],
      include: { insumo: { select: { id: true, nombre: true, unidad: true } } },
    });
  },
  crearConteo(data: Prisma.ConteoInsumoUncheckedCreateInput) {
    return prisma.conteoInsumo.create({
      data,
      include: { insumo: { select: { id: true, nombre: true, unidad: true } } },
    });
  },
  obtenerConteo(id: string) {
    return prisma.conteoInsumo.findUnique({ where: { id } });
  },
  eliminarConteo(id: string) {
    return prisma.conteoInsumo.delete({ where: { id } });
  },

  /** Cortes ya cortados (abiertos o cerrados) con lo necesario para su costo
   *  real y su consumo de material. Con corteId, solo ese. */
  cortesParaCosto(corteId?: string) {
    return prisma.corte.findMany({
      where: { estado: { in: ['abierto', 'cerrado'] }, ...(corteId ? { id: corteId } : {}) },
      orderBy: { codigo: 'desc' },
      select: {
        id: true,
        codigo: true,
        estado: true,
        fechaInicio: true,
        cantidadTotal: true,
        trazadoCm: true,
        prendasPorCapa: true,
        version: { select: { modeloId: true, modelo: { select: { nombre: true } } } },
        operaciones: {
          select: {
            ct: true,
            esEmpaque: true,
            cantidadObjetivo: true,
            asignaciones: { select: { cantidad: true, total: true } },
          },
        },
        trabajos: { select: { total: true } },
        envios: { select: { total: true, fechaDevolucion: true, servicio: true } },
      },
    });
  },

  obtenerPlan(anio: number, mes: number) {
    return prisma.planProduccion.findMany({ where: { anio, mes }, select: { fichaId: true, prendas: true } });
  },
  /** Reemplaza el plan del mes completo, atómico. */
  reemplazarPlan(anio: number, mes: number, items: { fichaId: string; prendas: number }[]) {
    return prisma.$transaction([
      prisma.planProduccion.deleteMany({ where: { anio, mes } }),
      prisma.planProduccion.createMany({ data: items.map((i) => ({ ...i, anio, mes })) }),
    ]);
  },

  existeModelo(id: string) {
    return prisma.modelo.findUnique({ where: { id }, select: { id: true } });
  },};
