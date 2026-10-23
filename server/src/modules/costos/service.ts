// Costos de producción (docs/PLAN_COSTOS.md): insumos, compras y fichas de costo
// por prenda. SOLO CONSULTA: lee CT y tarifas del sistema, nunca toca pagos.
// El dinero lo calcula el dominio compartido (shared/costos.ts): fracciones
// exactas y un solo redondeo por número informado.
import type { Configuracion } from '@prisma/client';
import {
  aBolivianos,
  docenaEnDolares,
  CANTIDAD_ESCALA,
  consumoTela,
  costoFicha,
  dateADia,
  diaADate,
  precioUnitario,
  type CompraDTO,
  type CompraInput,
  type EditarInsumoInput,
  type FichaCostoDetalleDTO,
  type FichaCostoInput,
  type FichaCostoResumenDTO,
  type Fraccion,
  type InsumoDTO,
  type InsumoInput,
  type LineaCostoDTO,
  type LineaParaCosto,
  type ConteoDTO,
  type ConteoInput,
  type CorteCostoDetalleDTO,
  type CorteCostoResumenDTO,
  type PlanInput,
  type ProyeccionDTO,
  type StockDTO,
} from '@taller/shared';
import { AppError } from '../../middleware/errors.js';
import { configuracionRepository } from '../configuracion/repository.js';
import { costoFijoPorPrenda } from './fijos.js';
import { costosRepository, type FichaConDatos, type InsumoConCompra } from './repository.js';
import {
  aResumenCorte,
  costoRealCorte,
  fichaDeCorte,
  proyeccion,
  STOCK_VACIO,
  stockPorInsumo,
} from './produccion.js';

/** Bs por unidad, solo para MOSTRAR (el cálculo usa la fracción exacta). */
const bsPorUnidad = (c: { precioTotal: number; cantidad: number }) =>
  (c.precioTotal / 100) * (CANTIDAD_ESCALA / c.cantidad);

function aInsumoDTO(
  i: InsumoConCompra,
  stock: StockDTO = STOCK_VACIO,
  codigosCorte: string[] = [],
): InsumoDTO {
  const ultima = i.compras[0] ?? null;
  return {
    id: i.id,
    nombre: i.nombre,
    categoria: i.categoria,
    unidad: i.unidad,
    color: i.color,
    codigo: i.codigo,
    titulo: i.titulo,
    anchoCm: i.anchoCm,
    marca: i.marca,
    numeroLlave: i.numeroLlave,
    medidaCm: i.medidaCm,
    rendimiento: i.rendimiento,
    notas: i.notas,
    activo: i.activo,
    compras: i._count.compras,
    ultimaCompra: ultima && {
      fecha: dateADia(ultima.fecha),
      tienda: ultima.tienda,
      precioTotal: ultima.precioTotal,
      cantidad: ultima.cantidad,
    },
    precioUnitarioBs: ultima ? bsPorUnidad(ultima) : null,
    usadoEnFichas: i._count.lineas,
    stock,
    codigosCorte,
  };
}

type CompraConInsumo = Awaited<ReturnType<typeof costosRepository.listarCompras>>[number];
function aCompraDTO(c: CompraConInsumo): CompraDTO {
  return {
    id: c.id,
    insumo: c.insumo,
    fecha: dateADia(c.fecha),
    tienda: c.tienda,
    origen: c.origen,
    ciudad: c.ciudad,
    presentacion: c.presentacion,
    cantidad: c.cantidad,
    moneda: c.moneda,
    montoUsd: c.montoUsd,
    tasaCambio: c.tasaCambio,
    precioTotal: c.precioTotal,
    precioUnitarioBs: bsPorUnidad(c),
    codigoCorte: c.codigoCorte,
    condicion: c.condicion,
    notas: c.notas,
  };
}

