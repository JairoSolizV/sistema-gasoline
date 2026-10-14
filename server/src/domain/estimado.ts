// FUNCIÓN PURA: estimado de duración de un corte (solo informativo, no toca
// pagos). Cada operación tiene un tiempo en segundos por prenda (del catálogo,
// congelado al abrir). Los operarios cosen en paralelo, así que el corte
// termina cuando termina el más cargado:
//   carga(operario) = Σ piezas asignadas × segundos por prenda
//   duración        = max(carga)

export interface OperacionParaEstimar {
  etiqueta: string;
  tiempoSeg: number | null;
  estado: 'sin_asignar' | 'parcial' | 'asignada';
  asignaciones: ReadonlyArray<{ operarioId: string; cantidad: number }>;
}

export interface Estimado {
  duracionSeg: number | null; // null = no hay nada asignado con tiempo
  operarioMasCargadoId: string | null;
  cargas: Map<string, number>; // segundos por operario
  operacionesSinTiempo: string[];
  operacionesSinAsignar: number;
}

export function estimarDuracion(operaciones: ReadonlyArray<OperacionParaEstimar>): Estimado {
  const cargas = new Map<string, number>();
  for (const op of operaciones) {
    if (op.tiempoSeg == null) continue;
    for (const a of op.asignaciones) {
      cargas.set(a.operarioId, (cargas.get(a.operarioId) ?? 0) + a.cantidad * op.tiempoSeg);
    }
  }
  let operarioMasCargadoId: string | null = null;
  let duracionSeg: number | null = null;
  for (const [operarioId, seg] of cargas) {
    if (duracionSeg == null || seg > duracionSeg) {
      duracionSeg = seg;
      operarioMasCargadoId = operarioId;
    }
  }
  return {
    duracionSeg,
    operarioMasCargadoId,
    cargas,
    operacionesSinTiempo: operaciones.filter((o) => o.tiempoSeg == null).map((o) => o.etiqueta),
    operacionesSinAsignar: operaciones.filter((o) => o.estado !== 'asignada').length,
  };
}

/** Tiempo de una operación según el catálogo: manda el de la pieza; si la
 *  pieza no tiene (o la operación no lleva pieza), el del proceso. */
export function tiempoDeOperacion(
  tiempoProceso: number | null | undefined,
  tiempoPieza: number | null | undefined,
): number | null {
  return tiempoPieza ?? tiempoProceso ?? null;
}
