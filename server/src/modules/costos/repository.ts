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

  existeModelo(id: string) {
    return prisma.modelo.findUnique({ where: { id }, select: { id: true } });
  },};