/** Servicio de corte por prenda con las tarifas vigentes de Configuración. */
export const servicioCortePorPrenda = (c: Configuracion) =>
  c.tarifaBusqueda +
  c.tarifaTrazado +
  c.tarifaDobladoHoja +
  c.tarifaCorteRespaldo +
  c.tarifaClasificacionRespaldo;

type LineaFicha = FichaConDatos['lineas'][number];

/** Precio exacto de la última compra del insumo de una línea (null = sin compras). */
export const precioDeLinea = (l: LineaFicha): Fraccion | null => {
  const compra = l.insumo?.compras[0] ?? null;
  return compra ? precioUnitario(compra) : null;
};

/** Rendimiento del hilo: el de la ficha o, si no, el del insumo. */
export const rendimientoDeLinea = (l: LineaFicha) =>
  l.tipo === 'hilo' ? (l.rendimiento ?? l.insumo?.rendimiento ?? null) : null;

/** Una línea guardada, lista para el cálculo de costo por prenda. */
export function aLineaParaCosto(l: LineaFicha): LineaParaCosto {
  const precio = precioDeLinea(l);
  switch (l.tipo) {
    case 'por_prenda':
      return { tipo: 'por_prenda', cantidad: l.cantidad!, precio };
    case 'tela_tizado':
      return { tipo: 'tela_tizado', largoMm: l.largoMm!, prendasPorCapa: l.prendasPorCapa!, precio };
    case 'hilo': {
      // sin rendimiento no se puede costear: queda como "sin precio"
      const rendimiento = rendimientoDeLinea(l);
      return { tipo: 'hilo', rendimiento: rendimiento ?? 1, precio: rendimiento ? precio : null };
    }
    case 'prorrateo':
      return { tipo: 'prorrateo', monto: l.monto!, prendas: l.prendas! };
    case 'precio_prenda':
      return { tipo: 'precio_prenda', precio: l.precio! };
  }
}

/** Calcula la ficha: cada línea, mano de obra, empaque, servicio, total y venta. */
export function calcularFicha(
  f: FichaConDatos,
  config: Configuracion,
  costoFijo?: Fraccion, // costos fijos del taller por prenda (etapa 5)
): FichaCostoDetalleDTO {
  const lineasCalculo = f.lineas.map(aLineaParaCosto);
  const lineasDTO: Omit<LineaCostoDTO, 'costo'>[] = [];
  for (const l of f.lineas) {
    const compra = l.insumo?.compras[0] ?? null;
    const rendimientoUsado = rendimientoDeLinea(l);
    lineasDTO.push({
      orden: l.orden,
      tipo: l.tipo,
      concepto: l.concepto,
      insumo: l.insumo && {
        id: l.insumo.id,
        nombre: l.insumo.nombre,
        unidad: l.insumo.unidad,
        precioUnitarioBs: compra ? bsPorUnidad(compra) : null,
      },
      cantidad: l.cantidad,
      largoMm: l.largoMm,
      prendasPorCapa: l.prendasPorCapa,
      consumoTela:
        l.tipo === 'tela_tizado' ? consumoTela(l.largoMm!, l.prendasPorCapa!) : null,
      rendimiento: l.rendimiento,
      rendimientoUsado,
      monto: l.monto,
      prendas: l.prendas,
      precio: l.precio,
    });
  }

  // mano de obra y empaque: del modelo vinculado (Σ CT de su última versión) o a mano
  const ops = f.modelo?.versiones[0]?.operaciones ?? null;
  const manoDeObra = ops
    ? ops.filter((o) => !o.esEmpaque).reduce((a, o) => a + o.ct, 0)
    : (f.manoDeObra ?? 0);
  const empaque = ops
    ? ops.filter((o) => o.esEmpaque).reduce((a, o) => a + o.ct, 0)
    : (f.empaque ?? 0);
  const margen = f.margen ?? config.margenVenta;
  const c = costoFicha({
    lineas: lineasCalculo,
    manoDeObra,
    empaque,
    servicioCorte: f.servicioCorteInterno ? servicioCortePorPrenda(config) : 0,
    costoFijo,
    margen,
  });

  return {
    id: f.id,
    codigo: f.codigo,
    nombre: f.nombre,
    modelo: f.modelo && { id: f.modelo.id, nombre: f.modelo.nombre },
    total: c.total,
    precioVenta: c.precioVenta,
    costoDocenaUsd: docenaEnDolares(c.total, config.tasaCambioUsd),
    ventaDocenaUsd: docenaEnDolares(c.precioVenta, config.tasaCambioUsd),
    incompleto: c.incompleto,
    actualizadoEn: f.actualizadoEn.toISOString(),
    manoDeObraManual: f.manoDeObra,
    empaqueManual: f.empaque,
    servicioCorteInterno: f.servicioCorteInterno,
    margenPropio: f.margen,
    margen,
    notas: f.notas,
    lineas: lineasDTO.map((l, i) => ({ ...l, costo: c.lineas[i] })),
    materiales: c.materiales,
    manoDeObra: c.manoDeObra,
    empaque: c.empaque,
    servicioCorte: c.servicioCorte,
    costoFijo: c.costoFijo,
    origenManoDeObra: ops ? 'modelo' : 'manual',
  };
}

