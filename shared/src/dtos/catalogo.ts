// Catálogo de captura. Dos cosas distintas en una sola respuesta:
//  - la jerarquía Máquina → Proceso → Pieza, que aplica DENTRO de cada operación;
//  - los grupos, que ENVUELVEN a las operaciones de un modelo y no filtran nada
//    de esa jerarquía (la lista de máquinas es la misma para todos los grupos).
// No lleva precios: el CT lo escribe siempre el dueño (PLAN_CATALOGO §2.5).

export interface CatalogoNodoDTO {
  id: string;
  nombre: string;
  activo: boolean;
  /** Operaciones que usan este texto. usos = 0 ⇒ se puede borrar físicamente (C-4). */
  usos: number;
}

/** Proceso o pieza: llevan el tiempo estimado (segundos por prenda). En una
 *  operación manda el de la pieza; si no tiene, el del proceso. */
export interface CatalogoNodoConTiempoDTO extends CatalogoNodoDTO {
  tiempoSeg: number | null;
}

export interface CatalogoProcesoDTO extends CatalogoNodoConTiempoDTO {
  piezas: CatalogoNodoConTiempoDTO[];
}

export interface CatalogoMaquinaDTO extends CatalogoNodoDTO {
  procesos: CatalogoProcesoDTO[];
}

/** Respuesta única que alimenta tanto el formulario de modelos como la pantalla
 *  de administración: son pocos KB, se cachean y la cascada se resuelve en el cliente. */
export interface CatalogoGrupoDTO extends CatalogoNodoDTO {
  /** Operaciones del bloque reutilizable del grupo (0 = sin bloque). */
  operacionesBloque: number;
}

export interface CatalogoArbolDTO {
  maquinas: CatalogoMaquinaDTO[];
  grupos: CatalogoGrupoDTO[];
}

/** Una operación del bloque estándar de un grupo (como una fila de plantilla). */
export interface BloqueOperacionDTO {
  id: string;
  orden: number;
  n: string | null;
  equipo: string;
  proceso: string;
  pieza: string | null;
  ctReferencia: number | null; // centavos; sugerencia, el CT real va en el modelo
  esEmpaque: boolean;
}

export interface BloqueGrupoDTO {
  grupo: { id: string; nombre: string };
  operaciones: BloqueOperacionDTO[]; // por orden
}

/** Resultado de unir dos entradas del catálogo. */
export interface FusionDTO {
  /** La entrada que queda. */
  destino: CatalogoNodoDTO;
  nombreAbsorbido: string;
  /** Operaciones (de modelos y plantillas) cuyo texto se reescribió.
   *  Los cortes NO se tocan. */
  operacionesActualizadas: number;
}
