import { z } from 'zod';
import { TITULOS_HILO, type TituloHilo } from '../requerimiento.js';

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
    // costos: margen general del precio de venta, centésimas de % (máx. 1000 %)
    margenVenta: z.number().int().min(0).max(100_000).optional(),
    prendasMesCostoFijo: z.number().int().min(1).max(1_000_000).optional(),
    tasaCambioUsd: z.number().int().min(1).max(10_000_000).optional(), // diezmilésimos
    // requerimiento: máquinas del taller y los conos de cada hilo que llevan
    hilosMaquinas: z
      .array(
        z.object({
          maquina: z.string().trim().min(1, 'Falta el nombre de la máquina').max(40).transform((v) => v.toUpperCase()),
          conos: z.object(
            Object.fromEntries(TITULOS_HILO.map((t) => [t, z.number().int().min(0).max(20)])) as Record<
              TituloHilo,
              z.ZodNumber
            >,
          ),
        }),
      )
      .max(60)
      .optional(),
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
