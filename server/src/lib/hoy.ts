// "Hoy" como día del taller ('aaaa-mm-dd' en hora de Bolivia, UTC−4). El
// servidor corre en UTC: desde las 20:00 de Bolivia ya sería "mañana" si se
// tomara la fecha UTC (mismo problema que client/src/lib/fechas.ts).
const formato = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/La_Paz',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function hoyEnBolivia(ahora = new Date()): string {
  return formato.format(ahora); // en-CA da 'aaaa-mm-dd'
}
