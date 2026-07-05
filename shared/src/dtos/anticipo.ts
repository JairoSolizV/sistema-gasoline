export interface AnticipoDTO {
  id: string;
  operarioId: string;
  operarioNombre: string;
  fecha: string; // ISO 8601 (día del anticipo)
  monto: number; // centavos
  nota: string | null;
}

/** Respuesta de crear/editar: incluye el flag de advertencia de tope (no bloqueo). */
export interface AnticipoGuardadoDTO {
  anticipo: AnticipoDTO;
  advertenciaTope: boolean; // true si monto > topeAnticipoAdvertencia
  topeAnticipoAdvertencia: number; // centavos, para el mensaje
}
