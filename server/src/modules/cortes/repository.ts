// Único acceso a Prisma del módulo. El snapshot al abrir y el reemplazo de
// asignaciones son transaccionales (ARQUITECTURA §3.2): nunca quedan a medias.
import type { EstadoCorteOp, ModalidadDoblado, Prisma, ProcesoCorte } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

/** Tarifas predeterminadas copiadas al corte (mismos nombres que las columnas). */
export interface TarifasServicioData {
  tarifaBusqueda: number;
  tarifaTrazado: number;
  tarifaDobladoHoja: number;
  tarifaDobladoPares: number;
  tarifaCorteRespaldo: number;
  tarifaClasificacionRespaldo: number;
}

/** Una fila de TrabajoCorte ya calculada por el service (total fijado). */
export interface FilaTrabajo {
  proceso: ProcesoCorte;
  operarioId: string;
  orden: number;
  tarifa: number;
  cantidad: number;
  total: number;
  fecha: Date;
}

const incluirDetalle = {
  version: {
    include: {
      modelo: { include: { buscador: { select: { id: true, nombre: true, activo: true } } } },
    },
  },
  // servicio de corte interno: por proceso (orden del enum) y orden dentro de él
  trabajos: {
    orderBy: [{ proceso: 'asc' as const }, { orden: 'asc' as const }],
    include: { operario: { select: { id: true, nombre: true } } },
  },
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
    tela: string;
    anchoCm: number;
    trazadoCm: number;
    esInterno: boolean;
    tarifas: TarifasServicioData | null; // snapshot de Configuración (null si externo)
  }) {
    const { tarifas, ...resto } = data;
    return prisma.corte.create({ data: { ...resto, ...(tarifas ?? {}) } });
  },

  actualizarTendido(
    corteId: string,
    data: { tela: string; anchoCm: number; trazadoCm: number },
  ) {
    return prisma.corte.update({ where: { id: corteId }, data });
  },

  /** Marca interno/externo; al pasar a interno se copian las tarifas si faltan. */
  actualizarServicio(
    corteId: string,
    data: { esInterno: boolean; tarifas?: TarifasServicioData },
  ) {
    return prisma.corte.update({
      where: { id: corteId },
      data: { esInterno: data.esInterno, ...(data.tarifas ?? {}) },
    });
  },

  /** Reemplaza el set completo de un proceso (todas sus personas), atómico.
   *  `extra` agrega filas de otro proceso en la misma transacción (búsqueda
   *  automática al registrar el corte). */
  reemplazarTrabajos(
    corteId: string,
    proceso: ProcesoCorte,
    filas: FilaTrabajo[],
    opciones: { modalidad?: ModalidadDoblado | null; extra?: FilaTrabajo[] } = {},
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.trabajoCorte.deleteMany({ where: { corteId, proceso } });
      await tx.trabajoCorte.createMany({
        data: [...filas, ...(opciones.extra ?? [])].map((f) => ({ ...f, corteId })),
      });
      if (opciones.modalidad !== undefined) {
        await tx.corte.update({
          where: { id: corteId },
          data: { modalidadDoblado: opciones.modalidad },
        });
      }
    });
  },

  eliminarTrabajos(corteId: string, proceso: ProcesoCorte) {
    return prisma.$transaction(async (tx) => {
      await tx.trabajoCorte.deleteMany({ where: { corteId, proceso } });
      if (proceso === 'doblado') {
        await tx.corte.update({ where: { id: corteId }, data: { modalidadDoblado: null } });
      }
    });
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
};
