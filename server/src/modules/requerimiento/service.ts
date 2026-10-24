// Requerimiento de insumos de un corte (docs/PLAN_REQUERIMIENTO.md). Solo
// consulta: arma los datos del corte, su ficha, los insumos, sus precios y el
// stock, y deja la cuenta a calcularRequerimiento() de shared.
//  - Precio de un envase: el de la última compra × unidades del envase
//    (redondeado una vez); sin compras, el precio de referencia del insumo.
//  - Lo que hay: el stock de Costos MÁS lo que ese stock ya descontó por este
//    mismo corte (si no, lo pediría dos veces).
import { Prisma } from '@prisma/client';
import {
  calcularRequerimiento,
  CANTIDAD_ESCALA,
  costoDeCantidad,
  MAQUINAS_HILO_DEFECTO,
  precioUnitario,
  redondear,
  TITULOS_HILO,
  type CierrePorTalla,
  type ElegirHilosInput,
  type InsumoRequerimiento,
  type MaquinaHilos,
  type RequerimientoCorteDTO,
  type TituloHilo,
} from '@taller/shared';
import { prisma } from '../../lib/prisma.js';
import { diaEnBolivia } from '../../lib/hoy.js';
import { AppError } from '../../middleware/errors.js';
import { configuracionRepository } from '../configuracion/repository.js';
import { costosRepository, type InsumoConCompra } from '../costos/repository.js';
import { consumoDeCorte, fichaDeCorte, stockPorInsumo } from '../costos/produccion.js';

const mismoTitulo = (a: string | null, b: TituloHilo) => a?.toLowerCase() === b.toLowerCase();

function precioDelEnvase(i: InsumoConCompra): number | null {
  const ultima = i.compras[0];
  const u = i.unidadesPorEnvase ?? 1;
  if (ultima) {
    return redondear(costoDeCantidad({ num: BigInt(u * CANTIDAD_ESCALA), den: 1n }, precioUnitario(ultima)));
  }
  return i.precioEnvase;
}

async function corteOError(corteId: string) {
  const corte = await prisma.corte.findUnique({
    where: { id: corteId },
    select: {
      id: true,
      tallas: true,
      cortePorTalla: true,
      plusPorTalla: true,
      hilosRequerimiento: true,
    },
  });
  if (!corte) throw new AppError('NO_ENCONTRADO', 'Corte no encontrado', 404);
  return corte;
}

