export type TipoOperario = 'regular' | 'maestro_externo';

export type RolOperario =
  | 'costurero'
  | 'cortador'
  | 'doblador'
  | 'moldista'
  | 'buscador'
  | 'trazador'
  | 'clasificador';

/** Nombre del oficio para mostrar. */
export const ETIQUETA_ROL: Record<RolOperario, string> = {
  costurero: 'Costurero',
  cortador: 'Cortador',
  doblador: 'Doblador de tela',
  moldista: 'Creador de moldes',
  buscador: 'Buscador de diseño',
  trazador: 'Trazador',
  clasificador: 'Clasificador / codificador',
};

export interface OperarioDTO {
  id: string;
  nombre: string;
  tipo: TipoOperario;
  activo: boolean;
  roles: RolOperario[];
  tarifaCorte: number | null; // centavos/prenda, personal (null = respaldo de Configuración)
  tarifaClasificacion: number | null;
  ci: string | null;
  celular: string | null;
  fechaNacimiento: string | null; // ISO 8601
  fechaIngreso: string; // ISO 8601
  fechaSalida: string | null; // salida prevista, informativa
  fechaBaja: string | null;
  // true si tiene asignaciones, anticipos, liquidaciones o cortes: no se puede eliminar
  tieneHistorial: boolean;
}
