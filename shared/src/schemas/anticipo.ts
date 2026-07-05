import { z } from 'zod';

const textoOpcional = (max: number) =>
  z.preprocess((v) => (v === '' || v == null ? null : v), z.string().trim().max(max).nullable());

export const crearAnticipoSchema = z.object({
  operarioId: z.uuid(),
  fecha: z.coerce.date(),
  monto: z.number('El monto debe ser un número en centavos').int().min(1, 'El monto debe ser mayor a 0'),
  nota: textoOpcional(120),
});

export const editarAnticipoSchema = z
  .object({
    fecha: z.coerce.date(),
    monto: z.number().int().min(1, 'El monto debe ser mayor a 0'),
    nota: textoOpcional(120),
  })
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, { message: 'Nada que actualizar' });

export const listarAnticiposQuerySchema = z.object({
  operarioId: z.uuid().optional(),
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
});

export type CrearAnticipoInput = z.infer<typeof crearAnticipoSchema>;
export type EditarAnticipoInput = z.infer<typeof editarAnticipoSchema>;
