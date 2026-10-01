// Único lugar del módulo que habla con Prisma. Las escrituras multi-fila
// (crear modelo con v1, duplicar versión) son transaccionales (ARQUITECTURA §3.2).
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

const persona = { select: { id: true, nombre: true } } as const;
const incluirMolde = { include: { operario: persona } } as const;

const incluirOperacionesOrdenadas = {
  operaciones: { orderBy: { orden: 'asc' as const } },
  modelo: { include: { buscador: persona } },
  molde: incluirMolde,
};

/** Datos de un pago de moldes ya resueltos por el service (tipo y monto fijados). */
export interface PagoMoldeData {
  operarioId: string;
  tipo: 'nuevo' | 'modificacion';
  monto: number;
  fecha: Date;
}

export type VersionConOperaciones = Prisma.ModeloVersionGetPayload<{
  include: typeof incluirOperacionesOrdenadas;
}>;

export const modelosRepository = {
  listar() {
    return prisma.modelo.findMany({
      orderBy: { nombre: 'asc' },
      include: {
        buscador: persona,
        versiones: {
          orderBy: { numeroVersion: 'desc' },
          include: { _count: { select: { operaciones: true } }, molde: incluirMolde },
        },
      },
    });
  },

  obtenerModelo(id: string) {
    return prisma.modelo.findUnique({ where: { id } });
  },

  actualizarBuscador(modeloId: string, data: { buscadorId: string | null; sinBuscador: boolean }) {
    return prisma.modelo.update({ where: { id: modeloId }, data });
  },

  /** Registra o reemplaza los moldes de una versión (a lo sumo uno por versión). */
  guardarMolde(versionId: string, data: PagoMoldeData) {
    return prisma.pagoMolde.upsert({
      where: { modeloVersionId: versionId },
      create: { ...data, modeloVersionId: versionId },
      update: data,
    });
  },

  eliminarMolde(versionId: string) {
    return prisma.pagoMolde.delete({ where: { modeloVersionId: versionId } });
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
    diseno: { buscadorId: string | null; sinBuscador: boolean; molde: PagoMoldeData | null },
  ) {
    return prisma.modelo.create({
      data: {
        nombre,
        buscadorId: diseno.buscadorId,
        sinBuscador: diseno.sinBuscador,
        versiones: {
          create: {
            numeroVersion: 1,
            costoManoObraPrenda: costo,
            operaciones: { create: operaciones },
            ...(diseno.molde ? { molde: { create: diseno.molde } } : {}),
          },
        },
      },
      include: { versiones: true },
    });
  },

  /** Duplica la versión origen como numeroVersion siguiente. Solo CREA filas
   *  (los moldes de la origen NO se copian: se pagan una vez, en su versión). */
  duplicarVersion(
    modeloId: string,
    origen: VersionConOperaciones,
    notas: string | null,
    molde: PagoMoldeData | null,
  ) {
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
          ...(molde ? { molde: { create: molde } } : {}),
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
