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

// Moldes / patronaje de una versión (docs/PLAN_SERVICIO_CORTE.md §2.9). El tipo
// lo decide el server (v1 = nuevo, otras = modificación); el monto, si no viene,
// sale de Configuración (tarifaMoldeNuevo / tarifaMoldeModificacion).
export const moldeInputSchema = z.object({
  moldistaId: z.uuid('Elegí quién hizo los moldes'),
  fecha: z.coerce.date({ error: 'La fecha de los moldes es obligatoria' }),
  monto: z.number().int().min(0).max(10_000_000).optional(),
});

// Búsqueda del diseño: quién lo encontró, o "sin buscador" (modelo del cliente
// o anterior al módulo). Ninguno = pendiente: un corte interno no podrá cerrarse.
const buscadorCampos = {
  buscadorId: z.uuid().nullable().optional(),
  sinBuscador: z.boolean().default(false),
};
const buscadorCoherente = (o: { buscadorId?: string | null; sinBuscador: boolean }) =>
  !(o.buscadorId && o.sinBuscador);
const MSJ_BUSCADOR = 'Elegí un buscador o marcá "sin buscador", no las dos cosas';

export const crearModeloSchema = z
  .object({
    nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(80),
    operaciones: z.array(operacionInputSchema).min(1, 'Agregá al menos una operación'),
    ...buscadorCampos,
    molde: moldeInputSchema.nullable().optional(), // moldes hechos en el taller → Bs 200
  })
  .refine(buscadorCoherente, { message: MSJ_BUSCADOR, path: ['sinBuscador'] });

// Nueva versión = copia de la versión origen (la última si no se indica).
export const crearVersionSchema = z.object({
  desdeVersionId: z.uuid().optional(),
  notas: textoOpcional(200),
  molde: moldeInputSchema.nullable().optional(), // ¿se modificaron los moldes? → Bs 50
});

export const editarBuscadorSchema = z
  .object({ buscadorId: z.uuid().nullable(), sinBuscador: z.boolean() })
  .refine(buscadorCoherente, { message: MSJ_BUSCADOR, path: ['sinBuscador'] });

export const editarOperacionSchema = operacionInputSchema
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, { message: 'Nada que actualizar' });

export type OperacionInput = z.infer<typeof operacionInputSchema>;
export type CrearModeloInput = z.infer<typeof crearModeloSchema>;
export type CrearVersionInput = z.infer<typeof crearVersionSchema>;
export type MoldeInput = z.infer<typeof moldeInputSchema>;
export type EditarBuscadorInput = z.infer<typeof editarBuscadorSchema>;
export type EditarOperacionInput = z.infer<typeof editarOperacionSchema>;
