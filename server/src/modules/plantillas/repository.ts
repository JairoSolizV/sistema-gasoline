// Único lugar del módulo que habla con Prisma (ARQUITECTURA §2.1).
// Las escrituras multi-fila (crear con operaciones, duplicar) son transaccionales.
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

const conOperaciones = { operaciones: { orderBy: { orden: 'asc' as const } } };

export type PlantillaConOperaciones = Prisma.PlantillaGetPayload<{
  include: typeof conOperaciones;
}>;

export const plantillasRepository = {
  listar() {
    return prisma.plantilla.findMany({
      orderBy: [{ protegida: 'desc' }, { nombre: 'asc' }],
      include: conOperaciones,
    });
  },

  obtener(id: string): Promise<PlantillaConOperaciones | null> {
    return prisma.plantilla.findUnique({ where: { id }, include: conOperaciones });
  },

  obtenerOperacion(id: string) {
    return prisma.plantillaOperacion.findUnique({ where: { id } });
  },

  crear(
    nombre: string,
    notas: string | null,
    operaciones: Prisma.PlantillaOperacionCreateManyPlantillaInput[],
  ) {
    return prisma.plantilla.create({
      data: { nombre, notas, operaciones: { create: operaciones } },
      include: conOperaciones,
    });
  },

  /** Copia las filas a una plantilla nueva; la copia nunca queda protegida. */
  duplicar(origen: PlantillaConOperaciones, nombre: string) {
    return prisma.plantilla.create({
      data: {
        nombre,
        notas: origen.notas,
        operaciones: {
          create: origen.operaciones.map((o) => ({
            orden: o.orden,
            grupo: o.grupo,
            n: o.n,
            equipo: o.equipo,
            proceso: o.proceso,
            pieza: o.pieza,
            ctReferencia: o.ctReferencia,
          })),
        },
      },
      include: conOperaciones,
    });
  },

  actualizar(id: string, data: Prisma.PlantillaUpdateInput) {
    return prisma.plantilla.update({ where: { id }, data });
  },

  borrar(id: string) {
    return prisma.plantilla.delete({ where: { id } }); // las operaciones caen por cascade
  },

  /** Agrega al final del grupo indicado y renumera el resto. */
  agregarOperacion(
    plantillaId: string,
    data: Omit<Prisma.PlantillaOperacionCreateManyPlantillaInput, 'orden'>,
  ) {
    return prisma.$transaction(async (tx) => {
      const ultimo = await tx.plantillaOperacion.aggregate({
        where: { plantillaId },
        _max: { orden: true },
      });
      await tx.plantillaOperacion.create({
        data: { ...data, plantillaId, orden: (ultimo._max.orden ?? 0) + 1 },
      });
    });
  },

  /** Reemplaza la lista entera en una transacción (borrar + insertar). */
  reemplazarOperaciones(
    plantillaId: string,
    operaciones: Prisma.PlantillaOperacionCreateManyPlantillaInput[],
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.plantillaOperacion.deleteMany({ where: { plantillaId } });
      if (operaciones.length > 0) {
        await tx.plantillaOperacion.createMany({
          data: operaciones.map((o) => ({ ...o, plantillaId })),
        });
      }
    });
  },

  actualizarOperacion(id: string, data: Prisma.PlantillaOperacionUpdateInput) {
    return prisma.plantillaOperacion.update({ where: { id }, data });
  },

  borrarOperacion(id: string) {
    return prisma.plantillaOperacion.delete({ where: { id } });
  },
};
