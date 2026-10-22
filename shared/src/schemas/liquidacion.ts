import { z } from 'zod';
import { CUENTAS } from '../cuentas.js';

export const consolidadoQuerySchema = z.object({
  anio: z.coerce.number().int().min(2000).max(2100),
  mes: z.coerce.number().int().min(1).max(12),
});

// Cierre de mes: se pagan todos por defecto; `excepciones` marca a quien NO
// cobra todo (viaje/ahorro/urgencia) con el monto que sí cobró (Regla 7.7),
// por cuenta: cada cuenta tiene su propio saldo (PLAN_CUENTAS_SEPARADAS §3).
export const cerrarMesSchema = z.object({
  anio: z.number().int().min(2000).max(2100),
  mes: z.number().int().min(1).max(12),
  excepciones: z
    .array(
      z.object({
        operarioId: z.uuid(),
        cuenta: z.enum(CUENTAS).default('operaciones'),
        pagado: z.number().int().min(0), // centavos efectivamente cobrados
        arrastraSaldo: z.boolean(),
      }),
    )
    .default([]),
});

export type CerrarMesInput = z.infer<typeof cerrarMesSchema>;
