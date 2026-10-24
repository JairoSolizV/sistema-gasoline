// Requerimiento de insumos (docs/PLAN_REQUERIMIENTO.md). Casos de la hoja
// REQUERIMIENTOS del dueño: corte de 1690 prendas (40-46: 169/338/338/169;
// 48-54: 169 cada una), cierres en bolsas de 120 (Bs 170 / 185 / 200), hilos
// por máquina (14 / 16 / 9 / 5 conos a Bs 30 / 28 / 10.50 / 55) y talla tejida
// en rollos de 500 a Bs 10, uno por talla.
import { describe, expect, test } from 'vitest';
import {
  calcularRequerimiento,
  CM_HILO_POR_PRENDA_DEFECTO,
  conosPorConsumo,
  costoLinea,
  redondear,
  rendimientoHilo,
  MAQUINAS_HILO_DEFECTO,
  medidaCierrePorDefecto,
  type EntradaRequerimiento,
  type InsumoRequerimiento,
} from '@taller/shared';

const insumo = (
  id: string,
  precioEnvase: number | null,
  unidadesPorEnvase: number | null = null,
  extra: Partial<InsumoRequerimiento> = {},
): InsumoRequerimiento => ({
  id,
  nombre: id,
  unidad: 'unidad',
  unidadesPorEnvase,
  porTalla: false,
  precioEnvase,
  disponible: 0,
  ...extra,
});

const CIERRES: Record<number, InsumoRequerimiento> = {
  12: insumo('Cierre 12 cm', 17000, 120),
  15: insumo('Cierre 15 cm', 18500, 120),
  18: insumo('Cierre 18 cm', 20000, 120),
};

const entrada = (extra: Partial<EntradaRequerimiento> = {}): EntradaRequerimiento => ({
  tallas: [40, 42, 44, 46, 48, 50, 52, 54],
  cantidades: [169, 338, 338, 169, 169, 169, 169, 169],
  cierresPorTalla: null,
  insumoCierre: (cm) => CIERRES[cm] ?? null,
  maquinas: MAQUINAS_HILO_DEFECTO,
  hilos: {
    '20/3': insumo('Hilo 20/3', 3000),
    '20/2': insumo('Hilo 20/2', 2800),
    '40/2': insumo('Hilo 40/2', 1050),
    Over: insumo('Hilo Over', 5500),
  },
  avios: [],
  cmHiloPorPrenda: CM_HILO_POR_PRENDA_DEFECTO,
  mermaHilo: 0,
  ...extra,
});

const de = (r: ReturnType<typeof calcularRequerimiento>, nombre: string) =>
  r.lineas.find((l) => l.nombre === nombre)!;

