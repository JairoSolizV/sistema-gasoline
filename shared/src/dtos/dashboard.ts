export interface DashboardKpisDTO {
  anio: number;
  mes: number;
  totalAPagar: number; // centavos, ganado del mes: costura + servicio de corte + moldes
  anticiposEntregados: number; // centavos
  saldoPendiente: number; // centavos, neto por liquidar (con arrastre)
  cortesActivos: number;
}

export interface DashboardCorteDTO {
  id: string;
  modeloNombre: string;
  numeroVersion: number;
  cantidadTotal: number;
  operacionesAsignadas: number;
  operacionesTotal: number;
  fechaInicio: string;
}

export interface DashboardAlertaDTO {
  tipo: 'error' | 'warn';
  texto: string;
}

export interface DashboardDTO {
  kpis: DashboardKpisDTO;
  periodoCerrado: boolean;
  cortesActivos: DashboardCorteDTO[];
  alertas: DashboardAlertaDTO[];
}
