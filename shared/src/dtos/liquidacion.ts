import type { Cuenta } from '../cuentas.js';

// Consolidado del mes POR CUENTA (docs/PLAN_CUENTAS_SEPARADAS.md): cada cuenta
// tiene sus filas, semanas y totales; los montos de cuentas distintas nunca se
// suman entre sí.

/** Un operario dentro de UNA cuenta. */
export interface LiquidacionFilaDTO {
  operarioId: string;
  nombre: string;
  activo: boolean;
  esMaestro: boolean;
  saldoEntrada: number; // centavos, arrastre del mes anterior en esta cuenta (puede ser negativo)
  ganado: number; // centavos ganados en esta cuenta en el mes
  anticipos: number; // centavos, anticipos cargados a esta cuenta en el mes
  saldoPeriodo: number; // = saldoEntrada + ganado − anticipos
  // presentes solo cuando el mes está cerrado (valores persistidos):
  pagado: number | null;
  arrastraSaldo: boolean;
  saldoSalida: number | null;
}

export interface SemanaConsolidadoDTO {
  inicioISO: string; // lunes
  finISO: string; // sábado
  label: string; // ej. "01–06 jun"
  cortesCerrados: number; // cortes cerrados en la semana con montos de esta cuenta
  ganado: number; // centavos ganados esa semana en esta cuenta
}

export interface ConsolidadoTotalesDTO {
  saldoEntrada: number;
  ganado: number;
  anticipos: number;
  saldoPeriodo: number;
  pagado: number | null; // solo si cerrado
  saldoSalida: number | null; // solo si cerrado
}

export interface CuentaConsolidadoDTO {
  cuenta: Cuenta;
  semanas: SemanaConsolidadoDTO[];
  filas: LiquidacionFilaDTO[]; // solo operarios con movimiento o saldo en esta cuenta
  totales: ConsolidadoTotalesDTO;
}

export interface ConsolidadoDTO {
  anio: number;
  mes: number;
  cerrado: boolean;
  fechaCierre: string | null;
  cuentas: CuentaConsolidadoDTO[]; // las 7 cuentas, siempre, en el orden de CUENTAS
}
