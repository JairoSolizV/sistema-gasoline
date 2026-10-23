// Tablero de dinero (docs/PLAN_TABLERO_DINERO.md). Dinero en centavos; los
// campos que terminan en Usd son centavos de $us, los demás de Bs
// (docs/PLAN_DOLARES.md).
import type { Cuenta } from '../cuentas.js';
import type { EstadoPedido } from '../schemas/dinero.js';
import type { Caja } from '../schemas/caja.js';

export type Moneda = 'USD' | 'BOB';

export interface ClienteDTO {
  id: string;
  nombre: string;
  celular: string | null;
  notas: string | null;
  plazoDias: number; // días para pagar un despacho
  activo: boolean;
  despachadoUsd: number; // Σ despachos
  cobradoUsd: number; // Σ cobros (los de Bs, a su equivalente en $us)
  porCobrarUsd: number; // despachado − cobrado (negativo = pagó de más / adelanto)
  tieneMovimientos: boolean;
}

export interface PedidoDTO {
  id: string;
  cliente: { id: string; nombre: string };
  ficha: { id: string; codigo: string | null; nombre: string };
  prendas: number;
  precioDocenaUsd: number;
  costoPrenda: number; // Bs: costo de hoy de la ficha, sin costos fijos
  ventaUsd: number; // prendas × precio de la docena ÷ 12
  costo: number; // Bs: prendas × costo
  fechaEntrega: string | null;
  estado: EstadoPedido;
  corte: { id: string; codigo: number } | null;
  notas: string | null;
}

export interface DespachoLineaDTO {
  id: string;
  corte: { id: string; codigo: number } | null;
  ficha: { id: string; nombre: string } | null;
  descripcion: string;
  detalle: string | null; // talla y color si no fue surtido
  prendas: number;
  precioDocenaUsd: number;
  costoPrenda: number; // Bs, foto al despachar
  totalUsd: number;
  totalBs: number; // a la tasa del despacho
}

export interface DespachoDTO {
  id: string;
  cliente: { id: string; nombre: string };
  fecha: string;
  vence: string; // cuándo lo tiene que pagar
  tasaCambio: number; // diezmilésimos del día
  notas: string | null;
  lineas: DespachoLineaDTO[];
  prendas: number;
  totalUsd: number;
  totalBs: number;
  costo: number; // Bs
}

export interface CobroDTO {
  id: string;
  cliente: { id: string; nombre: string };
  fecha: string;
  moneda: Moneda;
  monto: number; // en su moneda
  tasaCambio: number;
  usd: number; // equivalente en $us
  bs: number; // equivalente en Bs
  nota: string | null;
  caja: Caja;
}

export interface MovimientoProveedorDTO {
  tipo: 'compra' | 'pago';
  id: string;
  fecha: string;
  detalle: string;
  monto: number; // en la moneda de la deuda
}

/** Deuda con un proveedor en una moneda (la tela de Nancy va en $us). */
export interface ProveedorDeudaDTO {
  proveedor: string;
  moneda: Moneda;
  comprasCredito: number;
  pagado: number;
  deuda: number; // compras a crédito − pagos
  movimientos: MovimientoProveedorDTO[]; // más reciente primero
}

/** Dónde está un corte en el camino del producto. */
export type EtapaCorte = 'produccion' | 'servicios' | 'deposito';

export interface CorteDineroDTO {
  corteId: string;
  codigo: number;
  modeloNombre: string;
  etapa: EtapaCorte;
  prendas: number; // del corte
  despachadas: number;
  disponibles: number; // prendas − despachadas
  costoPrenda: number; // Bs: costo real del corte por prenda (sin costos fijos)
  precioDocenaUsd: number | null; // del pedido vinculado o de la ficha; null = sin ficha
  costo: number; // Bs, de las prendas disponibles
  ventaUsd: number | null;
  venta: number | null; // Bs, al último tipo de cambio
  faltaPagar: number; // costura/empaque al cerrar + envíos sin devolver
  serviciosPendientes: string[]; // ej. ['lavanderia']
}

export interface TableroItemDTO {
  id: string;
  titulo: string;
  detalle: string | null;
  prendas: number;
  costo: number;
  venta: number | null; // Bs
  ventaUsd: number | null;
  faltaPagar: number;
}

