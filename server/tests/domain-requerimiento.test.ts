// Requerimiento de insumos (docs/PLAN_REQUERIMIENTO.md). Casos de la hoja
// REQUERIMIENTOS del dueño: corte de 1690 prendas (40-46: 169/338/338/169;
// 48-54: 169 cada una), cierres en bolsas de 120 (Bs 170 / 185 / 200), hilos
// por máquina (14 / 16 / 9 / 5 conos a Bs 30 / 28 / 10.50 / 55) y talla tejida
// en rollos de 500 a Bs 10, uno por talla.
import { describe, expect, test } from 'vitest';
import {
  calcularRequerimiento,
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
});
