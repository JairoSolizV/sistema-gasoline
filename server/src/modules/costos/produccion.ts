// Costos etapas 3 y 4 (docs/PLAN_COSTOS.md §7b): stock de insumos, costo real
// de cada corte frente a su ficha y proyección del mes. SOLO CONSULTA: lee
// cortes, asignaciones, trabajos y envíos; nunca los modifica.
import type { Configuracion } from '@prisma/client';
import {
  capasDelTendido,
  consumoLinea,
  costoDeCantidad,
  costoLinea,
  dateADia,
  fijoPorPrenda,
  porPrendas,
  redondear,
  sumarFracciones,
  telaRealCorte,
  type CorteCostoDetalleDTO,
  type CorteCostoResumenDTO,
  esInsumoDeEmpaque,
  type CortePendienteDTO,
  type KardexDTO,
  type Fraccion,
  type NecesidadInsumoDTO,
  type ProyeccionDTO,
  type RubroCostoDTO,
  type StockDTO,
} from '@taller/shared';
import { diaEnBolivia } from '../../lib/hoy.js';
import { costosRepository, type FichaConDatos } from './repository.js';
import { presupuestoFijo } from './fijos.js';
import {
  aLineaParaCosto,
  calcularFicha,
  precioDeLinea,
  rendimientoDeLinea,
} from './service.js';

export type CorteCosto = Awaited<ReturnType<typeof costosRepository.cortesParaCosto>>[number];
const fr = (n: number): Fraccion => ({ num: BigInt(n), den: 1n });

/** La ficha que usa un corte: la vinculada a su modelo (la última actualizada). */
export function fichaDeCorte(c: CorteCosto, fichas: FichaConDatos[]): FichaConDatos | null {
  return (
    fichas
      .filter((f) => f.modeloId === c.version.modeloId)
      .sort((a, b) => b.actualizadoEn.getTime() - a.actualizadoEn.getTime())[0] ?? null
  );
}

/** Índice de la tela principal de la ficha (la primera por tizado). */
const telaPrincipal = (f: FichaConDatos) => f.lineas.findIndex((l) => l.tipo === 'tela_tizado');

/** Material que gastó un corte, por insumo, en milésimas exactas. La tela
 *  principal usa el tizado real si el corte tiene prendas por capa. */
export function consumoDeCorte(c: CorteCosto, f: FichaConDatos): Map<string, Fraccion> {
  const consumo = new Map<string, Fraccion>();
  const principal = telaPrincipal(f);
  f.lineas.forEach((l, i) => {
    if (!l.insumoId) return;
    const real =
      i === principal && c.trazadoCm && c.prendasPorCapa
        ? fr(telaRealCorte(c.trazadoCm, c.cantidadTotal, c.prendasPorCapa))
        : null;
    const gasto =
      real ??
      consumoLinea(
        {
          tipo: l.tipo,
          cantidad: l.cantidad,
          largoMm: l.largoMm,
          prendasPorCapa: l.prendasPorCapa,
          rendimiento: rendimientoDeLinea(l),
        },
        c.cantidadTotal,
      );
    if (gasto) consumo.set(l.insumoId, sumarFracciones([consumo.get(l.insumoId) ?? null, gasto]));
  });
  return consumo;
}

