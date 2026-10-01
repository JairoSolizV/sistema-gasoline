// Medidas de tela (ancho / trazado): metros con 2 decimales ↔ centímetros enteros.
import { describe, expect, test } from 'vitest';
import { formatMetros, metrosACm } from '@taller/shared';

describe('metrosACm', () => {
  test.each([
    ['1.60', 160],
    ['1.6', 160],
    ['5.25', 525],
    ['2', 200],
    ['0.05', 5],
    [' 1,52 ', 152], // coma decimal también
    ['1.15', 115], // sin error de float (1.15 * 100 = 114.999…)
  ])('%s m → %i cm', (texto, cm) => {
    expect(metrosACm(texto)).toBe(cm);
  });

  test.each(['', 'abc', '1.555', '-1', '1.2.3'])('"%s" es inválido', (texto) => {
    expect(metrosACm(texto)).toBeNull();
  });
});

describe('formatMetros', () => {
  test.each([
    [160, '1.60'],
    [525, '5.25'],
    [5, '0.05'],
    [200, '2.00'],
  ])('%i cm → %s m', (cm, texto) => {
    expect(formatMetros(cm)).toBe(texto);
  });
});
