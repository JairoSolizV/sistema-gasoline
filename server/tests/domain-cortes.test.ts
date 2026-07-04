// Motor puro de cálculo de cortes y asignaciones (ARQUITECTURA §2.2).
// Cada describe cita el CA que verifica. Todo en centavos enteros.
import { describe, expect, test } from 'vitest';
import { cantidadTotal, sumaCt, tarifaEfectiva, totalAsignacion } from '../src/domain/calculo.js';
import {
  MAX_OPERARIOS_POR_OPERACION,
  puedeCerrarCorte,
  validarMaximoTres,
  validarSumaExacta,
} from '../src/domain/validaciones.js';

describe('CA-2.1 / CA-2.2 — cantidad total del corte (el PLUS se paga)', () => {
  test('CA-2.1: seis tallas de 62 sin PLUS = 372', () => {
    expect(cantidadTotal([62, 62, 62, 62, 62, 62], [])).toBe(372);
  });

  test('CA-2.2: cinco tallas de 62 (310) + PLUS de 62 = 372 (no 310)', () => {
    expect(cantidadTotal([62, 62, 62, 62, 62], [62])).toBe(372);
  });

  test('CA-2.4: seis tallas de 39 = 234', () => {
    expect(cantidadTotal([39, 39, 39, 39, 39, 39], [])).toBe(234);
  });
});

describe('CA-2.3 / CA-2.4 — costo total del corte', () => {
  test('CA-2.3: DOBLE PRET 372 × Bs 8.10 = Bs 3013.20 exactos', () => {
    expect(372 * sumaCt([{ ct: 810 }])).toBe(301320);
  });

  test('CA-2.4: CRUDO SHORT 234 × Bs 6.29 = Bs 1471.86 exactos', () => {
    expect(234 * 629).toBe(147186);
  });
});

describe('CA-3.1 / CA-3.2 — pagos por asignación', () => {
  test('CA-3.1: 372 piezas × ct 0.15 = Bs 55.80', () => {
    expect(totalAsignacion(372, tarifaEfectiva(15, 0))).toBe(5580);
  });

  test('CA-3.2: división 300/72 → Bs 45.00 y Bs 10.80', () => {
    expect(totalAsignacion(300, tarifaEfectiva(15, 0))).toBe(4500);
    expect(totalAsignacion(72, tarifaEfectiva(15, 0))).toBe(1080);
  });
});

describe('CA-3.2 a CA-3.4 — validación de suma exacta', () => {
  test('CA-3.2: 300 + 72 = 372 → asignada', () => {
    const r = validarSumaExacta([300, 72], 372);
    expect(r.estado).toBe('asignada');
    expect(r.asignado).toBe(372);
    expect(r.diferencia).toBe(0);
  });

  test('CA-3.3: 300 + 50 = 350 → parcial, faltan 22', () => {
    const r = validarSumaExacta([300, 50], 372);
    expect(r.estado).toBe('parcial');
    expect(r.diferencia).toBe(22);
  });

  test('CA-3.4: 400 → parcial, sobran 28', () => {
    const r = validarSumaExacta([400], 372);
    expect(r.estado).toBe('parcial');
    expect(r.diferencia).toBe(-28);
  });

  test('sin asignaciones → sin_asignar', () => {
    expect(validarSumaExacta([], 372).estado).toBe('sin_asignar');
  });
});

describe('CA-3.5 — máximo 3 operarios por operación', () => {
  test('3 permitido, 4 no', () => {
    expect(MAX_OPERARIOS_POR_OPERACION).toBe(3);
    expect(validarMaximoTres(3)).toBe(true);
    expect(validarMaximoTres(4)).toBe(false);
  });
});

describe('CA-4.1 / CA-4.2 — maestro externo (+0.10 editable)', () => {
  test('CA-4.1: ct 0.20 + 0.10 = 0.30 → 100 piezas = Bs 30.00', () => {
    expect(tarifaEfectiva(20, 10)).toBe(30);
    expect(totalAsignacion(100, 30)).toBe(3000);
  });

  test('CA-4.2: regular 272 × 0.20 = Bs 54.40; total operación Bs 84.40', () => {
    const regular = totalAsignacion(272, tarifaEfectiva(20, 0));
    const maestro = totalAsignacion(100, tarifaEfectiva(20, 10));
    expect(regular).toBe(5440);
    expect(regular + maestro).toBe(8440);
  });

  test('CA-4.3 (dominio): diferencial editable → 0.15 sobre ct 0.20 = 0.35', () => {
    expect(tarifaEfectiva(20, 15)).toBe(35);
  });
});

describe('CA-8.3 — cierre bloqueado si algo no cuadra', () => {
  test('todas asignadas → puede cerrar', () => {
    expect(puedeCerrarCorte(['asignada', 'asignada', 'asignada'])).toBe(true);
  });

  test('una parcial o sin asignar → no puede cerrar', () => {
    expect(puedeCerrarCorte(['asignada', 'parcial', 'asignada'])).toBe(false);
    expect(puedeCerrarCorte(['asignada', 'sin_asignar'])).toBe(false);
    expect(puedeCerrarCorte([])).toBe(false);
  });
});