/** Stock de cada insumo: último conteo + compras − consumo de cortes posteriores. */
export async function stockPorInsumo(): Promise<Map<string, StockDTO>> {
  const [compras, conteos, cortes, fichas] = await Promise.all([
    costosRepository.movimientosCompra(),
    costosRepository.ultimosConteos(),
    costosRepository.cortesParaCosto(),
    costosRepository.listarFichas(),
  ]);
  const conteoDe = new Map(conteos.map((c) => [c.insumoId, c]));
  const desde = (insumoId: string) => {
    const c = conteoDe.get(insumoId);
    return c ? dateADia(c.fecha) : null; // los movimientos del MISMO día ya están en el conteo
  };

  const comprado = new Map<string, number>();
  for (const c of compras) {
    const d = desde(c.insumoId);
    if (d && dateADia(c.fecha) <= d) continue;
    comprado.set(c.insumoId, (comprado.get(c.insumoId) ?? 0) + c.cantidad);
  }
  const gastado = new Map<string, Fraccion>();
  for (const c of cortes) {
    const f = fichaDeCorte(c, fichas);
    if (!f) continue;
    const dia = diaEnBolivia(c.fechaInicio);
    for (const [insumoId, cant] of consumoDeCorte(c, f)) {
      const d = desde(insumoId);
      if (d && dia <= d) continue;
      gastado.set(insumoId, sumarFracciones([gastado.get(insumoId) ?? null, cant]));
    }
  }

  const ids = new Set([...comprado.keys(), ...gastado.keys(), ...conteoDe.keys()]);
  const resultado = new Map<string, StockDTO>();
  for (const id of ids) {
    const conteo = conteoDe.get(id);
    const compras = comprado.get(id) ?? 0;
    const consumo = redondear(gastado.get(id) ?? { num: 0n, den: 1n });
    resultado.set(id, {
      conteo: conteo ? { id: conteo.id, fecha: dateADia(conteo.fecha), cantidad: conteo.cantidad } : null,
      compras,
      consumo,
      stock: (conteo?.cantidad ?? 0) + compras - consumo,
    });
  }
  return resultado;
}

export const STOCK_VACIO: StockDTO = { conteo: null, compras: 0, consumo: 0, stock: 0 };

/** Kárdex de un insumo: compras (entran), consumo de cada corte (sale, en la
 *  fecha de inicio del corte) y conteos (el saldo pasa a ser lo contado). Un
 *  conteo va después de los movimientos de su mismo día: ya los incluye, igual
 *  que en el stock. */
export async function kardexInsumo(insumoId: string): Promise<KardexDTO['movimientos']> {
  const [compras, conteos, cortes, fichas] = await Promise.all([
    costosRepository.comprasDeInsumo(insumoId),
    costosRepository.listarConteos(insumoId),
    costosRepository.cortesParaCosto(),
    costosRepository.listarFichas(),
  ]);
  type Renglon = { fecha: string; orden: number; tipo: 'compra' | 'consumo' | 'conteo'; detalle: string; cantidad: number };
  const renglones: Renglon[] = [
    ...compras.map((c) => ({
      fecha: dateADia(c.fecha),
      orden: 0,
      tipo: 'compra' as const,
      detalle: `${c.tienda}${c.codigoCorte ? ` · para el COD ${c.codigoCorte}` : ''}`,
      cantidad: c.cantidad,
    })),
    ...conteos.map((c) => ({
      fecha: dateADia(c.fecha),
      orden: 1,
      tipo: 'conteo' as const,
      detalle: c.notas ?? 'conteo físico',
      cantidad: c.cantidad,
    })),
  ];
  for (const c of cortes) {
    const f = fichaDeCorte(c, fichas);
    const gasto = f && consumoDeCorte(c, f).get(insumoId);
    if (!gasto) continue;
    renglones.push({
      fecha: diaEnBolivia(c.fechaInicio),
      orden: 0,
      tipo: 'consumo',
      detalle: `COD ${c.codigo} · ${c.version.modelo.nombre} (${c.cantidadTotal} prendas)`,
      cantidad: redondear(gasto),
    });
  }
  renglones.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.orden - b.orden);

  let saldo = 0;
  return renglones.map((r) => {
    if (r.tipo === 'conteo') {
      const diferencia = r.cantidad - saldo;
      saldo = r.cantidad;
      return { fecha: r.fecha, tipo: r.tipo, detalle: r.detalle, entrada: null, salida: null, saldo, diferencia };
    }
    saldo += r.tipo === 'compra' ? r.cantidad : -r.cantidad;
    return {
      fecha: r.fecha,
      tipo: r.tipo,
      detalle: r.detalle,
      entrada: r.tipo === 'compra' ? r.cantidad : null,
      salida: r.tipo === 'consumo' ? r.cantidad : null,
      saldo,
      diferencia: null,
    };
  });
}

// ── Costo real del corte ──

/** Lo que cuesta (o costará al cerrar) la costura o el empaque del corte:
 *  lo asignado (con el diferencial de maestro) + lo que falta asignar × CT. */
