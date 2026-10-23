// Acceso a datos de la caja (docs/PLAN_CAJA.md). Lee los registros que entran
// solos a la caja; solo escribe inicios, categorías, movimientos a mano y
// arqueos (y la caja de un registro, si se cambia).
import type { Caja, Prisma } from '@prisma/client';
import type { OrigenCaja } from '@taller/shared';
import { prisma } from '../../lib/prisma.js';

type Rango = { gte: Date; lt: Date };

export const cajaRepository = {
  inicios() {
    return prisma.cajaInicio.findMany();
  },
  guardarInicio(caja: Caja, desde: Date, saldoInicial: number) {
    return prisma.cajaInicio.upsert({
      where: { caja },
      create: { caja, desde, saldoInicial },
      update: { desde, saldoInicial },
    });
  },

  categorias() {
    return prisma.categoriaCaja.findMany({ orderBy: [{ tipo: 'asc' }, { orden: 'asc' }, { nombre: 'asc' }] });
  },
  obtenerCategoria(id: string) {
    return prisma.categoriaCaja.findUnique({ where: { id } });
  },
  categoriaPorNombre(nombre: string) {
    return prisma.categoriaCaja.findFirst({ where: { nombre: { equals: nombre, mode: 'insensitive' } } });
  },
  crearCategoria(data: Prisma.CategoriaCajaCreateInput) {
    return prisma.categoriaCaja.create({ data });
  },
  actualizarCategoria(id: string, data: Prisma.CategoriaCajaUpdateInput) {
    return prisma.categoriaCaja.update({ where: { id }, data });
  },

  // ── lo que entra solo (fechas de día en UTC, como se guardan) ──
  cobros(fecha: Rango) {
    return prisma.cobro.findMany({ where: { fecha }, include: { cliente: { select: { nombre: true } } } });
  },
  pagosProveedor(fecha: Rango) {
    return prisma.pagoProveedor.findMany({ where: { fecha } });
  },
  comprasContado(fecha: Rango) {
    return prisma.compraInsumo.findMany({
      where: { fecha, condicion: 'contado' },
      include: { insumo: { select: { nombre: true } } },
    });
  },
  comprasGasto(fecha: Rango) {
    return prisma.compraGasto.findMany({ where: { fecha }, include: { gasto: { select: { nombre: true, grupo: true } } } });
  },
  pagosPrestamo(fecha: Rango) {
    return prisma.pagoPrestamo.findMany({ where: { fecha }, include: { prestamo: { select: { banco: true } } } });
  },
  /** Anticipos: la fecha es un instante; el service lo pasa a día de Bolivia. */
  anticipos(fecha: Rango) {
    return prisma.anticipo.findMany({ where: { fecha }, include: { operario: { select: { nombre: true } } } });
  },
  /** Lo pagado al cerrar cada mes, por cuenta. */
  pagosCierre(fechaCierre: Rango) {
    return prisma.liquidacion.findMany({
      where: { pagado: { gt: 0 }, periodo: { estado: 'cerrado', fechaCierre } },
      select: { cuenta: true, pagado: true, periodo: { select: { id: true, anio: true, mes: true, fechaCierre: true } } },
    });
  },

  manuales(fecha: Rango) {
    return prisma.movimientoCaja.findMany({ where: { fecha }, include: { categoria: { select: { id: true, nombre: true } } } });
  },
  crearMovimiento(data: Prisma.MovimientoCajaUncheckedCreateInput) {
    return prisma.movimientoCaja.create({ data });
  },
  obtenerMovimiento(id: string) {
    return prisma.movimientoCaja.findUnique({ where: { id } });
  },
  eliminarMovimiento(id: string) {
    return prisma.movimientoCaja.delete({ where: { id } });
  },

  arqueos(fecha: Rango) {
    return prisma.arqueoCaja.findMany({ where: { fecha }, orderBy: [{ fecha: 'asc' }, { creadoEn: 'asc' }] });
  },
  ultimoArqueo(caja: Caja, hasta: Date) {
    return prisma.arqueoCaja.findFirst({
      where: { caja, fecha: { lt: hasta } },
      orderBy: [{ fecha: 'desc' }, { creadoEn: 'desc' }],
    });
  },
  crearArqueo(data: Prisma.ArqueoCajaCreateInput) {
    return prisma.arqueoCaja.create({ data });
  },
  obtenerArqueo(id: string) {
    return prisma.arqueoCaja.findUnique({ where: { id } });
  },
  eliminarArqueo(id: string) {
    return prisma.arqueoCaja.delete({ where: { id } });
  },

  /** Cambia de qué caja salió (o entró) un registro que entra solo. */
  async cambiarCaja(origen: OrigenCaja, id: string, caja: Caja): Promise<boolean> {
    const donde = { where: { id }, data: { caja } };
    const actualizar: Record<OrigenCaja, () => Promise<unknown>> = {
      cobro: () => prisma.cobro.update(donde),
      pago_proveedor: () => prisma.pagoProveedor.update(donde),
      compra: () => prisma.compraInsumo.update(donde),
      compra_gasto: () => prisma.compraGasto.update(donde),
      pago_prestamo: () => prisma.pagoPrestamo.update(donde),
      anticipo: () => prisma.anticipo.update(donde),
    };
    try {
      await actualizar[origen]();
      return true;
    } catch {
      return false; // no existe
    }
  },
};