const aResumen = (d: FichaCostoDetalleDTO): FichaCostoResumenDTO => ({
  id: d.id,
  codigo: d.codigo,
  nombre: d.nombre,
  modelo: d.modelo,
  total: d.total,
  precioVenta: d.precioVenta,
  costoDocenaUsd: d.costoDocenaUsd,
  ventaDocenaUsd: d.ventaDocenaUsd,
  incompleto: d.incompleto,
  actualizadoEn: d.actualizadoEn,
});

async function insumoOError(id: string): Promise<InsumoConCompra> {
  const insumo = await costosRepository.obtenerInsumo(id);
  if (!insumo) throw new AppError('NO_ENCONTRADO', 'Insumo no encontrado', 404);
  return insumo;
}

export const costosService = {
  // ── Insumos ──
  async listarInsumos(): Promise<InsumoDTO[]> {
    const [insumos, stock, codigos] = await Promise.all([
      costosRepository.listarInsumos(),
      stockPorInsumo(),
      costosRepository.codigosCortePorInsumo(),
    ]);
    return insumos.map((i) => aInsumoDTO(i, stock.get(i.id), codigos.get(i.id)));
  },

  async crearInsumo(input: InsumoInput): Promise<InsumoDTO> {
    return aInsumoDTO(await costosRepository.crearInsumo(input));
  },

  async editarInsumo(id: string, input: EditarInsumoInput): Promise<InsumoDTO> {
    await insumoOError(id);
    const insumo = await costosRepository.actualizarInsumo(id, input);
    return aInsumoDTO(insumo, (await stockPorInsumo()).get(id));
  },

  /** Solo sin compras ni fichas que lo usen; si no, se desactiva. */
  async eliminarInsumo(id: string): Promise<void> {
    const insumo = await insumoOError(id);
    if (insumo._count.compras > 0 || insumo._count.lineas > 0) {
      throw new AppError(
        'EN_USO',
        `${insumo.nombre} tiene ${insumo._count.compras} compra(s) y se usa en ${insumo._count.lineas} línea(s) de fichas: desactivalo en vez de eliminarlo`,
        409,
      );
    }
    await costosRepository.eliminarInsumo(id);
  },

  // ── Compras ──
  async listarCompras(insumoId?: string): Promise<CompraDTO[]> {
    return (await costosRepository.listarCompras(insumoId)).map(aCompraDTO);
  },

  /** En dólares el precio en Bs = monto × tasa oficial del día, redondeado una vez. */
  async crearCompra(input: CompraInput): Promise<CompraDTO> {
    await insumoOError(input.insumoId);
    const enDolares = input.moneda === 'USD';
    const compra = await costosRepository.crearCompra({
      insumoId: input.insumoId,
      fecha: diaADate(input.fecha),
      tienda: input.tienda,
      origen: input.origen,
      ciudad: input.ciudad ?? null,
      presentacion: input.presentacion ?? null,
      cantidad: input.cantidad,
      moneda: input.moneda,
      montoUsd: enDolares ? input.montoUsd! : null,
      tasaCambio: enDolares ? input.tasaCambio! : null,
      precioTotal: enDolares ? aBolivianos(input.montoUsd!, input.tasaCambio!) : input.precioTotal!,
      codigoCorte: input.codigoCorte ?? null,
      condicion: input.condicion,
      notas: input.notas ?? null,
    });
    return aCompraDTO(compra);
  },

  async eliminarCompra(id: string): Promise<void> {
    const compra = await costosRepository.obtenerCompra(id);
    if (!compra) throw new AppError('NO_ENCONTRADO', 'Compra no encontrada', 404);
    await costosRepository.eliminarCompra(id);
  },

  // ── Fichas ──
  async listarFichas(): Promise<FichaCostoResumenDTO[]> {
    const [fichas, config] = await Promise.all([
      costosRepository.listarFichas(),
      configuracionRepository.obtener(),
    ]);
    const fijo = await costoFijoPorPrenda(config);
    return fichas.map((f) => aResumen(calcularFicha(f, config, fijo)));
  },

  async obtenerFicha(id: string): Promise<FichaCostoDetalleDTO> {
    const [ficha, config] = await Promise.all([
      costosRepository.obtenerFicha(id),
      configuracionRepository.obtener(),
    ]);
    if (!ficha) throw new AppError('NO_ENCONTRADO', 'Ficha de costo no encontrada', 404);
    return calcularFicha(ficha, config, await costoFijoPorPrenda(config));
  },

  async crearFicha(input: FichaCostoInput): Promise<FichaCostoDetalleDTO> {
    return this.obtenerFicha(await guardar(null, input));
  },

  async reemplazarFicha(id: string, input: FichaCostoInput): Promise<FichaCostoDetalleDTO> {
    if (!(await costosRepository.obtenerFicha(id))) {
      throw new AppError('NO_ENCONTRADO', 'Ficha de costo no encontrada', 404);
    }
    return this.obtenerFicha(await guardar(id, input));
  },

  async eliminarFicha(id: string): Promise<void> {
    if (!(await costosRepository.obtenerFicha(id))) {
      throw new AppError('NO_ENCONTRADO', 'Ficha de costo no encontrada', 404);
    }
    const pedidos = await costosRepository.pedidosDeFicha(id);
    if (pedidos > 0) {
      throw new AppError('EN_USO', `La ficha tiene ${pedidos} pedido(s) de clientes: no se puede eliminar`, 409);
    }
    await costosRepository.eliminarFicha(id);
  },

  // ── Stock: conteos físicos (etapa 4) ──
  async listarConteos(insumoId?: string): Promise<ConteoDTO[]> {
    return (await costosRepository.listarConteos(insumoId)).map(aConteoDTO);
  },

  async crearConteo(input: ConteoInput): Promise<ConteoDTO> {
    await insumoOError(input.insumoId);
    const conteo = await costosRepository.crearConteo({
      insumoId: input.insumoId,
      fecha: diaADate(input.fecha),
      cantidad: input.cantidad,
      notas: input.notas ?? null,
    });
    return aConteoDTO(conteo);
  },

  async eliminarConteo(id: string): Promise<void> {
    if (!(await costosRepository.obtenerConteo(id))) {
      throw new AppError('NO_ENCONTRADO', 'Conteo no encontrado', 404);
    }
    await costosRepository.eliminarConteo(id);
  },

  // ── Costo real de los cortes (etapa 3) ──
  async listarCostosCortes(): Promise<CorteCostoResumenDTO[]> {
    const [cortes, fichas, config] = await Promise.all([
      costosRepository.cortesParaCosto(),
      costosRepository.listarFichas(),
      configuracionRepository.obtener(),
    ]);
    return cortes.map((c) => aResumenCorte(costoRealCorte(c, fichaDeCorte(c, fichas), config)));
  },

  async costoCorte(corteId: string): Promise<CorteCostoDetalleDTO> {
    const [cortes, fichas, config] = await Promise.all([
      costosRepository.cortesParaCosto(corteId),
      costosRepository.listarFichas(),
      configuracionRepository.obtener(),
    ]);
    const corte = cortes[0];
    if (!corte) {
      throw new AppError('NO_ENCONTRADO', 'Corte no encontrado (o todavía en borrador)', 404);
    }
    return costoRealCorte(corte, fichaDeCorte(corte, fichas), config);
  },

  // ── Plan del mes y proyección (etapa 4) ──
  async guardarPlan(input: PlanInput): Promise<ProyeccionDTO> {
    const fichas = new Set((await costosRepository.listarFichas()).map((f) => f.id));
    if (input.items.some((i) => !fichas.has(i.fichaId))) {
      throw new AppError('NO_ENCONTRADO', 'Hay una ficha de costo que no existe en el plan', 404);
    }
    await costosRepository.reemplazarPlan(input.anio, input.mes, input.items);
    return this.proyeccion(input.anio, input.mes);
  },

  async proyeccion(anio: number, mes: number): Promise<ProyeccionDTO> {
    return proyeccion(anio, mes, await configuracionRepository.obtener());
  },
};