function manoDeObraReal(c: CorteCosto, empaque: boolean): number {
  return c.operaciones
    .filter((o) => o.esEmpaque === empaque)
    .reduce((acc, o) => {
      const asignado = o.asignaciones.reduce((a, x) => a + x.cantidad, 0);
      const pagado = o.asignaciones.reduce((a, x) => a + x.total, 0);
      return acc + pagado + Math.max(0, o.cantidadObjetivo - asignado) * o.ct;
    }, 0);
}

export function costoRealCorte(
  c: CorteCosto,
  f: FichaConDatos | null,
  config: Configuracion,
): CorteCostoDetalleDTO {
  const prendas = c.cantidadTotal;
  const avisos: string[] = [];
  const rubros: RubroCostoDTO[] = [];
  const total = (x: Fraccion | null) => (x ? redondear(x) : null);

  // materiales y externos de la ficha, para todas las prendas
  let telaFicha: Fraccion | null = null;
  let telaReal: Fraccion | null = null;
  let telaNota: string | null = null;
  let telaRealDTO: CorteCostoDetalleDTO['telaReal'] = null;
  const otrosMateriales: (Fraccion | null)[] = [];
  const externos: (Fraccion | null)[] = [];
  const logistica: (Fraccion | null)[] = [];
  let sinPrecio = false;
  if (f) {
    const principal = telaPrincipal(f);
    f.lineas.forEach((l, i) => {
      const porPrenda = costoLinea(aLineaParaCosto(l));
      if (porPrenda === null) sinPrecio = true;
      const todas = porPrenda && porPrendas(porPrenda, prendas);
      if (i === principal) {
        telaFicha = todas;
        const precio = precioDeLinea(l);
        if (c.trazadoCm && c.prendasPorCapa && precio) {
          const metros = telaRealCorte(c.trazadoCm, prendas, c.prendasPorCapa);
          telaReal = costoDeCantidad({ num: BigInt(metros), den: 1n }, precio);
          telaRealDTO = { metros, capas: capasDelTendido(prendas, c.prendasPorCapa) };
          telaNota = `tizado real: ${(metros / 1000).toLocaleString('es-BO')} m (${telaRealDTO.capas} capas)`;
        } else {
          telaReal = todas; // sin tizado real: la tela de la ficha
          avisos.push('Sin prendas por capa en el tendido: la tela se calcula con el consumo de la ficha.');
        }
      } else if (l.tipo === 'precio_prenda') externos.push(todas);
      else if (l.tipo === 'prorrateo') logistica.push(todas);
      else otrosMateriales.push(todas);
    });
    if (sinPrecio) avisos.push('La ficha tiene insumos sin precio: los materiales están incompletos.');
  } else {
    avisos.push('El modelo no tiene ficha de costo vinculada: solo se ve lo que se pagó.');
  }

  const costura = manoDeObraReal(c, false);
  const empaque = manoDeObraReal(c, true);
  const servicio = c.trabajos.reduce((a, t) => a + t.total, 0);
  const enviosTotal = c.envios.reduce((a, e) => a + e.total, 0);
  const fichaCalculo = f ? calcularFicha(f, config) : null;

  rubros.push({ rubro: 'tela', ficha: total(telaFicha), real: total(telaReal), nota: telaNota });
  rubros.push({
    rubro: 'materiales',
    ficha: f ? redondear(sumarFracciones(otrosMateriales)) : null,
    real: f ? redondear(sumarFracciones(otrosMateriales)) : null, // los avíos se toman de la ficha
    nota: f ? 'hilos, cierres y avíos según la ficha' : null,
  });
  rubros.push({
    rubro: 'externos',
    ficha: f ? redondear(sumarFracciones(externos)) : null,
    real: enviosTotal,
    nota: 'real = envíos a lavandería y bordado del corte',
  });
  rubros.push({
    rubro: 'logistica',
    ficha: f ? redondear(sumarFracciones(logistica)) : null,
    real: f ? redondear(sumarFracciones(logistica)) : null,
    nota: null,
  });
  rubros.push({
    rubro: 'costura',
    ficha: fichaCalculo ? fichaCalculo.manoDeObra * prendas : null,
    real: costura,
    nota: c.estado === 'abierto' ? 'lo asignado y, lo que falta, a su CT' : null,
  });
  rubros.push({
    rubro: 'empaque',
    ficha: fichaCalculo ? fichaCalculo.empaque * prendas : null,
    real: empaque,
    nota: null,
  });
  rubros.push({
    rubro: 'servicio_corte',
    ficha: fichaCalculo ? fichaCalculo.servicioCorte * prendas : null,
    real: servicio,
    nota: null,
  });

  const realTotal = rubros.reduce((a, r) => a + (r.real ?? 0), 0);
  const fichaTotal = f ? rubros.reduce((a, r) => a + (r.ficha ?? 0), 0) : null;
  return {
    corteId: c.id,
    codigo: c.codigo,
    modeloNombre: c.version.modelo.nombre,
    estado: c.estado as 'abierto' | 'cerrado',
    prendas,
    ficha: f && { id: f.id, nombre: f.nombre },
    realPorPrenda: Math.round(realTotal / prendas),
    fichaPorPrenda: fichaTotal != null ? Math.round(fichaTotal / prendas) : null,
    rubros,
    realTotal,
    fichaTotal,
    telaReal: telaRealDTO,
    avisos,
  };
}

