// Calculadora de tendido: cuántas hojas salen de los rollos de tela y cuánto
// sobra. Todo en centímetros enteros (como el dinero en centavos: sin floats).
//
//  1. Cada rollo da hojas enteras: piso(rollo ÷ trazado). Lo que queda al final
//     de cada rollo es un RETAZO más corto que el trazado.
//  2. Con los retazos se arman hojas extra EMPALMANDO hasta 3 pedazos. Cada
//     empalme encima los pedazos un TRASLAPE, así que una hoja de k pedazos
//     necesita: trazado + (k − 1) × traslape.
//  3. Los retazos más cortos que el RETAZO MÍNIMO no sirven para empalmar
//     (se descartan).
//  4. Al empalmar, el último pedazo se corta: lo que le sobra vuelve a ser un
//     retazo (y si alcanza el mínimo, se puede volver a usar).
//
// Estrategia (la que da más hojas): el retazo más largo se combina con el más
// corto que le alcance, así se desperdicia lo menos posible y quedan los
// pedazos grandes para otras hojas. Cuando ya no hay pares posibles, se prueba
// con tres pedazos.

export interface PiezaTendido {
  rollo: number; // número de rollo (1, 2, 3…) de donde viene el pedazo
  cm: number;
  resto: boolean; // es lo que sobró de un empalme anterior
}

export interface RolloTendido {
  rollo: number;
  cm: number;
  hojas: number; // hojas enteras de este rollo
  retazoCm: number; // lo que queda al final del rollo
}

export interface EmpalmeTendido {
  piezas: PiezaTendido[]; // 2 o 3 pedazos
  necesarioCm: number; // trazado + traslapes
  sobranteCm: number; // lo que sobra del último pedazo al cortar
}

export interface ResultadoTendido {
  totalCm: number;
  rollos: RolloTendido[];
  hojasEnteras: number;
  empalmes: EmpalmeTendido[]; // cada uno es una hoja extra
  hojasTotales: number;
  /** Si toda la tela fuera un solo rollo continuo (techo teórico). */
  maximoTeoricoHojas: number;
  sobrantesUtiles: PiezaTendido[]; // ≥ retazo mínimo, sin usar
  sobrantesDescartados: PiezaTendido[]; // < retazo mínimo
  sobranteUtilCm: number;
  descartadoCm: number;
}

export interface DatosTendido {
  rollosCm: number[];
  trazadoCm: number;
  traslapeCm: number;
  retazoMinimoCm: number;
}

export const MAX_PIEZAS_POR_HOJA = 3;

const suma = (piezas: PiezaTendido[]) => piezas.reduce((a, p) => a + p.cm, 0);

export function calcularTendido({
  rollosCm,
  trazadoCm,
  traslapeCm,
  retazoMinimoCm,
}: DatosTendido): ResultadoTendido {
  if (trazadoCm <= 0) throw new Error('El trazado debe ser mayor a 0');

  const rollos: RolloTendido[] = rollosCm.map((cm, i) => {
    const hojas = Math.floor(cm / trazadoCm);
    return { rollo: i + 1, cm, hojas, retazoCm: cm - hojas * trazadoCm };
  });

  const descartados: PiezaTendido[] = [];
  const descartar = (p: PiezaTendido) => {
    if (p.cm > 0) descartados.push(p);
  };

  let pool: PiezaTendido[] = [];
  for (const r of rollos) {
    const pieza = { rollo: r.rollo, cm: r.retazoCm, resto: false };
    if (r.retazoCm >= retazoMinimoCm && r.retazoCm > 0) pool.push(pieza);
    else descartar(pieza);
  }

  const empalmes: EmpalmeTendido[] = [];
  for (;;) {
    pool.sort((a, b) => b.cm - a.cm || a.rollo - b.rollo);
    if (pool.length < 2) break;
    const [mayor, ...resto] = pool;

    // el más corto que, junto al mayor, alcance (resto está de mayor a menor)
    const masCortoQueAlcance = (base: number, candidatos: PiezaTendido[], necesario: number) => {
      for (let i = candidatos.length - 1; i >= 0; i--) {
        if (base + candidatos[i].cm >= necesario) return candidatos[i];
      }
      return undefined;
    };

    let piezas: PiezaTendido[] | null = null;
    let necesario = trazadoCm + traslapeCm;
    const segundo = masCortoQueAlcance(mayor.cm, resto, necesario);
    if (segundo) {
      piezas = [mayor, segundo];
    } else if (MAX_PIEZAS_POR_HOJA >= 3 && resto.length >= 2) {
      necesario = trazadoCm + 2 * traslapeCm;
      const [medio, ...otros] = resto;
      const tercero = masCortoQueAlcance(mayor.cm + medio.cm, otros, necesario);
      if (tercero) piezas = [mayor, medio, tercero];
    }
    if (!piezas) break; // ni el mayor alcanza con nada: no hay más empalmes

    const usadas = piezas;
    const sobranteCm = suma(usadas) - necesario;
    empalmes.push({ piezas: usadas, necesarioCm: necesario, sobranteCm });
    pool = pool.filter((p) => !usadas.includes(p));
    // lo que sobra del último pedazo cortado vuelve a ser un retazo
    const ultimo = usadas[usadas.length - 1];
    const sobra = { rollo: ultimo.rollo, cm: sobranteCm, resto: true };
    if (sobranteCm >= retazoMinimoCm && sobranteCm > 0) pool.push(sobra);
    else descartar(sobra);
  }

  pool.sort((a, b) => a.rollo - b.rollo || b.cm - a.cm);
  descartados.sort((a, b) => a.rollo - b.rollo || b.cm - a.cm);
  const totalCm = rollosCm.reduce((a, c) => a + c, 0);
  const hojasEnteras = rollos.reduce((a, r) => a + r.hojas, 0);
  return {
    totalCm,
    rollos,
    hojasEnteras,
    empalmes,
    hojasTotales: hojasEnteras + empalmes.length,
    maximoTeoricoHojas: Math.floor(totalCm / trazadoCm),
    sobrantesUtiles: pool,
    sobrantesDescartados: descartados,
    sobranteUtilCm: suma(pool),
    descartadoCm: suma(descartados),
  };
}
