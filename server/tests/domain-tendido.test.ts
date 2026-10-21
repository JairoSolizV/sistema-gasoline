// Calculadora de tendido (función pura, en cm). Casos verificados a mano.
import { describe, expect, test } from 'vitest';
import { calcularTendido } from '@taller/shared';

const base = { trazadoCm: 615, traslapeCm: 50, retazoMinimoCm: 50 };

describe('calcularTendido — hojas enteras por rollo y retazos', () => {
  test('cada rollo da piso(rollo ÷ trazado) hojas y deja su retazo', () => {
    // 65 m → 10 hojas + 3.50 · 70 m → 11 + 2.35 · 68 m → 11 + 0.35 (< mínimo)
    const r = calcularTendido({ ...base, rollosCm: [6500, 7000, 6800] });
    expect(r.rollos.map((x) => [x.hojas, x.retazoCm])).toEqual([
      [10, 350],
      [11, 235],
      [11, 35],
    ]);
    expect(r.hojasEnteras).toBe(32);
    // 3.50 + 2.35 = 5.85 < 6.15 + 0.50 → no alcanza para empalmar
    expect(r.empalmes).toEqual([]);
    expect(r.hojasTotales).toBe(32);
    expect(r.maximoTeoricoHojas).toBe(33); // 203 m ÷ 6.15 si fuera un solo rollo
    expect(r.sobrantesUtiles.map((p) => p.cm)).toEqual([350, 235]);
    expect(r.sobrantesDescartados).toEqual([{ rollo: 3, cm: 35, resto: false }]);
    expect([r.sobranteUtilCm, r.descartadoCm]).toEqual([585, 35]);
  });
});

describe('calcularTendido — empalmes', () => {
  test('2 retazos: 4.50 + 3.50 ≥ 6.15 + 0.50 → hoja extra; sobra 1.35 del último', () => {
    const r = calcularTendido({ ...base, rollosCm: [6600, 6500] }); // retazos 450 y 350
    expect(r.hojasEnteras).toBe(20);
    expect(r.empalmes).toEqual([
      {
        piezas: [
          { rollo: 1, cm: 450, resto: false },
          { rollo: 2, cm: 350, resto: false },
        ],
        necesarioCm: 665,
        sobranteCm: 135,
      },
    ]);
    expect(r.hojasTotales).toBe(21);
    expect(r.sobrantesUtiles).toEqual([{ rollo: 2, cm: 135, resto: true }]);
  });

  test('elige el más corto que alcance (menos desperdicio) y deja los grandes para otra hoja', () => {
    // retazos 5.00, 4.00, 3.00, 2.00 · necesario 6.65:
    // 5.00 + 2.00 = 7.00 (no 5.00 + 4.00) → luego 4.00 + 3.00 = 7.00 → 2 hojas extra
    const rollos = [615 + 500, 615 + 400, 615 + 300, 615 + 200];
    const r = calcularTendido({ ...base, rollosCm: rollos });
    expect(r.empalmes.map((e) => e.piezas.map((p) => p.cm))).toEqual([
      [500, 200],
      [400, 300],
    ]);
    expect(r.hojasTotales).toBe(4 + 2);
  });

  test('3 retazos cuando ningún par alcanza: 3.00 + 2.80 + 2.50 ≥ 6.15 + 2 × 0.50', () => {
    const r = calcularTendido({ ...base, rollosCm: [1230 + 300, 1230 + 280, 1230 + 250] });
    expect(r.hojasEnteras).toBe(6);
    expect(r.empalmes).toHaveLength(1);
    expect(r.empalmes[0]).toMatchObject({ necesarioCm: 715, sobranteCm: 115 });
    expect(r.empalmes[0].piezas.map((p) => p.rollo)).toEqual([1, 2, 3]);
    expect(r.hojasTotales).toBe(7);
  });

  test('el retazo mínimo descarta pedazos cortos aunque sumados alcanzaran', () => {
    // retazos 6.00 y 0.80: con mínimo 1.00 el de 0.80 no se usa
    const r = calcularTendido({ ...base, retazoMinimoCm: 100, rollosCm: [615 + 600, 615 + 80] });
    expect(r.empalmes).toEqual([]);
    expect(r.sobrantesDescartados.map((p) => p.cm)).toEqual([80]);
    // con mínimo 0.50 sí: 6.00 + 0.80 = 6.80 ≥ 6.65
    expect(calcularTendido({ ...base, rollosCm: [615 + 600, 615 + 80] }).empalmes).toHaveLength(1);
  });

  test('lo que sobra de un empalme se vuelve a usar si alcanza el mínimo', () => {
    // retazos 6.00, 6.00, 6.00, 1.50 → 6.00 + 1.50 = 7.50 (sobra 0.85 y vuelve al montón)
    // → 6.00 + 0.85 = 6.85 (sobra 0.20 < mínimo, se descarta) → queda un 6.00 suelto
    const r = calcularTendido({ ...base, rollosCm: [615 + 600, 615 + 600, 615 + 600, 615 + 150] });
    expect(r.empalmes).toHaveLength(2);
    expect(r.empalmes[1].piezas).toEqual([
      { rollo: 2, cm: 600, resto: false },
      { rollo: 4, cm: 85, resto: true },
    ]);
    expect(r.sobrantesDescartados).toEqual([{ rollo: 4, cm: 20, resto: true }]);
    expect(r.hojasTotales).toBe(4 + 2);
    expect(r.sobranteUtilCm + r.descartadoCm).toBe(r.totalCm - r.hojasEnteras * 615 - 665 * 2);
  });

  test('el caso del corte 25: 688 m, trazado 6.15 → techo teórico 111 hojas', () => {
    // 10 rollos con los 688 m repartidos: 68.80 m c/u → 11 hojas + 1.15 m cada uno
    const r = calcularTendido({ ...base, rollosCm: Array(10).fill(6880) });
    expect(r.hojasEnteras).toBe(110);
    expect(r.maximoTeoricoHojas).toBe(111);
    // 10 retazos de 1.15: de a 2 no alcanza (2.30), de a 3 tampoco (3.45) → 110
    expect(r.hojasTotales).toBe(110);
    expect(r.sobranteUtilCm).toBe(1150);
  });
});
