// DTO de rendición de cuentas: contiene SOLO los datos del operario pedido.
// El service lo construye desde consultas filtradas por operarioId; nunca se
// serializa un modelo Prisma crudo (ARQUITECTURA §5.3, CA-7.1/7.2).

import type { ModalidadDoblado, ProcesoCorte } from '../servicioCorte.js';
import type { EstadoAsistencia } from '../sueldo.js';
import type { Cuenta } from '../cuentas.js';
import type { ServicioExterno } from '../schemas/corte.js';
import type { TipoMolde } from './modelo.js';

export interface RendicionOperacionDTO {
  grupo: string;
  n: string | null;
  equipo: string;
  proceso: string;
  pieza: string | null;
  ct: number; // centavos
  cantidad: number; // piezas que hizo este operario en esta operación
  esEmpaque: boolean; // va en la sección Empaque, no en Costura
  esMaestroExterno: boolean;
  tarifaEfectiva: number; // centavos
  total: number; // centavos = cantidad × tarifaEfectiva
}

export interface RendicionCorteDTO {
  corteId: string;
  codigo: number; // numeración del corte (N° 23), única
  modeloNombre: string;
  numeroVersion: number;
  fechaCierre: string | null;
  operaciones: RendicionOperacionDTO[]; // solo las de este operario
  totalCorte: number; // centavos que ganó este operario en este corte
}

/** Un trabajo del servicio de corte de ESTE operario (sin datos de compañeros:
 *  en el doblado se ve solo su mitad, no el nombre ni la parte del otro). */
export interface RendicionTrabajoCorteDTO {
  corteId: string;
  codigo: number; // numeración del corte (N° 23), única
  modeloNombre: string;
  numeroVersion: number;
  proceso: ProcesoCorte;
  modalidad: ModalidadDoblado | null; // solo doblado
  fecha: string; // ISO: cuándo se terminó (define cuándo se paga)
  cantidad: number; // prendas del corte
  tarifa: number; // centavos/prenda (doblado: la del proceso completo, repartida en 2)
  total: number; // centavos que cobra este operario
}

export interface RendicionMoldeDTO {
  modeloNombre: string;
  numeroVersion: number;
  tipo: TipoMolde;
  fecha: string;
  monto: number; // centavos
}

/** Un día de asistencia de ESTE ayudante (docs/PLAN_AYUDANTES.md §3). */
export interface RendicionDiaSueldoDTO {
  fecha: string; // 'aaaa-mm-dd'
  estado: EstadoAsistencia;
  minutosDescontados: number;
  minutosOperaciones: number;
  minutosPagados: number; // 0..540
  sueldoSemanal: number; // centavos, vigente ese día
  monto: number; // centavos (reparto del total del mes por mayor resto)
}

/** Sueldo del mes de un ayudante: el total se redondea una vez y los días
 *  suman exactamente ese total. */
export interface RendicionSueldoDTO {
  dias: RendicionDiaSueldoDTO[];
  diasTrabajados: number;
  faltas: number;
  feriados: number;
  minutosDescontados: number; // atrasos y salidas antes de hora
  minutosOperaciones: number; // horas de horario en operaciones (se cobran aparte)
  total: number; // centavos
}

/** Un envío de ESTE proveedor devuelto en el mes (PLAN_CUENTAS_SEPARADAS §5). */
export interface RendicionEnvioDTO {
  servicio: ServicioExterno;
  corteId: string;
  codigo: number;
  modeloNombre: string;
  numeroVersion: number;
  cantidad: number; // prendas
  precioPrenda: number; // centavos
  total: number; // centavos
  fechaEnvio: string; // 'aaaa-mm-dd'
  fechaDevolucion: string; // 'aaaa-mm-dd' (define el mes en que se paga)
}

export interface RendicionAnticipoDTO {
  cuenta: Cuenta; // de qué cuenta se descontó
  fecha: string;
  monto: number; // centavos
  nota: string | null;
}

/** El saldo de UNA cuenta del operario en el mes (PLAN_CUENTAS_SEPARADAS §3). */
export interface RendicionCuentaDTO {
  cuenta: Cuenta;
  saldoEntrada: number; // centavos (puede ser negativo)
  ganado: number; // centavos
  anticipos: number; // centavos
  saldoPeriodo: number; // = saldoEntrada + ganado − anticipos
  pagado: number | null; // solo si el mes está cerrado
  saldoSalida: number | null; // solo si el mes está cerrado
}

export interface RendicionDTO {
  operarioId: string;
  nombre: string;
  esMaestro: boolean;
  activo: boolean;
  anio: number;
  mes: number;
  cerrado: boolean;
  cuentas: RendicionCuentaDTO[]; // solo las cuentas con movimiento o saldo; nunca se suman entre sí
  sueldo: RendicionSueldoDTO | null; // solo si tuvo asistencia en el mes (ayudantes)
  cortes: RendicionCorteDTO[]; // costura (sin las operaciones de empaque)
  empaque: RendicionCorteDTO[]; // solo operaciones de empaque
  servicioCorte: RendicionTrabajoCorteDTO[];
  moldes: RendicionMoldeDTO[];
  envios: RendicionEnvioDTO[]; // serigrafía, láser, bordado y lavandería (proveedores externos)
  anticipos: RendicionAnticipoDTO[];
}
