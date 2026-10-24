// Configuración del taller: tope de anticipo (advertencia), diferencial de
// maestro externo y tarifas predeterminadas del servicio de corte, en centavos.
// Cambiar el diferencial afecta SOLO asignaciones nuevas — las guardadas
// conservan su tarifa (CA-4.3); ese invariante vive en el módulo cortes, que
// copia el diferencial a la asignación al crearla. Igual con las tarifas de
// corte: se copian al corte al crearlo (docs/PLAN_SERVICIO_CORTE.md §2).
import type { Configuracion, Prisma } from '@prisma/client';
import {
  CLAVES_TARIFA_CORTE,
  MAQUINAS_HILO_DEFECTO,
  type ConfiguracionDTO,
  type MaquinaHilos,
  type EditarConfiguracionInput,
} from '@taller/shared';
import { configuracionRepository } from './repository.js';

function aDTO(c: Configuracion): ConfiguracionDTO {
  return {
    topeAnticipoAdvertencia: c.topeAnticipoAdvertencia,
    diferencialMaestroExterno: c.diferencialMaestroExterno,
    nombreTaller: c.nombreTaller,
    tarifaBusqueda: c.tarifaBusqueda,
    tarifaMoldeNuevo: c.tarifaMoldeNuevo,
    tarifaMoldeModificacion: c.tarifaMoldeModificacion,
    tarifaTrazado: c.tarifaTrazado,
    tarifaDobladoHoja: c.tarifaDobladoHoja,
    tarifaDobladoPares: c.tarifaDobladoPares,
    tarifaCorteRespaldo: c.tarifaCorteRespaldo,
    tarifaClasificacionRespaldo: c.tarifaClasificacionRespaldo,
    margenVenta: c.margenVenta,
    prendasMesCostoFijo: c.prendasMesCostoFijo,
    tasaCambioUsd: c.tasaCambioUsd,
    hilosMaquinas: (c.hilosMaquinas as MaquinaHilos[] | null) ?? MAQUINAS_HILO_DEFECTO,
  };
}

export const configuracionService = {
  async obtener(): Promise<ConfiguracionDTO> {
    return aDTO(await configuracionRepository.obtener());
  },

  async editar(input: EditarConfiguracionInput): Promise<ConfiguracionDTO> {
    await configuracionRepository.obtener(); // garantiza que la fila exista
    const data: Prisma.ConfiguracionUpdateInput = {
      ...(input.topeAnticipoAdvertencia !== undefined
        ? { topeAnticipoAdvertencia: input.topeAnticipoAdvertencia }
        : {}),
      ...(input.diferencialMaestroExterno !== undefined
        ? { diferencialMaestroExterno: input.diferencialMaestroExterno }
        : {}),
      ...(input.nombreTaller !== undefined ? { nombreTaller: input.nombreTaller } : {}),
      ...(input.margenVenta !== undefined ? { margenVenta: input.margenVenta } : {}),
      ...(input.prendasMesCostoFijo !== undefined
        ? { prendasMesCostoFijo: input.prendasMesCostoFijo }
        : {}),
      ...(input.tasaCambioUsd !== undefined ? { tasaCambioUsd: input.tasaCambioUsd } : {}),
      ...(input.hilosMaquinas !== undefined ? { hilosMaquinas: input.hilosMaquinas } : {}),
    };
    for (const clave of CLAVES_TARIFA_CORTE) {
      if (input[clave] !== undefined) data[clave] = input[clave];
    }
    return aDTO(await configuracionRepository.actualizar(data));
  },
};
