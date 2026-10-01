import type { ModalidadDoblado, ProcesoCorte } from '../servicioCorte.js';

export type EstadoCorte = 'borrador' | 'abierto' | 'cerrado';
export type EstadoCorteOperacion = 'sin_asignar' | 'parcial' | 'asignada';

export interface AsignacionDTO {
  id: string;
  operarioId: string;
  operarioNombre: string;
  cantidad: number;
  esMaestroExterno: boolean;
  diferencial: number; // centavos
  tarifaEfectiva: number; // centavos = ct + diferencial
  total: number; // centavos = cantidad × tarifaEfectiva
}

export interface CorteOperacionDTO {
  id: string;
  orden: number;
  grupo: string;
  n: string | null;
  equipo: string;
  proceso: string;
  pieza: string | null;
  ct: number; // centavos, snapshot congelado al abrir el corte
  cantidadObjetivo: number;
  estado: EstadoCorteOperacion;
  asignado: number; // Σ cantidades asignadas
  diferencia: number; // objetivo − asignado (>0 faltan, <0 sobran)
  totalOperacion: number; // centavos, Σ totales de sus asignaciones
  asignaciones: AsignacionDTO[];
}

export interface PersonaDTO {
  id: string;
  nombre: string;
}

// ── Servicio de corte interno (docs/PLAN_SERVICIO_CORTE.md) ──

export interface TrabajoCorteDTO {
  id: string;
  operario: PersonaDTO;
  orden: number;
  tarifa: number; // centavos/prenda aplicada (doblado: la del proceso completo)
  cantidad: number; // prendas
  total: number; // centavos, fijado al guardar
}

export interface ProcesoServicioDTO {
  proceso: ProcesoCorte;
  fecha: string; // ISO: cuándo se terminó; define la semana/mes en que se paga
  modalidad: ModalidadDoblado | null; // solo doblado
  trabajos: TrabajoCorteDTO[];
  subtotal: number; // centavos
}

export interface ServicioCorteDTO {
  procesos: ProcesoServicioDTO[]; // solo los registrados, en orden del proceso
  total: number; // centavos
  /** Procesos que faltan para poder cerrar el corte. */
  faltantes: ProcesoCorte[];
  // tarifas predeterminadas copiadas al corte al crearlo (centavos)
  tarifas: {
    busqueda: number;
    trazado: number;
    dobladoHoja: number;
    dobladoPares: number;
    corteRespaldo: number;
    clasificacionRespaldo: number;
  };
  // búsqueda: del modelo. Buscador de baja = no cobra en cortes nuevos.
  buscadorModelo: (PersonaDTO & { activo: boolean }) | null;
  sinBuscador: boolean;
}

export interface CorteResumenDTO {
  id: string;
  codigo: string | null;
  modeloNombre: string;
  numeroVersion: number;
  cantidadTotal: number;
  estado: EstadoCorte;
  fechaInicio: string;
  fechaCierre: string | null;
  operacionesTotal: number;
  operacionesAsignadas: number;
}

export interface TotalPorOperarioDTO {
  operarioId: string;
  nombre: string;
  incluyeMaestro: boolean; // alguna asignación suya en el corte fue como maestro externo
  piezas: number;
  total: number; // centavos
}

export interface CorteDetalleDTO {
  id: string;
  codigo: string | null;
  modeloVersionId: string;
  modeloNombre: string;
  numeroVersion: number;
  tallas: number[];
  cortePorTalla: number[];
  plusPorTalla: number[];
  cantidadTotal: number;
  // tendido (null en cortes creados antes de pedir estos datos)
  tela: string | null;
  anchoCm: number | null;
  trazadoCm: number | null;
  esInterno: boolean;
  servicio: ServicioCorteDTO | null; // null en cortes externos
  estado: EstadoCorte;
  fechaInicio: string;
  fechaCierre: string | null;
  costoManoObraPrenda: number; // centavos, Σ ct del snapshot
  costoTotalCorte: number; // costura: centavos = cantidadTotal × costoManoObraPrenda (CA-2.3)
  costoServicioCorte: number; // Σ trabajos del servicio de corte interno (0 si externo)
  costoTotal: number; // costura + servicio de corte
  operaciones: CorteOperacionDTO[];
  totalesPorOperario: TotalPorOperarioDTO[];
}
