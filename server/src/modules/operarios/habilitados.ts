// Restricción estricta de roles (docs/PLAN_SERVICIO_CORTE.md §3): quien hace una
// tarea tiene que existir, estar activo y tener el oficio. Lo usan cortes
// (costura, cortador, doblador) y modelos (buscador, creador de moldes); la API
// valida aunque la pantalla ya filtre.
import { ETIQUETA_ROL, type RolOperario } from '@taller/shared';
import { AppError } from '../../middleware/errors.js';
import { operariosRepository } from './repository.js';

export async function exigirOperariosHabilitados(
  ids: string[],
  rol: RolOperario,
  para: string,
): Promise<void> {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return;
  const operarios = await operariosRepository.listarPorIds(unicos);
  if (operarios.length !== unicos.length) {
    throw new AppError('NO_ENCONTRADO', 'Algún operario no existe', 404);
  }
  const inactivo = operarios.find((o) => !o.activo);
  if (inactivo) {
    throw new AppError(
      'OPERARIO_INACTIVO',
      `${inactivo.nombre} está dado de baja y no puede ${para}`,
      409,
    );
  }
  const sinRol = operarios.find((o) => !o.roles.includes(rol));
  if (sinRol) {
    throw new AppError(
      'OPERARIO_SIN_ROL',
      `${sinRol.nombre} no tiene el rol "${ETIQUETA_ROL[rol]}" y no puede ${para}. Agregáselo en Operarios.`,
      409,
    );
  }
}
