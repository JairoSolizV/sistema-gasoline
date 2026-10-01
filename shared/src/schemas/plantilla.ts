import { z } from 'zod';

const textoOpcional = (max: number) =>
  z.preprocess((v) => (v === '' || v == null ? null : v), z.string().trim().max(max).nullable());

// Misma forma que operacionInputSchema, pero el CT es solo una REFERENCIA y es
// opcional: precarga el alta de modelo, donde se confirma o se cambia.
// Viaja en centavos enteros, igual que el ct de los modelos.
export const plantillaOperacionInputSchema = z.object({
  grupo: z.string().trim().min(1, 'El grupo es obligatorio').max(40),
  n: textoOpcional(10),
  equipo: z.string().trim().min(1, 'La máquina es obligatoria').max(40),
  proceso: z.string().trim().min(1, 'El proceso es obligatorio').max(60),
  pieza: textoOpcional(60),
  ctReferencia: z
    .number('El CT de referencia debe ser un número en centavos')
    .int('El CT de referencia debe ser centavos enteros')
    .min(1, 'El CT de referencia debe ser mayor a 0')
    .nullable()
    .optional(),
});

export const crearPlantillaSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(80),
  notas: textoOpcional(200),
  // se puede crear vacía y cargarle las operaciones después
  operaciones: z.array(plantillaOperacionInputSchema).default([]),
});

/** Duplicar: copia las operaciones a una plantilla nueva, que ya no es protegida. */
export const duplicarPlantillaSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(80),
});

export const editarPlantillaSchema = z
  .object({
    nombre: z.string().trim().min(1, 'El nombre no puede quedar vacío').max(80),
    notas: textoOpcional(200),
  })
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, { message: 'Nada que actualizar' });

/** Guardar la lista completa de una vez: es como se edita desde la pantalla
 *  (se agregan, quitan y reordenan filas y recién al final se guarda). */
export const reemplazarOperacionesSchema = z.object({
  operaciones: z.array(plantillaOperacionInputSchema),
});

export const editarPlantillaOperacionSchema = plantillaOperacionInputSchema
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, { message: 'Nada que actualizar' });

export type PlantillaOperacionInput = z.infer<typeof plantillaOperacionInputSchema>;
export type CrearPlantillaInput = z.infer<typeof crearPlantillaSchema>;
export type DuplicarPlantillaInput = z.infer<typeof duplicarPlantillaSchema>;
export type EditarPlantillaInput = z.infer<typeof editarPlantillaSchema>;
export type ReemplazarOperacionesInput = z.infer<typeof reemplazarOperacionesSchema>;
export type EditarPlantillaOperacionInput = z.infer<typeof editarPlantillaOperacionSchema>;
