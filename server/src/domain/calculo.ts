// FUNCIONES PURAS de cálculo (ARQUITECTURA §2.2): no conocen Express ni Prisma.
// Todo en centavos enteros — la aritmética es exacta, sin redondeos intermedios.

/** Suma de CT de una lista de operaciones = costo de mano de obra por prenda (centavos). */
export function sumaCt(operaciones: ReadonlyArray<{ ct: number }>): number {
  return operaciones.reduce((acc, o) => acc + o.ct, 0);
}

/** Cantidad total del corte = Σ corte por talla + Σ plus por talla.
 *  El PLUS SÍ se paga (CA-2.2). Única fuente de esta fórmula en el sistema. */
export function cantidadTotal(
  cortePorTalla: ReadonlyArray<number>,
  plusPorTalla: ReadonlyArray<number>,
): number {
  const suma = (nums: ReadonlyArray<number>) => nums.reduce((acc, n) => acc + n, 0);
  return suma(cortePorTalla) + suma(plusPorTalla);
}

/** Tarifa efectiva = ct base + diferencial (0 regular; configurable si maestro externo). */
export function tarifaEfectiva(ctCentavos: number, diferencialCentavos: number): number {
  return ctCentavos + diferencialCentavos;
}

/** Pago de una asignación = cantidad × tarifa efectiva. Enteros: exacto, sin redondeo. */
export function totalAsignacion(cantidad: number, tarifaEfectivaCentavos: number): number {
  return cantidad * tarifaEfectivaCentavos;
}
