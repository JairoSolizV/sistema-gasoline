// Configuración del taller: tope de anticipo (advertencia), diferencial de
// maestro externo y tarifas predeterminadas del servicio de corte, en centavos.
// Cambiar el diferencial afecta SOLO asignaciones nuevas — las guardadas
// conservan su tarifa (CA-4.3); ese invariante vive en el módulo cortes, que
// copia el diferencial a la asignación al crearla. Igual con las tarifas de
// corte: se copian al corte al crearlo (docs/PLAN_SERVICIO_CORTE.md §2).
import type { Configuracion, Prisma } from '@prisma/client';
import {
  CLAVES_TARIFA_CORTE,
  type ConfiguracionDTO,
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
    };
    for (const clave of CLAVES_TARIFA_CORTE) {
      if (input[clave] !== undefined) data[clave] = input[clave];
    }
    return aDTO(await configuracionRepository.actualizar(data));
  },
};
