// Sueldo de los ayudantes en un MES (docs/PLAN_AYUDANTES.md §3 y §7), para la
// liquidación y la rendición. El total de cada ayudante se redondea UNA vez
// por mes y se reparte entre semanas y luego entre días con el mayor resto
// (shared/sueldo.ts): las semanas suman exacto el mes y una semana completa
// paga exactamente su sueldo.
import {
  dateADia,
  diaADate,
  minutosPagados,
  repartirSueldoPorSemana,
  type EstadoAsistencia,
} from '@taller/shared';
import { diaEnBolivia } from '../../lib/hoy.js';
import { rangoMesUTC } from '../liquidacion/repository.js';
import { sueldoVigenteEl } from '../operarios/service.js';
import { asistenciaRepository } from './repository.js';

/** ¿El ayudante puede tener ese día marcado? (ingreso, baja y sueldo vigente) */
export function habil(
  a: {
    fechaIngreso: Date;
    fechaBaja: Date | null;
    sueldos: { montoSemanal: number; vigenteDesde: Date }[];
  },
  dia: string,
): boolean {
  if (dia < diaEnBolivia(a.fechaIngreso)) return false;
  if (a.fechaBaja && dia > diaEnBolivia(a.fechaBaja)) return false;
  return sueldoVigenteEl(a.sueldos, dia) != null;
}

/** Lunes (aaaa-mm-dd) de la semana de un día: agrupa el reparto por semana. */
function lunesDe(fecha: Date): string {
  const desdeLunes = (fecha.getUTCDay() + 6) % 7;
  return dateADia(new Date(fecha.getTime() - desdeLunes * 86_400_000));
}

export interface DiaSueldo {
  operarioId: string;
  fecha: Date;
  estado: EstadoAsistencia;
  minutosDescontados: number;
  minutosOperaciones: number;
  minutosPagados: number;
  sueldoSemanal: number; // centavos, vigente ese día
  monto: number; // centavos: parte del total del mes
}

/** operarioId ⇒ sus días del mes con el monto de cada uno (Σ = sueldo del mes).
 *  Con operarioId consulta solo ese operario. */
export async function sueldosDelMes(
  anio: number,
  mes: number,
  operarioId?: string,
): Promise<Map<string, DiaSueldo[]>> {
  const { inicio, fin } = rangoMesUTC(anio, mes);
  const registros = await asistenciaRepository.asistenciasDelRango(inicio, fin, operarioId);

  const porOperario = new Map<string, Omit<DiaSueldo, 'monto'>[]>();
  for (const r of registros) {
    const sueldoSemanal = sueldoVigenteEl(r.operario.sueldos, dateADia(r.fecha));
    if (sueldoSemanal == null) continue; // la API no deja marcar sin sueldo vigente
    const lista = porOperario.get(r.operarioId) ?? [];
    lista.push({
      operarioId: r.operarioId,
      fecha: r.fecha,
      estado: r.estado,
      minutosDescontados: r.minutosDescontados,
      minutosOperaciones: r.minutosOperaciones,
      minutosPagados: minutosPagados(r),
      sueldoSemanal,
    });
    porOperario.set(r.operarioId, lista);
  }

  const resultado = new Map<string, DiaSueldo[]>();
  for (const [id, dias] of porOperario) {
    const montos = repartirSueldoPorSemana(
      dias.map((d) => ({
        montoSemanal: d.sueldoSemanal,
        minutosPagados: d.minutosPagados,
        semana: lunesDe(d.fecha),
      })),
    );
    resultado.set(id, dias.map((d, i) => ({ ...d, monto: montos[i] })));
  }
  return resultado;
}

export interface AsistenciaFaltante {
  operarioId: string;
  nombre: string;
  dias: string[]; // 'aaaa-mm-dd' de lunes a sábado sin marcar
}

/** Días hábiles (lunes a sábado, dentro de ingreso/baja y con sueldo) del mes
 *  que cada ayudante todavía no tiene marcados. `hasta` (inclusive) limita a
 *  los días ya pasados, para los avisos del inicio. */
export async function asistenciaFaltante(
  anio: number,
  mes: number,
  hasta?: string,
): Promise<AsistenciaFaltante[]> {
  const { inicio, fin } = rangoMesUTC(anio, mes);
  const ayudantes = await asistenciaRepository.ayudantesConAsistencia(inicio, fin);

  const diasDelMes: string[] = [];
  for (let t = inicio.getTime(); t < fin.getTime(); t += 86_400_000) {
    const dia = dateADia(new Date(t));
    if (diaADate(dia).getUTCDay() === 0) continue; // domingo
    if (hasta && dia > hasta) break;
    diasDelMes.push(dia);
  }

  const faltantes: AsistenciaFaltante[] = [];
  for (const a of ayudantes) {
    const marcados = new Set(a.asistencias.map((x) => dateADia(x.fecha)));
    const dias = diasDelMes.filter((d) => habil(a, d) && !marcados.has(d));
    if (dias.length > 0) faltantes.push({ operarioId: a.id, nombre: a.nombre, dias });
  }
  return faltantes;
}
