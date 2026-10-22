// Costos de producción (docs/PLAN_COSTOS.md §3). FUNCIONES PURAS compartidas por
// la API (lo que se guarda y se informa) y la pantalla (vista previa).
//
// Unidades enteras para no perder centavos:
//  - dinero en CENTAVOS (Bs);
//  - cantidades en MILÉSIMAS de su unidad (1 metro = 1000, 1 botón = 1000, 1 cono = 1000);
//  - largo del tizado en MILÍMETROS (= milésimas de metro);
//  - tasa de cambio en DIEZMILÉSIMOS (6.96 Bs/$us = 69 600);
//  - margen en CENTÉSIMAS de % (30 % = 3000).
// Los precios unitarios (ej. Bs 50 por 144 botones) no son centavos exactos: se
// trabaja con fracciones exactas (BigInt) y se redondea UNA vez, half-up.

/** Fracción no negativa exacta: num / den (den > 0). */
export interface Fraccion {
  num: bigint;
  den: bigint;
}

const CERO: Fraccion = { num: 0n, den: 1n };
const fr = (num: number | bigint, den: number | bigint = 1): Fraccion => ({
  num: BigInt(num),
  den: BigInt(den),
});
const sumar = (a: Fraccion, b: Fraccion): Fraccion => ({
  num: a.num * b.den + b.num * a.den,
  den: a.den * b.den,
});
const multiplicar = (a: Fraccion, b: Fraccion): Fraccion => ({
  num: a.num * b.num,
  den: a.den * b.den,
});

/** Centavos de una fracción de centavos, half-up (valores ≥ 0). */
export function redondear(f: Fraccion): number {
  return Number((2n * f.num + f.den) / (2n * f.den));
}

export const TASA_ESCALA = 10_000; // diezmilésimos
export const CANTIDAD_ESCALA = 1_000; // milésimas
export const MARGEN_ESCALA = 10_000; // centésimas de % (100 % = 10 000)

/** Precio en Bs (centavos) de una compra en dólares: $us × tasa, redondeado una vez. */
export function aBolivianos(centavosUsd: number, tasaDiezmilesimos: number): number {
  return redondear(fr(centavosUsd * tasaDiezmilesimos, TASA_ESCALA));
}

/** Precio unitario exacto (centavos por 1 unidad) de una compra. */
export function precioUnitario(compra: { precioTotal: number; cantidad: number }): Fraccion {
  // cantidad en milésimas: precioTotal / (cantidad / 1000)
  return fr(compra.precioTotal * CANTIDAD_ESCALA, compra.cantidad);
}

/** Una línea de la ficha, con lo necesario para costearla por prenda. */
export type LineaParaCosto =
  /** cantidad (milésimas) de un insumo por prenda: botones, remaches, cierres, bolsas… */
  | { tipo: 'por_prenda'; cantidad: number; precio: Fraccion | null }
  /** tela según tizado: largo (mm) ÷ prendas por capa = metros por prenda */
  | { tipo: 'tela_tizado'; largoMm: number; prendasPorCapa: number; precio: Fraccion | null }
  /** hilo: precio del cono ÷ prendas que rinde */
  | { tipo: 'hilo'; rendimiento: number; precio: Fraccion | null }
  /** monto que se reparte entre las prendas (flete, saco, pasajes…) */
  | { tipo: 'prorrateo'; monto: number; prendas: number }
  /** precio directo por prenda (lavandería, bordado, otro proceso) */
  | { tipo: 'precio_prenda'; precio: number };

/** Costo exacto por prenda de una línea; null si su insumo no tiene precio. */
export function costoLinea(l: LineaParaCosto): Fraccion | null {
  switch (l.tipo) {
    case 'por_prenda':
      return l.precio && multiplicar(l.precio, fr(l.cantidad, CANTIDAD_ESCALA));
    case 'tela_tizado':
      return l.precio && multiplicar(l.precio, fr(l.largoMm, l.prendasPorCapa * CANTIDAD_ESCALA));
    case 'hilo':
      return l.precio && multiplicar(l.precio, fr(1, l.rendimiento));
    case 'prorrateo':
      return fr(l.monto, l.prendas);
    case 'precio_prenda':
      return fr(l.precio);
  }
}

/** Metros de tela por prenda según el tizado (catálogo local: largo ÷ prendas por capa). */
export function consumoTela(largoMm: number, prendasPorCapa: number): number {
  return largoMm / CANTIDAD_ESCALA / prendasPorCapa;
}

export interface CostoFicha {
  lineas: (number | null)[]; // centavos por prenda de cada línea, redondeados (null = sin precio)
  materiales: number; // Σ exacta de las líneas, redondeada una vez
  manoDeObra: number; // centavos (costura), del modelo o a mano
  empaque: number; // centavos
  servicioCorte: number; // centavos
  costoFijo: number; // centavos por prenda: costos fijos del taller ÷ prendas del mes (etapa 5)
  total: number; // materiales + mano de obra + empaque + servicio + fijo (desde la suma exacta)
  precioVenta: number; // total × (1 + margen), redondeado una vez
  incompleto: boolean; // alguna línea sin precio: el total es parcial
}

