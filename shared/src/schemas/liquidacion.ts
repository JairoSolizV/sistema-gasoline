import { z } from 'zod';

export const consolidadoQuerySchema = z.object({
  anio: z.coerce.number().int().min(2000).max(2100),
  mes: z.coerce.number().int().min(1).max(12),
});

// Cierre de mes: se pagan todos por defecto; `excepciones` marca a quien NO
// cobra todo (viaje/ahorro/urgencia) con el monto que sí cobró (Regla 7.7).
export const cerrarMesSchema = z.object({
  anio: z.number().int().min(2000).max(2100),
  mes: z.number().int().min(1).max(12),
  excepciones: z
    .array(
      z.object({
        operarioId: z.uuid(),
        pagado: z.number().int().min(0), // centavos efectivamente cobrados
        arrastraSaldo: z.boolean(),
      }),
    )
    .default([]),
});

export type CerrarMesInput = z.infer<typeof cerrarMesSchema>;
