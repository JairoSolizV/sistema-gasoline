import { z } from 'zod';

// Tarifas predeterminadas del servicio de corte interno (centavos). Se copian a
// cada corte al crearlo; ahí se editan (docs/PLAN_SERVICIO_CORTE.md §2).
export const CLAVES_TARIFA_CORTE = [
  'tarifaBusqueda',
  'tarifaMoldeNuevo',
  'tarifaMoldeModificacion',
  'tarifaTrazado',
  'tarifaDobladoHoja',
  'tarifaDobladoPares',
  'tarifaCorteRespaldo',
  'tarifaClasificacionRespaldo',
] as const;
export type ClaveTarifaCorte = (typeof CLAVES_TARIFA_CORTE)[number];

const centavos = z.number().int().min(0, 'No puede ser negativa').max(10_000_000);

export const editarConfiguracionSchema = z
  .object({
    topeAnticipoAdvertencia: z.number().int().min(0).optional(),
    diferencialMaestroExterno: z.number().int().min(0).optional(),
    nombreTaller: z
      .preprocess((v) => (v === '' || v == null ? null : v), z.string().trim().max(80).nullable())
      .optional(),
    ...(Object.fromEntries(CLAVES_TARIFA_CORTE.map((k) => [k, centavos.optional()])) as Record<
      ClaveTarifaCorte,
      z.ZodOptional<typeof centavos>
    >),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'Nada que actualizar' });

export type EditarConfiguracionInput = z.infer<typeof editarConfiguracionSchema>;
