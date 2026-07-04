// Único acceso a Prisma del módulo. El snapshot al abrir y el reemplazo de
// asignaciones son transaccionales (ARQUITECTURA §3.2): nunca quedan a medias.
import type { EstadoCorteOp, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

const incluirDetalle = {
  version: { include: { modelo: true } },
  operaciones: {
    orderBy: { orden: 'asc' as const },
    include: { asignaciones: { include: { operario: true } } },
  },
};

export type CorteConDetalle = Prisma.CorteGetPayload<{ include: typeof incluirDetalle }>;

export const cortesRepository = {
  listar(filtro: { estado?: 'borrador' | 'abierto' | 'cerrado'; modeloId?: string }) {
    return prisma.corte.findMany({
      where: {
        ...(filtro.estado ? { estado: filtro.estado } : {}),
        ...(filtro.modeloId ? { version: { modeloId: filtro.modeloId } } : {}),
      },
      orderBy: { fechaInicio: 'desc' },
      include: {
        version: { include: { modelo: true } },
        operaciones: { select: { estado: true } },
      },
    });
  },

  obtenerDetalle(id: string): Promise<CorteConDetalle | null> {
    return prisma.corte.findUnique({ where: { id }, include: incluirDetalle });
  },

  obtenerVersionConOperaciones(versionId: string) {
    return prisma.modeloVersion.findUnique({
      where: { id: versionId },
      include: { operaciones: { orderBy: { orden: 'asc' } } },
    });
  },

  crearBorrador(data: {
    modeloVersionId: string;
    codigo: string | null;
    tallas: number[];
    cortePorTalla: number[];
    plusPorTalla: number[];
    cantidadTotal: number;
  }) {
    return prisma.corte.create({ data });
  },

  /** Snapshot: copia las operaciones de la versión (ct congelado) y abre el corte. */
  abrir(corteId: string, operaciones: Prisma.CorteOperacionCreateManyCorteInput[]) {
    return prisma.$transaction(async (tx) => {
      await tx.corteOperacion.createMany({
        data: operaciones.map((o) => ({ ...o, corteId })),
      });
      await tx.corte.update({ where: { id: corteId }, data: { estado: 'abierto' } });
    });
  },

  obtenerCorteOperacion(id: string) {
    return prisma.corteOperacion.findUnique({ where: { id } });
  },

  listarOperacionesDeGrupo(corteId: string, grupo: string) {
    return prisma.corteOperacion.findMany({
      where: { corteId, grupo },
      orderBy: { orden: 'asc' },
    });
  },

  /** Reemplaza el set completo de asignaciones de una operación y fija su estado. */
  reemplazarAsignaciones(
    corteOperacionId: string,
    asignaciones: Omit<Prisma.AsignacionCreateManyCorteOperacionInput, 'id'>[],
    estado: EstadoCorteOp,
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.asignacion.deleteMany({ where: { corteOperacionId } });
      if (asignaciones.length > 0) {
        await tx.asignacion.createMany({
          data: asignaciones.map((a) => ({ ...a, corteOperacionId })),
        });
      }
      await tx.corteOperacion.update({ where: { id: corteOperacionId }, data: { estado } });
    });
  },

  /** Asignación por grupo completo: una asignación única por operación, atómico. */
  asignarGrupoCompleto(
    operaciones: { id: string; asignacion: Omit<Prisma.AsignacionCreateManyCorteOperacionInput, 'id'> }[],
  ) {
    return prisma.$transaction(async (tx) => {
      for (const op of operaciones) {
        await tx.asignacion.deleteMany({ where: { corteOperacionId: op.id } });
        await tx.asignacion.create({
          data: { ...op.asignacion, corteOperacionId: op.id },
        });
        await tx.corteOperacion.update({ where: { id: op.id }, data: { estado: 'asignada' } });
      }
    });
  },

  cerrar(corteId: string, fechaCierre: Date) {
    return prisma.corte.update({
      where: { id: corteId },
      data: { estado: 'cerrado', fechaCierre },
    });
  },

  obtenerConfiguracion() {
    return prisma.configuracion.findUnique({ where: { id: 1 } });
  },

  listarOperariosPorIds(ids: string[]) {
    return prisma.operario.findMany({ where: { id: { in: ids } } });
  },
};
