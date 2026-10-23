import type {
  CategoriaInsumo,
  GrupoGastoFijo,
  OrigenCompra,
  TipoGastoFijo,
} from '../schemas/costos.js';

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
  valorStock: number; // centavos: stock (si es positivo) × precio de la última compra
  codigosCorte: string[]; // cortes para los que se compró, de la compra más reciente a la más vieja
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
  codigoCorte: string | null; // corte para el que se compró
  condicion: 'contado' | 'credito';
  caja: 'efectivo' | 'banco';
  vence: string | null; // a crédito: 'aaaa-mm-dd'
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
  // por docena en $us (centavos de $us) con el tipo de cambio de Configuración; solo para mostrar
  costoDocenaUsd: number;
  ventaDocenaUsd: number;
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
  costoFijo: number; // centavos por prenda (etapa 5): costos fijos ÷ prendas de referencia
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

/** Un renglón del kárdex de un insumo: compra (entra), consumo de un corte
 *  (sale) o conteo físico (el saldo pasa a ser lo contado). Milésimas. */
export interface MovimientoKardexDTO {
  fecha: string;
  tipo: 'compra' | 'consumo' | 'conteo';
  detalle: string;
  entrada: number | null;
  salida: number | null;
  saldo: number;
  diferencia: number | null; // conteo: contado − lo que decía el sistema
}

export interface KardexDTO {
  insumo: { id: string; nombre: string; unidad: string };
  movimientos: MovimientoKardexDTO[]; // del más viejo al más nuevo
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
    costosFijos: number; // costos fijos del mes del taller (etapa 5)
    total: number;
  };
  avisos: string[];
}

// ── Etapa 5: costos fijos del taller ──

export interface CompraGastoDTO {
  id: string;
  fecha: string;
  monto: number; // centavos (total, antes del % del taller)
  nota: string | null;
}

export interface GastoFijoMesDTO {
  id: string;
  nombre: string;
  grupo: GrupoGastoFijo;
  tipo: TipoGastoFijo;
  porcentajeTaller: number; // centésimas de %
  activo: boolean;
  notas: string | null;
  montos: { id: string; monto: number; vigenteDesde: string }[]; // historial (mensual)
  base: number; // centavos del mes: monto vigente o suma de las compras
  parteTaller: number; // centavos que le tocan al taller
  compras: CompraGastoDTO[]; // las del mes (por compras)
}

export interface PrestamoMesDTO {
  id: string;
  banco: string;
  cuota: number;
  diaVencimiento: number;
  cuotasRestantes: number | null;
  activo: boolean;
  notas: string | null;
  vence: string; // 'aaaa-mm-dd' de este mes
  pago: { fecha: string; monto: number } | null;
}

export interface CostosFijosMesDTO {
  anio: number;
  mes: number;
  gastos: GastoFijoMesDTO[];
  prestamos: PrestamoMesDTO[];
  totalGastos: number; // parte del taller de los gastos (sin deuda)
  totalDeuda: number; // cuotas de préstamos activos ("recuperación de deuda")
  total: number;
  prendasReales: number; // de los cortes cerrados en el mes
  porPrendaReal: number | null; // total ÷ prendas reales
  /** lo que usan las fichas: gastos vigentes + promedio de compras + cuotas, ÷ prendas de referencia */
  presupuestoMensual: number;
  prendasReferencia: number; // Configuración (1500)
  porPrendaFicha: number;
  simulacion: { prendas: number; porPrenda: number }[]; // 1500 / 2000 / 3000 / 4000
}

// ── Catálogo de productos ──

export interface ProductoCatalogoDTO {
  id: string; // la ficha de costo
  codigo: string | null;
  nombre: string;
  modelo: { id: string; nombre: string } | null;
  tallas: string | null;
  colores: string | null;
  descripcion: string | null;
  tieneFoto: boolean;
  fotoVersion: string | null; // cambia al cambiar la foto (para refrescarla)
  costoPrenda: number; // centavos, con costos fijos (el de la ficha)
  precioPrenda: number; // precio de venta por prenda
  precioDocena: number; // Bs = 12 × precio por prenda
  costoDocenaUsd: number; // centavos de $us
  ventaDocenaUsd: number;
  incompleto: boolean;
}

export interface FotoFichaDTO {
  mime: string;
  base64: string;
}
