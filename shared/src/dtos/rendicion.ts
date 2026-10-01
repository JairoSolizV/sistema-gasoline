// DTO de rendición de cuentas: contiene SOLO los datos del operario pedido.
// El service lo construye desde consultas filtradas por operarioId; nunca se
// serializa un modelo Prisma crudo (ARQUITECTURA §5.3, CA-7.1/7.2).

import type { ModalidadDoblado, ProcesoCorte } from '../servicioCorte.js';
import type { GanadoDesgloseDTO } from './liquidacion.js';
import type { TipoMolde } from './modelo.js';

export interface RendicionOperacionDTO {
  grupo: string;
  n: string | null;
  equipo: string;
  proceso: string;
  pieza: string | null;
  ct: number; // centavos
  cantidad: number; // piezas que hizo este operario en esta operación
  esMaestroExterno: boolean;
  tarifaEfectiva: number; // centavos
  total: number; // centavos = cantidad × tarifaEfectiva
}

export interface RendicionCorteDTO {
  corteId: string;
  codigo: string | null;
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
  codigo: string | null;
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

export interface RendicionAnticipoDTO {
  fecha: string;
  monto: number; // centavos
  nota: string | null;
}

export interface RendicionDTO {
  operarioId: string;
  nombre: string;
  esMaestro: boolean;
  activo: boolean;
  anio: number;
  mes: number;
  cerrado: boolean;
  saldoEntrada: number; // centavos (puede ser negativo)
  totalGanado: number; // centavos = costura + servicio de corte + moldes
  desglose: GanadoDesgloseDTO;
  totalAnticipos: number; // centavos
  saldoPeriodo: number; // = saldoEntrada + totalGanado − totalAnticipos
  pagado: number | null; // solo si el mes está cerrado
  saldoSalida: number | null; // solo si el mes está cerrado
  cortes: RendicionCorteDTO[]; // costura
  servicioCorte: RendicionTrabajoCorteDTO[];
  moldes: RendicionMoldeDTO[];
  anticipos: RendicionAnticipoDTO[];
}
