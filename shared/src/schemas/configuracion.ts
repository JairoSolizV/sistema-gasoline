import { z } from 'zod';

export const editarConfiguracionSchema = z
  .object({
    topeAnticipoAdvertencia: z.number().int().min(0).optional(),
    diferencialMaestroExterno: z.number().int().min(0).optional(),
    nombreTaller: z
      .preprocess((v) => (v === '' || v == null ? null : v), z.string().trim().max(80).nullable())
      .optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'Nada que actualizar' });

export type EditarConfiguracionInput = z.infer<typeof editarConfiguracionSchema>;
