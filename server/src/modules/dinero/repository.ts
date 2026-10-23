// Acceso a datos del tablero de dinero (docs/PLAN_TABLERO_DINERO.md).
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

const incluirPedido = {
  cliente: { select: { id: true, nombre: true } },
  ficha: { select: { id: true, codigo: true, nombre: true } },
  corte: { select: { id: true, codigo: true } },
} as const;
export type PedidoConDatos = Prisma.PedidoGetPayload<{ include: typeof incluirPedido }>;

const incluirDespacho = {
  cliente: { select: { id: true, nombre: true } },
  lineas: {
    include: {
      corte: { select: { id: true, codigo: true } },
      ficha: { select: { id: true, nombre: true } },
    },
  },
} as const;
export type DespachoConDatos = Prisma.DespachoGetPayload<{ include: typeof incluirDespacho }>;

export const dineroRepository = {
  // ── Clientes ──
  listarClientes() {
    return prisma.cliente.findMany({
      orderBy: { nombre: 'asc' },
      include: { _count: { select: { pedidos: true, despachos: true, cobros: true } } },
    });
  },
  obtenerCliente(id: string) {
    return prisma.cliente.findUnique({
      where: { id },
      include: { _count: { select: { pedidos: true, despachos: true, cobros: true } } },
    });
  },
  clientePorNombre(nombre: string) {
    return prisma.cliente.findFirst({ where: { nombre: { equals: nombre, mode: 'insensitive' } } });
  },
  crearCliente(data: Prisma.ClienteCreateInput) {
    return prisma.cliente.create({ data });
  },
  actualizarCliente(id: string, data: Prisma.ClienteUpdateInput) {
    return prisma.cliente.update({ where: { id }, data });
  },
  eliminarCliente(id: string) {
    return prisma.cliente.delete({ where: { id } });
  },
  /** Σ despachado y Σ cobrado por cliente. */
  async totalesPorCliente(): Promise<Map<string, { despachado: number; cobrado: number }>> {
    const [lineas, cobros] = await Promise.all([
      prisma.despachoLinea.findMany({ select: { total: true, despacho: { select: { clienteId: true } } } }),
      prisma.cobro.groupBy({ by: ['clienteId'], _sum: { monto: true } }),
    ]);
    const mapa = new Map<string, { despachado: number; cobrado: number }>();
    const de = (id: string) => mapa.get(id) ?? mapa.set(id, { despachado: 0, cobrado: 0 }).get(id)!;
    for (const l of lineas) de(l.despacho.clienteId).despachado += l.total;
    for (const c of cobros) de(c.clienteId).cobrado += c._sum.monto ?? 0;
    return mapa;
  },

  // ── Pedidos ──
  listarPedidos() {
    return prisma.pedido.findMany({
      orderBy: [{ fechaEntrega: { sort: 'asc', nulls: 'last' } }, { creadoEn: 'asc' }],
      include: incluirPedido,
    });
  },
  obtenerPedido(id: string) {
    return prisma.pedido.findUnique({ where: { id }, include: incluirPedido });
  },
  crearPedido(data: Prisma.PedidoUncheckedCreateInput) {
    return prisma.pedido.create({ data, include: incluirPedido });
  },
  actualizarPedido(id: string, data: Prisma.PedidoUncheckedUpdateInput) {
    return prisma.pedido.update({ where: { id }, data, include: incluirPedido });
  },
  eliminarPedido(id: string) {
    return prisma.pedido.delete({ where: { id } });
  },

  // ── Despachos ──
  listarDespachos(rango?: { desde: Date; hasta: Date }) {
    return prisma.despacho.findMany({
      where: rango ? { fecha: { gte: rango.desde, lt: rango.hasta } } : {},
      orderBy: [{ fecha: 'desc' }, { creadoEn: 'desc' }],
      include: incluirDespacho,
    });
  },
  obtenerDespacho(id: string) {
    return prisma.despacho.findUnique({ where: { id }, include: incluirDespacho });
  },
  crearDespacho(
    data: { clienteId: string; fecha: Date; vence: Date; notas: string | null },
    lineas: Omit<Prisma.DespachoLineaCreateManyInput, 'despachoId'>[],
  ) {
    return prisma.despacho.create({
      data: { ...data, lineas: { createMany: { data: lineas } } },
      include: incluirDespacho,
    });
  },
  eliminarDespacho(id: string) {
    return prisma.despacho.delete({ where: { id } });
  },
  /** Prendas ya despachadas de cada corte. */
  async despachadasPorCorte(): Promise<Map<string, number>> {
    const filas = await prisma.despachoLinea.groupBy({
      by: ['corteId'],
      where: { corteId: { not: null } },
      _sum: { prendas: true },
    });
    return new Map(filas.map((f) => [f.corteId!, f._sum.prendas ?? 0]));
  },

  async cambiarPaso(corteId: string, paso: 'mesa' | 'costura' | 'lavanderia' | 'empaque' | 'deposito') {
    const r = await prisma.corte.updateMany({ where: { id: corteId }, data: { paso, pasoDesde: new Date() } });
    return r.count > 0;
  },

  // ── Cobros ──
  listarCobros(rango?: { desde: Date; hasta: Date }) {
    return prisma.cobro.findMany({
      where: rango ? { fecha: { gte: rango.desde, lt: rango.hasta } } : {},
      orderBy: [{ fecha: 'desc' }, { creadoEn: 'desc' }],
      include: { cliente: { select: { id: true, nombre: true } } },
    });
  },
  crearCobro(data: Prisma.CobroUncheckedCreateInput) {
    return prisma.cobro.create({ data, include: { cliente: { select: { id: true, nombre: true } } } });
  },
  obtenerCobro(id: string) {
    return prisma.cobro.findUnique({ where: { id } });
  },
  eliminarCobro(id: string) {
    return prisma.cobro.delete({ where: { id } });
  },

  // ── Proveedores ──
  comprasCredito() {
    return prisma.compraInsumo.findMany({
      where: { condicion: 'credito' },
      orderBy: [{ fecha: 'desc' }, { creadoEn: 'desc' }],
      select: {
        id: true,
        fecha: true,
        vence: true,
        tienda: true,
        precioTotal: true,
        codigoCorte: true,
        insumo: { select: { nombre: true } },
      },
    });
  },
  pagosProveedor() {
    return prisma.pagoProveedor.findMany({ orderBy: [{ fecha: 'desc' }, { creadoEn: 'desc' }] });
  },
  crearPagoProveedor(data: Prisma.PagoProveedorCreateInput) {
    return prisma.pagoProveedor.create({ data });
  },
  obtenerPagoProveedor(id: string) {
    return prisma.pagoProveedor.findUnique({ where: { id } });
  },
  eliminarPagoProveedor(id: string) {
    return prisma.pagoProveedor.delete({ where: { id } });
  },
};
