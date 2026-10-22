// Único acceso a Prisma del módulo. El snapshot al abrir y el reemplazo de
// asignaciones son transaccionales (ARQUITECTURA §3.2): nunca quedan a medias.
import type {
  EstadoCorteOp,
  ModalidadDoblado,
  Prisma,
  ProcesoCorte,
  TipoCambioCorte,
} from '@prisma/client';
import type { DetalleCambioCorte } from '@taller/shared';
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
  // historial de cambios de último momento (más reciente primero)
  cambios: { orderBy: { fecha: 'desc' as const } },
  // lavandería y bordado externos, en el orden en que se mandaron
  envios: {
    orderBy: [{ fechaEnvio: 'asc' as const }, { creadoEn: 'asc' as const }],
    include: { operario: { select: { id: true, nombre: true } } },
  },
};

/** Una fila del historial de cambios del corte, armada por el service. */
export interface CambioData {
  tipo: TipoCambioCorte;
  corteOperacionId: string | null;
  grupo: string;
  etiqueta: string;
  detalle: DetalleCambioCorte;
}

function aFilaCambio(corteId: string, c: CambioData): Prisma.CorteCambioUncheckedCreateInput {
  // el detalle es JSON plano armado en cambios.ts
  return { ...c, corteId, detalle: c.detalle as unknown as Prisma.InputJsonValue };
}

/** Datos editables de una operación del corte (snapshot propio del corte). */
export type DatosOperacionCorte = Pick<
  Prisma.CorteOperacionUncheckedCreateInput,
  'grupo' | 'n' | 'equipo' | 'proceso' | 'pieza' | 'ct' | 'esEmpaque'
>;

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

  /** Cortes abiertos con lo justo para contar, por cuenta, cuáles tienen
   *  trabajo pendiente (inicio, PLAN_CUENTAS_SEPARADAS §6). */
  abiertosConPendientes() {
    return prisma.corte.findMany({
      where: { estado: 'abierto' },
      select: {
        esInterno: true,
        operaciones: { select: { esEmpaque: true, estado: true } },
        trabajos: { select: { proceso: true } },
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

  /** Mayor código usado (0 si no hay cortes): el siguiente automático es éste + 1. */
  async maximoCodigo(): Promise<number> {
    const r = await prisma.corte.aggregate({ _max: { codigo: true } });
    return r._max.codigo ?? 0;
  },

  /** Corte que ya usa ese código (para rechazar repetidos con un mensaje claro). */
  buscarPorCodigo(codigo: number) {
    return prisma.corte.findUnique({
      where: { codigo },
      select: { id: true, codigo: true, version: { select: { modelo: { select: { nombre: true } } } } },
    });
  },

  actualizarCodigo(corteId: string, codigo: number) {
    return prisma.corte.update({ where: { id: corteId }, data: { codigo } });
  },

  crearBorrador(data: {
    modeloVersionId: string;
    codigo: number;
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

  actualizarRollos(
    corteId: string,
    data: { rollosCm: number[]; traslapeCm: number; retazoMinimoCm: number },
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

  // ── Cambios de último momento a las operaciones del corte (nunca al modelo) ──

  /** Fija orden = posición (1..n) y registra el historial, atómico. */
  reordenarOperaciones(corteId: string, operacionIds: string[], cambios: CambioData[]) {
    return prisma.$transaction(async (tx) => {
      for (const [i, id] of operacionIds.entries()) {
        await tx.corteOperacion.update({ where: { id }, data: { orden: i + 1 } });
      }
      await tx.corteCambio.createMany({ data: cambios.map((c) => aFilaCambio(corteId, c)) });
    });
  },

  /** Edita el snapshot de una operación del corte. Si cambió el CT, las
   *  asignaciones llegan ya recalculadas (tarifa y total) y se guardan juntas. */
  editarOperacion(
    corteId: string,
    corteOperacionId: string,
    data: Partial<DatosOperacionCorte> & { tiempoSeg?: number | null },
    asignaciones: { id: string; tarifaEfectiva: number; total: number }[],
    cambio: CambioData,
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.corteOperacion.update({ where: { id: corteOperacionId }, data });
      for (const a of asignaciones) {
        await tx.asignacion.update({
          where: { id: a.id },
          data: { tarifaEfectiva: a.tarifaEfectiva, total: a.total },
        });
      }
      await tx.corteCambio.create({ data: aFilaCambio(corteId, cambio) });
    });
  },

  /** Operación extra solo para este corte: al final, sin asignar, sin origen. */
  agregarOperacion(
    corteId: string,
    data: DatosOperacionCorte & { cantidadObjetivo: number; tiempoSeg: number | null },
    cambio: Omit<CambioData, 'corteOperacionId'>,
  ) {
    return prisma.$transaction(async (tx) => {
      const ultimo = await tx.corteOperacion.aggregate({
        where: { corteId },
        _max: { orden: true },
      });
      const op = await tx.corteOperacion.create({
        data: { ...data, corteId, orden: (ultimo._max.orden ?? 0) + 1, estado: 'sin_asignar' },
      });
      await tx.corteCambio.create({
        data: aFilaCambio(corteId, { ...cambio, corteOperacionId: op.id }),
      });
    });
  },

  /** Quita una operación SIN asignaciones (el service lo exige) y lo registra. */
  quitarOperacion(corteId: string, corteOperacionId: string, cambio: CambioData) {
    return prisma.$transaction(async (tx) => {
      await tx.corteCambio.create({ data: aFilaCambio(corteId, cambio) });
      await tx.corteOperacion.delete({ where: { id: corteOperacionId } });
    });
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

  // ── Envíos a lavandería y bordado externos (PLAN_CUENTAS_SEPARADAS §5) ──

  obtenerProveedor(id: string) {
    return prisma.operario.findUnique({ where: { id } });
  },

  crearEnvio(data: Prisma.EnvioServicioUncheckedCreateInput) {
    return prisma.envioServicio.create({ data });
  },

  actualizarEnvio(id: string, data: Prisma.EnvioServicioUncheckedUpdateInput) {
    return prisma.envioServicio.update({ where: { id }, data });
  },

  eliminarEnvio(id: string) {
    return prisma.envioServicio.delete({ where: { id } });
  },

  /** Envíos sin devolver (corte y servicio), para los cortes activos del inicio. */
  enviosSinDevolver() {
    return prisma.envioServicio.findMany({
      where: { fechaDevolucion: null },
      select: { corteId: true, servicio: true },
    });
  },
};
