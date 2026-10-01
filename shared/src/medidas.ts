// Medidas de tela: se ingresan en metros con hasta 2 decimales y se guardan en
// centímetros enteros (mismo criterio que Bs ↔ centavos: nada de floats).

/** "1.6" → 160, "5.25" → 525, "2" → 200. null si no es un número válido. */
export function metrosACm(texto: string): number | null {
  const s = texto.trim().replace(',', '.');
  const m = /^(\d{1,4})(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
}

/** 160 → "1.60" (siempre 2 decimales). */
export function formatMetros(cm: number): string {
  return `${Math.floor(cm / 100)}.${String(cm % 100).padStart(2, '0')}`;
}
