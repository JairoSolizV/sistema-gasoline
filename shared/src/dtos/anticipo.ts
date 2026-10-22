import type { Cuenta } from '../cuentas.js';

export interface AnticipoDTO {
  id: string;
  operarioId: string;
  operarioNombre: string;
  cuenta: Cuenta; // de qué cuenta se descuenta (PLAN_CUENTAS_SEPARADAS §2.2)
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
