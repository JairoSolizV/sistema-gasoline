// Restricción estricta de roles (docs/PLAN_SERVICIO_CORTE.md §3): quien hace una
// tarea tiene que existir, estar activo y tener el oficio. Lo usan cortes
// (costura, cortador, doblador) y modelos (buscador, creador de moldes); la API
// valida aunque la pantalla ya filtre.
import { ETIQUETA_ROL, type RolOperario } from '@taller/shared';
import { AppError } from '../../middleware/errors.js';
import { operariosRepository } from './repository.js';

/** `rol` puede ser una lista: alcanza con tener cualquiera de ellos (ej. la
 *  costura la hacen costureros o ayudantes, docs/PLAN_AYUDANTES.md §2.11). */
export async function exigirOperariosHabilitados(
  ids: string[],
  rol: RolOperario | readonly RolOperario[],
  para: string,
): Promise<void> {
  const aceptados: readonly RolOperario[] = typeof rol === 'string' ? [rol] : rol;
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
  const sinRol = operarios.find((o) => !aceptados.some((r) => o.roles.includes(r)));
  if (sinRol) {
    const nombres = aceptados.map((r) => `"${ETIQUETA_ROL[r]}"`).join(' o ');
    throw new AppError(
      'OPERARIO_SIN_ROL',
      `${sinRol.nombre} no tiene el rol ${nombres} y no puede ${para}. Agregáselo en Operarios.`,
      409,
    );
  }
}
