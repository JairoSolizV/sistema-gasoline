// Único lugar del módulo que habla con Prisma. Las escrituras multi-fila
// (crear modelo con v1, duplicar versión) son transaccionales (ARQUITECTURA §3.2).
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

const incluirOperacionesOrdenadas = {
  operaciones: { orderBy: { orden: 'asc' as const } },
  modelo: true,
};

export type VersionConOperaciones = Prisma.ModeloVersionGetPayload<{
  include: typeof incluirOperacionesOrdenadas;
}>;

export const modelosRepository = {
  listar() {
    return prisma.modelo.findMany({
      orderBy: { nombre: 'asc' },
      include: {
        versiones: {
          orderBy: { numeroVersion: 'desc' },
          include: { _count: { select: { operaciones: true } } },
        },
      },
    });
  },

  obtenerVersion(id: string): Promise<VersionConOperaciones | null> {
    return prisma.modeloVersion.findUnique({
      where: { id },
      include: incluirOperacionesOrdenadas,
    });
  },

  obtenerOperacion(id: string) {
    return prisma.operacion.findUnique({ where: { id } });
  },

  crearModeloConV1(
    nombre: string,
    operaciones: Prisma.OperacionCreateManyVersionInput[],
    costo: number,
  ) {
    return prisma.modelo.create({
      data: {
        nombre,
        versiones: {
          create: {
            numeroVersion: 1,
            costoManoObraPrenda: costo,
            operaciones: { create: operaciones },
          },
        },
      },
      include: { versiones: true },
    });
  },

  /** Duplica la versión origen como numeroVersion siguiente. Solo CREA filas. */
  duplicarVersion(modeloId: string, origen: VersionConOperaciones, notas: string | null) {
    return prisma.$transaction(async (tx) => {
      const ultima = await tx.modeloVersion.aggregate({
        where: { modeloId },
        _max: { numeroVersion: true },
      });
      return tx.modeloVersion.create({
        data: {
          modeloId,
          numeroVersion: (ultima._max.numeroVersion ?? 0) + 1,
          notas,
          costoManoObraPrenda: origen.costoManoObraPrenda,
          operaciones: {
            create: origen.operaciones.map((o) => ({
              orden: o.orden,
              grupo: o.grupo,
              n: o.n,
              equipo: o.equipo,
              proceso: o.proceso,
              pieza: o.pieza,
              ct: o.ct,
            })),
          },
        },
      });
    });
  },

  /** Agrega una operación al final y recalcula el costo cacheado, atómico. */
  agregarOperacion(versionId: string, data: Omit<Prisma.OperacionCreateManyVersionInput, 'orden'>) {
    return prisma.$transaction(async (tx) => {
      const ultimo = await tx.operacion.aggregate({
        where: { modeloVersionId: versionId },
        _max: { orden: true },
      });
      await tx.operacion.create({
        data: { ...data, modeloVersionId: versionId, orden: (ultimo._max.orden ?? 0) + 1 },
      });
      await recalcularCosto(tx, versionId);
    });
  },

  editarOperacion(operacionId: string, versionId: string, data: Prisma.OperacionUpdateInput) {
    return prisma.$transaction(async (tx) => {
      await tx.operacion.update({ where: { id: operacionId }, data });
      await recalcularCosto(tx, versionId);
    });
  },

  eliminarOperacion(operacionId: string, versionId: string) {
    return prisma.$transaction(async (tx) => {
      await tx.operacion.delete({ where: { id: operacionId } });
      await recalcularCosto(tx, versionId);
    });
  },
};

async function recalcularCosto(tx: Prisma.TransactionClient, versionId: string) {
  const suma = await tx.operacion.aggregate({
    where: { modeloVersionId: versionId },
    _sum: { ct: true },
  });
  await tx.modeloVersion.update({
    where: { id: versionId },
    data: { costoManoObraPrenda: suma._sum.ct ?? 0 },
  });
}
