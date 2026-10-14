// Tiempos estimados de costura (segundos por prenda, del catálogo). Solo sirven
// para estimar cuánto tarda un corte; nunca entran al cálculo de pagos.

/** 45 → "45 s" · 600 → "10 min" · 7440 → "2 h 04 min". */
export function formatDuracion(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  if (s < 60) return `${s} s`;
  const minutosTotales = Math.round(s / 60);
  const h = Math.floor(minutosTotales / 60);
  const min = minutosTotales % 60;
  if (h === 0) return `${min} min`;
  return `${h} h ${String(min).padStart(2, '0')} min`;
}