type ConteoConInsumo = Awaited<ReturnType<typeof costosRepository.listarConteos>>[number];
function aConteoDTO(c: ConteoConInsumo): ConteoDTO {
  return {
    id: c.id,
    insumo: c.insumo,
    fecha: dateADia(c.fecha),
    cantidad: c.cantidad,
    notas: c.notas,
  };
}

/** Valida nombre único, modelo e insumos, y guarda la ficha con sus líneas. */
async function guardar(id: string | null, input: FichaCostoInput): Promise<string> {
  const otra = await costosRepository.buscarFichaPorNombre(input.nombre);
  if (otra && otra.id !== id) {
    throw new AppError('NOMBRE_REPETIDO', `Ya hay una ficha llamada "${input.nombre}"`, 409);
  }
  if (input.modeloId && !(await costosRepository.existeModelo(input.modeloId))) {
    throw new AppError('NO_ENCONTRADO', 'Modelo no encontrado', 404);
  }
  for (const l of input.lineas) {
    if ('insumoId' in l) await insumoOError(l.insumoId);
  }
  const vinculada = Boolean(input.modeloId);
  return costosRepository.guardarFicha(
    id,
    {
      codigo: input.codigo ?? null,
      nombre: input.nombre,
      modeloId: input.modeloId ?? null,
      // con modelo vinculado mano de obra y empaque salen de sus CT
      manoDeObra: vinculada ? null : (input.manoDeObra ?? null),
      empaque: vinculada ? null : (input.empaque ?? null),
      servicioCorteInterno: input.servicioCorteInterno,
      margen: input.margen ?? null,
      notas: input.notas ?? null,
    },
    input.lineas.map((l, i) => ({
      orden: i + 1,
      tipo: l.tipo,
      concepto: l.concepto,
      insumoId: 'insumoId' in l ? l.insumoId : null,
      cantidad: l.tipo === 'por_prenda' ? l.cantidad : null,
      largoMm: l.tipo === 'tela_tizado' ? l.largoMm : null,
      prendasPorCapa: l.tipo === 'tela_tizado' ? l.prendasPorCapa : null,
      rendimiento: l.tipo === 'hilo' ? (l.rendimiento ?? null) : null,
      monto: l.tipo === 'prorrateo' ? l.monto : null,
      prendas: l.tipo === 'prorrateo' ? l.prendas : null,
      precio: l.tipo === 'precio_prenda' ? l.precio : null,
    })),
  );
}
