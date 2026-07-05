// Configuración del taller: tope de anticipo (advertencia) y diferencial de
// maestro externo, en centavos. Cambiar el diferencial afecta SOLO asignaciones
// nuevas — las guardadas conservan su tarifa (CA-4.3); ese invariante vive en el
// módulo cortes, que copia el diferencial a la asignación al crearla.
import type { Configuracion } from '@prisma/client';
import type { ConfiguracionDTO, EditarConfiguracionInput } from '@taller/shared';
import { configuracionRepository } from './repository.js';

function aDTO(c: Configuracion): ConfiguracionDTO {
  return {
    topeAnticipoAdvertencia: c.topeAnticipoAdvertencia,
    diferencialMaestroExterno: c.diferencialMaestroExterno,
    nombreTaller: c.nombreTaller,
  };
}

export const configuracionService = {
  async obtener(): Promise<ConfiguracionDTO> {
    return aDTO(await configuracionRepository.obtener());
  },

  async editar(input: EditarConfiguracionInput): Promise<ConfiguracionDTO> {
    await configuracionRepository.obtener(); // garantiza que la fila exista
    const actualizada = await configuracionRepository.actualizar({
      ...(input.topeAnticipoAdvertencia !== undefined
        ? { topeAnticipoAdvertencia: input.topeAnticipoAdvertencia }
        : {}),
      ...(input.diferencialMaestroExterno !== undefined
        ? { diferencialMaestroExterno: input.diferencialMaestroExterno }
        : {}),
      ...(input.nombreTaller !== undefined ? { nombreTaller: input.nombreTaller } : {}),
    });
    return aDTO(actualizada);
  },
};
