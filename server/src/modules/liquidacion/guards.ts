// Guard compartido por cortes y anticipos: ningún movimiento puede caer en un
// mes ya liquidado NI en un mes anterior al último cierre — el consolidado de un
// mes cerrado muestra valores persistidos y los meses vivos solo miran su propio
// rango, así que ese dinero quedaría fuera de toda liquidación (invariantes 5 y 6).
import { AppError } from '../../middleware/errors.js';
import { liquidacionRepository, mesAnteriorA } from './repository.js';

/** Lanza 409 MES_LIQUIDADO si la fecha cae en el mes del último cierre o antes. */
export async function exigirFechaSinLiquidar(fecha: Date, accion: string): Promise<void> {
  const ultimo = await liquidacionRepository.ultimoPeriodoCerrado();
  if (!ultimo) return;
  const anio = fecha.getUTCFullYear();
  const mes = fecha.getUTCMonth() + 1;
  const liquidado = !mesAnteriorA(ultimo.anio, ultimo.mes, anio, mes); // (anio,mes) ≤ último cierre
  if (liquidado) {
    throw new AppError(
      'MES_LIQUIDADO',
      `No se puede ${accion} con fecha ${mes}/${anio}: el último cierre de mes es ${ultimo.mes}/${ultimo.anio} y ese dinero quedaría fuera de toda liquidación. Usá una fecha posterior al último mes cerrado.`,
      409,
    );
  }
}
