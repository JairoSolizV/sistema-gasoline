// Costos (docs/PLAN_COSTOS.md §3): fracciones exactas y un solo redondeo. Los
// números salen del corte 31 del catálogo local (tela a $us 3 × 11.85, tizado de
// 10.12 m con 10 prendas por capa, hilos por rendimiento de cono).
import { describe, expect, test } from 'vitest';
import { aBolivianos, costoFicha, costoLinea, precioUnitario, redondear } from '@taller/shared';

// tela MR 11-1: 1 800 m comprados a Bs 35.55 el metro
const tela = precioUnitario({ precioTotal: 6_399_000, cantidad: 1_800_000 });
const cono = (bs: number) => precioUnitario({ precioTotal: bs, cantidad: 1000 }); // 1 cono

describe('compra en dólares', () => {
  test('$us 3.00 × tasa 11.85 = Bs 35.55 (redondeado una vez)', () => {
    expect(aBolivianos(300, 118_500)).toBe(3555);
    expect(aBolivianos(1, 69_600)).toBe(7); // 0.01 $us × 6.96 = 0.0696 Bs → 0.07
  });
});

describe('líneas de la ficha (por prenda)', () => {
  test('tela según tizado: 35.55 × 10.12 m ÷ 10 = 35.9766 → 35.98', () => {
    const c = costoLinea({ tipo: 'tela_tizado', largoMm: 10_120, prendasPorCapa: 10, precio: tela })!;
    expect(redondear(c)).toBe(3598);
  });

  test('hilo: precio del cono ÷ prendas que rinde', () => {
    expect(redondear(costoLinea({ tipo: 'hilo', rendimiento: 100, precio: cono(2800) })!)).toBe(28);
    expect(redondear(costoLinea({ tipo: 'hilo', rendimiento: 600, precio: cono(5500) })!)).toBe(9); // 0.0917
  });

  test('cierre a Bs 200 la caja de 120: 1.6667 → 1.67', () => {
    const cierre = precioUnitario({ precioTotal: 20_000, cantidad: 120_000 });
    expect(redondear(costoLinea({ tipo: 'por_prenda', cantidad: 1000, precio: cierre })!)).toBe(167);
  });

  test('prorrateo: Bs 350 de flete entre 1 690 prendas = 0.2071 → 0.21', () => {
    expect(redondear(costoLinea({ tipo: 'prorrateo', monto: 35_000, prendas: 1690 })!)).toBe(21);
  });

  test('un insumo sin compras no tiene precio', () => {
    expect(costoLinea({ tipo: 'por_prenda', cantidad: 1000, precio: null })).toBeNull();
  });
});

describe('total de la ficha', () => {
  test('se redondea desde la suma exacta, no sumando líneas redondeadas', () => {
    // 3 botones de medio centavo: cada línea muestra 0.01, pero el total es 0.015 → 0.02
    const medio = precioUnitario({ precioTotal: 2, cantidad: 4000 });
    const linea = { tipo: 'por_prenda' as const, cantidad: 1000, precio: medio };
    const r = costoFicha({ lineas: [linea, linea, linea], manoDeObra: 0, empaque: 0, servicioCorte: 0, margen: 0 });
    expect(r.lineas).toEqual([1, 1, 1]);
    expect(r.materiales).toBe(2);
    expect(r.total).toBe(2);
  });

  test('corte 31: tela + popelina + 4 hilos + mano de obra + venta con 30 %', () => {
    const r = costoFicha({
      lineas: [
        { tipo: 'tela_tizado', largoMm: 10_120, prendasPorCapa: 10, precio: tela }, // 35.9766
        {
          tipo: 'tela_tizado',
          largoMm: 1_560,
          prendasPorCapa: 20,
          precio: precioUnitario({ precioTotal: 95_000, cantidad: 100_000 }), // 9.50/m → 0.741
        },
        { tipo: 'hilo', rendimiento: 100, precio: cono(2800) }, // 0.28
        { tipo: 'hilo', rendimiento: 50, precio: cono(2800) }, // 0.56
        { tipo: 'hilo', rendimiento: 600, precio: cono(5500) }, // 0.0917
        { tipo: 'hilo', rendimiento: 100, precio: cono(1125) }, // 0.1125
      ],
      manoDeObra: 714,
      empaque: 100,
      servicioCorte: 80,
      margen: 3000,
    });
    // materiales exactos = 37.761766… → 37.76; total = 46.701766… → 46.70
    expect(r.materiales).toBe(3776);
    expect(r.total).toBe(4670);
    expect(r.precioVenta).toBe(6071); // 46.701766 × 1.30 = 60.712 → 60.71
    expect(r.incompleto).toBe(false);
  });

  test('con una línea sin precio el total queda marcado como incompleto', () => {
    const r = costoFicha({
      lineas: [{ tipo: 'por_prenda', cantidad: 1000, precio: null }, { tipo: 'precio_prenda', precio: 850 }],
      manoDeObra: 0,
      empaque: 0,
      servicioCorte: 0,
      margen: 0,
    });
    expect(r.lineas).toEqual([null, 850]);
    expect(r.total).toBe(850);
    expect(r.incompleto).toBe(true);
  });
});
