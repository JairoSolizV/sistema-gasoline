// Requerimiento de insumos de un corte (docs/PLAN_REQUERIMIENTO.md): qué hay
// que comprar para producirlo — cierres según la talla, hilos según las
// máquinas y los avíos de empaque de la ficha del modelo — descontando lo que
// ya hay en inventario. Solo consulta: no registra compras ni toca pagos.
//
// Reglas del dueño (2026-10-23):
//  - Se compran ENVASES completos (bolsa de 120 cierres, rollo de 500 tallas…),
//    redondeando hacia arriba; se informa lo que sobra.
//  - Cierres: la medida sale de la talla (regla de la ficha del modelo; si no
//    tiene, la de su hoja: hasta la 44 → 12 cm, 46–48 → 15 cm, desde la 50 → 18 cm).
//  - Hilos: el MAYOR entre la carga de las máquinas (conos fijos por máquina,
//    lista de Configuración) y el consumo del corte (prendas × metros por jean
//    de la ficha ÷ metros del cono, que salen de sus yardas). El hilo de cada
//    título (20/3, 20/2, 40/2, Over) se elige en el corte (color).
//  - Talla tejida (insumo "un envase por talla"): un rollo por talla aunque
//    sobre; no se descuenta stock (cada talla es una etiqueta distinta).
//  - A comprar = lo que se necesita − lo que hay (nunca negativo).
// Cantidades en milésimas como en Costos; dinero en centavos.

import { CANTIDAD_ESCALA } from './costos.js';

export const TITULOS_HILO = ['20/3', '20/2', '40/2', 'Over'] as const;
export type TituloHilo = (typeof TITULOS_HILO)[number];

/** Una máquina del taller y los conos de cada hilo que lleva cargados. */
export interface MaquinaHilos {
  maquina: string;
  conos: Record<TituloHilo, number>;
}

const m = (maquina: string, a: number, b: number, c: number, d: number): MaquinaHilos => ({
  maquina,
  conos: { '20/3': a, '20/2': b, '40/2': c, Over: d },
});

/** La lista de la hoja REQUERIMIENTOS del dueño: 14 / 16 / 9 / 5 conos. */
export const MAQUINAS_HILO_DEFECTO: MaquinaHilos[] = [
  m('PRETINADORA', 2, 2, 0, 0),
  m('CODO', 2, 2, 0, 0),
  m('PLANA', 2, 1, 0, 0),
  m('PLANA', 2, 1, 0, 0),
  m('OVERLOCK', 0, 2, 1, 2),
  m('OVERLOCK', 0, 2, 1, 2),
  m('COLLARETA', 0, 0, 4, 0),
  m('OVER', 0, 0, 1, 1),
  m('ATRACADORA', 0, 0, 2, 0),
  ...Array.from({ length: 6 }, () => m('RECTA', 1, 1, 0, 0)),
];

/** Metros de cada hilo por prenda, en CENTÍMETROS (enteros), de la hoja del
 *  dueño: 12 / 24 / 30 / 48 m por jean. Cada ficha puede tener los suyos. */
export const CM_HILO_POR_PRENDA_DEFECTO: Record<TituloHilo, number> = {
  '20/3': 1200,
  '20/2': 2400,
  '40/2': 3000,
  Over: 4800,
};

/** Conos que consume un corte: prendas × cm por prenda ÷ cm del cono
 *  (1 yarda = 91.44 cm), hacia arriba. Enteros exactos. */
export function conosPorConsumo(prendas: number, cmPorPrenda: number, yardasPorCono: number): number {
  return Math.ceil((prendas * cmPorPrenda * 100) / (yardasPorCono * 9144));
}

export interface CierrePorTalla {
  talla: number;
  medidaCm: number;
}

/** Regla de la hoja del dueño, para modelos sin regla propia. */
export function medidaCierrePorDefecto(talla: number): number {
  if (talla <= 44) return 12;
  if (talla <= 48) return 15;
  return 18;
}

/** Un insumo con lo que el requerimiento necesita saber de él. */
export interface InsumoRequerimiento {
  id: string;
  nombre: string;
  unidad: string;
  unidadesPorEnvase: number | null; // null = se compra por unidad
  porTalla: boolean; // un envase por talla (talla tejida)
  precioEnvase: number | null; // centavos; null = sin precio
  disponible: number | null; // milésimas en inventario para este corte
  yardasPorCono?: number | null; // hilos: para calcular el consumo
}

