// Tablero de dinero (docs/PLAN_TABLERO_DINERO.md). Dinero en centavos.
import type { Cuenta } from '../cuentas.js';
import type { EstadoPedido } from '../schemas/dinero.js';

export interface ClienteDTO {
  id: string;
  nombre: string;
  celular: string | null;
  notas: string | null;
  activo: boolean;
  despachado: number; // Σ despachos
  cobrado: number; // Σ cobros
  porCobrar: number; // despachado − cobrado (negativo = pagó de más / adelanto)
  tieneMovimientos: boolean;
}

export interface PedidoDTO {
  id: string;
  cliente: { id: string; nombre: string };
  ficha: { id: string; codigo: string | null; nombre: string };
  prendas: number;
  precioPrenda: number;
  costoPrenda: number; // costo de hoy de la ficha, sin costos fijos
  venta: number; // prendas × precio
  costo: number; // prendas × costo
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
  precioPrenda: number;
  costoPrenda: number; // foto al despachar
  total: number;
}

export interface DespachoDTO {
  id: string;
  cliente: { id: string; nombre: string };
  fecha: string;
  notas: string | null;
  lineas: DespachoLineaDTO[];
  prendas: number;
  total: number;
  costo: number;
}

export interface CobroDTO {
  id: string;
  cliente: { id: string; nombre: string };
  fecha: string;
  monto: number;
  nota: string | null;
  caja: 'efectivo' | 'banco';
}

export interface MovimientoProveedorDTO {
  tipo: 'compra' | 'pago';
  id: string;
  fecha: string;
  detalle: string;
  monto: number;
}

export interface ProveedorDeudaDTO {
  proveedor: string;
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
  costoPrenda: number; // costo real del corte por prenda (sin costos fijos)
  precioPrenda: number | null; // del pedido vinculado o de la ficha; null = sin ficha
  costo: number; // de las prendas disponibles
  venta: number | null;
  faltaPagar: number; // costura/empaque al cerrar + envíos sin devolver
  serviciosPendientes: string[]; // ej. ['lavanderia']
}

export interface TableroItemDTO {
  id: string;
  titulo: string;
  detalle: string | null;
  prendas: number;
  costo: number;
  venta: number | null;
  faltaPagar: number;
}

export interface EtapaDineroDTO {
  prendas: number;
  costo: number;
  venta: number; // solo de lo que tiene precio
  ganancia: number; // venta − costo, solo de lo que tiene precio
  sinPrecio: number; // cuántos ítems no tienen precio de venta (modelo sin ficha)
  faltaPagar: number;
  items: TableroItemDTO[];
}

/** Algo que hay que pagar (cuentas por pagar). */
export interface CuentaPorPagarDTO {
  id: string;
  tipo: 'proveedor' | 'servicio' | 'operarios' | 'banco';
  acreedor: string; // a quién
  detalle: string;
  monto: number; // lo que falta pagar
  vence: string | null; // 'aaaa-mm-dd'; null = sin fecha acordada
  enlace: string; // dónde se paga en el sistema
}

export interface CuentasPorPagarDTO {
  hoy: string;
  items: CuentaPorPagarDTO[]; // por fecha de vencimiento (sin fecha al final)
  total: number;
  vencido: number; // ya pasó la fecha
  semana: number; // vence en los próximos 7 días
}

export interface TableroDTO {
  anio: number;
  mes: number;
  enPuerta: EtapaDineroDTO; // pedidos sin cortar
  enProduccion: EtapaDineroDTO; // cortes abiertos
  enServicios: EtapaDineroDTO; // cerrados con envíos sin devolver
  deposito: EtapaDineroDTO; // listos para despachar
  porCobrar: { total: number; clientes: { id: string; nombre: string; monto: number }[] };
  insumos: { valor: number; sinPrecio: number }; // sinPrecio: insumos con stock y sin compras
  anticiposAdelantados: number; // anticipos por trabajo todavía no ganado (saldos negativos)
  tenes: number; // insumos + producción + servicios + depósito (a costo) + por cobrar + anticipos adelantados
  deudas: {
    proveedores: { total: number; lista: { proveedor: string; monto: number }[] };
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
    ventas: number; // despachado en el mes
    costoVendido: number;
    margen: number; // ventas − costo
    gastosFijos: number; // costos fijos del taller (sin la deuda)
    operativo: number; // margen − gastos fijos
    cuotaBanco: number;
    queda: number; // operativo − cuota del banco
    cobrado: number; // cobros del mes (plata que entró)
    prendasDespachadas: number;
  };
  avisos: string[];
}
