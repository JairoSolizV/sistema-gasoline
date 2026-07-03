// Único lugar del sistema con aritmética de conversión de dinero (ARQUITECTURA §4).
// Todo monto vive como Int en centavos de Bs; el redondeo half-up ocurre UNA sola
// vez, aquí, al convertir un valor externo (formulario, JSON) a centavos.

const PATRON_MONTO = /^-?\d+(\.\d+)?$/;

/** Convierte un monto en Bs (string o number) a centavos enteros.
 *  Redondeo half-up a 2 decimales, alejándose de cero para negativos. */
export function aCentavos(valor: number | string): number {
  let v: number;
  if (typeof valor === 'string') {
    const s = valor.trim();
    if (!PATRON_MONTO.test(s)) throw new Error(`Monto inválido: "${valor}"`);
    v = Number(s);
  } else {
    v = valor;
  }
  if (!Number.isFinite(v)) throw new Error(`Monto inválido: "${valor}"`);
  // (1 + EPSILON) compensa la representación binaria de decimales exactos
  // (ej. 1.005 → 100.4999...) para que el half-up no caiga del lado equivocado.
  const abs = Math.round(Math.abs(v) * 100 * (1 + Number.EPSILON));
  return v < 0 ? -abs : abs;
}

/** Formatea centavos como Bs con 2 decimales y miles con espacio: 301320 → "3 013.20". */
export function formatBs(centavos: number): string {
  if (!Number.isInteger(centavos)) throw new Error(`Centavos inválidos: ${centavos}`);
  const neg = centavos < 0;
  const abs = Math.abs(centavos);
  const entera = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const decimales = (abs % 100).toString().padStart(2, '0');
  return `${neg ? '-' : ''}${entera}.${decimales}`;
}
