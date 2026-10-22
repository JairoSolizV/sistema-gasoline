import { z } from 'zod';
import { esDiaValido } from '../dias.js';
import { PROCESOS_CORTE } from '../servicioCorte.js';

// Datos del tendido (informativos; no afectan pagos). Los mismos campos se
// piden al crear el corte y al completarlos/editarlos después. Quién cortó y
// quién dobló ahora son procesos pagados (registrarProcesoSchema).
const camposTendido = {
  tela: z.string().trim().min(1, 'El nombre de la tela es obligatorio').max(60),
  anchoCm: z.number().int().min(1, 'El ancho de la tela debe ser mayor a 0').max(1000),
  trazadoCm: z.number().int().min(1, 'El largo del trazado debe ser mayor a 0').max(100000),
  // costos: prendas por capa del trazado (tela real = largo × capas); opcional
  prendasPorCapa: z
    .number()
    .int()
    .min(1, 'Las prendas por capa deben ser al menos 1')
    .max(10000)
    .nullable()
    .optional(),
};

export const editarTendidoSchema = z.object(camposTendido);

// Calculadora de tendido: metros de cada rollo (en cm, en el orden en que se
// tienden), traslape de cada empalme y retazo mínimo útil.
export const editarRollosSchema = z.object({
  rollosCm: z
    .array(z.number().int().min(1, 'Cada rollo debe tener más de 0 m').max(999_999))
    .min(1, 'Ingresá al menos un rollo')
    .max(200, 'Demasiados rollos'),
  traslapeCm: z.number().int().min(0).max(500, 'El traslape es demasiado grande'),
  retazoMinimoCm: z.number().int().min(0).max(5_000, 'El retazo mínimo es demasiado grande'),
});

// Numeración del corte (N° 1, 2, 3…). Al crear es opcional: si falta, el server
// asigna el siguiente (mayor + 1). Nunca se repite (lo valida el server).
const codigoCorte = z
  .number({ error: 'El código debe ser un número' })
  .int('El código debe ser un número entero')
  .min(1, 'El código debe ser mayor a 0')
  .max(999_999, 'El código es demasiado grande');

export const editarCodigoSchema = z.object({ codigo: codigoCorte });

// ── Servicio de corte interno (docs/PLAN_SERVICIO_CORTE.md) ──
const centavos = z.number().int().min(0, 'La tarifa no puede ser negativa').max(1_000_000);

export const procesoCorteSchema = z.enum(PROCESOS_CORTE);

/** Registra (o reemplaza) un proceso completo del corte: fecha en que se
 *  terminó + personas. `tarifa` es la del proceso (búsqueda, trazado, doblado);
 *  en corte y clasificación cada persona trae la suya. Si falta, el server usa
 *  el predeterminado copiado al corte (o la tarifa personal del operario). Las
 *  cantidades de personas por proceso las valida el service. */
export const registrarProcesoSchema = z.object({
  fecha: z.coerce.date({ error: 'La fecha del proceso es obligatoria' }),
  tarifa: centavos.optional(),
  modalidad: z.enum(['hoja', 'pares']).optional(), // solo doblado (obligatoria ahí)
  personas: z
    .array(z.object({ operarioId: z.uuid(), tarifa: centavos.optional() }))
    .min(1, 'Elegí al menos una persona')
    .max(3)
    .refine(
      (ps) => new Set(ps.map((p) => p.operarioId)).size === ps.length,
      'Hay personas repetidas en el proceso',
    ),
});

export const editarServicioSchema = z.object({ esInterno: z.boolean() });

export const crearCorteSchema = z
  .object({
    modeloVersionId: z.uuid(),
    codigo: z.preprocess((v) => (v === '' || v == null ? undefined : v), codigoCorte.optional()),
    tallas: z.array(z.number().int().min(0)).min(1, 'Ingresá al menos una talla'),
    cortePorTalla: z.array(z.number().int().min(0, 'Cantidades no negativas')),
    // el PLUS son tallas repetidas para cuadrar docenas; SÍ se paga (CA-2.2)
    plusPorTalla: z.array(z.number().int().min(0)).default([]),
    ...camposTendido,
    // interno: el taller hace trazado, doblado, corte y clasificación (se pagan)
    esInterno: z.boolean().default(true),
  })
  .refine((d) => d.cortePorTalla.length === d.tallas.length, {
    message: 'Debe haber una cantidad de corte por cada talla',
  })
  .refine((d) => d.plusPorTalla.length <= d.tallas.length, {
    message: 'El plus no puede tener más entradas que tallas',
  });

