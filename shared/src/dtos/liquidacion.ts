/** Ganado separado por tipo de trabajo (docs/PLAN_SERVICIO_CORTE.md §2.12). */
export interface GanadoDesgloseDTO {
  costura: number; // centavos, de cortes cerrados (por fechaCierre)
  servicioCorte: number; // centavos, trabajos del servicio de corte (por fecha del trabajo)
  moldes: number; // centavos, pagos de moldes (por su fecha)
}

export interface LiquidacionFilaDTO {
  operarioId: string;
  nombre: string;
  activo: boolean;
  esMaestro: boolean;
  saldoEntrada: number; // centavos, arrastre del mes anterior (puede ser negativo)
  ganado: number; // centavos = costura + servicio de corte + moldes del mes
  desglose: GanadoDesgloseDTO;
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
  ganado: number; // centavos ganados esa semana (costura + servicio + moldes)
  desglose: GanadoDesgloseDTO;
}

export interface ConsolidadoTotalesDTO {
  saldoEntrada: number;
  ganado: number;
  desglose: GanadoDesgloseDTO;
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