/** Partes del costo de un corte para el camino de la plata: materia prima
 *  (tela real), insumos de costura y de empaque (de la ficha), mano de obra,
 *  servicio de corte y servicios externos (envíos reales o, si no hay, la
 *  ficha). Todo en centavos para todas las prendas del corte. */
export function partesDeCorte(c: CorteCosto, f: FichaConDatos | null, config: Configuracion) {
  const d = costoRealCorte(c, f, config);
  const rubro = (r: RubroCostoDTO['rubro']) => d.rubros.find((x) => x.rubro === r)?.real ?? 0;
  const costura: (Fraccion | null)[] = [];
  const empaque: (Fraccion | null)[] = [];
  const telas: (Fraccion | null)[] = [];
  const externos: (Fraccion | null)[] = [];
  if (f) {
    const principal = telaPrincipal(f);
    f.lineas.forEach((l, i) => {
      if (i === principal) return; // la tela principal va con el tizado real
      const porPrenda = costoLinea(aLineaParaCosto(l));
      const todas = porPrenda && porPrendas(porPrenda, c.cantidadTotal);
      if (l.tipo === 'precio_prenda') externos.push(todas);
      else if (l.tipo === 'prorrateo') empaque.push(todas);
      else if (l.insumo?.categoria === 'tela') telas.push(todas);
      else if (l.insumo && esInsumoDeEmpaque(l.insumo.categoria, l.insumo.nombre)) empaque.push(todas);
      else costura.push(todas);
    });
  }
  const enviosTotal = c.envios.reduce((a, e) => a + e.total, 0);
  return {
    detalle: d,
    materiaPrima: rubro('tela') + redondear(sumarFracciones(telas)),
    insumosCostura: redondear(sumarFracciones(costura)),
    insumosEmpaque: redondear(sumarFracciones(empaque)),
    servicioCorte: rubro('servicio_corte'),
    manoCostura: rubro('costura'),
    manoEmpaque: rubro('empaque'),
    externos: enviosTotal > 0 ? enviosTotal : redondear(sumarFracciones(externos)),
    externosPendientes: c.envios.filter((e) => !e.fechaDevolucion).reduce((a, e) => a + e.total, 0),
  };
}

export function aResumenCorte(d: CorteCostoDetalleDTO): CorteCostoResumenDTO {
  return {
    corteId: d.corteId,
    codigo: d.codigo,
    modeloNombre: d.modeloNombre,
    estado: d.estado,
    prendas: d.prendas,
    ficha: d.ficha,
    realPorPrenda: d.realPorPrenda,
    fichaPorPrenda: d.fichaPorPrenda,
  };
}

// ── Proyección del mes ──

