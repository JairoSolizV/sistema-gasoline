// FUNCIONES PURAS de cálculo (ARQUITECTURA §2.2): no conocen Express ni Prisma.
// Todo en centavos enteros — la aritmética es exacta, sin redondeos intermedios.

/** Suma de CT de una lista de operaciones = costo de mano de obra por prenda (centavos). */
export function sumaCt(operaciones: ReadonlyArray<{ ct: number }>): number {
  return operaciones.reduce((acc, o) => acc + o.ct, 0);
}
