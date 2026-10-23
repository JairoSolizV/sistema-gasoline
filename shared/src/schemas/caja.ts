import { z } from 'zod';
import { esDiaValido } from '../dias.js';

// Caja (docs/PLAN_CAJA.md): efectivo y banco, categorías, movimientos a mano y
// arqueos. Dinero en centavos.

export const CAJAS = ['efectivo', 'banco', 'dolares'] as const;
export type Caja = (typeof CAJAS)[number];
/** Las cajas en bolivianos (la de dólares lleva su saldo en $us). */
export const CAJAS_BS = ['efectivo', 'banco'] as const;
export type CajaBs = (typeof CAJAS_BS)[number];
export const ETIQUETA_CAJA: Record<Caja, string> = { efectivo: 'Efectivo', banco: 'Banco / QR', dolares: 'Dólares ($us)' };
/** Moneda de cada caja. */
export const MONEDA_CAJA: Record<Caja, 'BOB' | 'USD'> = { efectivo: 'BOB', banco: 'BOB', dolares: 'USD' };

export const cajaSchema = z.enum(CAJAS);
export const cajaBsSchema = z.enum(CAJAS_BS);

/** Lo que entra solo a la caja: de qué registro viene. */
export const ORIGENES_CAJA = [
  'cobro',
  'pago_proveedor',
  'compra',
  'compra_gasto',
  'pago_prestamo',
  'anticipo',
] as const;
export type OrigenCaja = (typeof ORIGENES_CAJA)[number];

const texto = (max: number) =>
  z.preprocess((v) => (v === '' || v == null ? null : v), z.string().trim().max(max).nullable());
const dia = z.string().refine(esDiaValido, 'Fecha inválida (aaaa-mm-dd)');
const monto = z.number().int().min(1, 'El monto debe ser mayor a 0').max(1_000_000_000);

export const inicioCajaSchema = z.object({
  desde: dia,
  saldoInicial: z.number().int().min(-1_000_000_000).max(1_000_000_000),
});

export const movimientoCajaInputSchema = z
  .object({
    tipo: z.enum(['ingreso', 'egreso', 'transferencia']),
    caja: cajaSchema,
    cajaDestino: cajaSchema.optional(),
    fecha: dia,
    monto,
    categoriaId: z.uuid().optional(),
    descripcion: z.string().trim().min(1, 'Describí el movimiento').max(120),
    // cambio de dólares: Bs por $us de ese día (diezmilésimos)
    tasaCambio: z.number().int().min(1, 'Indicá el tipo de cambio').max(10_000_000).optional(),
  })
  .refine((m) => m.tipo !== 'transferencia' || (m.cajaDestino != null && m.cajaDestino !== m.caja), {
    path: ['cajaDestino'],
    message: 'Una transferencia va de una caja a la otra',
  })
  .refine((m) => m.tipo === 'transferencia' || m.categoriaId != null, {
    path: ['categoriaId'],
    message: 'Elegí la categoría',
  })
  .refine(
    (m) =>
      m.tipo !== 'transferencia' ||
      m.cajaDestino == null ||
      (m.caja === 'dolares') === (m.cajaDestino === 'dolares') ||
      m.tasaCambio != null,
    { path: ['tasaCambio'], message: 'Para cambiar dólares indicá el tipo de cambio' },
  );

export const cambiarCajaSchema = z.object({ caja: cajaSchema });

export const arqueoInputSchema = z.object({
  caja: cajaSchema,
  fecha: dia,
  contado: z.number().int().min(0, 'No puede ser negativo').max(1_000_000_000),
  nota: texto(120).optional(),
});

export const categoriaCajaInputSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(40),
  tipo: z.enum(['ingreso', 'egreso']),
});

export const editarCategoriaCajaSchema = z
  .object({ nombre: z.string().trim().min(1).max(40), activo: z.boolean() })
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: 'Nada que actualizar' });

export type InicioCajaInput = z.infer<typeof inicioCajaSchema>;
export type MovimientoCajaInput = z.infer<typeof movimientoCajaInputSchema>;
export type ArqueoInput = z.infer<typeof arqueoInputSchema>;
export type CategoriaCajaInput = z.infer<typeof categoriaCajaInputSchema>;
export type EditarCategoriaCajaInput = z.infer<typeof editarCategoriaCajaSchema>;
