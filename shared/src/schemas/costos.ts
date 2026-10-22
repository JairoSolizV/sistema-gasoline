import { z } from 'zod';
import { esDiaValido } from '../dias.js';

// Costos de producción (docs/PLAN_COSTOS.md). Unidades en shared/costos.ts:
// cantidades en milésimas, dinero en centavos, tasa en diezmilésimos.

export const CATEGORIAS_INSUMO = [
  'tela',
  'hilo',
  'cierre',
  'boton',
  'remache',
  'cuero',
  'etiqueta',
  'bolsa',
  'logistica',
  'otro',
] as const;
export type CategoriaInsumo = (typeof CATEGORIAS_INSUMO)[number];

export const ORIGENES_COMPRA = ['fabrica', 'mayorista', 'tienda'] as const;
export type OrigenCompra = (typeof ORIGENES_COMPRA)[number];

const texto = (max: number) =>
  z.preprocess((v) => (v === '' || v == null ? null : v), z.string().trim().max(max).nullable());
const entero = (min: number, mensaje: string) => z.number().int(mensaje).min(min, mensaje);
const centavos = z.number().int().min(0, 'No puede ser negativo').max(1_000_000_000);
const dia = z.string().refine(esDiaValido, 'Fecha inválida (aaaa-mm-dd)');

export const insumoInputSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(80),
  categoria: z.enum(CATEGORIAS_INSUMO),
  unidad: z.string().trim().min(1, 'La unidad es obligatoria').max(20),
  color: texto(40).optional(),
  codigo: texto(40).optional(),
  titulo: texto(20).optional(), // hilo: 20/3
  anchoCm: entero(1, 'Ancho inválido').nullable().optional(),
  marca: texto(40).optional(),
  numeroLlave: texto(20).optional(),
  medidaCm: entero(1, 'Medida inválida').nullable().optional(),
  rendimiento: entero(1, 'El rendimiento son prendas por cono (mayor a 0)').nullable().optional(),
  notas: texto(200).optional(),
});

export const editarInsumoSchema = insumoInputSchema
  .extend({ activo: z.boolean() })
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: 'Nada que actualizar' });

/** Compra: en Bs se indica el precio total; en dólares, monto y tasa oficial del día. */
export const compraInputSchema = z
  .object({
    insumoId: z.uuid('Elegí el insumo'),
    fecha: dia,
    tienda: z.string().trim().min(1, 'Indicá la tienda o proveedor').max(80),
    origen: z.enum(ORIGENES_COMPRA).default('tienda'),
    ciudad: texto(40).optional(),
    presentacion: texto(40).optional(),
    cantidad: entero(1, 'La cantidad comprada debe ser mayor a 0'), // milésimas
    moneda: z.enum(['BOB', 'USD']).default('BOB'),
    precioTotal: centavos.optional(), // BOB
    montoUsd: centavos.optional(), // USD
    tasaCambio: entero(1, 'Tasa de cambio inválida').optional(), // diezmilésimos
    notas: texto(200).optional(),
  })
  .refine((c) => c.moneda !== 'BOB' || c.precioTotal != null, {
    path: ['precioTotal'],
    message: 'Indicá el precio pagado',
  })
  .refine((c) => c.moneda !== 'USD' || (c.montoUsd != null && c.tasaCambio != null), {
    path: ['montoUsd'],
    message: 'En dólares indicá el monto y la tasa oficial del día',
  });

const lineaBase = { concepto: z.string().trim().min(1, 'Falta el concepto').max(80) };
const insumoId = z.uuid('Elegí el insumo');
export const lineaCostoInputSchema = z.discriminatedUnion('tipo', [
  z.object({ ...lineaBase, tipo: z.literal('por_prenda'), insumoId, cantidad: entero(1, 'Cantidad inválida') }),
  z.object({
    ...lineaBase,
    tipo: z.literal('tela_tizado'),
    insumoId,
    largoMm: entero(1, 'Largo del tizado inválido'),
    prendasPorCapa: entero(1, 'Prendas por capa inválidas'),
  }),
  z.object({
    ...lineaBase,
    tipo: z.literal('hilo'),
    insumoId,
    rendimiento: entero(1, 'Rendimiento inválido').nullable().optional(),
  }),
  z.object({
    ...lineaBase,
    tipo: z.literal('prorrateo'),
    monto: centavos,
    prendas: entero(1, 'Prendas inválidas'),
  }),
  z.object({ ...lineaBase, tipo: z.literal('precio_prenda'), precio: centavos }),
]);

/** Ficha completa (alta o reemplazo): datos + todas sus líneas, en orden. */
export const fichaCostoInputSchema = z.object({
  codigo: texto(20).optional(),
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(80),
  modeloId: z.uuid().nullable().optional(),
  manoDeObra: centavos.nullable().optional(), // solo sin modelo vinculado
  empaque: centavos.nullable().optional(),
  servicioCorteInterno: z.boolean().default(true),
  margen: z.number().int().min(0).max(100_000).nullable().optional(), // null = el general
  notas: texto(500).optional(),
  lineas: z.array(lineaCostoInputSchema).max(60).default([]),
});

export const listarComprasQuerySchema = z.object({ insumoId: z.uuid().optional() });

export type InsumoInput = z.infer<typeof insumoInputSchema>;
export type EditarInsumoInput = z.infer<typeof editarInsumoSchema>;
export type CompraInput = z.infer<typeof compraInputSchema>;
export type LineaCostoInput = z.infer<typeof lineaCostoInputSchema>;
export type FichaCostoInput = z.infer<typeof fichaCostoInputSchema>;

// ── Etapas 3 y 4: stock (conteos), plan de producción y proyección ──

/** Conteo físico: cuánto hay hoy en el depósito (milésimas de la unidad). */
export const conteoInputSchema = z.object({
  insumoId: z.uuid('Elegí el insumo'),
  fecha: dia,
  cantidad: z.number().int().min(0, 'La cantidad no puede ser negativa').max(1_000_000_000),
  notas: texto(200).optional(),
});

export const mesQuerySchema = z.object({
  anio: z.coerce.number().int().min(2000).max(2100),
  mes: z.coerce.number().int().min(1).max(12),
});

/** Plan del mes completo (reemplaza al anterior): prendas de cada ficha. */
export const planInputSchema = z.object({
  anio: z.number().int().min(2000).max(2100),
  mes: z.number().int().min(1).max(12),
  items: z
    .array(z.object({ fichaId: z.uuid(), prendas: entero(1, 'Las prendas deben ser al menos 1') }))
    .max(100)
    .refine((xs) => new Set(xs.map((x) => x.fichaId)).size === xs.length, 'Hay modelos repetidos en el plan'),
});

export type ConteoInput = z.infer<typeof conteoInputSchema>;
export type PlanInput = z.infer<typeof planInputSchema>;
