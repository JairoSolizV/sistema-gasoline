export type TipoOperario = 'regular' | 'maestro_externo';

export interface OperarioDTO {
  id: string;
  nombre: string;
  tipo: TipoOperario;
  activo: boolean;
  fechaIngreso: string; // ISO 8601
  fechaBaja: string | null;
}
