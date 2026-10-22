// Asistencia diaria de los ayudantes y su sueldo (docs/PLAN_AYUDANTES.md §2-3).
// Reglas: solo lunes a sábado, solo ayudantes, dentro de su ingreso/baja y con
// sueldo vigente ese día; nada en un mes liquidado. El dinero lo calcula el
// dominio compartido (shared/sueldo.ts): exacto y redondeado una sola vez.
import {
  dateADia,
  diaADate,
  minutosPagados,
  repartirSueldo,
  type AsistenciaAyudanteDTO,
  type AsistenciaDiaDTO,
  type MarcarPresentesInput,
  type RegistrarAsistenciaInput,
  type SemanaAsistenciaDTO,
} from '@taller/shared';
import { diaEnBolivia } from '../../lib/hoy.js';
import { AppError } from '../../middleware/errors.js';
import { exigirFechaSinLiquidar } from '../liquidacion/guards.js';
import { liquidacionRepository, mesAnteriorA } from '../liquidacion/repository.js';
import { sueldoVigenteEl } from '../operarios/service.js';
import { asistenciaRepository } from './repository.js';

type Ayudante = {
  id: string;
  nombre: string;
  activo: boolean;
  roles: string[];
  fechaIngreso: Date;
  fechaBaja: Date | null;
  sueldos: { montoSemanal: number; vigenteDesde: Date }[];
};

/** Los 6 días de la semana que empieza en `lunes` ('aaaa-mm-dd'). */
function diasDeSemana(lunes: string): string[] {
  const base = diaADate(lunes);
  return Array.from({ length: 6 }, (_, i) =>
    dateADia(new Date(base.getTime() + i * 86_400_000)),
  );
}

/** Lunes de la semana de un día. */
export function lunesDe(dia: string): string {
  const d = diaADate(dia);
  const desdeLunes = (d.getUTCDay() + 6) % 7; // lunes = 0 … domingo = 6
  return dateADia(new Date(d.getTime() - desdeLunes * 86_400_000));
}

/** ¿El ayudante puede tener ese día marcado? (ingreso, baja y sueldo) */
function habil(a: Ayudante, dia: string): boolean {
  if (dia < diaEnBolivia(a.fechaIngreso)) return false;
  if (a.fechaBaja && dia > diaEnBolivia(a.fechaBaja)) return false;
  return sueldoVigenteEl(a.sueldos, dia) != null;
}

async function mesesBloqueados(): Promise<(dia: string) => boolean> {
  const ultimo = await liquidacionRepository.ultimoPeriodoCerrado();
  return (dia) => {
    if (!ultimo) return false;
    const [anio, mes] = dia.split('-').map(Number);
    return !mesAnteriorA(ultimo.anio, ultimo.mes, anio, mes); // (anio, mes) ≤ último cierre
  };
}

async function exigirAyudanteHabil(operarioId: string, dia: string): Promise<Ayudante> {
  const a = await asistenciaRepository.operarioConSueldos(operarioId);
  if (!a) throw new AppError('NO_ENCONTRADO', 'Operario no encontrado', 404);
  if (!a.roles.includes('ayudante')) {
    throw new AppError('OPERARIO_SIN_ROL', `${a.nombre} no tiene el rol "Ayudante"`, 409);
  }
  if (diaADate(dia).getUTCDay() === 0) {
    throw new AppError('VALIDACION', 'El domingo no se trabaja ni se paga', 400);
  }
  if (dia < diaEnBolivia(a.fechaIngreso)) {
    throw new AppError('VALIDACION', `${a.nombre} todavía no había ingresado ese día`, 400);
  }
  if (a.fechaBaja && dia > diaEnBolivia(a.fechaBaja)) {
    throw new AppError('VALIDACION', `${a.nombre} ya estaba de baja ese día`, 400);
  }
  if (sueldoVigenteEl(a.sueldos, dia) == null) {
    throw new AppError('SIN_SUELDO', `${a.nombre} no tiene sueldo vigente ese día`, 409);
  }
  return a;
}