export type GrupoRequerimiento = 'Cierres' | 'Hilos' | 'Empaque';

export interface LineaRequerimiento {
  grupo: GrupoRequerimiento;
  insumoId: string | null; // null = falta cargar el insumo
  nombre: string;
  detalle: string; // ej. "tallas 40, 42, 44" o "conos fijos por máquina"
  unidad: string;
  necesita: number; // unidades
  hay: number | null; // unidades en inventario; null = no se descuenta
  falta: number; // unidades a comprar
  unidadesPorEnvase: number; // 1 = por unidad
  envases: number;
  sobran: number; // unidades que quedan del último envase
  precioEnvase: number | null;
  monto: number | null; // centavos; null = sin precio
}

export interface Requerimiento {
  lineas: LineaRequerimiento[];
  total: number; // centavos de las líneas con precio
  sinPrecio: number; // líneas sin precio (no suman)
  avisos: string[];
}

export interface EntradaRequerimiento {
  tallas: number[];
  cantidades: number[]; // corte + plus de cada talla
  cierresPorTalla: CierrePorTalla[] | null; // null = la regla por defecto
  /** cierres por medida (cm) → insumo */
  insumoCierre: (medidaCm: number) => InsumoRequerimiento | null;
  maquinas: MaquinaHilos[];
  hilos: Partial<Record<TituloHilo, InsumoRequerimiento | null>>;
  /** cm de cada hilo por prenda (ficha del modelo o los de la hoja) */
  cmHiloPorPrenda: Record<TituloHilo, number>;
  /** líneas "por prenda" de la ficha que no son cierres (avíos de empaque, talla tejida…) */
  avios: { insumo: InsumoRequerimiento; cantidad: number /* milésimas por prenda */ }[];
}

const techo = (a: number, b: number) => Math.ceil(a / b);

function linea(
  grupo: GrupoRequerimiento,
  insumo: InsumoRequerimiento,
  necesita: number,
  detalle: string,
): LineaRequerimiento {
  const u = insumo.unidadesPorEnvase ?? 1;
  const hayMil = insumo.disponible == null ? null : Math.max(0, insumo.disponible);
  const falta = Math.max(0, techo(necesita * CANTIDAD_ESCALA - (hayMil ?? 0), CANTIDAD_ESCALA));
  const envases = techo(falta, u);
  return {
    grupo,
    insumoId: insumo.id,
    nombre: insumo.nombre,
    detalle,
    unidad: insumo.unidad,
    necesita,
    hay: hayMil == null ? null : Math.floor(hayMil / CANTIDAD_ESCALA),
    falta,
    unidadesPorEnvase: u,
    envases,
    sobran: envases * u - falta,
    precioEnvase: insumo.precioEnvase,
    monto: insumo.precioEnvase == null ? null : envases * insumo.precioEnvase,
  };
}

/** Línea de un insumo que falta cargar: se informa, no se puede comprar. */
const faltaInsumo = (
  grupo: GrupoRequerimiento,
  nombre: string,
  necesita: number,
  detalle: string,
): LineaRequerimiento => ({
  grupo,
  insumoId: null,
  nombre,
  detalle,
  unidad: 'unidad',
  necesita,
  hay: null,
  falta: necesita,
  unidadesPorEnvase: 1,
  envases: 0,
  sobran: 0,
  precioEnvase: null,
  monto: null,
});

