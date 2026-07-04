import { z } from 'zod';

const textoOpcional = (max: number) =>
  z.preprocess(
    (v) => (v === '' || v == null ? null : v),
    z.string().trim().max(max).nullable(),
  );

// El CT viaja SIEMPRE en centavos enteros (el cliente convierte con aCentavos).
export const operacionInputSchema = z.object({
  grupo: z.string().trim().min(1, 'El grupo es obligatorio').max(40),
  n: textoOpcional(10),
  equipo: z.string().trim().min(1, 'La máquina es obligatoria').max(40),
  proceso: z.string().trim().min(1, 'El proceso es obligatorio').max(60),
  pieza: textoOpcional(60),
  ct: z
    .number('CT debe ser un número en centavos')
    .int('CT debe ser centavos enteros')
    .min(1, 'CT debe ser mayor a 0'),
});

export const crearModeloSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(80),
  operaciones: z.array(operacionInputSchema).min(1, 'Agregá al menos una operación'),
});

// Nueva versión = copia de la versión origen (la última si no se indica).
export const crearVersionSchema = z.object({
  desdeVersionId: z.uuid().optional(),
  notas: textoOpcional(200),
});

export const editarOperacionSchema = operacionInputSchema
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, { message: 'Nada que actualizar' });

export type OperacionInput = z.infer<typeof operacionInputSchema>;
export type CrearModeloInput = z.infer<typeof crearModeloSchema>;
export type CrearVersionInput = z.infer<typeof crearVersionSchema>;
export type EditarOperacionInput = z.infer<typeof editarOperacionSchema>;
