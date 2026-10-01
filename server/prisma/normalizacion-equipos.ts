// Equivalencias con las que se carga el Excel del taller
// (docs/seed_datos_taller.json → _meta.nota_normalizacion).
//
// El Excel trae el mismo concepto escrito de varias formas: variantes de máquina
// (over/overloc/overlock), plurales distintos ("DELANTERO" y "DELANTEROS"),
// abreviaturas de pieza ("del", "bol") y columnas invertidas. Acá quedan
// unificados, decididos con el dueño el 2026-09-20
// (docs/PLAN_CATALOGO_MAQUINAS.md §11).
//
// Lo que NO se unifica: los números del nombre ("2corrida", "despunte 2",
// "3 pinza", "pretina2", "solap1"/"solap2", "herraje 1"/"herraje 2"). No son
// números de paso — eso va en la columna N — sino segundas pasadas, cantidades
// o piezas distintas, cada una con su propio CT. Unificarlas sería perder el
// dato de qué se cobra.
//
// Esto NO cambia ningún CT: el seed valida al final que las sumas por modelo
// sigan dando 8.10 / 5.97 / 7.68 / 6.29 / 7.18 Bs.
import { normalizarNombreCatalogo, normalizarNombreGrupo } from '@taller/shared';

// Las claves van siempre normalizadas (minúsculas para máquina/proceso/pieza,
// MAYÚSCULAS para grupo): el Excel escribe "SOLO", "ENTREPI" o "Plancha" sin
// criterio, y así una sola entrada del mapa cubre todas las variantes de caja.

/** Variantes del nombre de máquina. */
export const MAPA_EQUIPOS: Record<string, string> = {
  over: 'overlock',
  overloc: 'overlock',
  rect: 'recta',
  // "recta+pres" y "asegurado" no eran máquinas: la primera es recta (con la
  // presilladora anotada en la misma celda) y la segunda es un proceso que
  // quedó escrito en la columna de máquina.
  'recta+pres': 'recta',
  asegurado: 'recta',
  atraqie: 'atraque', // errata de la hoja del clásico
};

/** Grupos que son el mismo bloque escrito distinto. Clave y valor en MAYÚSCULAS.
 *  Las abreviaturas vienen de la hoja del pantalón clásico, donde la columna es
 *  angosta y el grupo se escribió recortado. */
export const MAPA_GRUPOS: Record<string, string> = {
  DELANTERO: 'DELANTEROS',
  CERADO: 'CERRADO', // error de tipeo del Excel original
  TRAS: 'TRASEROS',
  DEL: 'DELANTEROS',
  ENSA: 'ENSAMBLE',
  CERR: 'CERRADO',
  ACAB: 'ACABADO',
  PRESI: 'PRESILLA',
};

/** Procesos equivalentes, por máquina ya normalizada: "maquina|proceso" → proceso. */
export const MAPA_PROCESOS: Record<string, string> = {
  'atraque|atrque': 'atraque', // errata de la hoja del clásico
  'recta|asegurar': 'asegurado',
  'recta|pretina aseg': 'pretina',
  'recta|aleta/ciere': 'aleta',
  'atraque|solo': 'atraque', // el "SOLO" del Excel era un atraque suelto

  // OJO: un número en el nombre NO es el número de paso (ese va en la columna N).
  // "1despunte" y "2corrida" son la primera y la segunda pasada — operaciones
  // distintas, cada una con su CT; "3 pinza" / "5 pinza" es la CANTIDAD de
  // pinzas (por eso valen 0.15 y 0.25). Nunca se unifican con la operación
  // simple: acá solo se les da un formato parejo, con el número al final.
  'recta|1despunte': 'despunte 1',
  'recta|2corrida': 'corrida 2',
  'recta|3 pinza': '3 pinzas',
  'recta|5 pinza': '5 pinzas',
  // 'plana|despunte 1' y 'plana|despunte 2' ya vienen con ese formato
};

/** Casos donde el Excel invirtió las columnas: lo que figura como proceso es en
 *  realidad la pieza. La fila va al proceso real y ese texto pasa a ser la pieza.
 *  `pisar` fuerza la pieza aunque la fila ya traiga una (esa otra era el detalle
 *  de dónde va la pieza, no la pieza en sí). */
export const MAPA_COLUMNAS_INVERTIDAS: Record<
  string,
  { proceso: string; pieza: string; pisar?: boolean }
> = {
  // planchar el bolsillo lateral: "bol latera" era la pieza, no el proceso
  'plancha|bol latera': { proceso: 'planchado', pieza: 'bol latera' },
  // en la atracadora la operación es atracar y la jota es la pieza (las 7 filas
  // son la misma operación: grupo PRESILLA, paso 7, CT 0.06)
  'atraque|jota': { proceso: 'atraque', pieza: 'jota', pisar: true },
};

/** Abreviaturas de pieza que valen en cualquier rama: la columna del Excel es
 *  angosta y el nombre quedó recortado. Ninguna pieza real se llama así. */
export const MAPA_ABREVIATURAS_PIEZA: Record<string, string> = {
  pope: 'popelina',
  bolsill: 'bolsillo',
  delant: 'delantero',
  entrepier: 'entrepierna',
  entrep: 'entrepierna',
  del: 'delantero',
  bol: 'bolsillo',
};

/** Piezas equivalentes, por rama: "maquina|proceso|pieza" → pieza. */
export const MAPA_PIEZAS: Record<string, string> = {
  'recta|colocado|aletacierre': 'aleta cierre',
  // un solo nombre para la entrepierna en la máquina atraque
  'atraque|reloj|y entrep': 'entrepierna',
  'atraque|atraque|entrepi': 'entrepierna',
  'overlock|cerrado|entrep.': 'entrepierna',
};

/** Aplica las cuatro tablas en orden: máquina → grupo → proceso → pieza.
 *  Devuelve los textos ya normalizados (C-2), que es como los guarda la
 *  operación y como el catálogo los va a listar. */
export function normalizarOperacion(cruda: {
  grupo: string;
  equipo: string;
  proceso: string;
  pieza: string | null;
}) {
  const equipoCrudo = normalizarNombreCatalogo(cruda.equipo);
  const equipo = MAPA_EQUIPOS[equipoCrudo] ?? equipoCrudo;

  const grupoCrudo = normalizarNombreGrupo(cruda.grupo);
  const grupo = MAPA_GRUPOS[grupoCrudo] ?? grupoCrudo;

  const procesoCrudo = normalizarNombreCatalogo(cruda.proceso);
  const invertida = MAPA_COLUMNAS_INVERTIDAS[`${equipo}|${procesoCrudo}`];
  const proceso = invertida?.proceso ?? MAPA_PROCESOS[`${equipo}|${procesoCrudo}`] ?? procesoCrudo;

  // salvo que la entrada pida pisarla, si la fila ya traía pieza manda la suya
  const piezaCruda =
    invertida?.pisar === true
      ? invertida.pieza
      : cruda.pieza != null
        ? normalizarNombreCatalogo(cruda.pieza)
        : (invertida?.pieza ?? null);
  const piezaSinAbreviar =
    piezaCruda == null ? null : (MAPA_ABREVIATURAS_PIEZA[piezaCruda] ?? piezaCruda);
  const pieza =
    piezaSinAbreviar == null || piezaSinAbreviar === ''
      ? null
      : (MAPA_PIEZAS[`${equipo}|${proceso}|${piezaSinAbreviar}`] ?? piezaSinAbreviar);

  return { grupo, equipo, proceso, pieza };
}
