import { z } from 'zod';
import { esDiaValido } from '../dias.js';
import { cajaBsSchema, cajaSchema } from './caja.js';
import { TITULOS_HILO, type TituloHilo } from '../requerimiento.js';

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
  // requerimiento (docs/PLAN_REQUERIMIENTO.md): envase en que se compra
  unidadesPorEnvase: entero(1, 'Las unidades por envase deben ser al menos 1').nullable().optional(),
  precioEnvase: centavos.nullable().optional(), // referencia si no hay compras
  porTalla: z.boolean().optional(), // un envase por talla (talla tejida)
  yardasPorCono: entero(1, 'Las yardas del cono deben ser mayores a 0').nullable().optional(), // hilo
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
    codigoCorte: texto(20).optional(), // corte para el que se compró (ej. "28-1")
    condicion: z.enum(['contado', 'credito']).default('contado'), // a crédito: deuda con el proveedor
    caja: cajaSchema.default('efectivo'), // al contado: de qué caja salió
    vence: dia.optional(), // a crédito: cuándo hay que pagarla
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
  precioDocenaUsd: centavos.nullable().optional(), // precio fijo de la docena en $us (null = costo + margen)
  notas: texto(500).optional(),
  // requerimiento: medida del cierre de cada talla (null = la regla por defecto)
  cierresPorTalla: z
    .array(z.object({ talla: z.number().int(), medidaCm: entero(1, 'Medida de cierre inválida') }))
    .max(40)
    .refine((cs) => new Set(cs.map((c) => c.talla)).size === cs.length, 'Hay una talla repetida')
    .nullable()
    .optional(),
  // requerimiento: cm de cada hilo por prenda (null = los de la hoja: 12 / 24 / 30 / 48 m)
  cmHiloPorPrenda: z
    .object(
      Object.fromEntries(TITULOS_HILO.map((t) => [t, entero(0, 'Metros de hilo inválidos')])) as Record<
        TituloHilo,
        z.ZodNumber
      >,
    )
    .nullable()
    .optional(),
  mermaHilo: z.number().int().min(0, 'La merma no puede ser negativa').max(100).nullable().optional(), // %
  lineas: z.array(lineaCostoInputSchema).max(60).default([]),
});

export const listarComprasQuerySchema = z.object({ insumoId: z.uuid().optional() });

/** Datos de una compra que se pueden corregir sin tocar su precio ni cantidad:
 *  la tienda, el corte, si fue al contado o a crédito y de qué caja salió. */
export const editarCompraSchema = z
  .object({
    tienda: z.string().trim().min(1, 'Indicá la tienda o proveedor').max(80),
    codigoCorte: texto(20),
    condicion: z.enum(['contado', 'credito']),
    caja: cajaSchema,
    vence: dia.nullable(),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: 'Nada que actualizar' });

export type InsumoInput = z.infer<typeof insumoInputSchema>;
export type EditarInsumoInput = z.infer<typeof editarInsumoSchema>;
export type CompraInput = z.infer<typeof compraInputSchema>;
export type EditarCompraInput = z.infer<typeof editarCompraSchema>;
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

// ── Etapa 5: costos fijos del taller (docs/PLAN_COSTOS.md §7c) ──

export const GRUPOS_GASTO_FIJO = ['personal', 'operativos', 'servicios', 'maquinas', 'impuestos', 'otros'] as const;
export type GrupoGastoFijo = (typeof GRUPOS_GASTO_FIJO)[number];
export type TipoGastoFijo = 'mensual' | 'por_compras';

const porcentaje = z.number().int().min(1, 'El porcentaje debe ser mayor a 0').max(10_000, 'Máximo 100 %');

/** Alta de un gasto fijo: mensual (con su monto desde una fecha) o por compras. */
export const gastoFijoInputSchema = z
  .object({
    nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(60),
    grupo: z.enum(GRUPOS_GASTO_FIJO),
    tipo: z.enum(['mensual', 'por_compras']).default('mensual'),
    porcentajeTaller: porcentaje.default(10_000),
    monto: centavos.optional(), // mensual: monto por mes
    vigenteDesde: dia.optional(), // mensual: desde cuándo
    notas: texto(200).optional(),
  })
  .refine((g) => g.tipo !== 'mensual' || (g.monto != null && g.vigenteDesde != null), {
    path: ['monto'],
    message: 'Un gasto mensual necesita su monto y desde cuándo rige',
  });

export const editarGastoFijoSchema = z
  .object({
    nombre: z.string().trim().min(1).max(60),
    grupo: z.enum(GRUPOS_GASTO_FIJO),
    porcentajeTaller: porcentaje,
    activo: z.boolean(),
    notas: texto(200),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: 'Nada que actualizar' });

/** Nuevo monto mensual desde una fecha (misma fecha = lo reemplaza). */
export const montoGastoInputSchema = z.object({ monto: centavos, vigenteDesde: dia });

/** Una compra de un gasto por compras (ej. comida; sin factura). */
export const compraGastoInputSchema = z.object({
  fecha: dia,
  monto: z.number().int().min(1, 'El monto debe ser mayor a 0').max(100_000_000),
  nota: texto(120).optional(),
  caja: cajaBsSchema.default('efectivo'),
});

export const prestamoInputSchema = z.object({
  banco: z.string().trim().min(1, 'Indicá el banco').max(60),
  cuota: z.number().int().min(1, 'La cuota debe ser mayor a 0').max(100_000_000),
  diaVencimiento: z.number().int().min(1).max(31),
  cuotasRestantes: z.number().int().min(0).max(600).nullable().optional(),
  notas: texto(200).optional(),
});
export const editarPrestamoSchema = prestamoInputSchema
  .extend({ activo: z.boolean() })
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: 'Nada que actualizar' });

export const pagoPrestamoInputSchema = z.object({
  anio: z.number().int().min(2000).max(2100),
  mes: z.number().int().min(1).max(12),
  fecha: dia,
  monto: z.number().int().min(1).max(100_000_000),
  caja: cajaBsSchema.default('efectivo'),
});

export type GastoFijoInput = z.infer<typeof gastoFijoInputSchema>;
export type EditarGastoFijoInput = z.infer<typeof editarGastoFijoSchema>;
export type MontoGastoInput = z.infer<typeof montoGastoInputSchema>;
export type CompraGastoInput = z.infer<typeof compraGastoInputSchema>;
export type PrestamoInput = z.infer<typeof prestamoInputSchema>;
export type EditarPrestamoInput = z.infer<typeof editarPrestamoSchema>;
export type PagoPrestamoInput = z.infer<typeof pagoPrestamoInputSchema>;

// ── Catálogo de productos (sobre las fichas de costo) ──

/** Lo que se le muestra al cliente de cada producto. */
export const catalogoFichaSchema = z
  .object({ tallas: texto(60), colores: texto(120), descripcion: texto(300) })
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: 'Nada que actualizar' });

export const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'] as const;
/** Foto ya achicada por el panel, en base64 (máx. ~2 MB de imagen). */
export const fotoFichaSchema = z.object({
  mime: z.enum(TIPOS_FOTO, 'La foto tiene que ser JPG, PNG o WEBP'),
  base64: z.string().min(10).max(2_800_000, 'La foto es muy pesada'),
});

export type CatalogoFichaInput = z.infer<typeof catalogoFichaSchema>;
export type FotoFichaInput = z.infer<typeof fotoFichaSchema>;
