// Único lugar del módulo que habla con Prisma (ARQUITECTURA §2.1).
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

const ordenNatural = [{ orden: 'asc' as const }, { nombre: 'asc' as const }];

export type MaquinaConHijos = Prisma.MaquinaGetPayload<{
  include: { procesos: { include: { piezas: true } } };
}>;

export const catalogoRepository = {
  /** Árbol completo. `soloActivos` es lo que pide el formulario de modelos;
   *  la pantalla de administración pide todo (incluidos los dados de baja). */
  maquinas(soloActivos: boolean): Promise<MaquinaConHijos[]> {
    const activo = soloActivos ? { activo: true } : {};
    return prisma.maquina.findMany({
      where: activo,
      orderBy: ordenNatural,
      include: {
        procesos: {
          where: activo,
          orderBy: ordenNatural,
          include: { piezas: { where: activo, orderBy: ordenNatural } },
        },
      },
    });
  },

  grupos(soloActivos: boolean) {
    return prisma.grupo.findMany({
      where: soloActivos ? { activo: true } : undefined,
      orderBy: ordenNatural,
    });
  },

  /** Textos de todo lo que usa el catálogo — operaciones de modelos Y de
   *  plantillas — para contar el uso de cada entrada (no hay FK,
   *  PLAN_CATALOGO §3). Si las plantillas no contaran, se podría borrar del
   *  catálogo algo que una plantilla necesita. Son pocas filas. */
  async textosDeOperaciones() {
    const select = { grupo: true, equipo: true, proceso: true, pieza: true };
    const [deModelos, dePlantillas] = await Promise.all([
      prisma.operacion.findMany({ select }),
      prisma.plantillaOperacion.findMany({ select }),
    ]);
    return [...deModelos, ...dePlantillas];
  },

  maquina: (id: string) => prisma.maquina.findUnique({ where: { id } }),
  proceso: (id: string) =>
    prisma.proceso.findUnique({ where: { id }, include: { maquina: true } }),
  pieza: (id: string) =>
    prisma.pieza.findUnique({ where: { id }, include: { proceso: { include: { maquina: true } } } }),
  grupo: (id: string) => prisma.grupo.findUnique({ where: { id } }),

  crearMaquina: (nombre: string) => prisma.maquina.create({ data: { nombre } }),
  crearProceso: (maquinaId: string, nombre: string) =>
    prisma.proceso.create({ data: { maquinaId, nombre } }),
  crearPieza: (procesoId: string, nombre: string) =>
    prisma.pieza.create({ data: { procesoId, nombre } }),
  crearGrupo: (nombre: string) => prisma.grupo.create({ data: { nombre } }),

  // Las ediciones NO pasan por acá: renombrar puede tener que reescribir las
  // operaciones que usaban el nombre viejo, y eso va en transacción
  // (reescritura.ts).

  // El borrado físico solo llega acá si el service verificó que no está en uso
  // (C-4). Máquina y proceso arrastran sus hijos por onDelete: Cascade.
  borrarMaquina: (id: string) => prisma.maquina.delete({ where: { id } }),
  borrarProceso: (id: string) => prisma.proceso.delete({ where: { id } }),
  borrarPieza: (id: string) => prisma.pieza.delete({ where: { id } }),
  borrarGrupo: (id: string) => prisma.grupo.delete({ where: { id } }),
};