export const asignacionInputSchema = z.object({
  operarioId: z.uuid(),
  cantidad: z.number().int().min(1, 'La cantidad debe ser mayor a 0'),
  esMaestroExterno: z.boolean().default(false),
  // centavos; si es maestro y no se envía, el server usa el diferencial de configuración
  diferencial: z.number().int().min(0).optional(),
});

export const reemplazarAsignacionesSchema = z.object({
  asignaciones: z
    .array(asignacionInputSchema)
    .max(3, 'Máximo 3 operarios por operación (CA-3.5)'),
});

export const asignarGrupoSchema = z.object({
  grupo: z.string().trim().min(1),
  operarioId: z.uuid(),
  esMaestroExterno: z.boolean().default(false),
});

export const cerrarCorteSchema = z.object({
  // fecha de cierre/liquidación: eje del consolidado; hoy si no se envía
  fechaCierre: z.coerce.date().optional(),
});

export const listarCortesQuerySchema = z.object({
  estado: z.enum(['borrador', 'abierto', 'cerrado']).optional(),
  modeloId: z.uuid().optional(),
});

export type CrearCorteInput = z.infer<typeof crearCorteSchema>;
export type EditarTendidoInput = z.infer<typeof editarTendidoSchema>;
export type EditarCodigoInput = z.infer<typeof editarCodigoSchema>;
export type EditarRollosInput = z.infer<typeof editarRollosSchema>;
export type RegistrarProcesoInput = z.infer<typeof registrarProcesoSchema>;
export type EditarServicioInput = z.infer<typeof editarServicioSchema>;
export type AsignacionInput = z.infer<typeof asignacionInputSchema>;
export type ReemplazarAsignacionesInput = z.infer<typeof reemplazarAsignacionesSchema>;
export type AsignarGrupoInput = z.infer<typeof asignarGrupoSchema>;
export type CerrarCorteInput = z.infer<typeof cerrarCorteSchema>;

// ── Lavandería y bordado externos (docs/PLAN_CUENTAS_SEPARADAS.md §5) ─────────
export const SERVICIOS_EXTERNOS = ['lavanderia', 'bordado'] as const;
export type ServicioExterno = (typeof SERVICIOS_EXTERNOS)[number];

const dia = (mensaje: string) => z.string({ error: mensaje }).refine(esDiaValido, 'Fecha inválida (aaaa-mm-dd)');
const notaEnvio = z.preprocess(
  (v) => (v === '' || v == null ? null : v),
  z.string().trim().max(120).nullable(),
);

/** Envío de prendas a un proveedor. Sin precio, el server usa el del proveedor. */
export const crearEnvioSchema = z.object({
  servicio: z.enum(SERVICIOS_EXTERNOS),
  operarioId: z.uuid('Elegí el proveedor'),
  cantidad: z.number().int().min(1, 'Las prendas enviadas deben ser al menos 1'),
  precioPrenda: centavos.optional(),
  fechaEnvio: dia('La fecha de envío es obligatoria'),
  nota: notaEnvio.optional(),
});

/** Edición parcial; `fechaDevolucion` registra (o con null, deshace) la devolución. */
export const editarEnvioSchema = z
  .object({
    cantidad: z.number().int().min(1, 'Las prendas enviadas deben ser al menos 1'),
    precioPrenda: centavos,
    fechaEnvio: dia('La fecha de envío es obligatoria'),
    fechaDevolucion: dia('Fecha de devolución inválida').nullable(),
    nota: notaEnvio,
  })
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, { message: 'Nada que actualizar' });

export type CrearEnvioInput = z.infer<typeof crearEnvioSchema>;
export type EditarEnvioInput = z.infer<typeof editarEnvioSchema>;