export const requerimientoService = {
  async obtener(corteId: string): Promise<RequerimientoCorteDTO> {
    const corte = await corteOError(corteId);
    const [insumos, fichas, stock, config, conPrendas] = await Promise.all([
      costosRepository.listarInsumos(),
      costosRepository.listarFichas(),
      stockPorInsumo(),
      configuracionRepository.obtener(),
      costosRepository.cortesParaCosto(corteId, true),
    ]);
    const datosCorte = conPrendas[0];
    const ficha = datosCorte ? fichaDeCorte(datosCorte, fichas) : null;

    // lo que el stock ya descontó por este corte vuelve a estar disponible para él
    const yaDescontado = new Map<string, number>();
    if (ficha && datosCorte && datosCorte.estado !== 'borrador') {
      const dia = diaEnBolivia(datosCorte.fechaInicio);
      for (const [insumoId, cant] of consumoDeCorte(datosCorte, ficha)) {
        const conteo = stock.get(insumoId)?.conteo;
        if (conteo && dia <= conteo.fecha) continue; // el conteo ya lo incluye
        yaDescontado.set(insumoId, redondear(cant));
      }
    }

    const aRequerimiento = (i: InsumoConCompra): InsumoRequerimiento => ({
      id: i.id,
      nombre: i.nombre,
      unidad: i.unidad,
      unidadesPorEnvase: i.unidadesPorEnvase,
      porTalla: i.porTalla,
      precioEnvase: precioDelEnvase(i),
      disponible: (stock.get(i.id)?.stock ?? 0) + (yaDescontado.get(i.id) ?? 0),
    });
    const porId = new Map(insumos.map((i) => [i.id, i]));
    const activos = insumos.filter((i) => i.activo);

    // hilos: el elegido en el corte o, si no, el de la ficha para ese título
    const elegidos = (corte.hilosRequerimiento as Partial<Record<TituloHilo, string | null>> | null) ?? {};
    const deFicha = (t: TituloHilo) =>
      ficha?.lineas.find((l) => l.tipo === 'hilo' && mismoTitulo(l.insumo?.titulo ?? null, t))?.insumoId ??
      null;
    const hilos = TITULOS_HILO.map((titulo) => {
      const id = elegidos[titulo] ?? deFicha(titulo);
      const insumo = id ? (porId.get(id) ?? null) : null;
      return {
        titulo,
        insumo,
        opciones: activos
          .filter((i) => i.categoria === 'hilo' && mismoTitulo(i.titulo, titulo))
          .map((i) => ({ id: i.id, nombre: i.nombre })),
      };
    });

    const cierresPorTalla = (ficha?.cierresPorTalla as CierrePorTalla[] | null) ?? null;
    const maquinas = (config.hilosMaquinas as MaquinaHilos[] | null) ?? MAQUINAS_HILO_DEFECTO;
    const tallas = corte.tallas as number[];
    const plus = corte.plusPorTalla as number[];
    const cantidades = (corte.cortePorTalla as number[]).map((c, i) => c + (plus[i] ?? 0));

    const r = calcularRequerimiento({
      tallas,
      cantidades,
      cierresPorTalla,
      insumoCierre: (cm) => {
        const i = activos.find((x) => x.categoria === 'cierre' && x.medidaCm === cm);
        return i ? aRequerimiento(i) : null;
      },
      maquinas,
      hilos: Object.fromEntries(hilos.map((h) => [h.titulo, h.insumo && aRequerimiento(h.insumo)])),
      avios: (ficha?.lineas ?? [])
        .filter(
          (l) =>
            l.tipo === 'por_prenda' &&
            l.insumo &&
            l.cantidad &&
            l.insumo.categoria !== 'cierre' &&
            l.insumo.categoria !== 'tela',
        )
        .map((l) => ({ insumo: aRequerimiento(porId.get(l.insumoId!)!), cantidad: l.cantidad! })),
    });

    if (!ficha) {
      r.avisos.unshift(
        'El modelo de este corte no tiene ficha de costos: no se calcula el empaque (vinculala en Costos → Fichas)',
      );
    }
    return {
      ...r,
      prendas: cantidades.reduce((a, b) => a + b, 0),
      ficha: ficha && { id: ficha.id, nombre: ficha.nombre },
      reglaCierres: cierresPorTalla ? 'ficha' : 'defecto',
      hilos: hilos.map((h) => ({
        titulo: h.titulo,
        elegido: h.insumo && { id: h.insumo.id, nombre: h.insumo.nombre },
        opciones: h.opciones,
      })),
      maquinas,
    };
  },

  /** Elegir el hilo de cada título para este corte (el color). */
  async elegirHilos(corteId: string, input: ElegirHilosInput): Promise<RequerimientoCorteDTO> {
    await corteOError(corteId);
    for (const titulo of TITULOS_HILO) {
      const id = input.hilos[titulo];
      if (!id) continue;
      const insumo = await prisma.insumo.findUnique({ where: { id } });
      if (!insumo || insumo.categoria !== 'hilo' || !mismoTitulo(insumo.titulo, titulo)) {
        throw new AppError('VALIDACION', `El hilo elegido para ${titulo} no es un hilo ${titulo}`, 400);
      }
    }
    const hilos = Object.fromEntries(
      TITULOS_HILO.filter((t) => input.hilos[t]).map((t) => [t, input.hilos[t]]),
    );
    await prisma.corte.update({
      where: { id: corteId },
      data: { hilosRequerimiento: Object.keys(hilos).length ? hilos : Prisma.DbNull },
    });
    return this.obtener(corteId);
  },
};
