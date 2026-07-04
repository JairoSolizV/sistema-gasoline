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
  estado: EstadoCorte;
  fechaInicio: string;
  fechaCierre: string | null;
  costoManoObraPrenda: number; // centavos, Σ ct del snapshot
  costoTotalCorte: number; // centavos = cantidadTotal × costoManoObraPrenda (CA-2.3)
  operaciones: CorteOperacionDTO[];
  totalesPorOperario: TotalPorOperarioDTO[];
}