export async function proyeccion(
  anio: number,
  mes: number,
  config: Configuracion,
): Promise<ProyeccionDTO> {
  const [plan, fichas, stock, cortes, presupuesto] = await Promise.all([
    costosRepository.obtenerPlan(anio, mes),
    costosRepository.listarFichas(),
    stockPorInsumo(),
    costosRepository.cortesParaCosto(),
    presupuestoFijo(),
  ]);
  const fijo = fijoPorPrenda(presupuesto, config.prendasMesCostoFijo);
  const avisos: string[] = [];
  const porId = new Map(fichas.map((f) => [f.id, f]));

  // material necesario y plata para producir, por ficha del plan
  const necesario = new Map<string, Fraccion>();
  const insumoInfo = new Map<string, { nombre: string; unidad: string; precio: Fraccion | null }>();
  const producir: Fraccion[] = [];
  const planDTO: ProyeccionDTO['plan'] = [];
  for (const item of plan) {
    const f = porId.get(item.fichaId);
    if (!f) continue;
    const calculo = calcularFicha(f, config, fijo);
    planDTO.push({
      ficha: { id: f.id, codigo: f.codigo, nombre: f.nombre },
      prendas: item.prendas,
      costoPorPrenda: calculo.total,
      incompleto: calculo.incompleto,
    });
    if (calculo.incompleto) avisos.push(`${f.nombre}: tiene insumos sin precio, la plata del plan es parcial.`);
    for (const l of f.lineas) {
      if (l.insumoId && l.insumo) {
        const cant = consumoLinea(
          {
            tipo: l.tipo,
            cantidad: l.cantidad,
            largoMm: l.largoMm,
            prendasPorCapa: l.prendasPorCapa,
            rendimiento: rendimientoDeLinea(l),
          },
          item.prendas,
        );
        if (cant) necesario.set(l.insumoId, sumarFracciones([necesario.get(l.insumoId) ?? null, cant]));
        insumoInfo.set(l.insumoId, { nombre: l.insumo.nombre, unidad: l.insumo.unidad, precio: precioDeLinea(l) });
      } else {
        // precio por prenda y prorrateos: plata, no material
        const porPrenda = costoLinea(aLineaParaCosto(l));
        if (porPrenda) producir.push(porPrendas(porPrenda, item.prendas));
      }
    }
    producir.push(fr((calculo.manoDeObra + calculo.empaque + calculo.servicioCorte) * item.prendas));
  }

  const necesidades: NecesidadInsumoDTO[] = [...necesario].map(([id, cant]) => {
    const info = insumoInfo.get(id)!;
    const nec = redondear(cant);
    const hay = stock.get(id)?.stock ?? 0;
    const faltante = Math.max(0, nec - Math.max(0, hay));
    return {
      insumo: { id, nombre: info.nombre, unidad: info.unidad },
      necesario: nec,
      stock: hay,
      faltante,
      costoFaltante:
        faltante === 0 ? 0 : info.precio ? redondear(costoDeCantidad(fr(faltante), info.precio)) : null,
    };
  });
  necesidades.sort((a, b) => a.insumo.nombre.localeCompare(b.insumo.nombre, 'es'));
  if (necesidades.some((n) => n.costoFaltante === null)) {
    avisos.push('Hay materiales que faltan comprar sin precio conocido: el monto a comprar es parcial.');
  }

  const cortesAbiertos: CortePendienteDTO[] = cortes
    .filter((c) => c.estado === 'abierto')
    .map((c) => ({
      corteId: c.id,
      codigo: c.codigo,
      modeloNombre: c.version.modelo.nombre,
      prendas: c.cantidadTotal,
      costuraYEmpaque: manoDeObraReal(c, false) + manoDeObraReal(c, true),
      enviosSinDevolver: c.envios.filter((e) => !e.fechaDevolucion).reduce((a, e) => a + e.total, 0),
    }));

  const comprarMateriales = necesidades.reduce((a, n) => a + (n.costoFaltante ?? 0), 0);
  const producirPlan = redondear(sumarFracciones(producir));
  const terminarCortes = cortesAbiertos.reduce((a, c) => a + c.costuraYEmpaque + c.enviosSinDevolver, 0);
  const costosFijos = redondear(presupuesto); // el mes del taller, una vez (no por prenda)
  return {
    anio,
    mes,
    plan: planDTO,
    necesidades,
    cortesAbiertos,
    totales: {
      comprarMateriales,
      producirPlan,
      terminarCortes,
      costosFijos,
      total: comprarMateriales + producirPlan + terminarCortes + costosFijos,
    },
    avisos,
  };
}
