import { z } from 'zod';
import { esDiaValido } from '../dias.js';
import { cajaSchema } from './caja.js';

// Tablero de dinero (docs/PLAN_TABLERO_DINERO.md): clientes, pedidos,
// despachos, cobros y pagos a proveedores. Dinero en centavos.

const texto = (max: number) =>
  z.preprocess((v) => (v === '' || v == null ? null : v), z.string().trim().max(max).nullable());
const dia = z.string().refine(esDiaValido, 'Fecha inválida (aaaa-mm-dd)');
const monto = z.number().int().min(1, 'El monto debe ser mayor a 0').max(1_000_000_000);
const precio = z.number().int().min(0, 'El precio no puede ser negativo').max(100_000_000);
const prendas = z.number().int().min(1, 'Indicá cuántas prendas').max(1_000_000);

export const ESTADOS_PEDIDO = ['pendiente', 'en_produccion', 'entregado', 'cancelado'] as const;
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

/** Nombre de proveedor para agrupar deudas: mayúsculas y sin espacios de más. */
export const normalizarProveedor = (s: string) => s.trim().replace(/\s+/g, ' ').toUpperCase();

export const clienteInputSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(80),
  celular: texto(30).optional(),
  notas: texto(200).optional(),
});

export const editarClienteSchema = z
  .object({
    nombre: z.string().trim().min(1).max(80),
    celular: texto(30),
    notas: texto(200),
    activo: z.boolean(),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: 'Nada que actualizar' });

/** Pedido: sin precio usa el precio de venta de la ficha. */
export const pedidoInputSchema = z.object({
  clienteId: z.uuid('Elegí el cliente'),
  fichaId: z.uuid('Elegí el modelo (ficha de costo)'),
  prendas,
  precioPrenda: precio.optional(),
  fechaEntrega: dia.optional(),
  notas: texto(200).optional(),
});

export const editarPedidoSchema = z
  .object({
    prendas,
    precioPrenda: precio,
    fechaEntrega: dia.nullable(),
    estado: z.enum(ESTADOS_PEDIDO),
    corteId: z.uuid().nullable(), // el corte con el que se produce
    notas: texto(200),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: 'Nada que actualizar' });

/** Una línea sale de un corte (descuenta su depósito) o de una ficha (prendas
 *  que no pasaron por el sistema). Sin precio usa el del pedido o la ficha. */
const lineaDespachoSchema = z
  .object({
    corteId: z.uuid().optional(),
    fichaId: z.uuid().optional(),
    prendas,
    precioPrenda: precio.optional(),
    detalle: texto(80).optional(), // talla y color si no va surtido
  })
  .refine((l) => (l.corteId == null) !== (l.fichaId == null), {
    message: 'Cada línea es de un corte o de una ficha',
  });

export const despachoInputSchema = z.object({
  clienteId: z.uuid('Elegí el cliente'),
  fecha: dia,
  notas: texto(200).optional(),
  lineas: z.array(lineaDespachoSchema).min(1, 'Agregá al menos una línea'),
});

export const cobroInputSchema = z.object({
  clienteId: z.uuid('Elegí el cliente'),
  fecha: dia,
  monto,
  nota: texto(120).optional(),
  caja: cajaSchema.default('efectivo'),
});

export const pagoProveedorInputSchema = z.object({
  proveedor: z.string().trim().min(1, 'Indicá el proveedor').max(80).transform(normalizarProveedor),
  fecha: dia,
  monto,
  nota: texto(120).optional(),
  caja: cajaSchema.default('efectivo'),
});

export type ClienteInput = z.infer<typeof clienteInputSchema>;
export type EditarClienteInput = z.infer<typeof editarClienteSchema>;
export type PedidoInput = z.infer<typeof pedidoInputSchema>;
export type EditarPedidoInput = z.infer<typeof editarPedidoSchema>;
export type DespachoInput = z.infer<typeof despachoInputSchema>;
export type CobroInput = z.infer<typeof cobroInputSchema>;
export type PagoProveedorInput = z.infer<typeof pagoProveedorInputSchema>;
