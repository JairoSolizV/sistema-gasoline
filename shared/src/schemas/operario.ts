import { z } from 'zod';

export const tipoOperarioSchema = z.enum(['regular', 'maestro_externo']);

export const crearOperarioSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(60),
  tipo: tipoOperarioSchema.default('regular'),
  fechaIngreso: z.coerce.date().optional(),
});

// PATCH: edición parcial. `activo` es la baja/reactivación lógica (el server
// fija o limpia fechaBaja); nunca existe borrado físico (CA-8.2).
export const editarOperarioSchema = z
  .object({
    nombre: z.string().trim().min(1, 'El nombre no puede quedar vacío').max(60),
    tipo: tipoOperarioSchema,
    activo: z.boolean(),
    fechaIngreso: z.coerce.date(),
  })
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, { message: 'Nada que actualizar' });

export const listarOperariosQuerySchema = z.object({
  estado: z.enum(['activos', 'todos']).default('activos'),
});

export type CrearOperarioInput = z.infer<typeof crearOperarioSchema>;
export type EditarOperarioInput = z.infer<typeof editarOperarioSchema>;
