// Servicios externos — serigrafía, láser, bordado y lavandería
// (docs/PLAN_CUENTAS_SEPARADAS.md §5): prendas de
// un corte que se mandan a un proveedor. Se paga por prenda (precio copiado del
// proveedor, editable) y se GANA en la fecha de devolución, en la cuenta del
// servicio. Este archivo arma el DTO y valida; el service persiste.
import type { Operario } from '@prisma/client';
import {
  dateADia,
  ETIQUETA_CUENTA,
  SERVICIOS_EXTERNOS,
  TARIFA_SERVICIO,
  type EnvioServicioDTO,
  type ServicioExterno,
} from '@taller/shared';
import { AppError } from '../../middleware/errors.js';
import type { CorteConDetalle } from './repository.js';

export function aEnviosDTO(
  corte: CorteConDetalle,
  liquidado: (fecha: Date) => boolean,
): EnvioServicioDTO[] {
  return corte.envios.map((e) => ({
    id: e.id,
    servicio: e.servicio,
    operario: e.operario,
    cantidad: e.cantidad,
    precioPrenda: e.precioPrenda,
    total: e.total,
    fechaEnvio: dateADia(e.fechaEnvio),
    fechaDevolucion: e.fechaDevolucion ? dateADia(e.fechaDevolucion) : null,
    nota: e.nota,
    bloqueado: e.fechaDevolucion != null && liquidado(e.fechaDevolucion),
  }));
}

/** Σ de los envíos de un servicio (todos, devueltos o no). */
export const costoEnvios = (corte: CorteConDetalle, servicio: ServicioExterno) =>
  corte.envios.filter((e) => e.servicio === servicio).reduce((a, e) => a + e.total, 0);

/** Σ de los envíos de cada servicio externo. */
export const costoExternos = (corte: CorteConDetalle) =>
  Object.fromEntries(SERVICIOS_EXTERNOS.map((s) => [s, costoEnvios(corte, s)])) as Record<
    ServicioExterno,
    number
  >;

/** El proveedor existe, está activo y hace ese servicio. */
export function exigirProveedor(p: Operario | null, servicio: ServicioExterno): Operario {
  if (!p) throw new AppError('NO_ENCONTRADO', 'Proveedor no encontrado', 404);
  if (!p.activo) throw new AppError('OPERARIO_INACTIVO', `${p.nombre} está de baja`, 409);
  if (!p.roles.includes(servicio)) {
    throw new AppError(
      'OPERARIO_SIN_ROL',
      `${p.nombre} no es proveedor de ${ETIQUETA_CUENTA[servicio].toLowerCase()}`,
      409,
    );
  }
  return p;
}

/** Las prendas enviadas a un servicio no pueden pasar de las del corte. */
export function exigirCantidadDisponible(
  corte: CorteConDetalle,
  servicio: ServicioExterno,
  cantidad: number,
  excluirEnvioId?: string,
) {
  const yaEnviadas = corte.envios
    .filter((e) => e.servicio === servicio && e.id !== excluirEnvioId)
    .reduce((a, e) => a + e.cantidad, 0);
  const disponibles = corte.cantidadTotal - yaEnviadas;
  if (cantidad > disponibles) {
    throw new AppError(
      'CANTIDAD_EXCEDIDA',
      `El corte tiene ${corte.cantidadTotal} prendas y ya se mandaron ${yaEnviadas} a ${ETIQUETA_CUENTA[servicio].toLowerCase()}: quedan ${disponibles}`,
      409,
    );
  }
}

/** Precio por prenda: el indicado, o el predeterminado del proveedor. */
export function precioDelEnvio(
  p: Operario,
  servicio: ServicioExterno,
  indicado: number | undefined,
): number {
  const predeterminado = p[TARIFA_SERVICIO[servicio]];
  const precio = indicado ?? predeterminado;
  if (precio == null) {
    throw new AppError(
      'SIN_PRECIO',
      `Indicá el precio por prenda: ${p.nombre} no tiene uno cargado en su ficha`,
      400,
    );
  }
  return precio;
}
