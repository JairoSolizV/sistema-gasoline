import type { PersonaDTO } from './corte.js';

export interface OperacionDTO {
  id: string;
  orden: number;
  grupo: string;
  n: string | null;
  equipo: string;
  proceso: string;
  pieza: string | null;
  ct: number; // centavos por pieza
}

export type TipoMolde = 'nuevo' | 'modificacion';

export interface PagoMoldeDTO {
  id: string;
  tipo: TipoMolde;
  operario: PersonaDTO; // creador de moldes
  monto: number; // centavos
  fecha: string; // ISO: define la semana/mes en que se paga
}

export interface ModeloVersionResumenDTO {
  id: string;
  numeroVersion: number;
  notas: string | null;
  costoManoObraPrenda: number; // centavos
  activa: boolean;
  createdAt: string; // ISO
  cantidadOperaciones: number;
  molde: PagoMoldeDTO | null;
}

export interface ModeloDTO {
  id: string;
  nombre: string;
  activo: boolean;
  // búsqueda: buscador, o sinBuscador; ninguno de los dos = pendiente
  buscador: PersonaDTO | null;
  sinBuscador: boolean;
  versiones: ModeloVersionResumenDTO[]; // ordenadas desc por numeroVersion
}

export interface ModeloVersionDetalleDTO {
  id: string;
  modeloId: string;
  modeloNombre: string;
  numeroVersion: number;
  notas: string | null;
  costoManoObraPrenda: number; // centavos = Σ ct de sus operaciones
  activa: boolean;
  buscador: PersonaDTO | null; // del modelo
  sinBuscador: boolean;
  molde: PagoMoldeDTO | null; // de esta versión
  operaciones: OperacionDTO[]; // ordenadas por orden
}
