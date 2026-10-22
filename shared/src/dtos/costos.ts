import type { CategoriaInsumo, OrigenCompra } from '../schemas/costos.js';

// Costos de producción (docs/PLAN_COSTOS.md). Solo consulta: nada entra a pagos.

export interface UltimaCompraDTO {
  fecha: string; // 'aaaa-mm-dd'
  tienda: string;
  precioTotal: number; // centavos Bs
  cantidad: number; // milésimas
}

export interface InsumoDTO {
  id: string;
  nombre: string;
  categoria: CategoriaInsumo;
  unidad: string;
  color: string | null;
  codigo: string | null;
  titulo: string | null;
  anchoCm: number | null;
  marca: string | null;
  numeroLlave: string | null;
  medidaCm: number | null;
  rendimiento: number | null;
  notas: string | null;
  activo: boolean;
  compras: number; // cuántas compras tiene
  ultimaCompra: UltimaCompraDTO | null;
  /** Bs por unidad de la última compra, SOLO para mostrar (el cálculo usa la fracción exacta). */
  precioUnitarioBs: number | null;
  usadoEnFichas: number;
}

export interface CompraDTO {
  id: string;
  insumo: { id: string; nombre: string; unidad: string };
  fecha: string;
  tienda: string;
  origen: OrigenCompra;
  ciudad: string | null;
  presentacion: string | null;
  cantidad: number; // milésimas
  moneda: 'BOB' | 'USD';
  montoUsd: number | null;
  tasaCambio: number | null; // diezmilésimos
  precioTotal: number; // centavos Bs
  precioUnitarioBs: number; // solo para mostrar
  notas: string | null;
}

export interface LineaCostoDTO {
  orden: number;
  tipo: 'por_prenda' | 'tela_tizado' | 'hilo' | 'prorrateo' | 'precio_prenda';
  concepto: string;
  insumo: { id: string; nombre: string; unidad: string; precioUnitarioBs: number | null } | null;
  cantidad: number | null; // milésimas por prenda
  largoMm: number | null;
  prendasPorCapa: number | null;
  consumoTela: number | null; // metros por prenda (tizado), para mostrar
  rendimiento: number | null; // el de la ficha (null = el del insumo)
  rendimientoUsado: number | null; // el que se aplicó
  monto: number | null;
  prendas: number | null;
  precio: number | null;
  costo: number | null; // centavos por prenda, redondeado; null = sin precio
}

export interface FichaCostoResumenDTO {
  id: string;
  codigo: string | null;
  nombre: string;
  modelo: { id: string; nombre: string } | null;
  total: number; // centavos por prenda
  precioVenta: number;
  incompleto: boolean;
  actualizadoEn: string;
}

export interface FichaCostoDetalleDTO extends FichaCostoResumenDTO {
  manoDeObraManual: number | null;
  empaqueManual: number | null;
  servicioCorteInterno: boolean;
  margenPropio: number | null; // centésimas de %
  margen: number; // el que se aplicó
  notas: string | null;
  lineas: LineaCostoDTO[];
  materiales: number;
  manoDeObra: number;
  empaque: number;
  servicioCorte: number;
  origenManoDeObra: 'modelo' | 'manual'; // del modelo vinculado (CT) o escrita a mano
}
