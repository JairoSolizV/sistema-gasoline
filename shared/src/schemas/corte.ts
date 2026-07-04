import { z } from 'zod';

const textoOpcional = (max: number) =>
  z.preprocess((v) => (v === '' || v == null ? null : v), z.string().trim().max(max).nullable());

export const crearCorteSchema = z
  .object({
    modeloVersionId: z.uuid(),
    codigo: textoOpcional(30),
    tallas: z.array(z.number().int().min(0)).min(1, 'Ingresá al menos una talla'),
    cortePorTalla: z.array(z.number().int().min(0, 'Cantidades no negativas')),
    // el PLUS son tallas repetidas para cuadrar docenas; SÍ se paga (CA-2.2)
    plusPorTalla: z.array(z.number().int().min(0)).default([]),
  })
  .refine((d) => d.cortePorTalla.length === d.tallas.length, {
    message: 'Debe haber una cantidad de corte por cada talla',
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
export type AsignacionInput = z.infer<typeof asignacionInputSchema>;
export type ReemplazarAsignacionesInput = z.infer<typeof reemplazarAsignacionesSchema>;
export type AsignarGrupoInput = z.infer<typeof asignarGrupoSchema>;
export type CerrarCorteInput = z.infer<typeof cerrarCorteSchema>;
