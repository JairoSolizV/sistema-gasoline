export interface LiquidacionFilaDTO {
  operarioId: string;
  nombre: string;
  activo: boolean;
  esMaestro: boolean;
  saldoEntrada: number; // centavos, arrastre del mes anterior (puede ser negativo)
  ganado: number; // centavos, de cortes cerrados con fechaCierre en el mes
  anticipos: number; // centavos, del período
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
  cortesCerrados: number;
  ganado: number; // centavos ganados por cortes cerrados esa semana
}

export interface ConsolidadoTotalesDTO {
  saldoEntrada: number;
  ganado: number;
  anticipos: number;
  saldoPeriodo: number;
  pagado: number | null; // solo si cerrado
  saldoSalida: number | null; // solo si cerrado
}

export interface ConsolidadoDTO {
  anio: number;
  mes: number;
  cerrado: boolean;
  fechaCierre: string | null;
  semanas: SemanaConsolidadoDTO[];
  filas: LiquidacionFilaDTO[];
  totales: ConsolidadoTotalesDTO;
}
