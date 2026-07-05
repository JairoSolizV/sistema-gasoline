// Semana del taller = lunes a sábado (config del seed). Se usa para agrupar el
// histórico de anticipos y, más adelante, el desglose semanal de la liquidación.

/** Lunes (00:00) de la semana que contiene a `fecha`. */
export function lunesDe(fecha: Date): Date {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  const dia = d.getDay(); // 0=domingo, 1=lunes, …
  const desplazamiento = dia === 0 ? 6 : dia - 1; // domingo cae en la semana anterior
  d.setDate(d.getDate() - desplazamiento);
  return d;
}

/** Clave estable de semana (ISO del lunes) para agrupar. */
export function claveSemana(fecha: Date): string {
  return lunesDe(fecha).toISOString().slice(0, 10);
}

/** Etiqueta legible del rango lunes–sábado, ej. "01–06 jun". */
export function etiquetaSemana(claveLunesISO: string): string {
  const lunes = new Date(`${claveLunesISO}T12:00:00`);
  const sabado = new Date(lunes);
  sabado.setDate(sabado.getDate() + 5);
  const dia = (d: Date) => String(d.getDate()).padStart(2, '0');
  const mes = sabado.toLocaleDateString('es-BO', { month: 'short' });
  return `${dia(lunes)}–${dia(sabado)} ${mes}`;
}
