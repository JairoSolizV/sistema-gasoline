// Sueldo semanal de los ayudantes (docs/PLAN_AYUDANTES.md §2-3). FUNCIONES PURAS,
// compartidas por la API (cálculo que se paga) y la pantalla (vista previa).
//
// Semana = lunes a sábado (6 días); el sábado es medio día pero se paga completo.
// Día = sueldo semanal ÷ 6; hora = día ÷ 9 (jornada 8–12 y 14–19), siempre.
// Cada día marcado vale "minutos pagados" de 540. El dinero se calcula en una
// fracción exacta y se redondea UNA sola vez por período (CLAUDE.md §7).

export const MINUTOS_JORNADA = 540; // 9 h
export const DIAS_SEMANA = 6; // lunes a sábado
const DIVISOR = DIAS_SEMANA * MINUTOS_JORNADA; // 3240 minutos pagados = 1 semana

export type EstadoAsistencia = 'trabajo' | 'falta' | 'feriado';

export interface DiaAsistencia {
  estado: EstadoAsistencia;
  minutosDescontados: number; // atrasos y salidas antes de hora
  minutosOperaciones: number; // horas de horario dedicadas a operaciones (se pagan aparte)
}

/** Minutos de la jornada que se pagan con sueldo ese día. */
export function minutosPagados(d: DiaAsistencia): number {
  if (d.estado === 'falta') return 0;
  if (d.estado === 'feriado') return MINUTOS_JORNADA;
  return Math.max(0, MINUTOS_JORNADA - d.minutosDescontados - d.minutosOperaciones);
}

export interface DiaParaSueldo {
  montoSemanal: number; // centavos, sueldo vigente ese día
  minutosPagados: number; // 0..540
}

/** Total del período en centavos: Σ (semanal × minutos) ÷ 3240, half-up una vez.
 *  Aritmética entera: 6 días completos de 400 dan 40 000, nunca 40 002. */
export function sueldoDelPeriodo(dias: DiaParaSueldo[]): number {
  const numerador = dias.reduce((a, d) => a + d.montoSemanal * d.minutosPagados, 0);
  return Math.floor((2 * numerador + DIVISOR) / (2 * DIVISOR)); // half-up (numerador ≥ 0)
}

/** Reparte el total del período entre sus días (para mostrar por día o semana)
 *  con el método del mayor resto: cada día recibe su parte entera y los
 *  centavos que sobran van a los de mayor fracción (empate: el primero). La
 *  suma es EXACTAMENTE sueldoDelPeriodo(dias). */
export function repartirSueldo(dias: DiaParaSueldo[]): number[] {
  return mayorResto(sueldoDelPeriodo(dias), dias.map(exacto));
}

/** Como repartirSueldo, pero en dos niveles: el total del período se reparte
 *  primero entre las SEMANAS (clave `semana`, ej. el lunes) y cada semana entre
 *  sus días. Así una semana completa recibe exactamente su sueldo (no tiene
 *  fracción) y los centavos del redondeo del mes caen en semanas incompletas.
 *  La suma sigue siendo EXACTAMENTE sueldoDelPeriodo(dias). */
export function repartirSueldoPorSemana(dias: (DiaParaSueldo & { semana: string })[]): number[] {
  const semanas = [...new Set(dias.map((d) => d.semana))];
  const indices = semanas.map((s) => dias.flatMap((d, i) => (d.semana === s ? [i] : [])));
  const exactosSemana = indices.map((ids) => ids.reduce((a, i) => a + exacto(dias[i]), 0));
  const porSemana = mayorResto(sueldoDelPeriodo(dias), exactosSemana);
  const montos = new Array<number>(dias.length).fill(0);
  indices.forEach((ids, s) => {
    const partes = mayorResto(porSemana[s], ids.map((i) => exacto(dias[i])));
    ids.forEach((i, k) => (montos[i] = partes[k]));
  });
  return montos;
}

/** Valor exacto de un día en 1/3240 de centavo (entero). */
const exacto = (d: DiaParaSueldo) => d.montoSemanal * d.minutosPagados;

/** Reparte `total` centavos en partes proporcionales a `exactos` (en 1/3240 de
 *  centavo): cada una recibe su parte entera y los centavos que sobran van a las
 *  de mayor fracción (empate: la primera). */
function mayorResto(total: number, exactos: number[]): number[] {
  const base = exactos.map((n) => Math.floor(n / DIVISOR));
  let sobran = total - base.reduce((a, b) => a + b, 0);
  const porResto = exactos
    .map((n, i) => ({ i, resto: n % DIVISOR }))
    .sort((a, b) => b.resto - a.resto || a.i - b.i);
  for (const { i } of porResto) {
    if (sobran <= 0) break;
    base[i] += 1;
    sobran -= 1;
  }
  return base;
}