/** Costo por prenda de una ficha. Cada número se redondea una sola vez desde el
 *  valor exacto: el total NO es la suma de las líneas redondeadas. */
export function costoFicha(input: {
  lineas: LineaParaCosto[];
  manoDeObra: number;
  empaque: number;
  servicioCorte: number;
  costoFijo?: Fraccion; // por prenda, exacto (etapa 5)
  margen: number; // centésimas de %
}): CostoFicha {
  const exactas = input.lineas.map(costoLinea);
  const materiales = exactas.reduce<Fraccion>((a, c) => (c ? sumar(a, c) : a), CERO);
  const costoFijo = input.costoFijo ?? CERO;
  const total = sumar(
    sumar(materiales, fr(input.manoDeObra + input.empaque + input.servicioCorte)),
    costoFijo,
  );
  return {
    lineas: exactas.map((c) => (c ? redondear(c) : null)),
    materiales: redondear(materiales),
    manoDeObra: input.manoDeObra,
    empaque: input.empaque,
    servicioCorte: input.servicioCorte,
    costoFijo: redondear(costoFijo),
    total: redondear(total),
    precioVenta: redondear(multiplicar(total, fr(MARGEN_ESCALA + input.margen, MARGEN_ESCALA))),
    incompleto: exactas.some((c) => c === null),
  };
}

// ── Etapas 3 y 4: consumo de material, tela real y montos por varias prendas ──

/** Una línea de ficha tal como se guarda (para consumo y costo por corte). */
export interface LineaGuardada {
  tipo: LineaParaCosto['tipo'];
  cantidad: number | null;
  largoMm: number | null;
  prendasPorCapa: number | null;
  rendimiento: number | null; // ya resuelto: el de la ficha o el del insumo
}

/** Material que gasta una línea para `prendas` prendas, en milésimas de la
 *  unidad del insumo (fracción exacta). null = la línea no gasta un insumo
 *  (precio por prenda, prorrateo) o no se puede calcular (hilo sin rendimiento). */
export function consumoLinea(l: LineaGuardada, prendas: number): Fraccion | null {
  switch (l.tipo) {
    case 'por_prenda':
      return l.cantidad == null ? null : fr(l.cantidad * prendas);
    case 'tela_tizado':
      // largo en mm = milésimas de metro
      return l.largoMm == null || !l.prendasPorCapa ? null : fr(l.largoMm * prendas, l.prendasPorCapa);
    case 'hilo':
      // conos = prendas ÷ rendimiento → en milésimas de cono
      return l.rendimiento ? fr(CANTIDAD_ESCALA * prendas, l.rendimiento) : null;
    default:
      return null;
  }
}

/** Capas del tendido: las prendas del corte ÷ prendas por capa, hacia arriba. */
export const capasDelTendido = (prendas: number, prendasPorCapa: number) =>
  Math.ceil(prendas / prendasPorCapa);

/** Tela real de un corte en milésimas de metro: largo del trazado (cm) × capas. */
export function telaRealCorte(trazadoCm: number, prendas: number, prendasPorCapa: number): number {
  return trazadoCm * 10 * capasDelTendido(prendas, prendasPorCapa);
}

/** Costo (centavos, exacto) de una cantidad en milésimas a un precio unitario. */
export function costoDeCantidad(cantidadMilesimas: Fraccion, precio: Fraccion): Fraccion {
  return multiplicar(cantidadMilesimas, multiplicar(precio, fr(1, CANTIDAD_ESCALA)));
}

/** Un monto exacto por prenda × prendas. */
export const porPrendas = (f: Fraccion, prendas: number): Fraccion => multiplicar(f, fr(prendas));

export const sumarFracciones = (fs: (Fraccion | null)[]): Fraccion =>
  fs.reduce<Fraccion>((a, f) => (f ? sumar(a, f) : a), CERO);

/** Milésimas redondeadas half-up (para mostrar cantidades de material). */
export const redondearCantidad = redondear;

// ── Etapa 5: costos fijos del taller (docs/PLAN_COSTOS.md §7c) ──

export const PORCENTAJE_ESCALA = 10_000; // centésimas de % (100 % = 10 000)

/** Parte del taller de un gasto compartido con la casa: monto × %, exacto. */
export const parteTaller = (monto: number, porcentaje: number): Fraccion =>
  fr(monto * porcentaje, PORCENTAJE_ESCALA);

/** Costo fijo por prenda: total del mes ÷ prendas (exacto). */
export const fijoPorPrenda = (totalMes: Fraccion, prendas: number): Fraccion =>
  multiplicar(totalMes, fr(1, prendas));
