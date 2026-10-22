// Único lugar del módulo que habla con Prisma (ARQUITECTURA §2.1).
import type { Prisma, RolOperario } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

// Conteo de lo que ata a un operario al histórico (pagos y cortes donde figura).
const conHistorial = {
  _count: {
    select: {
      asignaciones: true,
      anticipos: true,
      liquidaciones: true,
      trabajosCorte: true,
      modelosBuscados: true,
      pagosMolde: true,
      asistencias: true,
      envios: true, // como proveedor de lavandería o bordado
    },
  },
  // ayudantes: historial de sueldo semanal, el más reciente primero
  sueldos: { orderBy: { vigenteDesde: 'desc' } },
} satisfies Prisma.OperarioInclude;

export type OperarioConHistorial = Prisma.OperarioGetPayload<{ include: typeof conHistorial }>;

export const operariosRepository = {
  listar(soloActivos: boolean, rol?: RolOperario) {
    return prisma.operario.findMany({
      where: {
        ...(soloActivos ? { activo: true } : {}),
        ...(rol ? { roles: { has: rol } } : {}),
      },
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      include: conHistorial,
    });
  },

  obtener(id: string) {
    return prisma.operario.findUnique({ where: { id }, include: conHistorial });
  },

  listarPorIds(ids: string[]) {
    return prisma.operario.findMany({ where: { id: { in: ids } } });
  },

  buscarPorCi(ci: string) {
    return prisma.operario.findUnique({ where: { ci } });
  },

  crear(data: Prisma.OperarioCreateInput) {
    return prisma.operario.create({ data, include: conHistorial });
  },

  actualizar(id: string, data: Prisma.OperarioUpdateInput) {
    return prisma.operario.update({ where: { id }, data, include: conHistorial });
  },

  eliminar(id: string) {
    return prisma.operario.delete({ where: { id } });
  },

  /** Registra el sueldo desde una fecha; si ya había uno con esa fecha lo reemplaza. */
  guardarSueldo(operarioId: string, montoSemanal: number, vigenteDesde: Date) {
    return prisma.sueldoAyudante.upsert({
      where: { operarioId_vigenteDesde: { operarioId, vigenteDesde } },
      create: { operarioId, montoSemanal, vigenteDesde },
      update: { montoSemanal },
    });
  },

  obtenerSueldo(id: string) {
    return prisma.sueldoAyudante.findUnique({ where: { id } });
  },

  eliminarSueldo(id: string) {
    return prisma.sueldoAyudante.delete({ where: { id } });
  },
};
