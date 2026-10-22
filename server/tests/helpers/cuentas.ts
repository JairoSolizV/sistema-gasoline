// Lectura por cuenta del consolidado y la rendición (docs/PLAN_CUENTAS_SEPARADAS.md):
// cada cuenta trae sus filas, semanas y totales; un operario puede estar en varias.
import type {
  ConsolidadoDTO,
  Cuenta,
  CuentaConsolidadoDTO,
  LiquidacionFilaDTO,
  RendicionCuentaDTO,
  RendicionDTO,
} from '@taller/shared';

export const cuentaDe = (c: ConsolidadoDTO, cuenta: Cuenta = 'operaciones') =>
  c.cuentas.find((x) => x.cuenta === cuenta) as CuentaConsolidadoDTO;

/** La fila del operario en esa cuenta (undefined si no tuvo nada en ella). */
export const filaDe = (c: ConsolidadoDTO, operarioId: string, cuenta: Cuenta = 'operaciones') =>
  cuentaDe(c, cuenta).filas.find((f) => f.operarioId === operarioId) as LiquidacionFilaDTO;

/** El saldo de esa cuenta en la rendición (undefined si no tuvo nada en ella). */
export const saldoDe = (r: RendicionDTO, cuenta: Cuenta = 'operaciones') =>
  r.cuentas.find((x) => x.cuenta === cuenta) as RendicionCuentaDTO;
