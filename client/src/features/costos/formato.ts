import type { CategoriaInsumo, LineaCostoDTO, OrigenCompra } from '@taller/shared';

// Conversión entre lo que se escribe (decimales con punto o coma) y las unidades
// enteras de la API (shared/costos.ts): milésimas, centavos, diezmilésimos.

export const PATRON_DECIMAL = /^\d+([.,]\d{1,3})?$/;
export const PATRON_BS = /^\d+([.,]\d{1,2})?$/;
export const PATRON_TASA = /^\d+([.,]\d{1,4})?$/;

const num = (s: string) => Number(s.trim().replace(',', '.'));
/** "1.5" → 1500 milésimas */
export const aMilesimas = (s: string) => Math.round(num(s) * 1000);
/** 1500 → "1.5" */
export const deMilesimas = (n: number) => String(n / 1000);
/** "6.96" → 69 600 diezmilésimos */
export const aDiezmilesimos = (s: string) => Math.round(num(s) * 10_000);
/** "30" (%) → 3000 centésimas de % */
export const aCentesimasPct = (s: string) => Math.round(num(s) * 100);
export const pct = (centesimas: number) => `${(centesimas / 100).toLocaleString('es-BO')} %`;

/** Bs con hasta 4 decimales, para precios unitarios (0.3472). */
export const bsUnitario = (bs: number | null) =>
  bs == null ? '—' : `Bs ${bs.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

export const ETIQUETA_CATEGORIA: Record<CategoriaInsumo, string> = {
  tela: 'Tela',
  hilo: 'Hilo',
  cierre: 'Cierre',
  boton: 'Botón',
  remache: 'Remache',
  cuero: 'Cuero',
  etiqueta: 'Etiqueta',
  bolsa: 'Bolsa',
  logistica: 'Logística (saco, yute…)',
  otro: 'Otro',
};

export const UNIDAD_SUGERIDA: Record<CategoriaInsumo, string> = {
  tela: 'metro',
  hilo: 'cono',
  cierre: 'unidad',
  boton: 'unidad',
  remache: 'unidad',
  cuero: 'unidad',
  etiqueta: 'unidad',
  bolsa: 'unidad',
  logistica: 'unidad',
  otro: 'unidad',
};

export const ETIQUETA_ORIGEN: Record<OrigenCompra, string> = {
  fabrica: 'De fábrica',
  mayorista: 'Mayorista',
  tienda: 'Tienda',
};

export const ETIQUETA_TIPO_LINEA: Record<LineaCostoDTO['tipo'], string> = {
  tela_tizado: 'Tela (según tizado)',
  hilo: 'Hilo (por rendimiento del cono)',
  por_prenda: 'Insumo por prenda',
  precio_prenda: 'Precio por prenda (lavandería, bordado…)',
  prorrateo: 'Monto repartido (flete, pasajes…)',
};

export const fechaCorta = (dia: string) => dia.split('-').reverse().join('/');

/** 150 prendas → "12 doc + 6" */
export const enDocenas = (prendas: number) => {
  const doc = Math.floor(prendas / 12);
  const sueltas = prendas % 12;
  return doc === 0 ? `${sueltas} sueltas` : sueltas === 0 ? `${doc} doc` : `${doc} doc + ${sueltas}`;
};
