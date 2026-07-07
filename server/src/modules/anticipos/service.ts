// Reglas del módulo: el tope es ADVERTENCIA, no bloqueo (CA-5.6). Puede haber
// varios anticipos por semana (CA-5.5) — no hay unicidad por fecha. DTOs siempre.
import type {
  AnticipoDTO,
  AnticipoGuardadoDTO,
  CrearAnticipoInput,
  EditarAnticipoInput,
} from '@taller/shared';
import { AppError } from '../../middleware/errors.js';
import { exigirFechaSinLiquidar } from '../liquidacion/guards.js';
import { anticiposRepository, type AnticipoConOperario } from './repository.js';

function aDTO(a: AnticipoConOperario): AnticipoDTO {
  return {
    id: a.id,
    operarioId: a.operarioId,
    operarioNombre: a.operario.nombre,
    fecha: a.fecha.toISOString(),
    monto: a.monto,
    nota: a.nota,
  };
}

async function tope(): Promise<number> {
  const config = await anticiposRepository.obtenerConfiguracion();
  return config?.topeAnticipoAdvertencia ?? 200000;
}

async function conAdvertencia(a: AnticipoConOperario): Promise<AnticipoGuardadoDTO> {
  const topeAnticipoAdvertencia = await tope();
  return {
    anticipo: aDTO(a),
    advertenciaTope: a.monto > topeAnticipoAdvertencia,
    topeAnticipoAdvertencia,
  };
}

export const anticiposService = {
  async listar(filtro: {
    operarioId?: string;
    desde?: Date;
    hasta?: Date;
  }): Promise<AnticipoDTO[]> {
    const anticipos = await anticiposRepository.listar(filtro);
    return anticipos.map(aDTO);
  },

  async crear(input: CrearAnticipoInput): Promise<AnticipoGuardadoDTO> {
    const operario = await anticiposRepository.obtenerOperario(input.operarioId);
    if (!operario) throw new AppError('NO_ENCONTRADO', 'Operario no encontrado', 404);
    await exigirFechaSinLiquidar(input.fecha, 'registrar un anticipo');

    const anticipo = await anticiposRepository.crear({
      operarioId: input.operarioId,
      fecha: input.fecha,
      monto: input.monto,
      nota: input.nota ?? null,
    });
    return conAdvertencia(anticipo);
  },

  async editar(id: string, input: EditarAnticipoInput): Promise<AnticipoGuardadoDTO> {
    const actual = await anticiposRepository.obtener(id);
    if (!actual) throw new AppError('NO_ENCONTRADO', 'Anticipo no encontrado', 404);
    // ni tocar uno ya liquidado, ni moverlo hacia un mes ya liquidado
    await exigirFechaSinLiquidar(actual.fecha, 'editar un anticipo');
    if (input.fecha !== undefined) await exigirFechaSinLiquidar(input.fecha, 'mover un anticipo');

    const anticipo = await anticiposRepository.actualizar(id, {
      ...(input.fecha !== undefined ? { fecha: input.fecha } : {}),
      ...(input.monto !== undefined ? { monto: input.monto } : {}),
      ...(input.nota !== undefined ? { nota: input.nota } : {}),
    });
    return conAdvertencia(anticipo);
  },

  async eliminar(id: string): Promise<void> {
    const actual = await anticiposRepository.obtener(id);
    if (!actual) throw new AppError('NO_ENCONTRADO', 'Anticipo no encontrado', 404);
    await exigirFechaSinLiquidar(actual.fecha, 'eliminar un anticipo');
    await anticiposRepository.eliminar(id);
  },
};
