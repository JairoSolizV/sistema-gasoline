export type TipoOperario = 'regular' | 'maestro_externo' | 'proveedor_externo';

export type RolOperario =
  | 'costurero'
  | 'cortador'
  | 'doblador'
  | 'moldista'
  | 'buscador'
  | 'trazador'
  | 'clasificador'
  | 'ayudante'
  | 'lavanderia'
  | 'bordado'
  | 'serigrafia'
  | 'laser';

/** Quiénes pueden recibir operaciones de costura (y de empaque): costureros y
 *  ayudantes (docs/PLAN_AYUDANTES.md §2.11). */
export const ROLES_COSTURA: readonly RolOperario[] = ['costurero', 'ayudante'];

/** Roles de los proveedores externos, y solo de ellos (PLAN_CUENTAS_SEPARADAS §5). */
export const ROLES_PROVEEDOR: readonly RolOperario[] = ['serigrafia', 'laser', 'bordado', 'lavanderia'];

export const ETIQUETA_TIPO: Record<TipoOperario, string> = {
  regular: 'regular',
  maestro_externo: 'maestro externo',
  proveedor_externo: 'proveedor externo',
};

/** Nombre del oficio para mostrar. */
export const ETIQUETA_ROL: Record<RolOperario, string> = {
  costurero: 'Costurero',
  cortador: 'Cortador',
  doblador: 'Doblador de tela',
  moldista: 'Creador de moldes',
  buscador: 'Buscador de diseño',
  trazador: 'Trazador',
  clasificador: 'Clasificador / codificador',
  ayudante: 'Ayudante',
  lavanderia: 'Lavandería',
  bordado: 'Bordado',
  serigrafia: 'Serigrafía',
  laser: 'Láser',
};

export interface OperarioDTO {
  id: string;
  nombre: string;
  tipo: TipoOperario;
  activo: boolean;
  roles: RolOperario[];
  tarifaCorte: number | null; // centavos/prenda, personal (null = respaldo de Configuración)
  tarifaClasificacion: number | null;
  tarifaLavanderia: number | null; // proveedor externo: centavos/prenda predeterminados
  tarifaBordado: number | null;
  tarifaSerigrafia: number | null;
  tarifaLaser: number | null;
  ci: string | null;
  celular: string | null;
  fechaNacimiento: string | null; // ISO 8601
  fechaIngreso: string; // ISO 8601
  fechaSalida: string | null; // salida prevista, informativa
  fechaBaja: string | null;
  // true si tiene asignaciones, anticipos, liquidaciones o cortes: no se puede eliminar
  tieneHistorial: boolean;
  // ayudante: historial de sueldo semanal (más reciente primero) y el vigente hoy
  sueldos: SueldoDTO[];
  sueldoVigente: number | null; // centavos por semana
}

export interface SueldoDTO {
  id: string;
  montoSemanal: number; // centavos por semana completa
  vigenteDesde: string; // 'aaaa-mm-dd'
}
