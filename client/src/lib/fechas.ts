/** Fecha LOCAL de hoy como yyyy-mm-dd (para <input type="date">).
 *  No usar new Date().toISOString().slice(0, 10): eso da la fecha UTC, y en
 *  Bolivia (UTC−4) desde las 20:00 ya es "mañana" — a fin de mes empujaría el
 *  cierre o el anticipo al mes equivocado. */
export function hoyLocalISO(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}