export interface EtapaDineroDTO {
  prendas: number;
  costo: number;
  venta: number; // Bs, solo de lo que tiene precio
  ventaUsd: number;
  ganancia: number; // Bs: venta − costo, solo de lo que tiene precio
  sinPrecio: number; // cuántos ítems no tienen precio de venta (modelo sin ficha)
  faltaPagar: number;
  items: TableroItemDTO[];
}

/** Un despacho que el cliente todavía no terminó de pagar. */
export interface CuentaPorCobrarDTO {
  despachoId: string;
  cliente: { id: string; nombre: string; celular: string | null };
  fecha: string;
  vence: string;
  detalle: string; // qué se le despachó
  totalUsd: number;
  cobradoUsd: number; // lo que ya pagó de este despacho (los cobros van a los más viejos)
  pendienteUsd: number;
}

export interface CuentasPorCobrarDTO {
  hoy: string;
  tasaCambio: number; // la última, para mostrar el equivalente en Bs
  items: CuentaPorCobrarDTO[]; // por fecha de vencimiento
  totalUsd: number;
  vencidoUsd: number;
  semanaUsd: number; // vence en los próximos 7 días
  adelantos: { id: string; nombre: string; montoUsd: number }[]; // clientes que pagaron de más
}

/** Algo que hay que pagar (cuentas por pagar). */
export interface CuentaPorPagarDTO {
  id: string;
  tipo: 'proveedor' | 'servicio' | 'operarios' | 'banco';
  acreedor: string; // a quién
  detalle: string;
  moneda: Moneda;
  monto: number; // lo que falta pagar, en su moneda
  montoBs: number; // su equivalente en Bs (los $us, al último tipo de cambio)
  vence: string | null; // 'aaaa-mm-dd'; null = sin fecha acordada
  enlace: string; // dónde se paga en el sistema
}

export interface CuentasPorPagarDTO {
  hoy: string;
  tasaCambio: number; // la última
  items: CuentaPorPagarDTO[]; // por fecha de vencimiento (sin fecha al final)
  total: number; // Bs (los $us convertidos)
  totalUsd: number; // solo lo que se debe en $us
  vencido: number; // Bs: ya pasó la fecha
  semana: number; // Bs: vence en los próximos 7 días
}

export interface TableroDTO {
  anio: number;
  mes: number;
  enPuerta: EtapaDineroDTO; // pedidos sin cortar
  enProduccion: EtapaDineroDTO; // cortes abiertos
  enServicios: EtapaDineroDTO; // cerrados con envíos sin devolver
  deposito: EtapaDineroDTO; // listos para despachar
  tasaCambio: number; // la última, para pasar $us a Bs
  porCobrar: { total: number; totalUsd: number; clientes: { id: string; nombre: string; montoUsd: number }[] };
  insumos: { valor: number; sinPrecio: number }; // sinPrecio: insumos con stock y sin compras
  anticiposAdelantados: number; // anticipos por trabajo todavía no ganado (saldos negativos)
  tenes: number; // insumos + producción + servicios + depósito (a costo) + por cobrar + anticipos adelantados
  deudas: {
    proveedores: { total: number; lista: { proveedor: string; moneda: Moneda; monto: number; montoBs: number }[] };
    servicios: { total: number; porCuenta: { cuenta: Cuenta; monto: number }[] };
    operarios: number; // saldos a favor de los operarios (cuentas internas)
    total: number;
  };
  capitalDeTrabajo: number; // tenes − deudas.total (sin el préstamo)
  banco: {
    cuotaMes: number;
    prestamos: { banco: string; cuota: number; cuotasRestantes: number | null; pagadaEsteMes: boolean }[];
  };
  resultadoMes: {
    ventas: number; // Bs: despachado en el mes (a la tasa de cada despacho)
    ventasUsd: number;
    costoVendido: number;
    margen: number; // ventas − costo
    gastosFijos: number; // costos fijos del taller (sin la deuda)
    operativo: number; // margen − gastos fijos
    cuotaBanco: number;
    queda: number; // operativo − cuota del banco
    cobrado: number; // Bs: cobros del mes (plata que entró)
    cobradoUsd: number;
    prendasDespachadas: number;
  };
  avisos: string[];
}
