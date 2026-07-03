import { describe, expect, test } from 'vitest';
import { aCentavos, formatBs } from '@taller/shared';

describe('aCentavos — conversión a centavos con redondeo half-up único', () => {
  test('convierte strings de montos exactos', () => {
    expect(aCentavos('8.10')).toBe(810);
    expect(aCentavos('0.15')).toBe(15);
    expect(aCentavos('2000')).toBe(200000);
  });

  test('convierte los números del seed sin arrastre de float', () => {
    expect(aCentavos(8.1)).toBe(810);
    expect(aCentavos(5.97)).toBe(597);
    expect(aCentavos(7.68)).toBe(768);
    expect(aCentavos(6.29)).toBe(629);
    expect(aCentavos(7.18)).toBe(718);
    expect(aCentavos(0.29)).toBe(29); // 0.29*100 = 28.999999... en float
  });

  test('maneja negativos (saldos): −256.40 → −25640', () => {
    expect(aCentavos('-256.40')).toBe(-25640);
    expect(aCentavos(-256.4)).toBe(-25640);
  });

  test('redondea half-up (alejándose de cero) a 2 decimales', () => {
    expect(aCentavos(0.005)).toBe(1);
    expect(aCentavos(0.004)).toBe(0);
    expect(aCentavos(-0.005)).toBe(-1);
    expect(aCentavos(1.005)).toBe(101); // trampa clásica: 1.005*100 = 100.4999...
    expect(aCentavos(2.675)).toBe(268);
  });

  test('rechaza entradas inválidas', () => {
    expect(() => aCentavos('12.3.4')).toThrow();
    expect(() => aCentavos('abc')).toThrow();
    expect(() => aCentavos(NaN)).toThrow();
    expect(() => aCentavos(Infinity)).toThrow();
  });
});

describe('formatBs — presentación de centavos como Bs', () => {
  test('formatea con 2 decimales', () => {
    expect(formatBs(810)).toBe('8.10');
    expect(formatBs(0)).toBe('0.00');
    expect(formatBs(5)).toBe('0.05');
  });

  test('agrupa miles con espacio (como el mockup)', () => {
    expect(formatBs(301320)).toBe('3 013.20');
    expect(formatBs(1482060)).toBe('14 820.60');
  });

  test('negativos', () => {
    expect(formatBs(-25640)).toBe('-256.40');
  });

  test('rechaza no enteros', () => {
    expect(() => formatBs(10.5)).toThrow();
  });
});
