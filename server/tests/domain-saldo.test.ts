// Motor puro de saldo y cierre de mes (ARQUITECTURA §2.2). Todo en centavos.
// Cita los CA del grupo 5 (saldos) y 6 (cierre), los de mayor riesgo del sistema.
import { describe, expect, test } from 'vitest';
import {
  calcularCierreMes,
  calcularSaldo,
  ganadoPorPeriodo,
  semanasDelMes,
} from '../src/domain/saldo.js';

describe('CA-5.1 — ganado por período a través de varios cortes cerrados', () => {
  test('suma los totales de asignaciones de cortes cerrados del mes', () => {
    const asigs = [
      { total: 124620, estadoCorte: 'cerrado' as const, fechaCierre: new Date(Date.UTC(2026, 5, 10)) },
      { total: 46500, estadoCorte: 'cerrado' as const, fechaCierre: new Date(Date.UTC(2026, 5, 20)) },
    ];
    expect(ganadoPorPeriodo(asigs, 2026, 6)).toBe(171120);
  });
});

describe('CA-5.2 — solo cuentan cortes cerrados', () => {
  test('un corte abierto (a medias) no entra en el ganado del período', () => {
    const asigs = [
      { total: 124620, estadoCorte: 'cerrado' as const, fechaCierre: new Date(Date.UTC(2026, 5, 10)) },
      { total: 999999, estadoCorte: 'abierto' as const, fechaCierre: null },
    ];
    expect(ganadoPorPeriodo(asigs, 2026, 6)).toBe(124620);
  });
});

describe('CA-5.7 — agrupación por fecha de cierre, no por semana fija', () => {
  test('un corte que cerró el 20 cuenta en el mes del 20, no en otro', () => {
    const asigs = [
      { total: 50000, estadoCorte: 'cerrado' as const, fechaCierre: new Date(Date.UTC(2026, 5, 20)) },
    ];
    expect(ganadoPorPeriodo(asigs, 2026, 6)).toBe(50000);
    expect(ganadoPorPeriodo(asigs, 2026, 5)).toBe(0);
    expect(ganadoPorPeriodo(asigs, 2026, 7)).toBe(0);
  });
});

describe('CA-5.3 / CA-8.4 — saldo = entrada + ganado − anticipos (sin alimentación)', () => {
  test('CA-5.3: 0 + 24360 − 50000 = −25640', () => {
    expect(calcularSaldo(0, 24360, 50000)).toBe(-25640);
  });

  test('arrastre de entrada positiva se suma', () => {
    expect(calcularSaldo(30000, 80000, 20000)).toBe(90000);
  });

  test('CA-8.4: la fórmula NO tiene término de alimentación (comida no descuenta)', () => {
    // 96000 = comida de un mes tipo; el saldo no la resta
    expect(calcularSaldo(0, 96000, 0)).toBe(96000);
  });
});

describe('CA-6.1 / CA-6.2 / CA-5.4 — cierre de mes', () => {
  test('CA-6.1: saldo 80000 sin excepción → paga todo, salida 0', () => {
    expect(calcularCierreMes(80000, false)).toEqual({ pagado: 80000, saldoSalida: 0 });
  });

  test('CA-6.2: saldo 80000, arrastra cobrando 50000 → pagado 50000, salida 30000', () => {
    expect(calcularCierreMes(80000, true, 50000)).toEqual({ pagado: 50000, saldoSalida: 30000 });
  });

  test('CA-5.4: saldo negativo −25640 se arrastra entero (no se paga nada)', () => {
    expect(calcularCierreMes(-25640, false)).toEqual({ pagado: 0, saldoSalida: -25640 });
    // aunque se marque la excepción, un saldo negativo nunca se "paga"
    expect(calcularCierreMes(-25640, true, 0)).toEqual({ pagado: 0, saldoSalida: -25640 });
  });

  test('arrastra pero cobra todo → salida 0', () => {
    expect(calcularCierreMes(80000, true, 80000)).toEqual({ pagado: 80000, saldoSalida: 0 });
  });

  test('pagado propuesto mayor al saldo se recorta al saldo', () => {
    expect(calcularCierreMes(80000, true, 100000)).toEqual({ pagado: 80000, saldoSalida: 0 });
  });
});

describe('semanasDelMes — semanas lunes-sábado que tocan el mes', () => {
  test('cada semana dura 7 días y son contiguas, cubriendo el mes', () => {
    const semanas = semanasDelMes(2026, 6);
    expect(semanas.length).toBeGreaterThanOrEqual(4);
    // la primera semana empieza en lunes on/before el día 1
    expect(semanas[0].inicio.getUTCDay()).toBe(1); // lunes
    expect(semanas[0].inicio.getTime()).toBeLessThanOrEqual(Date.UTC(2026, 5, 1));
    // contiguas: cada inicio = fin exclusivo del anterior
    for (let i = 1; i < semanas.length; i++) {
      expect(semanas[i].inicio.getTime()).toBe(semanas[i - 1].finExclusivo.getTime());
    }
    // la última semana alcanza el último día del mes (30 de junio)
    const ultima = semanas[semanas.length - 1];
    expect(ultima.finExclusivo.getTime()).toBeGreaterThan(Date.UTC(2026, 5, 30));
  });
});
