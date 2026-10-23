// Acceso a Prisma de los costos fijos del taller (docs/PLAN_COSTOS.md §7c).
// Solo consulta: nada de esto entra a los pagos.
import type { Caja, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { rangoMesUTC } from '../liquidacion/repository.js';

const incluirGasto = {
  montos: { orderBy: { vigenteDesde: 'desc' as const } },
  compras: { orderBy: [{ fecha: 'asc' as const }, { creadoEn: 'asc' as const }] },
};
export type GastoConDatos = Prisma.GastoFijoGetPayload<{ include: typeof incluirGasto }>;

export const fijosRepository = {
  /** Todos los gastos con su historial de montos y TODAS sus compras. */
  listarGastos(): Promise<GastoConDatos[]> {
    return prisma.gastoFijo.findMany({
      orderBy: [{ grupo: 'asc' }, { nombre: 'asc' }],
      include: incluirGasto,
    });
  },
  obtenerGasto(id: string) {
    return prisma.gastoFijo.findUnique({ where: { id } });
  },
  buscarGastoPorNombre(nombre: string) {
    return prisma.gastoFijo.findUnique({ where: { nombre }, select: { id: true } });
  },
  crearGasto(data: Prisma.GastoFijoCreateInput) {
    return prisma.gastoFijo.create({ data });
  },
  actualizarGasto(id: string, data: Prisma.GastoFijoUpdateInput) {
    return prisma.gastoFijo.update({ where: { id }, data });
  },
  eliminarGasto(id: string) {
    return prisma.gastoFijo.delete({ where: { id } }); // montos y compras en cascada
  },
  guardarMonto(gastoId: string, monto: number, vigenteDesde: Date) {
    return prisma.gastoFijoMonto.upsert({
      where: { gastoId_vigenteDesde: { gastoId, vigenteDesde } },
      create: { gastoId, monto, vigenteDesde },
      update: { monto },
    });
  },
  obtenerMonto(id: string) {
    return prisma.gastoFijoMonto.findUnique({ where: { id } });
  },
  eliminarMonto(id: string) {
    return prisma.gastoFijoMonto.delete({ where: { id } });
  },
  crearCompra(data: Prisma.CompraGastoUncheckedCreateInput) {
    return prisma.compraGasto.create({ data });
  },
  obtenerCompra(id: string) {
    return prisma.compraGasto.findUnique({ where: { id } });
  },
  eliminarCompra(id: string) {
    return prisma.compraGasto.delete({ where: { id } });
  },

  listarPrestamos() {
    return prisma.prestamo.findMany({ orderBy: { creadoEn: 'asc' }, include: { pagos: true } });
  },
  obtenerPrestamo(id: string) {
    return prisma.prestamo.findUnique({ where: { id } });
  },
  crearPrestamo(data: Prisma.PrestamoCreateInput) {
    return prisma.prestamo.create({ data });
  },
  actualizarPrestamo(id: string, data: Prisma.PrestamoUpdateInput) {
    return prisma.prestamo.update({ where: { id }, data });
  },
  eliminarPrestamo(id: string) {
    return prisma.prestamo.delete({ where: { id } }); // pagos en cascada
  },
  guardarPago(prestamoId: string, anio: number, mes: number, fecha: Date, monto: number, caja: Caja) {
    return prisma.pagoPrestamo.upsert({
      where: { prestamoId_anio_mes: { prestamoId, anio, mes } },
      create: { prestamoId, anio, mes, fecha, monto, caja },
      update: { fecha, monto, caja },
    });
  },
  eliminarPago(prestamoId: string, anio: number, mes: number) {
    return prisma.pagoPrestamo.deleteMany({ where: { prestamoId, anio, mes } });
  },

  /** Prendas producidas en el mes: las de los cortes cerrados en él. */
  async prendasCerradas(anio: number, mes: number): Promise<number> {
    const { inicio, fin } = rangoMesUTC(anio, mes);
    const r = await prisma.corte.aggregate({
      where: { estado: 'cerrado', fechaCierre: { gte: inicio, lt: fin } },
      _sum: { cantidadTotal: true },
    });
    return r._sum.cantidadTotal ?? 0;
  },
};
