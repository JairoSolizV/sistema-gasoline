// Fechas de DÍA sin hora ('aaaa-mm-dd'), para sueldos y asistencia
// (docs/PLAN_AYUDANTES.md). Viajan como texto y en la BD son @db.Date: se
// guardan a medianoche UTC, así no se corren de día por la zona horaria
// (Bolivia es UTC−4) y caen en el mes correcto de la liquidación.

export const PATRON_DIA = /^\d{4}-\d{2}-\d{2}$/;

/** '2026-10-05' → Date a medianoche UTC. */
export function diaADate(dia: string): Date {
  return new Date(`${dia}T00:00:00.000Z`);
}

/** Date (medianoche UTC de @db.Date) → '2026-10-05'. */
export function dateADia(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/** ¿Es una fecha de calendario real? ('2026-02-30' no lo es) */
export function esDiaValido(dia: string): boolean {
  return PATRON_DIA.test(dia) && dateADia(diaADate(dia)) === dia;
}