export function calcularRequerimiento(e: EntradaRequerimiento): Requerimiento {
  const lineas: LineaRequerimiento[] = [];
  const avisos: string[] = [];

  // ── Cierres: por medida, según la talla ──
  const medidaDe = (talla: number) =>
    e.cierresPorTalla?.find((c) => c.talla === talla)?.medidaCm ?? medidaCierrePorDefecto(talla);
  const porMedida = new Map<number, { tallas: number[]; prendas: number }>();
  e.tallas.forEach((t, i) => {
    if (!e.cantidades[i]) return;
    const medida = medidaDe(t);
    const g = porMedida.get(medida) ?? { tallas: [], prendas: 0 };
    g.tallas.push(t);
    g.prendas += e.cantidades[i];
    porMedida.set(medida, g);
  });
  for (const [medida, g] of [...porMedida].sort((a, b) => a[0] - b[0])) {
    const detalle = `talla${g.tallas.length > 1 ? 's' : ''} ${g.tallas.join(', ')}`;
    const insumo = e.insumoCierre(medida);
    lineas.push(
      insumo
        ? linea('Cierres', insumo, g.prendas, detalle)
        : faltaInsumo('Cierres', `Cierre ${medida} cm`, g.prendas, detalle),
    );
    if (!insumo) avisos.push(`Falta cargar en Insumos el cierre de ${medida} cm`);
  }

  // ── Hilos: el mayor entre la carga de las máquinas y el consumo ──
  const prendas = e.cantidades.reduce((a, b) => a + b, 0);
  for (const titulo of TITULOS_HILO) {
    const carga = e.maquinas.reduce((a, maq) => a + (maq.conos[titulo] ?? 0), 0);
    const insumo = e.hilos[titulo];
    const yardas = insumo?.yardasPorCono ?? null;
    const consumo =
      yardas && e.cmHiloPorPrenda[titulo] > 0
        ? conosPorConsumo(prendas, e.cmHiloPorPrenda[titulo], yardas)
        : null;
    const conos = Math.max(carga, consumo ?? 0);
    if (conos === 0) continue;
    const detalle =
      consumo == null
        ? `carga de máquinas ${carga}`
        : `carga de máquinas ${carga} · consumo ${consumo}${consumo > carga ? ' (manda el consumo)' : ''}`;
    lineas.push(
      insumo
        ? linea('Hilos', insumo, conos, detalle)
        : faltaInsumo('Hilos', `Hilo ${titulo} (elegí el color)`, conos, detalle),
    );
    if (!insumo) avisos.push(`Elegí el hilo ${titulo} del corte`);
    else if (yardas == null) avisos.push(`${insumo.nombre}: cargá las yardas del cono para calcular el consumo`);
  }

  // ── Empaque y avíos de la ficha (por prenda) ──
  for (const { insumo, cantidad } of e.avios) {
    if (insumo.porTalla) {
      // un envase por talla, sin descontar stock
      const u = insumo.unidadesPorEnvase ?? 1;
      const conCorte = e.tallas.filter((_, i) => e.cantidades[i] > 0);
      const necesita = e.cantidades.reduce((a, q) => a + techo(q * cantidad, CANTIDAD_ESCALA), 0);
      const envases = e.cantidades.reduce(
        (a, q) => a + (q > 0 ? techo(techo(q * cantidad, CANTIDAD_ESCALA), u) : 0),
        0,
      );
      lineas.push({
        grupo: 'Empaque',
        insumoId: insumo.id,
        nombre: insumo.nombre,
        detalle: `un envase por talla (${conCorte.length} tallas)`,
        unidad: insumo.unidad,
        necesita,
        hay: null,
        falta: necesita,
        unidadesPorEnvase: u,
        envases,
        sobran: envases * u - necesita,
        precioEnvase: insumo.precioEnvase,
        monto: insumo.precioEnvase == null ? null : envases * insumo.precioEnvase,
      });
      continue;
    }
    lineas.push(linea('Empaque', insumo, techo(prendas * cantidad, CANTIDAD_ESCALA), 'por prenda'));
  }

  for (const l of lineas) {
    if (l.insumoId && l.envases > 0 && l.monto == null) {
      avisos.push(`${l.nombre} no tiene precio: cargá una compra o el precio del envase`);
    }
  }
  return {
    lineas,
    total: lineas.reduce((a, l) => a + (l.monto ?? 0), 0),
    sinPrecio: lineas.filter((l) => l.envases > 0 && l.monto == null).length,
    avisos,
  };
}

// ── Lo que devuelve la API para un corte ──

export interface OpcionInsumoDTO {
  id: string;
  nombre: string;
}

export interface RequerimientoCorteDTO extends Requerimiento {
  prendas: number;
  ficha: { id: string; nombre: string } | null; // la del modelo del corte
  reglaCierres: 'ficha' | 'defecto'; // de dónde salió la medida de los cierres
  cmHiloPorPrenda: Record<TituloHilo, number>; // el que se usó
  hiloDeFicha: boolean; // los metros por prenda salen de la ficha (si no, los de la hoja)
  hilos: { titulo: TituloHilo; elegido: OpcionInsumoDTO | null; opciones: OpcionInsumoDTO[] }[];
  maquinas: MaquinaHilos[];
}
