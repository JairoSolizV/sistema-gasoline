import type { CatalogoArbolDTO } from '@taller/shared';

const igual = (a: string, b: string) =>
  a.toLocaleLowerCase('es') === b.trim().toLocaleLowerCase('es');

/** Tiempo (segundos por prenda) de una operación según el catálogo: manda el de
 *  la pieza; si no tiene, el del proceso. Misma regla que el server al abrir un
 *  corte; acá solo se muestra como referencia. */
export function tiempoDesdeCatalogo(
  arbol: CatalogoArbolDTO | undefined,
  equipo: string,
  proceso: string,
  pieza: string | null | undefined,
): number | null {
  const p = arbol?.maquinas
    .find((m) => igual(m.nombre, equipo))
    ?.procesos.find((x) => igual(x.nombre, proceso));
  if (!p) return null;
  const pz = pieza ? p.piezas.find((x) => igual(x.nombre, pieza)) : undefined;
  return pz?.tiempoSeg ?? p.tiempoSeg ?? null;
}