function filaAyudante(
  a: Ayudante & {
    asistencias: {
      fecha: Date;
      estado: 'trabajo' | 'falta' | 'feriado';
      minutosDescontados: number;
      minutosOperaciones: number;
      nota: string | null;
    }[];
  },
  dias: string[],
  bloqueado: (dia: string) => boolean,
): AsistenciaAyudanteDTO {
  const filas = dias.map((dia) => {
    const reg = a.asistencias.find((x) => dateADia(x.fecha) === dia) ?? null;
    return {
      dia,
      reg,
      sueldoSemanal: sueldoVigenteEl(a.sueldos, dia),
      minutos: reg ? minutosPagados(reg) : 0,
    };
  });
  // dinero de la semana: solo días marcados, repartido por mayor resto
  const marcados = filas.filter((f) => f.reg && f.sueldoSemanal != null);
  const montos = repartirSueldo(
    marcados.map((f) => ({ montoSemanal: f.sueldoSemanal!, minutosPagados: f.minutos })),
  );
  const montoDe = new Map(marcados.map((f, i) => [f.dia, montos[i]]));

  const diasDTO: AsistenciaDiaDTO[] = filas.map((f) => ({
    fecha: f.dia,
    habil: habil(a, f.dia),
    bloqueado: bloqueado(f.dia),
    estado: f.reg?.estado ?? null,
    minutosDescontados: f.reg?.minutosDescontados ?? 0,
    minutosOperaciones: f.reg?.minutosOperaciones ?? 0,
    nota: f.reg?.nota ?? null,
    minutosPagados: f.minutos,
    sueldoSemanal: f.sueldoSemanal,
    monto: montoDe.get(f.dia) ?? 0,
  }));
  return {
    operarioId: a.id,
    nombre: a.nombre,
    activo: a.activo,
    dias: diasDTO,
    totalSemana: montos.reduce((s, m) => s + m, 0),
    diasSinMarcar: diasDTO.filter((d) => d.habil && d.estado == null).length,
  };
}

export const asistenciaService = {
  async semana(lunes: string): Promise<SemanaAsistenciaDTO> {
    const dias = diasDeSemana(lunes);
    const [ayudantes, bloqueado] = await Promise.all([
      asistenciaRepository.ayudantesDeSemana(diaADate(dias[0]), diaADate(dias[5])),
      mesesBloqueados(),
    ]);
    return {
      lunes: dias[0],
      sabado: dias[5],
      ayudantes: ayudantes
        // fuera de la semana por ingreso/baja y sin nada marcado: no se muestra
        .filter((a) => a.asistencias.length > 0 || dias.some((d) => habil(a, d)))
        .map((a) => filaAyudante(a, dias, bloqueado)),
    };
  },

  async registrar(input: RegistrarAsistenciaInput): Promise<SemanaAsistenciaDTO> {
    await exigirAyudanteHabil(input.operarioId, input.fecha);
    const fecha = diaADate(input.fecha);
    await exigirFechaSinLiquidar(fecha, 'marcar asistencia');
    await asistenciaRepository.guardar(input.operarioId, fecha, {
      estado: input.estado,
      minutosDescontados: input.minutosDescontados,
      minutosOperaciones: input.minutosOperaciones,
      nota: input.nota ?? null,
    });
    return this.semana(lunesDe(input.fecha));
  },

  /** Desmarca un día (vuelve a "sin marcar"). */
  async borrar(operarioId: string, dia: string): Promise<SemanaAsistenciaDTO> {
    const fecha = diaADate(dia);
    const actual = await asistenciaRepository.obtener(operarioId, fecha);
    if (!actual) throw new AppError('NO_ENCONTRADO', 'Ese día no estaba marcado', 404);
    await exigirFechaSinLiquidar(fecha, 'cambiar la asistencia');
    await asistenciaRepository.borrar(operarioId, fecha);
    return this.semana(lunesDe(dia));
  },

  /** Todos los ayudantes habilitados ese día y sin marcar → trabajo completo. */
  async marcarPresentes(input: MarcarPresentesInput): Promise<SemanaAsistenciaDTO> {
    if (diaADate(input.fecha).getUTCDay() === 0) {
      throw new AppError('VALIDACION', 'El domingo no se trabaja ni se paga', 400);
    }
    const fecha = diaADate(input.fecha);
    await exigirFechaSinLiquidar(fecha, 'marcar asistencia');
    const ayudantes = await asistenciaRepository.ayudantesDeSemana(fecha, fecha);
    const ids = ayudantes.filter((a) => a.activo && habil(a, input.fecha)).map((a) => a.id);
    if (ids.length > 0) await asistenciaRepository.marcarPresentes(ids, fecha);
    return this.semana(lunesDe(input.fecha));
  },
};
