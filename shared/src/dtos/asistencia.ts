import type { EstadoAsistencia } from '../sueldo.js';

// Grilla semanal de asistencia de los ayudantes (lunes a sábado).

export interface AsistenciaDiaDTO {
  fecha: string; // 'aaaa-mm-dd'
  /** false = fuera de su ingreso/baja o sin sueldo vigente: no se marca. */
  habil: boolean;
  bloqueado: boolean; // cae en un mes ya liquidado
  estado: EstadoAsistencia | null; // null = sin marcar
  minutosDescontados: number;
  minutosOperaciones: number;
  nota: string | null;
  minutosPagados: number;
  sueldoSemanal: number | null; // centavos, vigente ese día
  monto: number; // centavos del día (reparto por mayor resto dentro de la semana)
}

export interface AsistenciaAyudanteDTO {
  operarioId: string;
  nombre: string;
  activo: boolean;
  dias: AsistenciaDiaDTO[]; // 6: lunes a sábado
  totalSemana: number; // centavos de los días marcados
  diasSinMarcar: number; // hábiles y sin marcar
}

export interface SemanaAsistenciaDTO {
  lunes: string;
  sabado: string;
  ayudantes: AsistenciaAyudanteDTO[];
}
