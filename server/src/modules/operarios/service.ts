// Reglas del módulo: baja/reactivación lógica (CA-8.2) y armado del DTO
// (nunca se devuelve el modelo Prisma crudo — ARQUITECTURA §5.3).
import type { Operario, Prisma } from '@prisma/client';
import type { CrearOperarioInput, EditarOperarioInput, OperarioDTO } from '@taller/shared';
import { AppError } from '../../middleware/errors.js';
import { operariosRepository } from './repository.js';

function aDTO(o: Operario): OperarioDTO {
  return {
    id: o.id,
    nombre: o.nombre,
    tipo: o.tipo,
    activo: o.activo,
    fechaIngreso: o.fechaIngreso.toISOString(),
    fechaBaja: o.fechaBaja ? o.fechaBaja.toISOString() : null,
  };
}

export const operariosService = {
  async listar(estado: 'activos' | 'todos'): Promise<OperarioDTO[]> {
    const operarios = await operariosRepository.listar(estado === 'activos');
    return operarios.map(aDTO);
  },

  async obtener(id: string): Promise<OperarioDTO> {
    const operario = await operariosRepository.obtener(id);
    if (!operario) throw new AppError('NO_ENCONTRADO', 'Operario no encontrado', 404);
    return aDTO(operario);
  },

  async crear(input: CrearOperarioInput): Promise<OperarioDTO> {
    const operario = await operariosRepository.crear({
      nombre: input.nombre,
      tipo: input.tipo,
      ...(input.fechaIngreso ? { fechaIngreso: input.fechaIngreso } : {}),
    });
    return aDTO(operario);
  },

  async editar(id: string, input: EditarOperarioInput): Promise<OperarioDTO> {
    const actual = await operariosRepository.obtener(id);
    if (!actual) throw new AppError('NO_ENCONTRADO', 'Operario no encontrado', 404);

    const data: Prisma.OperarioUpdateInput = {
      ...(input.nombre !== undefined ? { nombre: input.nombre } : {}),
      ...(input.tipo !== undefined ? { tipo: input.tipo } : {}),
      ...(input.fechaIngreso !== undefined ? { fechaIngreso: input.fechaIngreso } : {}),
    };

    // Baja lógica: al desactivar se fija fechaBaja; al reactivar se limpia.
    if (input.activo !== undefined && input.activo !== actual.activo) {
      data.activo = input.activo;
      data.fechaBaja = input.activo ? null : new Date();
    }

    const operario = await operariosRepository.actualizar(id, data);
    return aDTO(operario);
  },
};
