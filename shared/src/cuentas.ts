// Cuentas de pago separadas (docs/PLAN_CUENTAS_SEPARADAS.md). Cada operario
// tiene un saldo y un arrastre POR CUENTA; los montos de una cuenta nunca se
// suman ni se compensan con los de otra. El anticipo se carga a una cuenta.

export const CUENTAS = [
  'operaciones',
  'empaque',
  'servicio_corte',
  'moldes',
  'sueldo',
  'lavanderia',
  'bordado',
] as const;
export type Cuenta = (typeof CUENTAS)[number];

export const ETIQUETA_CUENTA: Record<Cuenta, string> = {
  operaciones: 'Operaciones',
  empaque: 'Empaque',
  servicio_corte: 'Servicio de corte',
  moldes: 'Moldes',
  sueldo: 'Sueldo de ayudantes',
  lavanderia: 'Lavandería',
  bordado: 'Bordado',
};
