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

export interface CatalogoProcesoDTO extends CatalogoNodoDTO {
  piezas: CatalogoNodoDTO[];
}

export interface CatalogoMaquinaDTO extends CatalogoNodoDTO {
  procesos: CatalogoProcesoDTO[];
}

/** Respuesta única que alimenta tanto el formulario de modelos como la pantalla
 *  de administración: son pocos KB, se cachean y la cascada se resuelve en el cliente. */
export interface CatalogoArbolDTO {
  maquinas: CatalogoMaquinaDTO[];
  grupos: CatalogoNodoDTO[];
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
