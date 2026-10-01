// Plantillas de modelo: la receta de operaciones de una prenda típica.
// Cada operación trae un CT de REFERENCIA (opcional) que precarga el alta de
// modelo; el CT que se paga es el que queda escrito en el modelo.

export interface PlantillaOperacionDTO {
  id: string;
  orden: number;
  grupo: string;
  n: string | null;
  equipo: string;
  proceso: string;
  pieza: string | null;
  /** centavos; precio sugerido para esta operación (null = sin referencia) */
  ctReferencia: number | null;
}

export interface PlantillaResumenDTO {
  id: string;
  nombre: string;
  notas: string | null;
  /** La del pantalón clásico: se puede editar, no borrar. */
  protegida: boolean;
  createdAt: string; // ISO
  cantidadOperaciones: number;
  /** Grupos en el orden en que aparecen, para mostrar de qué se trata. */
  grupos: string[];
  /** centavos = Σ ctReferencia de las operaciones que la tienen */
  costoReferencia: number;
  /** cuántas operaciones tienen CT de referencia (para avisar si faltan) */
  operacionesConReferencia: number;
}

export interface PlantillaDetalleDTO extends PlantillaResumenDTO {
  operaciones: PlantillaOperacionDTO[]; // ordenadas por orden
}
