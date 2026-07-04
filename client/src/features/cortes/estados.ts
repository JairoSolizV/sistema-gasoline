// Colores y etiquetas de estado (paleta del mockup) compartidos por las vistas de cortes.
import type { CorteOperacionDTO, EstadoCorte } from '@taller/shared';

export const ESTILO_ESTADO_OP = {
  asignada: { color: '#127a45', bg: '#e6f4ec', border: '#bfe3cd' },
  sin_asignar: { color: '#7c8492', bg: '#eef0f3', border: '#dde1e7' },
  parcial: { color: '#c0362c', bg: '#fbeceb', border: '#f2c9c5' },
  progreso: { color: '#9a6a12', bg: '#fbf3e3', border: '#eeddb8' },
} as const;

export function etiquetaOperacion(op: { estado: string; asignado: number; diferencia: number }) {
  if (op.estado === 'asignada') return { texto: `Cuadra · ${op.asignado}`, ...ESTILO_ESTADO_OP.asignada };
  if (op.estado === 'sin_asignar') return { texto: 'Sin asignar', ...ESTILO_ESTADO_OP.sin_asignar };
  return {
    texto: op.diferencia > 0 ? `Faltan ${op.diferencia}` : `Sobran ${-op.diferencia}`,
    ...ESTILO_ESTADO_OP.parcial,
  };
}

export function etiquetaGrupo(ops: CorteOperacionDTO[]) {
  const ok = ops.filter((o) => o.estado === 'asignada').length;
  const sin = ops.filter((o) => o.estado === 'sin_asignar').length;
  const parciales = ops.filter((o) => o.estado === 'parcial').length;
  if (ok === ops.length) return { texto: 'Completo', ...ESTILO_ESTADO_OP.asignada, ok };
  if (sin === ops.length) return { texto: 'Pendiente', ...ESTILO_ESTADO_OP.sin_asignar, ok };
  if (parciales > 0) return { texto: 'Con descuadre', ...ESTILO_ESTADO_OP.parcial, ok };
  return { texto: 'En progreso', ...ESTILO_ESTADO_OP.progreso, ok };
}

export function badgeEstadoCorte(estado: EstadoCorte) {
  if (estado === 'abierto') return { texto: 'Abierto', ...ESTILO_ESTADO_OP.asignada };
  if (estado === 'cerrado') return { texto: 'Cerrado', ...ESTILO_ESTADO_OP.sin_asignar };
  return { texto: 'Borrador', ...ESTILO_ESTADO_OP.progreso };
}
