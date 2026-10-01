// Reglas del servicio de corte interno compartidas por API y pantalla
// (docs/PLAN_SERVICIO_CORTE.md §1-2). Dinero en centavos enteros.
import type { RolOperario } from './dtos/operario.js';

export const PROCESOS_CORTE = ['busqueda', 'trazado', 'doblado', 'corte', 'clasificacion'] as const;
export type ProcesoCorte = (typeof PROCESOS_CORTE)[number];
export type ModalidadDoblado = 'hoja' | 'pares';

export const ETIQUETA_PROCESO: Record<ProcesoCorte, string> = {
  busqueda: 'Búsqueda del modelo',
  trazado: 'Trazado',
  doblado: 'Doblado de tela',
  corte: 'Corte de tela',
  clasificacion: 'Clasificación y codificación',
};

export const ETIQUETA_MODALIDAD: Record<ModalidadDoblado, string> = {
  hoja: 'Por hoja / cara',
  pares: 'Por pares',
};

/** Oficio que debe tener cada persona del proceso (restricción estricta). */
export const ROL_DE_PROCESO: Record<ProcesoCorte, RolOperario> = {
  busqueda: 'buscador',
  trazado: 'trazador',
  doblado: 'doblador',
  corte: 'cortador',
  clasificacion: 'clasificador',
};

/** Cuántas personas lleva cada proceso [mínimo, máximo]. */
export const PERSONAS_POR_PROCESO: Record<ProcesoCorte, readonly [number, number]> = {
  busqueda: [1, 1],
  trazado: [1, 1],
  doblado: [2, 2],
  corte: [1, 3],
  clasificacion: [1, 2],
};

/** Corte y clasificación: cada persona cobra su propia tarifa (habilidad/velocidad).
 *  En los demás la tarifa es una sola para el proceso. */
export const TARIFA_POR_PERSONA: Record<ProcesoCorte, boolean> = {
  busqueda: false,
  trazado: false,
  doblado: false,
  corte: true,
  clasificacion: true,
};

/** Doblado: total exacto del proceso repartido en 2; el centavo sobrante va al
 *  primero anotado. 721 × 15 = 10 815 → [5 408, 5 407] (nunca 10 816). */
export function repartirDoblado(cantidad: number, tarifaProceso: number): [number, number] {
  const total = cantidad * tarifaProceso;
  const primero = Math.ceil(total / 2);
  return [primero, total - primero];
}
