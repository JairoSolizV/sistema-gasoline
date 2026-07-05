// DTO de rendición de cuentas: contiene SOLO los datos del operario pedido.
// El service lo construye desde consultas filtradas por operarioId; nunca se
// serializa un modelo Prisma crudo (ARQUITECTURA §5.3, CA-7.1/7.2).

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
  totalGanado: number; // centavos
  totalAnticipos: number; // centavos
  saldoPeriodo: number; // = saldoEntrada + totalGanado − totalAnticipos
  pagado: number | null; // solo si el mes está cerrado
  saldoSalida: number | null; // solo si el mes está cerrado
  cortes: RendicionCorteDTO[];
  anticipos: RendicionAnticipoDTO[];
}
