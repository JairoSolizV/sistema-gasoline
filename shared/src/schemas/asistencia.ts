import { z } from 'zod';
import { diaADate, esDiaValido } from '../dias.js';
import { MINUTOS_JORNADA } from '../sueldo.js';

// Asistencia diaria de los ayudantes (docs/PLAN_AYUDANTES.md §2-3).

const diaSchema = z.string().refine(esDiaValido, 'Fecha inválida (aaaa-mm-dd)');
const minutosSchema = z
  .number()
  .int('Los minutos van enteros')
  .min(0, 'No puede ser negativo')
  .max(MINUTOS_JORNADA, `Como máximo ${MINUTOS_JORNADA} minutos (la jornada de 9 h)`);

/** Marca (o corrige) el día de un ayudante. Atrasos/salidas y horas en
 *  operaciones solo tienen sentido si trabajó; falta y feriado van en 0. */
export const registrarAsistenciaSchema = z
  .object({
    operarioId: z.uuid(),
    fecha: diaSchema,
    estado: z.enum(['trabajo', 'falta', 'feriado']),
    minutosDescontados: minutosSchema.default(0),
    minutosOperaciones: minutosSchema.default(0),
    nota: z
      .preprocess((v) => (v === '' || v == null ? null : v), z.string().trim().max(120).nullable())
      .optional(),
  })
  .refine((a) => a.minutosDescontados + a.minutosOperaciones <= MINUTOS_JORNADA, {
    path: ['minutosOperaciones'],
    message: 'Atrasos + horas en operaciones no pueden pasar la jornada (9 h)',
  })
  .refine((a) => a.estado === 'trabajo' || a.minutosDescontados + a.minutosOperaciones === 0, {
    path: ['estado'],
    message: 'Con falta o feriado no se cargan minutos',
  });

const esLunes = (dia: string) => diaADate(dia).getUTCDay() === 1;

export const semanaAsistenciaQuerySchema = z.object({
  lunes: diaSchema.refine(esLunes, 'La semana empieza el lunes'),
});

export const borrarAsistenciaQuerySchema = z.object({
  operarioId: z.uuid(),
  fecha: diaSchema,
});

/** "Marcar todos presentes": los ayudantes habilitados ese día que todavía no
 *  tienen el día marcado quedan como trabajo completo. */
export const marcarPresentesSchema = z.object({ fecha: diaSchema });

export type RegistrarAsistenciaInput = z.infer<typeof registrarAsistenciaSchema>;
export type MarcarPresentesInput = z.infer<typeof marcarPresentesSchema>;
