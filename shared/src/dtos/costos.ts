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
  stock: StockDTO; // milésimas (etapa 4)
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

// ── Etapas 3 y 4 ──

/** Stock de un insumo (milésimas): último conteo + compras − consumo de cortes posteriores. */
export interface StockDTO {
  conteo: { id: string; fecha: string; cantidad: number } | null;
  compras: number; // milésimas compradas después del conteo (o todas, sin conteo)
  consumo: number; // milésimas gastadas por cortes después del conteo
  stock: number; // puede ser negativo si faltan compras o conteos
}

export interface ConteoDTO {
  id: string;
  insumo: { id: string; nombre: string; unidad: string };
  fecha: string;
  cantidad: number;
  notas: string | null;
}

/** Un rubro del costo de un corte: lo que decía la ficha y lo que pasó. */
export interface RubroCostoDTO {
  rubro:
    | 'tela'
    | 'materiales'
    | 'externos' // lavandería, bordado y otros precios por prenda
    | 'logistica'
    | 'costura'
    | 'empaque'
    | 'servicio_corte';
  ficha: number | null; // centavos para todas las prendas (null = sin ficha)
  real: number | null; // centavos (null = sin dato real)
  nota: string | null; // ej. "tela según tizado real: 61.20 m"
}

export interface CorteCostoResumenDTO {
  corteId: string;
  codigo: number;
  modeloNombre: string;
  estado: 'abierto' | 'cerrado';
  prendas: number;
  ficha: { id: string; nombre: string } | null;
  realPorPrenda: number; // centavos
  fichaPorPrenda: number | null;
}

export interface CorteCostoDetalleDTO extends CorteCostoResumenDTO {
  rubros: RubroCostoDTO[];
  realTotal: number;
  fichaTotal: number | null;
  telaReal: { metros: number; capas: number } | null; // tizado real (milésimas de m)
  avisos: string[]; // ej. "sin prendas por capa: la tela se calcula con la ficha"
}

export interface PlanItemDTO {
  ficha: { id: string; codigo: string | null; nombre: string };
  prendas: number;
  costoPorPrenda: number;
  incompleto: boolean;
}

/** Lo que necesita el plan de un insumo, frente a lo que hay. */
export interface NecesidadInsumoDTO {
  insumo: { id: string; nombre: string; unidad: string };
  necesario: number; // milésimas
  stock: number; // milésimas
  faltante: number; // milésimas (0 si alcanza)
  costoFaltante: number | null; // centavos al precio de la última compra (null = sin precio)
}

export interface CortePendienteDTO {
  corteId: string;
  codigo: number;
  modeloNombre: string;
  prendas: number;
  costuraYEmpaque: number; // centavos que se pagan al cerrar
  enviosSinDevolver: number; // centavos de lavandería/bordado por devolver
}

export interface ProyeccionDTO {
  anio: number;
  mes: number;
  plan: PlanItemDTO[];
  necesidades: NecesidadInsumoDTO[];
  cortesAbiertos: CortePendienteDTO[];
  totales: {
    comprarMateriales: number; // centavos
    producirPlan: number; // mano de obra, empaque, servicio de corte, externos y logística del plan
    terminarCortes: number;
    total: number;
  };
  avisos: string[];
}
