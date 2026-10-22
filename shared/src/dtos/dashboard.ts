import type { Cuenta } from '../cuentas.js';

/** Una fila del inicio: los números del mes de UNA cuenta (PLAN_CUENTAS_SEPARADAS §6).
 *  No hay total general: las cuentas no se mezclan. */
export interface DashboardCuentaDTO {
  cuenta: Cuenta;
  totalAPagar: number; // centavos, ganado del mes en esta cuenta
  anticiposEntregados: number; // centavos, anticipos cargados a esta cuenta
  saldoPendiente: number; // centavos, neto por liquidar (con arrastre)
  cortesActivos: number | null; // cortes abiertos con trabajo pendiente de esta cuenta; null = no aplica
}

export interface DashboardKpisDTO {
  anio: number;
  mes: number;
  cuentas: DashboardCuentaDTO[]; // las 7, en el orden de CUENTAS
  cortesActivos: number; // cortes abiertos (todos)
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
