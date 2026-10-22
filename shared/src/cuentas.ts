// Cuentas de pago separadas (docs/PLAN_CUENTAS_SEPARADAS.md). Cada operario
// tiene un saldo y un arrastre POR CUENTA; los montos de una cuenta nunca se
// suman ni se compensan con los de otra. El anticipo se carga a una cuenta.

// Orden en que se muestran en todo el sistema (Inicio, Liquidación,
// Rendición, Anticipos): el del proceso de la prenda, como lo pidió el dueño.
export const CUENTAS = [
  'moldes',
  'servicio_corte',
  'operaciones',
  'serigrafia',
  'laser',
  'bordado',
  'lavanderia',
  'empaque',
  'sueldo',
] as const;
export type Cuenta = (typeof CUENTAS)[number];

export const ETIQUETA_CUENTA: Record<Cuenta, string> = {
  moldes: 'Moldes',
  servicio_corte: 'Servicio de corte',
  operaciones: 'Operaciones',
  serigrafia: 'Servicio de serigrafía',
  laser: 'Servicio de láser',
  bordado: 'Servicio de bordado',
  lavanderia: 'Servicio de lavandería',
  empaque: 'Servicio de empaque',
  sueldo: 'Sueldo de ayudantes',
};
