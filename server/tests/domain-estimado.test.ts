// Estimado de duración del corte (función pura). Solo informativo: no toca pagos.
import { describe, expect, test } from 'vitest';
import { estimarDuracion, tiempoDeOperacion } from '../src/domain/estimado.js';
import { formatDuracion } from '@taller/shared';

describe('estimarDuracion — el corte termina cuando termina el más cargado', () => {
  test('carga = Σ piezas × segundos; duración = la mayor carga', () => {
    const e = estimarDuracion([
      // pinza 20 s: RUBEN 300, CLARIS 72
      {
        etiqueta: 'pinza',
        tiempoSeg: 20,
        estado: 'asignada',
        asignaciones: [
          { operarioId: 'ruben', cantidad: 300 },
          { operarioId: 'claris', cantidad: 72 },
        ],
      },
      // urlado 30 s: CLARIS 372
      {
        etiqueta: 'urlado',
        tiempoSeg: 30,
        estado: 'asignada',
        asignaciones: [{ operarioId: 'claris', cantidad: 372 }],
      },
    ]);
    expect(e.cargas.get('ruben')).toBe(6000); // 300 × 20
    expect(e.cargas.get('claris')).toBe(12600); // 72 × 20 + 372 × 30
    expect(e.duracionSeg).toBe(12600);
    expect(e.operarioMasCargadoId).toBe('claris');
    expect(e.operacionesSinTiempo).toEqual([]);
    expect(e.operacionesSinAsignar).toBe(0);
  });

  test('sin tiempo no suma carga y se avisa; lo no asignado se cuenta aparte', () => {
    const e = estimarDuracion([
      {
        etiqueta: 'boca · bolsillo',
        tiempoSeg: null,
        estado: 'asignada',
        asignaciones: [{ operarioId: 'ruben', cantidad: 372 }],
      },
      { etiqueta: 'pinza', tiempoSeg: 20, estado: 'sin_asignar', asignaciones: [] },
      {
        etiqueta: 'urlado',
        tiempoSeg: 30,
        estado: 'parcial',
        asignaciones: [{ operarioId: 'ruben', cantidad: 100 }],
      },
    ]);
    expect(e.cargas.get('ruben')).toBe(3000); // solo urlado: la boca no tiene tiempo
    expect(e.duracionSeg).toBe(3000);
    expect(e.operacionesSinTiempo).toEqual(['boca · bolsillo']);
    expect(e.operacionesSinAsignar).toBe(2);
  });

  test('nada asignado con tiempo → sin duración', () => {
    const e = estimarDuracion([{ etiqueta: 'pinza', tiempoSeg: 20, estado: 'sin_asignar', asignaciones: [] }]);
    expect(e.duracionSeg).toBeNull();
    expect(e.operarioMasCargadoId).toBeNull();
  });
});

describe('tiempoDeOperacion — manda la pieza; si no, el proceso', () => {
  test.each([
    [20, 25, 25],
    [20, null, 20],
    [null, 25, 25],
    [null, null, null],
    [undefined, undefined, null],
  ])('proceso %s, pieza %s → %s', (proceso, pieza, esperado) => {
    expect(tiempoDeOperacion(proceso, pieza)).toBe(esperado);
  });
});

describe('formatDuracion', () => {
  test.each([
    [45, '45 s'],
    [600, '10 min'],
    [7440, '2 h 04 min'],
    [12600, '3 h 30 min'],
  ])('%i s → %s', (seg, texto) => {
    expect(formatDuracion(seg)).toBe(texto);
  });
});
