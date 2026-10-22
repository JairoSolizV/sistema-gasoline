// Sueldo de los ayudantes (docs/PLAN_AYUDANTES.md §3): los ejemplos del plan,
// con sueldo semanal de Bs 400 (40 000 centavos).
import { describe, expect, test } from 'vitest';
import {
  minutosPagados,
  repartirSueldo,
  repartirSueldoPorSemana,
  sueldoDelPeriodo,
  type DiaParaSueldo,
} from '@taller/shared';

const dia = (minutos = 540, montoSemanal = 40000): DiaParaSueldo => ({
  montoSemanal,
  minutosPagados: minutos,
});
const semana = (...minutos: number[]) => minutos.map((m) => dia(m));

describe('minutos pagados por día', () => {
  test.each([
    [{ estado: 'trabajo', minutosDescontados: 0, minutosOperaciones: 0 }, 540],
    [{ estado: 'trabajo', minutosDescontados: 20, minutosOperaciones: 0 }, 520],
    [{ estado: 'trabajo', minutosDescontados: 0, minutosOperaciones: 300 }, 240],
    [{ estado: 'trabajo', minutosDescontados: 0, minutosOperaciones: 540 }, 0], // día entero en operaciones
    [{ estado: 'falta', minutosDescontados: 0, minutosOperaciones: 0 }, 0],
    [{ estado: 'feriado', minutosDescontados: 0, minutosOperaciones: 0 }, 540],
  ] as const)('%o → %i', (d, esperado) => {
    expect(minutosPagados(d)).toBe(esperado);
  });
});

describe('sueldo del período (Bs 400 por semana)', () => {
  test('semana completa: exactamente 400.00 (no 6 × 66.67 = 400.02)', () => {
    expect(sueldoDelPeriodo(semana(540, 540, 540, 540, 540, 540))).toBe(40000);
  });

  test('faltó un día: 333.33', () => {
    expect(sueldoDelPeriodo(semana(540, 540, 0, 540, 540, 540))).toBe(33333);
  });

  test('llegó 8:20 un día (20 min): 397.53', () => {
    expect(sueldoDelPeriodo(semana(520, 540, 540, 540, 540, 540))).toBe(39753);
  });

  test('una tarde (5 h) en operaciones: descuenta 37.04 → 362.96', () => {
    expect(sueldoDelPeriodo(semana(540, 540, 540, 240, 540, 540))).toBe(36296);
  });

  test('feriado se paga: igual a la semana completa', () => {
    expect(
      sueldoDelPeriodo([
        dia(minutosPagados({ estado: 'feriado', minutosDescontados: 0, minutosOperaciones: 0 })),
        ...semana(540, 540, 540, 540, 540),
      ]),
    ).toBe(40000);
  });

  test('cambio de sueldo a mitad de semana: 3 días a 400 y 3 a 450 → 425.00', () => {
    expect(
      sueldoDelPeriodo([dia(540), dia(540), dia(540), dia(540, 45000), dia(540, 45000), dia(540, 45000)]),
    ).toBe(42500);
  });

  test('un mes de 4 semanas completas: 1600.00 exactos', () => {
    expect(sueldoDelPeriodo(Array.from({ length: 24 }, () => dia()))).toBe(160000);
  });
});

describe('reparto por día (mayor resto): suma exacta', () => {
  test('semana completa de 400: 4 días de 66.67 y 2 de 66.66 = 400.00', () => {
    const r = repartirSueldo(semana(540, 540, 540, 540, 540, 540));
    expect(r).toEqual([6667, 6667, 6667, 6667, 6666, 6666]);
    expect(r.reduce((a, b) => a + b, 0)).toBe(40000);
  });

  test('con falta y atraso, la suma coincide con el total del período', () => {
    const dias = semana(520, 540, 0, 240, 540, 540);
    const r = repartirSueldo(dias);
    expect(r[2]).toBe(0);
    expect(r.reduce((a, b) => a + b, 0)).toBe(sueldoDelPeriodo(dias));
  });
});

describe('reparto del mes por semana y día (liquidación)', () => {
  // marzo 2032 de lunes a sábado: semana 1 con atraso de 20 min y una falta,
  // semanas 2 a 4 completas y 3 días sueltos al final (29 a 31)
  const mes = [
    ...[520, 540, 0, 540, 540, 540].map((m) => ({ ...dia(m), semana: 'S1' })),
    ...Array.from({ length: 18 }, (_, i) => ({ ...dia(), semana: `S${2 + Math.floor(i / 6)}` })),
    ...[540, 540, 540].map((m) => ({ ...dia(m), semana: 'S5' })),
  ];
  const r = repartirSueldoPorSemana(mes);
  const deSemana = (s: string) => r.filter((_, i) => mes[i].semana === s).reduce((a, b) => a + b, 0);

  test('el mes suma exacto su total, redondeado una sola vez', () => {
    expect(r.reduce((a, b) => a + b, 0)).toBe(sueldoDelPeriodo(mes));
    expect(sueldoDelPeriodo(mes)).toBe(173086); // 40000 × 14020 ÷ 3240 = 1730.864…
  });

  test('cada semana completa paga exactamente Bs 400 (nunca 400.02)', () => {
    expect([deSemana('S2'), deSemana('S3'), deSemana('S4')]).toEqual([40000, 40000, 40000]);
  });

  test('el día de falta queda en 0 y los centavos del redondeo van a semanas incompletas', () => {
    expect(r[2]).toBe(0);
    expect(deSemana('S1') + deSemana('S5')).toBe(173086 - 120000);
  });
});
