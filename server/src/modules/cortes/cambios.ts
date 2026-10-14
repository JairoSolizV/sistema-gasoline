// Cambios de último momento a las operaciones de UN corte (máquina que se
// fregó, operación extra, orden distinto…). Tocan solo el snapshot del corte,
// nunca el modelo, y cada uno deja una fila en el historial (CorteCambio).
// Este archivo arma esas filas y las lee de vuelta como DTO.
import type {
  CampoOperacion,
  CorteCambioDTO,
  DetalleCambioCorte,
  OperacionResumenDTO,
} from '@taller/shared';
import type { CambioData, CorteConDetalle, DatosOperacionCorte } from './repository.js';

export const CAMPOS_OPERACION: CampoOperacion[] = ['grupo', 'n', 'equipo', 'proceso', 'pieza', 'ct'];

type OperacionLike = OperacionResumenDTO;
type OperacionConId = OperacionLike & { id: string };

export function etiquetaOperacion(o: { proceso: string; pieza: string | null }): string {
  return o.pieza ? `${o.proceso} · ${o.pieza}` : o.proceso;
}

function resumen(o: OperacionLike): OperacionResumenDTO {
  return { grupo: o.grupo, n: o.n, equipo: o.equipo, proceso: o.proceso, pieza: o.pieza, ct: o.ct };
}

/** Campos que realmente cambian (lo que no viene o es igual se ignora). */
export function camposCambiados(actual: OperacionLike, input: Partial<DatosOperacionCorte>) {
  const campos: Extract<DetalleCambioCorte, { tipo: 'editar' }>['campos'] = [];
  for (const campo of CAMPOS_OPERACION) {
    const nuevo = input[campo];
    if (nuevo === undefined || nuevo === actual[campo]) continue;
    campos.push({ campo, antes: actual[campo], despues: nuevo ?? null });
  }
  return campos;
}

export function cambioEditar(
  op: OperacionConId,
  campos: ReturnType<typeof camposCambiados>,
): CambioData {
  const detalle: DetalleCambioCorte = { tipo: 'editar', campos };
  return {
    tipo: 'editar',
    corteOperacionId: op.id,
    grupo: op.grupo,
    etiqueta: etiquetaOperacion(op),
    detalle,
  };
}

export function cambioAgregarOQuitar(
  tipo: 'agregar' | 'quitar',
  op: OperacionLike,
): Omit<CambioData, 'corteOperacionId'> {
  const detalle: DetalleCambioCorte = { tipo, operacion: resumen(op) };
  return { tipo, grupo: op.grupo, etiqueta: etiquetaOperacion(op), detalle };
}

/** Una fila por grupo cuyo orden cambió, con el antes/después del grupo. La
 *  etiqueta nombra la operación movida cuando se movió una sola (arrastre). */
export function cambiosReorden(actuales: OperacionConId[], nuevas: OperacionConId[]): CambioData[] {
  const grupos = [...new Set(actuales.map((o) => o.grupo))];
  const cambios: CambioData[] = [];
  for (const grupo of grupos) {
    const antes = actuales.filter((o) => o.grupo === grupo);
    const despues = nuevas.filter((o) => o.grupo === grupo);
    if (antes.every((o, i) => o.id === despues[i]?.id)) continue;
    const movida = operacionMovida(antes, despues);
    const detalle: DetalleCambioCorte = {
      tipo: 'reordenar',
      antes: antes.map(etiquetaOperacion),
      despues: despues.map(etiquetaOperacion),
    };
    cambios.push({
      tipo: 'reordenar',
      corteOperacionId: movida?.id ?? null,
      grupo,
      etiqueta: movida ? etiquetaOperacion(movida) : grupo,
      detalle,
    });
  }
  return cambios;
}

/** La operación que, sacándola de ambas listas, las deja iguales (un arrastre). */
function operacionMovida(antes: OperacionConId[], despues: OperacionConId[]) {
  const sin = (lista: OperacionConId[], id: string) => lista.filter((o) => o.id !== id).map((o) => o.id);
  return despues.find((o, i) => {
    if (antes[i]?.id === o.id) return false;
    const a = sin(antes, o.id);
    const d = sin(despues, o.id);
    return a.every((id, j) => id === d[j]);
  });
}

export function aCambiosDTO(corte: CorteConDetalle): CorteCambioDTO[] {
  return corte.cambios.map((c) => ({
    id: c.id,
    fecha: c.fecha.toISOString(),
    grupo: c.grupo,
    etiqueta: c.etiqueta,
    detalle: c.detalle as unknown as DetalleCambioCorte,
  }));
}

/** Marca de cada operación respecto del modelo: agregada en el corte, o con
 *  algún campo distinto al original. El original de cada campo es el "antes"
 *  de su PRIMERA edición (si se editó y se volvió al valor original, no cuenta). */
export function marcasDeOperacion(corte: CorteConDetalle, op: OperacionConId) {
  const propios = corte.cambios
    .filter((c) => c.corteOperacionId === op.id)
    .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  const agregadaEnCorte = propios.some((c) => c.tipo === 'agregar');
  const original = new Map<CampoOperacion, string | number | null>();
  for (const c of propios) {
    const detalle = c.detalle as unknown as DetalleCambioCorte;
    if (detalle.tipo !== 'editar') continue;
    for (const { campo, antes } of detalle.campos) {
      if (!original.has(campo)) original.set(campo, antes);
    }
  }
  const modificadaEnCorte = [...original].some(([campo, antes]) => op[campo] !== antes);
  return { agregadaEnCorte, modificadaEnCorte };
}
