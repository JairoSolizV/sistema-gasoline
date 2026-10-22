// Único acceso a Prisma del módulo de asistencia de ayudantes.
import type { EstadoAsistencia } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export const asistenciaRepository = {
  /** Ayudantes a mostrar en la semana [desde, hasta]: los activos y los que ya
   *  tienen algún día marcado ahí (aunque hoy estén de baja), con su historial
   *  de sueldo y sus días de esa semana. */
  ayudantesDeSemana(desde: Date, hasta: Date) {
    const rango = { gte: desde, lte: hasta };
    return prisma.operario.findMany({
      where: {
        roles: { has: 'ayudante' },
        OR: [{ activo: true }, { asistencias: { some: { fecha: rango } } }],
      },
      orderBy: { nombre: 'asc' },
      include: {
        sueldos: true,
        asistencias: { where: { fecha: rango }, orderBy: { fecha: 'asc' } },
      },
    });
  },

  operarioConSueldos(id: string) {
    return prisma.operario.findUnique({ where: { id }, include: { sueldos: true } });
  },

  obtener(operarioId: string, fecha: Date) {
    return prisma.asistencia.findUnique({
      where: { operarioId_fecha: { operarioId, fecha } },
    });
  },

  guardar(
    operarioId: string,
    fecha: Date,
    data: {
      estado: EstadoAsistencia;
      minutosDescontados: number;
      minutosOperaciones: number;
      nota: string | null;
    },
  ) {
    return prisma.asistencia.upsert({
      where: { operarioId_fecha: { operarioId, fecha } },
      create: { operarioId, fecha, ...data },
      update: data,
    });
  },

  borrar(operarioId: string, fecha: Date) {
    return prisma.asistencia.delete({ where: { operarioId_fecha: { operarioId, fecha } } });
  },

  /** Trabajo completo para varios ayudantes el mismo día; no pisa lo ya marcado. */
  marcarPresentes(operarioIds: string[], fecha: Date) {
    return prisma.asistencia.createMany({
      data: operarioIds.map((operarioId) => ({ operarioId, fecha, estado: 'trabajo' as const })),
      skipDuplicates: true,
    });
  },
};
