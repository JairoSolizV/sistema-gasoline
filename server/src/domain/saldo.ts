// FUNCIONES PURAS de consolidado, saldo y cierre de mes (ARQUITECTURA §2.2).
// Es la lógica de mayor riesgo del sistema: aquí se decide cuánto se paga y qué
// se arrastra. Todo en centavos enteros → sin redondeos, aritmética exacta.
// Fechas: se comparan por UTC para ser independientes del huso del servidor.

export type EstadoCorteParaGanado = 'borrador' | 'abierto' | 'cerrado';

export interface AsignacionParaGanado {
  total: number; // centavos
  estadoCorte: EstadoCorteParaGanado;
  fechaCierre: Date | null;
}

function enMesUTC(fecha: Date, anio: number, mes: number): boolean {
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() + 1 === mes;
}

/** Ganado del período: SOLO cortes cerrados (CA-5.2), agrupados por su
 *  fechaCierre (CA-5.7). Un corte a medias no se paga. */
export function ganadoPorPeriodo(
  asignaciones: ReadonlyArray<AsignacionParaGanado>,
  anio: number,
  mes: number,
): number {
  return asignaciones
    .filter(
      (a) =>
        a.estadoCorte === 'cerrado' &&
        a.fechaCierre != null &&
        enMesUTC(a.fechaCierre, anio, mes),
    )
    .reduce((acc, a) => acc + a.total, 0);
}

/** Saldo del período = saldo de entrada (arrastre) + ganado − anticipos.
 *  No hay ningún otro término (CA-8.4: la alimentación NO afecta el saldo). */
export function calcularSaldo(saldoEntrada: number, ganado: number, anticipos: number): number {
  return saldoEntrada + ganado - anticipos;
}

export interface ResultadoCierre {
  pagado: number;
  saldoSalida: number;
}

/** Cierre de mes para un operario:
 *  - saldo negativo (se adelantó de más): no se paga nada y el negativo se
 *    arrastra entero al mes siguiente (CA-5.4).
 *  - saldo positivo sin excepción: se paga todo, el saldo queda en 0 (CA-6.1).
 *  - saldo positivo con excepción `arrastraSaldo`: cobra `pagadoPropuesto`
 *    (recortado a [0, saldo]) y el resto se arrastra (CA-6.2, Regla 7.7). */
export function calcularCierreMes(
  saldoPeriodo: number,
  arrastraSaldo: boolean,
  pagadoPropuesto = 0,
): ResultadoCierre {
  if (saldoPeriodo < 0) {
    return { pagado: 0, saldoSalida: saldoPeriodo };
  }
  if (!arrastraSaldo) {
    return { pagado: saldoPeriodo, saldoSalida: 0 };
  }
  const pagado = Math.max(0, Math.min(pagadoPropuesto, saldoPeriodo));
  return { pagado, saldoSalida: saldoPeriodo - pagado };
}

export interface SemanaMes {
  inicio: Date; // lunes 00:00 UTC
  finExclusivo: Date; // lunes siguiente 00:00 UTC (fin exclusivo)
}

/** Semanas lunes–sábado (config del taller) que tocan el mes, para el desglose
 *  visual del consolidado. El pago se agrupa por mes; esto es solo referencia. */
export function semanasDelMes(anio: number, mes: number): SemanaMes[] {
  const primerDia = new Date(Date.UTC(anio, mes - 1, 1));
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)); // día 0 del mes siguiente = último del mes
  const diaSemana = primerDia.getUTCDay(); // 0=domingo, 1=lunes…
  const desplaz = diaSemana === 0 ? 6 : diaSemana - 1;
  const primerLunes = new Date(primerDia);
  primerLunes.setUTCDate(primerLunes.getUTCDate() - desplaz);

  const semanas: SemanaMes[] = [];
  const cursor = new Date(primerLunes);
  while (cursor.getTime() <= ultimoDia.getTime()) {
    const inicio = new Date(cursor);
    const finExclusivo = new Date(cursor);
    finExclusivo.setUTCDate(finExclusivo.getUTCDate() + 7);
    semanas.push({ inicio, finExclusivo });
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return semanas;
}
