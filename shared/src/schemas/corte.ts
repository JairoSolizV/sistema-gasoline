import { z } from 'zod';
import { PROCESOS_CORTE } from '../servicioCorte.js';

const textoOpcional = (max: number) =>
  z.preprocess((v) => (v === '' || v == null ? null : v), z.string().trim().max(max).nullable());

// Datos del tendido (informativos; no afectan pagos). Los mismos campos se
// piden al crear el corte y al completarlos/editarlos después. Quién cortó y
// quién dobló ahora son procesos pagados (registrarProcesoSchema).
const camposTendido = {
  tela: z.string().trim().min(1, 'El nombre de la tela es obligatorio').max(60),
  anchoCm: z.number().int().min(1, 'El ancho de la tela debe ser mayor a 0').max(1000),
  trazadoCm: z.number().int().min(1, 'El largo del trazado debe ser mayor a 0').max(100000),
};

export const editarTendidoSchema = z.object(camposTendido);

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
    codigo: textoOpcional(30),
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
export type RegistrarProcesoInput = z.infer<typeof registrarProcesoSchema>;
export type EditarServicioInput = z.infer<typeof editarServicioSchema>;
export type AsignacionInput = z.infer<typeof asignacionInputSchema>;
export type ReemplazarAsignacionesInput = z.infer<typeof reemplazarAsignacionesSchema>;
export type AsignarGrupoInput = z.infer<typeof asignarGrupoSchema>;
export type CerrarCorteInput = z.infer<typeof cerrarCorteSchema>;
