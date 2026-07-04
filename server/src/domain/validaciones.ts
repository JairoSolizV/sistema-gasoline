// FUNCIONES PURAS de validación de asignación y cierre (ARQUITECTURA §2.2).
// Son el corazón de los invariantes 1, 9 y CA-8.3: cualquier error aquí paga mal.

export type EstadoOperacion = 'sin_asignar' | 'parcial' | 'asignada';

export interface ResultadoSumaExacta {
  estado: EstadoOperacion;
  asignado: number;
  /** cantidadObjetivo − asignado: >0 faltan piezas, <0 sobran. */
  diferencia: number;
}

/** Regla 6.2 (CRÍTICA): la suma asignada debe ser EXACTAMENTE la cantidad del corte. */
export function validarSumaExacta(
  cantidades: ReadonlyArray<number>,
  cantidadObjetivo: number,
): ResultadoSumaExacta {
  const asignado = cantidades.reduce((acc, n) => acc + n, 0);
  const diferencia = cantidadObjetivo - asignado;
  const estado: EstadoOperacion =
    cantidades.length === 0 ? 'sin_asignar' : diferencia === 0 ? 'asignada' : 'parcial';
  return { estado, asignado, diferencia };
}

export const MAX_OPERARIOS_POR_OPERACION = 3;

/** Regla 6.1 / CA-3.5: una operación se parte entre 1 y 3 operarios. */
export function validarMaximoTres(cantidadAsignaciones: number): boolean {
  return cantidadAsignaciones <= MAX_OPERARIOS_POR_OPERACION;
}

/** CA-8.3: un corte solo puede cerrarse con TODAS sus operaciones asignadas. */
export function puedeCerrarCorte(estados: ReadonlyArray<EstadoOperacion>): boolean {
  return estados.length > 0 && estados.every((e) => e === 'asignada');
}
