import type { ModalidadDoblado, ProcesoCorte } from '../servicioCorte.js';
import type { PasoCorte } from '../pasos.js';
import type { ServicioExterno } from '../schemas/corte.js';

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
  esEmpaque: boolean; // congelado al abrir, como el ct
  cantidadObjetivo: number;
  estado: EstadoCorteOperacion;
  asignado: number; // Σ cantidades asignadas
  diferencia: number; // objetivo − asignado (>0 faltan, <0 sobran)
  totalOperacion: number; // centavos, Σ totales de sus asignaciones
  asignaciones: AsignacionDTO[];
  tiempoSeg: number | null; // segundos por prenda (catálogo, congelado al abrir); null = sin tiempo
  // cambio de último momento respecto del modelo (solo en este corte)
  agregadaEnCorte: boolean; // no viene del modelo: se agregó en el corte
  modificadaEnCorte: boolean; // máquina/proceso/pieza/CT distintos al modelo
}

// ── Historial de cambios de las operaciones del corte (no tocan el modelo) ──

export type TipoCambioCorte = 'reordenar' | 'editar' | 'agregar' | 'quitar';
export type CampoOperacion = 'grupo' | 'n' | 'equipo' | 'proceso' | 'pieza' | 'ct' | 'esEmpaque';
export type ValorCampo = string | number | boolean | null;

export interface OperacionResumenDTO {
  grupo: string;
  n: string | null;
  equipo: string;
  proceso: string;
  pieza: string | null;
  ct: number; // centavos
  esEmpaque?: boolean; // ausente en cambios anteriores a la marca = costura
}

export type DetalleCambioCorte =
  | {
      tipo: 'editar';
      campos: { campo: CampoOperacion; antes: ValorCampo; despues: ValorCampo }[];
    }
  | { tipo: 'agregar' | 'quitar'; operacion: OperacionResumenDTO }
  | { tipo: 'reordenar'; antes: string[]; despues: string[] };

export interface CorteCambioDTO {
  id: string;
  fecha: string; // ISO
  grupo: string;
  etiqueta: string; // "proceso · pieza" al momento del cambio
  detalle: DetalleCambioCorte;
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
  codigo: number; // numeración del corte (N° 23), única
  modeloNombre: string;
  numeroVersion: number;
  cantidadTotal: number;
  estado: EstadoCorte;
  paso: PasoCorte; // dónde está físicamente (en mesa, costura, lavandería…)
  pasoDesde: string; // ISO
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
  codigo: number; // numeración del corte (N° 23), única
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
  prendasPorCapa: number | null; // costos: tela real = trazado × capas
  // calculadora de tendido (null = sin cargar); el resultado se calcula con
  // calcularTendido() de shared
  rollos: { rollosCm: number[]; traslapeCm: number; retazoMinimoCm: number } | null;
  esInterno: boolean;
  servicio: ServicioCorteDTO | null; // null en cortes externos
  estado: EstadoCorte;
  paso: PasoCorte; // dónde está físicamente (en mesa, costura, lavandería…)
  pasoDesde: string; // ISO
  fechaInicio: string;
  fechaCierre: string | null;
  costoManoObraPrenda: number; // centavos, Σ ct del snapshot
  costoTotalCorte: number; // costura: centavos = cantidadTotal × costoManoObraPrenda (CA-2.3)
  costoEmpaqueCorte: number; // la parte de empaque de costoTotalCorte (Σ ct empaque × cantidad)
  costoServicioCorte: number; // Σ trabajos del servicio de corte interno (0 si externo)
  // servicios externos: Σ de todos los envíos de cada uno (devueltos o no)
  costoExternos: Record<ServicioExterno, number>;
  costoTotal: number; // costura + servicio de corte + servicios externos
  envios: EnvioServicioDTO[]; // a serigrafía, láser, bordado y lavandería (PLAN_CUENTAS_SEPARADAS §5)
  operaciones: CorteOperacionDTO[];
  totalesPorOperario: TotalPorOperarioDTO[];
  cambios: CorteCambioDTO[]; // historial de cambios respecto del modelo, más reciente primero
  estimado: EstimadoDuracionDTO;
}

/** Cuánto tarda el corte: todos cosen en paralelo, así que termina cuando
 *  termina el operario más cargado (Σ piezas asignadas × segundos por prenda).
 *  Solo estimado; no afecta pagos. */
export interface EstimadoDuracionDTO {
  duracionSeg: number | null; // null = todavía no hay nada asignado con tiempo
  operarioMasCargado: PersonaDTO | null;
  operacionesSinTiempo: string[]; // etiquetas: el catálogo no tenía tiempo al abrir
  operacionesSinAsignar: number; // sin asignar o con descuadre: su trabajo no está repartido
}

/** Envío de prendas del corte a un proveedor externo. Se gana (y entra a la
 *  cuenta del servicio) en la fecha de devolución. */
export interface EnvioServicioDTO {
  id: string;
  servicio: ServicioExterno;
  operario: { id: string; nombre: string }; // el proveedor
  cantidad: number; // prendas enviadas
  precioPrenda: number; // centavos
  total: number; // centavos = cantidad × precioPrenda
  fechaEnvio: string; // 'aaaa-mm-dd'
  fechaDevolucion: string | null; // 'aaaa-mm-dd'; null = todavía no volvió
  nota: string | null;
  bloqueado: boolean; // devuelto en un mes ya liquidado: no se puede tocar
}
