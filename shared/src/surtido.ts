// Surtido por colores para la lavandería (docs/PLAN_SURTIDO.md): cómo se
// reparten las prendas de un corte entre los colores de lavado, talla por talla,
// y cuántas docenas salen de cada color. Solo informativo: no toca pagos.
//
// Las tallas van en dos grupos que se surten por separado: NORMAL y ESPECIAL
// (por defecto, desde la 48). Dentro de cada grupo:
//
//  1. El corte sale en JUEGOS: la proporción mínima entre tallas. Ej. 169, 338,
//     338, 169 → juego 1-2-2-1 (6 prendas = media docena) × 169 juegos.
//  2. Los juegos se reparten PAREJO entre los colores; lo que sobra va de a 1 a
//     los primeros colores (169 juegos en 5 colores → 34, 34, 34, 34, 33). Así
//     cada color conserva la proporción de tallas y salen más docenas completas.
//  3. El SURTIDO por docena es el juego llevado a 12 prendas (1-2-2-1 → 2-4-4-2),
//     cuando el juego entra justo en una docena.
//  4. Si las tallas no guardan proporción (juego de más de 12 prendas), se
//     reparte cada talla parejo y lo que sobra va al color que lleva menos.
//  5. El PLUS se lava igual: se reparte aparte, talla por talla, también al
//     color que lleva menos.
//
// Todo en prendas enteras: la suma de los colores da siempre lo del corte.

export const TALLA_ESPECIAL_DESDE = 48;
export const MAX_COLORES_SURTIDO = 12;

export type NombreGrupoSurtido = 'NORMAL' | 'ESPECIAL';

export interface SurtidoColor {
  color: string;
  piezas: number[]; // por talla del grupo, en el orden de `tallas`
  total: number;
  docenas: number; // docenas completas
  sueltas: number; // prendas que no llegan a docena (0–11)
}

export interface SurtidoGrupo {
  nombre: NombreGrupoSurtido;
  tallas: number[];
  cantidades: number[]; // corte + plus de cada talla
  /** prendas de cada talla en una docena; null si el corte no guarda proporción */
  surtidoDocena: number[] | null;
  colores: SurtidoColor[];
  total: number;
}

export interface Surtido {
  grupos: SurtidoGrupo[];
  /** total de cada color sumando los grupos: lo que va en cada envío */
  porColor: { color: string; total: number; docenas: number; sueltas: number }[];
  total: number;
}

/** Por defecto son ESPECIAL las tallas desde la 48. */
export function tallasEspecialesPorDefecto(tallas: number[]): number[] {
  return tallas.filter((t) => t >= TALLA_ESPECIAL_DESDE);
}

const mcd = (a: number, b: number): number => (b === 0 ? a : mcd(b, a % b));

const enDocenas = (total: number) => ({
  total,
  docenas: Math.floor(total / 12),
  sueltas: total % 12,
});

/** Reparte `cantidad` parejo; lo que sobra, de a 1 a los primeros. */
function repartirParejo(cantidad: number, n: number): number[] {
  const base = Math.floor(cantidad / n);
  const resto = cantidad % n;
  return Array.from({ length: n }, (_, i) => base + (i < resto ? 1 : 0));
}

/** Reparte `cantidad` parejo; lo que sobra va a los colores que llevan menos
 *  hasta ahora (a igualdad, el primero). Actualiza `llevan`. */
function repartirEquilibrado(cantidad: number, llevan: number[]): number[] {
  const n = llevan.length;
  const partes = Array<number>(n).fill(Math.floor(cantidad / n));
  const orden = llevan.map((t, i) => ({ t, i })).sort((a, b) => a.t - b.t || a.i - b.i);
  for (let k = 0; k < cantidad % n; k++) partes[orden[k].i] += 1;
  partes.forEach((p, i) => (llevan[i] += p));
  return partes;
}

function surtirGrupo(
  nombre: NombreGrupoSurtido,
  tallas: number[],
  corte: number[],
  plus: number[],
  colores: string[],
): SurtidoGrupo {
  const n = colores.length;
  // piezas[color][talla]
  const piezas = colores.map(() => Array<number>(tallas.length).fill(0));

  const conCorte = corte.filter((c) => c > 0);
  const juegos = conCorte.reduce((g, c) => mcd(g, c), 0); // 0 si no hay corte
  const juego = juegos > 0 ? corte.map((c) => c / juegos) : corte.map(() => 0);
  const prendasJuego = juego.reduce((a, b) => a + b, 0);

  if (juegos > 0 && prendasJuego <= 12) {
    // 1-2: juegos completos, parejo entre colores
    repartirParejo(juegos, n).forEach((j, c) => {
      juego.forEach((u, t) => (piezas[c][t] = j * u));
    });
  } else {
    // 4: sin proporción, talla por talla
    const llevan = Array<number>(n).fill(0);
    corte.forEach((cant, t) => {
      repartirEquilibrado(cant, llevan).forEach((p, c) => (piezas[c][t] = p));
    });
  }

  // 5: el plus, al color que lleva menos
  const llevan = piezas.map((fila) => fila.reduce((a, b) => a + b, 0));
  plus.forEach((cant, t) => {
    if (cant > 0) repartirEquilibrado(cant, llevan).forEach((p, c) => (piezas[c][t] += p));
  });

  const surtidoDocena =
    juegos > 0 && prendasJuego <= 12 && 12 % prendasJuego === 0
      ? juego.map((u) => (u * 12) / prendasJuego)
      : null;

  const filas = colores.map((color, c) => ({
    color,
    piezas: piezas[c],
    ...enDocenas(piezas[c].reduce((a, b) => a + b, 0)),
  }));

  return {
    nombre,
    tallas,
    cantidades: corte.map((c, t) => c + plus[t]),
    surtidoDocena,
    colores: filas,
    total: filas.reduce((a, f) => a + f.total, 0),
  };
}

export function calcularSurtido(entrada: {
  tallas: number[];
  cortePorTalla: number[];
  plusPorTalla: number[];
  colores: string[];
  tallasEspeciales: number[];
}): Surtido {
  const { tallas, cortePorTalla, plusPorTalla, colores, tallasEspeciales } = entrada;
  const grupos: SurtidoGrupo[] = [];

  if (colores.length > 0) {
    for (const nombre of ['NORMAL', 'ESPECIAL'] as const) {
      const indices = tallas
        .map((t, i) => ({ t, i }))
        .filter(({ t }) => tallasEspeciales.includes(t) === (nombre === 'ESPECIAL'))
        .map(({ i }) => i);
      const corte = indices.map((i) => cortePorTalla[i] ?? 0);
      const plus = indices.map((i) => plusPorTalla[i] ?? 0);
      if (corte.reduce((a, b) => a + b, 0) + plus.reduce((a, b) => a + b, 0) === 0) continue;
      grupos.push(surtirGrupo(nombre, indices.map((i) => tallas[i]), corte, plus, colores));
    }
  }

  const porColor = colores.map((color, c) =>
    enDocenas(grupos.reduce((a, g) => a + g.colores[c].total, 0)),
  );
  return {
    grupos,
    porColor: porColor.map((p, c) => ({ color: colores[c], ...p })),
    total: grupos.reduce((a, g) => a + g.total, 0),
  };
}