describe('requerimiento de la hoja del dueño', () => {
  test('REQ-1: la regla por defecto es la de su hoja', () => {
    expect([40, 42, 44, 46, 48, 50, 52, 54].map(medidaCierrePorDefecto)).toEqual([
      12, 12, 12, 15, 15, 18, 18, 18,
    ]);
  });

  test('REQ-2: cierres en bolsas completas de 120, con lo que sobra', () => {
    const r = calcularRequerimiento(entrada());
    expect(de(r, 'Cierre 12 cm')).toMatchObject({
      detalle: 'tallas 40, 42, 44',
      necesita: 845,
      envases: 8, // 7.04 bolsas → 8
      sobran: 115,
      monto: 136000,
    });
    // en la hoja decía 33.8 bolsas (dividía entre 10): son 338 cierres → 3 bolsas
    expect(de(r, 'Cierre 15 cm')).toMatchObject({ necesita: 338, envases: 3, sobran: 22, monto: 55500 });
    expect(de(r, 'Cierre 18 cm')).toMatchObject({ necesita: 507, envases: 5, sobran: 93, monto: 100000 });
  });

  test('REQ-3: hilos fijos por máquina: 14 / 16 / 9 / 5 conos = Bs 1 237.50', () => {
    const r = calcularRequerimiento(entrada());
    const hilos = r.lineas.filter((l) => l.grupo === 'Hilos');
    expect(hilos.map((l) => l.necesita)).toEqual([14, 16, 9, 5]);
    expect(hilos.reduce((a, l) => a + (l.monto ?? 0), 0)).toBe(123750);
    // no crecen con las prendas
    const chico = calcularRequerimiento(entrada({ cantidades: [10, 20, 20, 10, 0, 0, 0, 0] }));
    expect(chico.lineas.filter((l) => l.grupo === 'Hilos').map((l) => l.necesita)).toEqual([
      14, 16, 9, 5,
    ]);
  });

  test('REQ-4: talla tejida: un rollo de 500 por talla aunque sobre (8 × Bs 10)', () => {
    const talla = insumo('Talla tejida', 1000, 500, { porTalla: true, disponible: 999_000 });
    const r = calcularRequerimiento(entrada({ avios: [{ insumo: talla, cantidad: 1000 }] }));
    expect(de(r, 'Talla tejida')).toMatchObject({
      necesita: 1690,
      hay: null, // no descuenta stock
      envases: 8,
      sobran: 4000 - 1690,
      monto: 8000,
    });
  });

  test('REQ-5: descuenta lo que hay en inventario (nunca negativo)', () => {
    const conStock: Record<number, InsumoRequerimiento> = { ...CIERRES, 12: { ...CIERRES[12], disponible: 100_000 } }; // 100 cierres
    const r = calcularRequerimiento(entrada({ insumoCierre: (cm) => conStock[cm] }));
    expect(de(r, 'Cierre 12 cm')).toMatchObject({ hay: 100, falta: 745, envases: 7, sobran: 95 });

    const sobra: Record<number, InsumoRequerimiento> = { ...CIERRES, 18: { ...CIERRES[18], disponible: 9_999_000 } };
    const r2 = calcularRequerimiento(entrada({ insumoCierre: (cm) => sobra[cm] }));
    expect(de(r2, 'Cierre 18 cm')).toMatchObject({ falta: 0, envases: 0, monto: 0 });
  });

  test('REQ-6: regla propia del modelo (31 CLÁSICO: 46-52 → 15, 54 → 18)', () => {
    const regla = [40, 42, 44, 46, 48, 50, 52, 54].map((talla) => ({
      talla,
      medidaCm: talla <= 44 ? 12 : talla <= 52 ? 15 : 18,
    }));
    const r = calcularRequerimiento(entrada({ cierresPorTalla: regla }));
    expect(de(r, 'Cierre 15 cm')).toMatchObject({ detalle: 'tallas 46, 48, 50, 52', necesita: 676 });
    expect(de(r, 'Cierre 18 cm')).toMatchObject({ detalle: 'talla 54', necesita: 169 });
  });

  test('REQ-7: empaque por prenda en envases; total y avisos', () => {
    const tags = insumo('Tags', 5000, 100);
    const bolsa = insumo('Bolsa', null, 100); // sin precio
    const r = calcularRequerimiento(
      entrada({
        avios: [
          { insumo: tags, cantidad: 1000 },
          { insumo: bolsa, cantidad: 1000 },
        ],
        hilos: {},
      }),
    );
    expect(de(r, 'Tags')).toMatchObject({ necesita: 1690, envases: 17, sobran: 10, monto: 85000 });
    expect(de(r, 'Bolsa')).toMatchObject({ envases: 17, monto: null });
    expect(r.sinPrecio).toBe(1); // la bolsa (los hilos sin elegir van como aviso)
    expect(r.avisos).toContain('Elegí el hilo 20/3 del corte');
    expect(r.total).toBe(136000 + 55500 + 100000 + 85000);
  });

  test('REQ-8: consumo por yardas: 5 200 yd y 12 m por jean → 396 prendas por cono', () => {
    // hoja: 5 200 yd = 4 754.88 m; ÷ 12 m = 396.24 prendas por cono
    expect(conosPorConsumo(396, 1200, 5200)).toBe(1);
    expect(conosPorConsumo(397, 1200, 5200)).toBe(2);
    // 1690 prendas: 20/3 4.27 → 5 · 20/2 6.16 → 7 · 40/2 7.70 → 8 · Over 2.46 → 3
    expect([
      conosPorConsumo(1690, 1200, 5200),
      conosPorConsumo(1690, 2400, 7200),
      conosPorConsumo(1690, 3000, 7200),
      conosPorConsumo(1690, 4800, 36000),
    ]).toEqual([5, 7, 8, 3]);
  });

  test('REQ-9: hilos = el mayor entre la carga de las máquinas y el consumo', () => {
    const conYardas = (id: string, precio: number, yardas: number) =>
      insumo(id, precio, null, { yardasPorCono: yardas });
    const hilos = {
      '20/3': conYardas('Hilo 20/3', 3000, 5200),
      '20/2': conYardas('Hilo 20/2', 2800, 7200),
      '40/2': conYardas('Hilo 40/2', 1050, 7200),
      Over: conYardas('Hilo Over', 5500, 36000),
    };
    // 1690 prendas: el consumo (5/7/8/3) es menor que la carga (14/16/9/5) → manda la carga
    const r = calcularRequerimiento(entrada({ hilos }));
    const hilosDe = (x: typeof r) => x.lineas.filter((l) => l.grupo === 'Hilos');
    expect(hilosDe(r).map((l) => l.necesita)).toEqual([14, 16, 9, 5]);
    expect(hilosDe(r)[0].detalle).toBe('carga de máquinas 14 · consumo 5');

    // un corte de 5 070 prendas (el triple): 20/3 13 < 14, 20/2 19 > 16, 40/2 24 > 9, Over 8 > 5
    const grande = calcularRequerimiento(
      entrada({ hilos, cantidades: [507, 1014, 1014, 507, 507, 507, 507, 507] }),
    );
    expect(hilosDe(grande).map((l) => l.necesita)).toEqual([14, 19, 24, 8]);
    expect(hilosDe(grande)[1].detalle).toBe('carga de máquinas 16 · consumo 19 (manda el consumo)');
    expect(r.avisos.some((a) => a.includes('yardas'))).toBe(false);
  });

  test('REQ-10: la merma (10 %) se suma a los metros por jean', () => {
    // 1690 prendas × 12 m × 1.10 = 22 308 m ÷ 4 754.88 m = 4.69 → 5 (sin merma: 4.27 → 5)
    expect(conosPorConsumo(1690, 1200, 5200, 10)).toBe(5);
    // Over: 1690 × 48 × 1.10 = 89 232 m ÷ 32 918.4 = 2.71 → 3
    expect(conosPorConsumo(1690, 4800, 36000, 10)).toBe(3);
    // 40/2: 1690 × 30 × 1.10 = 55 770 m ÷ 6 583.68 = 8.47 → 9 (sin merma: 8)
    expect(conosPorConsumo(1690, 3000, 7200, 10)).toBe(9);
  });

  test('REQ-11: costo del hilo por metros: 20/3 a Bs 30 rinde 360 prendas con 10 % de merma', () => {
    const { rendimiento, porMetros } = rendimientoHilo({
      titulo: '20/3',
      yardasPorCono: 5200,
      cmPorPrenda: CM_HILO_POR_PRENDA_DEFECTO,
      mermaPct: 10,
      rendimiento: 100, // el "rinde" del costurero ya no se usa
    });
    expect(porMetros).toBe(true);
    expect(Number(rendimiento!.num) / Number(rendimiento!.den)).toBeCloseTo(360.2, 1);
    // Bs 30 por cono (3000 centavos por cono = 3000 por unidad) ÷ 360.2 = 8.33 centavos
    const costo = costoLinea({ tipo: 'hilo', rendimiento: rendimiento!, precio: { num: 3000n, den: 1n } });
    expect(redondear(costo!)).toBe(8);

    // sin yardas, el "rinde" escrito a mano
    const aMano = rendimientoHilo({
      titulo: '20/3',
      yardasPorCono: null,
      cmPorPrenda: CM_HILO_POR_PRENDA_DEFECTO,
      mermaPct: 10,
      rendimiento: 100,
    });
    expect(aMano).toEqual({ rendimiento: { num: 100n, den: 1n }, porMetros: false });
  });
});
