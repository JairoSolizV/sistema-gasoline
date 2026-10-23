// Surtido por colores para la lavandería (docs/PLAN_SURTIDO.md). Los casos
// salen de la hoja del dueño "ENSEÑANDO A SURTIR": un corte de 1690 prendas
// (NORMAL 40-46: 169/338/338/169; ESPECIAL 48-54: 169 cada una) en 7, 6, 5 y
// 4 colores.
import { describe, expect, test } from 'vitest';
import { calcularSurtido, tallasEspecialesPorDefecto } from '@taller/shared';

const COLORES = ['VERDE A', 'ENZIMÁTICO', 'BLEACH', 'MAÍS', 'TABACO', 'STONE 4GL', 'MARENGO'];
const TALLAS = [40, 42, 44, 46, 48, 50, 52, 54];
const CORTE = [169, 338, 338, 169, 169, 169, 169, 169];
const SIN_PLUS = CORTE.map(() => 0);

const surtir = (nColores: number, plus = SIN_PLUS) =>
  calcularSurtido({
    tallas: TALLAS,
    cortePorTalla: CORTE,
    plusPorTalla: plus,
    colores: COLORES.slice(0, nColores),
    tallasEspeciales: tallasEspecialesPorDefecto(TALLAS),
  });

describe('surtido de la hoja del dueño', () => {
  test('SUR-1: desde la 48 es ESPECIAL y cada grupo se surte aparte', () => {
    const s = surtir(7);
    expect(s.grupos.map((g) => [g.nombre, g.tallas])).toEqual([
      ['NORMAL', [40, 42, 44, 46]],
      ['ESPECIAL', [48, 50, 52, 54]],
    ]);
    expect(s.grupos.map((g) => g.surtidoDocena)).toEqual([
      [2, 4, 4, 2],
      [3, 3, 3, 3],
    ]);
  });

  test('SUR-2: 7 colores → el primero 25-50-50-25 y los demás 24-48-48-24', () => {
    const [normal, especial] = surtir(7).grupos;
    expect(normal.colores[0].piezas).toEqual([25, 50, 50, 25]);
    for (const c of normal.colores.slice(1)) expect(c.piezas).toEqual([24, 48, 48, 24]);
    expect(normal.colores[0]).toMatchObject({ total: 150, docenas: 12, sueltas: 6 }); // 12.5 doc
    expect(normal.colores[1]).toMatchObject({ total: 144, docenas: 12, sueltas: 0 });
    expect(especial.colores[0].piezas).toEqual([25, 25, 25, 25]);
    expect(especial.colores[0]).toMatchObject({ total: 100, docenas: 8, sueltas: 4 });
  });

  test('SUR-3: 6 y 4 colores, como en la hoja', () => {
    const seis = surtir(6).grupos[0];
    expect(seis.colores.map((c) => c.piezas[0])).toEqual([29, 28, 28, 28, 28, 28]);
    expect(seis.colores[0].total).toBe(174); // 14.5 docenas
    const cuatro = surtir(4).grupos[0];
    expect(cuatro.colores.map((c) => c.piezas[1])).toEqual([86, 84, 84, 84]);
    expect(cuatro.colores[0].total).toBe(258); // 21.5 docenas
  });

  test('SUR-4: 5 colores → lo que sobra va de a 1 (34, 34, 34, 34, 33 juegos)', () => {
    const [normal] = surtir(5).grupos;
    expect(normal.colores.map((c) => c.piezas)).toEqual([
      [34, 68, 68, 34],
      [34, 68, 68, 34],
      [34, 68, 68, 34],
      [34, 68, 68, 34],
      [33, 66, 66, 33],
    ]);
    // cuatro colores en docenas completas
    expect(normal.colores.map((c) => [c.docenas, c.sueltas])).toEqual([
      [17, 0],
      [17, 0],
      [17, 0],
      [17, 0],
      [16, 6],
    ]);
  });

  test('SUR-5: cada talla suma exacto lo del corte, con cualquier cantidad de colores', () => {
    for (let n = 1; n <= 7; n++) {
      const s = surtir(n);
      expect(s.total).toBe(1690);
      for (const g of s.grupos) {
        g.tallas.forEach((_, t) => {
          expect(g.colores.reduce((a, c) => a + c.piezas[t], 0)).toBe(g.cantidades[t]);
        });
      }
      expect(s.porColor.reduce((a, c) => a + c.total, 0)).toBe(1690);
    }
  });

  test('SUR-6: el plus también se lava, y va al color que lleva menos', () => {
    const plus = [0, 0, 6, 0, 0, 0, 0, 0];
    const [normal] = surtir(5, plus).grupos;
    expect(normal.cantidades[2]).toBe(344);
    // 6 ÷ 5 = 1 a cada uno y sobra 1: va al último, que llevaba menos (198)
    expect(normal.colores.map((c) => c.piezas[2])).toEqual([69, 69, 69, 69, 68]);
    expect(normal.colores.map((c) => c.total)).toEqual([205, 205, 205, 205, 200]);
    expect(normal.colores.reduce((a, c) => a + c.piezas[2], 0)).toBe(344);
  });

  test('SUR-7: tallas sin proporción → talla por talla, sin surtido por docena', () => {
    // el COD 23: 118, 121, 121, 122, 119
    const s = calcularSurtido({
      tallas: [30, 32, 34, 36, 38],
      cortePorTalla: [118, 121, 121, 122, 119],
      plusPorTalla: [0, 0, 0, 0, 0],
      colores: ['A', 'B', 'C'],
      tallasEspeciales: [],
    });
    const [g] = s.grupos;
    expect(s.grupos).toHaveLength(1);
    expect(g.surtidoDocena).toBeNull();
    expect(g.total).toBe(601);
    const totales = g.colores.map((c) => c.total);
    expect(Math.max(...totales) - Math.min(...totales)).toBeLessThanOrEqual(1);
  });

  test('SUR-8: sin colores no hay surtido', () => {
    expect(surtir(0)).toEqual({ grupos: [], porColor: [], total: 0 });
  });
});
