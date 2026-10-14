// Tiempo estimado de cada operación según el catálogo (segundos por prenda).
// Sin FK entre operación y catálogo (PLAN_CATALOGO §3): se cruza por el texto
// normalizado máquina|proceso|pieza. Lo usan los cortes al congelar el tiempo.
import { normalizarNombreCatalogo } from '@taller/shared';
import { tiempoDeOperacion } from '../../domain/estimado.js';
import { catalogoRepository } from './repository.js';

interface TextoOperacion {
  equipo: string;
  proceso: string;
  pieza: string | null;
}

/** Devuelve el tiempo de cada operación (mismo orden). Manda el de la pieza;
 *  si no tiene, el del proceso; null si el catálogo no tiene ninguno. */
export async function tiemposDeOperaciones(ops: TextoOperacion[]): Promise<(number | null)[]> {
  if (ops.length === 0) return [];
  const procesos = await catalogoRepository.tiempos();
  const porProceso = new Map<string, number | null>();
  const porPieza = new Map<string, number | null>();
  for (const p of procesos) {
    const clave = `${p.maquina.nombre}|${p.nombre}`;
    porProceso.set(clave, p.tiempoSeg);
    for (const pz of p.piezas) porPieza.set(`${clave}|${pz.nombre}`, pz.tiempoSeg);
  }
  return ops.map((op) => {
    const clave = `${normalizarNombreCatalogo(op.equipo)}|${normalizarNombreCatalogo(op.proceso)}`;
    const pieza = op.pieza ? porPieza.get(`${clave}|${normalizarNombreCatalogo(op.pieza)}`) : null;
    return tiempoDeOperacion(porProceso.get(clave), pieza);
  });
}
