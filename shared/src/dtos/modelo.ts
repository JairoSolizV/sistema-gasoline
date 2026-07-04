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

export interface ModeloVersionResumenDTO {
  id: string;
  numeroVersion: number;
  notas: string | null;
  costoManoObraPrenda: number; // centavos
  activa: boolean;
  createdAt: string; // ISO
  cantidadOperaciones: number;
}

export interface ModeloDTO {
  id: string;
  nombre: string;
  activo: boolean;
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
  operaciones: OperacionDTO[]; // ordenadas por orden
}
