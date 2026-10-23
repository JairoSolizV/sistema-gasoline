// Tablero de dinero (docs/PLAN_TABLERO_DINERO.md). NO toca pagos: lee cortes,
// liquidación, compras y costos fijos; guarda solo clientes, pedidos,
// despachos, cobros y pagos a proveedores.
import type { Configuracion } from '@prisma/client';
import {
  bsAUsd,
  costoDeCantidad,
  dateADia,
  diaADate,
  ETIQUETA_CUENTA,
  normalizarProveedor,
  precioUnitario,
  redondear,
  SERVICIOS_EXTERNOS,
  type ClienteDTO,
  type ClienteInput,
  type CobroDTO,
  type CobroInput,
  type CaminoDTO,
  type CorteDineroDTO,
  type CorteEnCaminoDTO,
  type PasoCorte,
  PASOS_CORTE,
  semaforoPaso,
  type CuentaPorCobrarDTO,
  type CuentasPorCobrarDTO,
  type CuentaPorPagarDTO,
  type CuentasPorPagarDTO,
  type Cuenta,
  type DespachoDTO,
  type DespachoInput,
  type EditarClienteInput,
  type EditarPedidoInput,
  type EtapaDineroDTO,
  type Moneda,
  type PagoProveedorInput,
  type PedidoDTO,
  type PedidoInput,
  type ProveedorDeudaDTO,
  type TableroDTO,
  type TableroItemDTO,
  totalPorDocena,
  usdABs,
} from '@taller/shared';
import { hoyEnBolivia } from '../../lib/hoy.js';
import { AppError } from '../../middleware/errors.js';
import { configuracionRepository } from '../configuracion/repository.js';
import { costosRepository, type FichaConDatos } from '../costos/repository.js';
import { calcularFicha } from '../costos/service.js';
import { costoRealCorte, fichaDeCorte, partesDeCorte, stockPorInsumo } from '../costos/produccion.js';
import { costoFijoPorPrenda, fijosService } from '../costos/fijos.js';
import { liquidacionService } from '../liquidacion/service.js';
import { rangoMesUTC } from '../liquidacion/repository.js';
import { dineroRepository, type DespachoConDatos, type PedidoConDatos } from './repository.js';

const fr = (n: number) => ({ num: BigInt(n), den: 1n });
/** 'aaaa-mm-dd' + n días. */
const sumarDias = (dia: string, n: number) => {
  const d = diaADate(dia);
  d.setUTCDate(d.getUTCDate() + n);
  return dateADia(d);
};

/** Costo por prenda de una ficha SIN costos fijos (esos se restan una vez en el
 *  resultado del mes) y precio de la docena en $us tal como lo muestra la ficha
 *  (el fijo, o el calculado al último tipo de cambio). */
function precioYCosto(f: FichaConDatos, config: Configuracion, fijo: ReturnType<typeof fr>) {
  return { costo: calcularFicha(f, config).total, docenaUsd: calcularFicha(f, config, fijo).ventaDocenaUsd };
}

/** Monto de una compra a crédito en la moneda en que se debe. */
const montoCompra = (c: { moneda: Moneda; montoUsd: number | null; precioTotal: number }) =>
  c.moneda === 'USD' ? (c.montoUsd ?? 0) : c.precioTotal;

async function contexto() {
  const config = await configuracionRepository.obtener();
  const [fichas, fijo] = await Promise.all([costosRepository.listarFichas(), costoFijoPorPrenda(config)]);
  return { config, fichas, fijo };
}

// ── Cortes: en qué etapa está cada uno y cuánto vale ──

async function cortesDinero(): Promise<CorteDineroDTO[]> {
  const [{ config, fichas, fijo }, cortes, despachadas, pedidos] = await Promise.all([
    contexto(),
    costosRepository.cortesParaCosto(),
    dineroRepository.despachadasPorCorte(),
    dineroRepository.listarPedidos(),
  ]);
  const precioPedido = new Map(
    pedidos.filter((p) => p.corteId && p.estado !== 'cancelado').map((p) => [p.corteId!, p.precioDocenaUsd]),
  );
  return cortes.map((c) => {
    const f = fichaDeCorte(c, fichas);
    const d = costoRealCorte(c, f, config);
    const sinDevolver = c.envios.filter((e) => !e.fechaDevolucion);
    const abierto = c.estado === 'abierto';
    const etapa = abierto ? 'produccion' : sinDevolver.length > 0 ? 'servicios' : 'deposito';
    const manoDeObra = d.rubros
      .filter((r) => r.rubro === 'costura' || r.rubro === 'empaque')
      .reduce((a, r) => a + (r.real ?? 0), 0);
    const enviosPendientes = sinDevolver.reduce((a, e) => a + e.total, 0);
    const vendidas = despachadas.get(c.id) ?? 0;
    const disponibles = Math.max(0, c.cantidadTotal - vendidas);
    const docena = precioPedido.get(c.id) ?? (f ? precioYCosto(f, config, fijo).docenaUsd : null);
    const ventaUsd = docena != null ? totalPorDocena(disponibles, docena) : null;
    return {
      corteId: c.id,
      codigo: c.codigo,
      modeloNombre: c.version.modelo.nombre,
      etapa,
      prendas: c.cantidadTotal,
      despachadas: vendidas,
      disponibles,
      costoPrenda: d.realPorPrenda,
      precioDocenaUsd: docena,
      // costo de las disponibles: costo real × disponibles ÷ prendas, un redondeo
      costo: redondear({ num: BigInt(d.realTotal * disponibles), den: BigInt(c.cantidadTotal) }),
      ventaUsd,
      venta: ventaUsd != null ? usdABs(ventaUsd, config.tasaCambioUsd) : null,
      faltaPagar: (abierto ? manoDeObra : 0) + enviosPendientes,
      serviciosPendientes: [...new Set(sinDevolver.map((e) => e.servicio))],
    };
  });
}

/** Totales de una etapa. La ganancia solo cuenta lo que tiene precio: un corte
 *  sin ficha no es una pérdida, es un precio que no se conoce. */
function etapa(items: TableroItemDTO[]): EtapaDineroDTO {
  const conPrecio = items.filter((i) => i.venta != null);
  const venta = conPrecio.reduce((a, i) => a + i.venta!, 0);
  return {
    prendas: items.reduce((a, i) => a + i.prendas, 0),
    costo: items.reduce((a, i) => a + i.costo, 0),
    venta,
    ventaUsd: conPrecio.reduce((a, i) => a + (i.ventaUsd ?? 0), 0),
    ganancia: venta - conPrecio.reduce((a, i) => a + i.costo, 0),
    sinPrecio: items.length - conPrecio.length,
    faltaPagar: items.reduce((a, i) => a + i.faltaPagar, 0),
    items,
  };
}

const itemCorte = (c: CorteDineroDTO): TableroItemDTO => ({
  id: c.corteId,
  titulo: `COD ${c.codigo} · ${c.modeloNombre}`,
  detalle:
    c.serviciosPendientes.length > 0
      ? `en ${c.serviciosPendientes.join(', ')}`
      : c.despachadas > 0
        ? `${c.despachadas} de ${c.prendas} ya despachadas`
        : null,
  prendas: c.disponibles,
  costo: c.costo,
  venta: c.venta,
  ventaUsd: c.ventaUsd,
  faltaPagar: c.faltaPagar,
});

// ── DTOs ──

function aPedidoDTO(p: PedidoConDatos, costoPrenda: number): PedidoDTO {
  return {
    id: p.id,
    cliente: p.cliente,
    ficha: p.ficha,
    prendas: p.prendas,
    precioDocenaUsd: p.precioDocenaUsd,
    costoPrenda,
    ventaUsd: totalPorDocena(p.prendas, p.precioDocenaUsd),
    costo: p.prendas * costoPrenda,
    fechaEntrega: p.fechaEntrega ? dateADia(p.fechaEntrega) : null,
    estado: p.estado,
    corte: p.corte,
    notas: p.notas,
  };
}

function aDespachoDTO(d: DespachoConDatos): DespachoDTO {
  return {
    id: d.id,
    cliente: d.cliente,
    fecha: dateADia(d.fecha),
    vence: dateADia(d.vence),
    tasaCambio: d.tasaCambio,
    notas: d.notas,
    lineas: d.lineas.map((l) => ({
      id: l.id,
      corte: l.corte,
      ficha: l.ficha,
      descripcion: l.descripcion,
      detalle: l.detalle,
      prendas: l.prendas,
      precioDocenaUsd: l.precioDocenaUsd,
      costoPrenda: l.costoPrenda,
      totalUsd: l.totalUsd,
      totalBs: l.totalBs,
    })),
    prendas: d.lineas.reduce((a, l) => a + l.prendas, 0),
    totalUsd: d.lineas.reduce((a, l) => a + l.totalUsd, 0),
    totalBs: d.lineas.reduce((a, l) => a + l.totalBs, 0),
    costo: d.lineas.reduce((a, l) => a + l.prendas * l.costoPrenda, 0),
  };
}

function aCobroDTO(c: Awaited<ReturnType<typeof dineroRepository.crearCobro>>): CobroDTO {
  return {
    id: c.id,
    cliente: c.cliente,
    fecha: dateADia(c.fecha),
    moneda: c.moneda,
    monto: c.monto,
    tasaCambio: c.tasaCambio,
    usd: c.usd,
    bs: c.bs,
    nota: c.nota,
    caja: c.caja,
  };
}

async function clienteOError(id: string) {
  const c = await dineroRepository.obtenerCliente(id);
  if (!c) throw new AppError('NO_ENCONTRADO', 'Cliente no encontrado', 404);
  return c;
}

async function nombreLibre(nombre: string, id?: string) {
  const otro = await dineroRepository.clientePorNombre(nombre);
  if (otro && otro.id !== id) throw new AppError('NOMBRE_REPETIDO', `Ya hay un cliente "${otro.nombre}"`, 409);
}

export const dineroService = {
  // ── Clientes ──
  async listarClientes(): Promise<ClienteDTO[]> {
    const [clientes, totales] = await Promise.all([
      dineroRepository.listarClientes(),
      dineroRepository.totalesPorCliente(),
    ]);
    return clientes.map((c) => {
      const t = totales.get(c.id) ?? { despachado: 0, cobrado: 0 };
      return {
        id: c.id,
        nombre: c.nombre,
        celular: c.celular,
        notas: c.notas,
        plazoDias: c.plazoDias,
        activo: c.activo,
        despachadoUsd: t.despachado,
        cobradoUsd: t.cobrado,
        porCobrarUsd: t.despachado - t.cobrado,
        tieneMovimientos: c._count.pedidos + c._count.despachos + c._count.cobros > 0,
      };
    });
  },

  async crearCliente(input: ClienteInput): Promise<ClienteDTO> {
    await nombreLibre(input.nombre);
    const c = await dineroRepository.crearCliente({
      nombre: input.nombre,
      celular: input.celular ?? null,
      notas: input.notas ?? null,
      ...(input.plazoDias !== undefined ? { plazoDias: input.plazoDias } : {}),
    });
    return (await this.listarClientes()).find((x) => x.id === c.id)!;
  },

  async editarCliente(id: string, input: EditarClienteInput): Promise<ClienteDTO> {
    await clienteOError(id);
    if (input.nombre) await nombreLibre(input.nombre, id);
    await dineroRepository.actualizarCliente(id, input);
    return (await this.listarClientes()).find((x) => x.id === id)!;
  },

  /** Solo sin pedidos, despachos ni cobros; si no, se desactiva. */
  async eliminarCliente(id: string): Promise<void> {
    const c = await clienteOError(id);
    if (c._count.pedidos + c._count.despachos + c._count.cobros > 0) {
      throw new AppError('EN_USO', `${c.nombre} tiene movimientos: desactivalo en vez de eliminarlo`, 409);
    }
    await dineroRepository.eliminarCliente(id);
  },

  // ── Pedidos ──
  async listarPedidos(): Promise<PedidoDTO[]> {
    const [{ config, fichas }, pedidos] = await Promise.all([contexto(), dineroRepository.listarPedidos()]);
    const costo = new Map(fichas.map((f) => [f.id, calcularFicha(f, config).total]));
    return pedidos.map((p) => aPedidoDTO(p, costo.get(p.fichaId) ?? 0));
  },

  async crearPedido(input: PedidoInput): Promise<PedidoDTO> {
    await clienteOError(input.clienteId);
    const { config, fichas, fijo } = await contexto();
    const f = fichas.find((x) => x.id === input.fichaId);
    if (!f) throw new AppError('NO_ENCONTRADO', 'Ficha de costo no encontrada', 404);
    const { costo, docenaUsd } = precioYCosto(f, config, fijo);
    const p = await dineroRepository.crearPedido({
      clienteId: input.clienteId,
      fichaId: input.fichaId,
      prendas: input.prendas,
      precioDocenaUsd: input.precioDocenaUsd ?? docenaUsd,
      fechaEntrega: input.fechaEntrega ? diaADate(input.fechaEntrega) : null,
      notas: input.notas ?? null,
    });
    return aPedidoDTO(p, costo);
  },

  /** Vincular un corte pasa el pedido a "en producción" si estaba pendiente. */
  async editarPedido(id: string, input: EditarPedidoInput): Promise<PedidoDTO> {
    const actual = await dineroRepository.obtenerPedido(id);
    if (!actual) throw new AppError('NO_ENCONTRADO', 'Pedido no encontrado', 404);
    if (input.corteId) {
      const corte = (await costosRepository.cortesParaCosto(input.corteId))[0];
      if (!corte) throw new AppError('NO_ENCONTRADO', 'El corte no existe o está en borrador', 404);
    }
    const estado =
      input.estado ?? (input.corteId && actual.estado === 'pendiente' ? 'en_produccion' : undefined);
    await dineroRepository.actualizarPedido(id, {
      ...(input.prendas !== undefined ? { prendas: input.prendas } : {}),
      ...(input.precioDocenaUsd !== undefined ? { precioDocenaUsd: input.precioDocenaUsd } : {}),
      ...(input.fechaEntrega !== undefined
        ? { fechaEntrega: input.fechaEntrega ? diaADate(input.fechaEntrega) : null }
        : {}),
      ...(input.corteId !== undefined ? { corteId: input.corteId } : {}),
      ...(input.notas !== undefined ? { notas: input.notas } : {}),
      ...(estado ? { estado } : {}),
    });
    return (await this.listarPedidos()).find((p) => p.id === id)!;
  },

  async eliminarPedido(id: string): Promise<void> {
    if (!(await dineroRepository.obtenerPedido(id))) {
      throw new AppError('NO_ENCONTRADO', 'Pedido no encontrado', 404);
    }
    await dineroRepository.eliminarPedido(id);
  },

  // ── Despachos ──
  async listarDespachos(): Promise<DespachoDTO[]> {
    return (await dineroRepository.listarDespachos()).map(aDespachoDTO);
  },

  /** Cortes con prendas para despachar (cerrados), con su precio y costo. */
  async deposito(): Promise<CorteDineroDTO[]> {
    return (await cortesDinero()).filter((c) => c.etapa !== 'produccion' && c.disponibles > 0);
  },

  /** Cada línea guarda la FOTO del costo por prenda (corte real o ficha, sin
   *  costos fijos) y su total en $us (prendas × docena ÷ 12) y en Bs a la tasa
   *  del día. Un corte tiene que estar cerrado y no se despacha de más. */
  async crearDespacho(input: DespachoInput): Promise<DespachoDTO> {
    const cliente = await clienteOError(input.clienteId);
    const [{ config, fichas, fijo }, cortes] = await Promise.all([contexto(), cortesDinero()]);
    const tasa = input.tasaCambio ?? config.tasaCambioUsd;
    const totales = (prendas: number, docena: number) => {
      const totalUsd = totalPorDocena(prendas, docena);
      return { precioDocenaUsd: docena, totalUsd, totalBs: usdABs(totalUsd, tasa) };
    };
    const pedidas = new Map<string, number>(); // prendas pedidas por corte en este despacho
    const lineas = input.lineas.map((l) => {
      if (l.corteId) {
        const c = cortes.find((x) => x.corteId === l.corteId);
        if (!c) throw new AppError('NO_ENCONTRADO', 'Corte no encontrado', 404);
        if (c.etapa === 'produccion') {
          throw new AppError('CORTE_ABIERTO', `El COD ${c.codigo} todavía no está cerrado`, 409);
        }
        const total = (pedidas.get(c.corteId) ?? 0) + l.prendas;
        if (total > c.disponibles) {
          throw new AppError(
            'CANTIDAD_EXCEDIDA',
            `Del COD ${c.codigo} quedan ${c.disponibles} prendas para despachar`,
            409,
          );
        }
        pedidas.set(c.corteId, total);
        const docena = l.precioDocenaUsd ?? c.precioDocenaUsd;
        if (docena == null) {
          throw new AppError('SIN_PRECIO', `Indicá el precio del COD ${c.codigo}: su modelo no tiene ficha`, 400);
        }
        return {
          corteId: c.corteId,
          fichaId: null,
          descripcion: `COD ${c.codigo} · ${c.modeloNombre}`,
          detalle: l.detalle ?? null,
          prendas: l.prendas,
          costoPrenda: c.costoPrenda,
          ...totales(l.prendas, docena),
        };
      }
      const f = fichas.find((x) => x.id === l.fichaId);
      if (!f) throw new AppError('NO_ENCONTRADO', 'Ficha de costo no encontrada', 404);
      const { costo, docenaUsd } = precioYCosto(f, config, fijo);
      return {
        corteId: null,
        fichaId: f.id,
        descripcion: f.nombre,
        detalle: l.detalle ?? null,
        prendas: l.prendas,
        costoPrenda: costo,
        ...totales(l.prendas, l.precioDocenaUsd ?? docenaUsd),
      };
    });
    const d = await dineroRepository.crearDespacho(
      {
        clienteId: input.clienteId,
        fecha: diaADate(input.fecha),
        vence: diaADate(input.vence ?? sumarDias(input.fecha, cliente.plazoDias)),
        tasaCambio: tasa,
        notas: input.notas ?? null,
      },
      lineas,
    );
    await configuracionRepository.recordarTasa(input.tasaCambio);
    return aDespachoDTO(d);
  },

  async eliminarDespacho(id: string): Promise<void> {
    if (!(await dineroRepository.obtenerDespacho(id))) {
      throw new AppError('NO_ENCONTRADO', 'Despacho no encontrado', 404);
    }
    await dineroRepository.eliminarDespacho(id);
  },

  // ── Cobros ──
  async listarCobros(): Promise<CobroDTO[]> {
    return (await dineroRepository.listarCobros()).map(aCobroDTO);
  },

  /** Guarda el monto en su moneda y sus dos equivalentes, calculados una vez a
   *  la tasa del día: en $us descuenta la deuda del cliente; en Bs, la ganancia.
   *  En $us entra a la caja de dólares. */
  async crearCobro(input: CobroInput): Promise<CobroDTO> {
    await clienteOError(input.clienteId);
    const config = await configuracionRepository.obtener();
    const tasa = input.tasaCambio ?? config.tasaCambioUsd;
    const enUsd = input.moneda === 'USD';
    const c = await dineroRepository.crearCobro({
      clienteId: input.clienteId,
      fecha: diaADate(input.fecha),
      moneda: input.moneda,
      monto: input.monto,
      tasaCambio: tasa,
      usd: enUsd ? input.monto : bsAUsd(input.monto, tasa),
      bs: enUsd ? usdABs(input.monto, tasa) : input.monto,
      nota: input.nota ?? null,
      caja: enUsd ? 'dolares' : input.caja,
    });
    await configuracionRepository.recordarTasa(input.tasaCambio);
    return aCobroDTO(c);
  },

  async eliminarCobro(id: string): Promise<void> {
    if (!(await dineroRepository.obtenerCobro(id))) throw new AppError('NO_ENCONTRADO', 'Cobro no encontrado', 404);
    await dineroRepository.eliminarCobro(id);
  },

  // ── Proveedores: compras a crédito − pagos ──
  async proveedores(): Promise<ProveedorDeudaDTO[]> {
    const [compras, pagos] = await Promise.all([
      dineroRepository.comprasCredito(),
      dineroRepository.pagosProveedor(),
    ]);
    // una deuda por proveedor y moneda: lo de $us se debe y se paga en $us
    const mapa = new Map<string, ProveedorDeudaDTO>();
    const de = (nombre: string, moneda: Moneda) => {
      const proveedor = normalizarProveedor(nombre);
      const k = `${proveedor}|${moneda}`;
      if (!mapa.has(k)) mapa.set(k, { proveedor, moneda, comprasCredito: 0, pagado: 0, deuda: 0, movimientos: [] });
      return mapa.get(k)!;
    };
    for (const c of compras) {
      const p = de(c.tienda, c.moneda);
      p.comprasCredito += montoCompra(c);
      p.movimientos.push({
        tipo: 'compra',
        id: c.id,
        fecha: dateADia(c.fecha),
        detalle: `${c.insumo.nombre}${c.codigoCorte ? ` · COD ${c.codigoCorte}` : ''}`,
        monto: montoCompra(c),
      });
    }
    for (const x of pagos) {
      const p = de(x.proveedor, x.moneda);
      p.pagado += x.monto;
      p.movimientos.push({ tipo: 'pago', id: x.id, fecha: dateADia(x.fecha), detalle: x.nota ?? 'pago', monto: x.monto });
    }
    const lista = [...mapa.values()].map((p) => ({
      ...p,
      deuda: p.comprasCredito - p.pagado,
      movimientos: p.movimientos.sort((a, b) => b.fecha.localeCompare(a.fecha)),
    }));
    return lista.sort(
      (a, b) => a.moneda.localeCompare(b.moneda) * -1 || b.deuda - a.deuda || a.proveedor.localeCompare(b.proveedor, 'es'),
    );
  },

  async crearPagoProveedor(input: PagoProveedorInput): Promise<ProveedorDeudaDTO[]> {
    await dineroRepository.crearPagoProveedor({
      proveedor: input.proveedor,
      fecha: diaADate(input.fecha),
      moneda: input.moneda,
      monto: input.monto,
      nota: input.nota ?? null,
      caja: input.moneda === 'USD' ? 'dolares' : input.caja,
    });
    return this.proveedores();
  },

  async eliminarPagoProveedor(id: string): Promise<void> {
    if (!(await dineroRepository.obtenerPagoProveedor(id))) {
      throw new AppError('NO_ENCONTRADO', 'Pago no encontrado', 404);
    }
    await dineroRepository.eliminarPagoProveedor(id);
  },

  // ── El camino de la plata (para entenderlo de un vistazo) ──
  /** Cada corte, en su paso, con lo que ya está puesto y lo que falta para
   *  terminarlo. Lo puesto crece con los pasos: en mesa, la tela y el corte;
   *  en costura, además los insumos de costura; en lavandería, además la
   *  costura; en empaque, además la lavandería; en depósito, todo. */
  async camino(): Promise<CaminoDTO> {
    const hoy = hoyEnBolivia();
    const [anio, mes] = hoy.split('-').map(Number);
    const { inicio: desde, fin: hasta } = rangoMesUTC(anio, mes);
    const [{ config, fichas, fijo }, cortes, despachadas, pedidos, cxc, cobrosMes] = await Promise.all([
      contexto(),
      costosRepository.cortesParaCosto(undefined, true),
      dineroRepository.despachadasPorCorte(),
      this.listarPedidos(),
      this.cuentasPorCobrar(),
      dineroRepository.listarCobros({ desde, hasta }),
    ]);
    const precioPedido = new Map(
      pedidos.filter((p) => p.corte && p.estado !== 'cancelado').map((p) => [p.corte!.id, p.precioDocenaUsd]),
    );
    const tasa = config.tasaCambioUsd;
    const orden: Record<PasoCorte, number> = { mesa: 0, costura: 1, lavanderia: 2, empaque: 3, deposito: 4 };
    const avisos: string[] = [];
    const lista: CorteEnCaminoDTO[] = [];
    for (const c of cortes) {
      const disponibles = c.cantidadTotal - (despachadas.get(c.id) ?? 0);
      if (disponibles <= 0) continue; // ya se entregó todo
      const f = fichaDeCorte(c, fichas);
      const p = partesDeCorte(c, f, config);
      const n = orden[c.paso];
      // lo que ya se hizo según el paso (true = ya está puesto)
      const hecho = { costura: n >= 1, manoCostura: n >= 2, externos: n >= 3, empaque: n >= 4 };
      const externosFalta = c.paso === 'lavanderia' ? p.externosPendientes : hecho.externos ? 0 : p.externos;
      const desglose = {
        insumosCostura: hecho.costura ? 0 : p.insumosCostura,
        insumosEmpaque: hecho.empaque ? 0 : p.insumosEmpaque,
        manoDeObra: (hecho.manoCostura ? 0 : p.manoCostura) + (hecho.empaque ? 0 : p.manoEmpaque),
        servicios: externosFalta,
      };
      const total =
        p.materiaPrima + p.servicioCorte + p.insumosCostura + p.insumosEmpaque + p.manoCostura + p.manoEmpaque + p.externos;
      const falta = desglose.insumosCostura + desglose.insumosEmpaque + desglose.manoDeObra + desglose.servicios;
      // en depósito solo cuenta lo que queda sin entregar
      const parte = (x: number) => (c.paso === 'deposito' ? Math.round((x * disponibles) / c.cantidadTotal) : x);
      const docena = precioPedido.get(c.id) ?? (f ? calcularFicha(f, config, fijo).ventaDocenaUsd : null);
      const valeUsd = docena != null ? totalPorDocena(c.paso === 'deposito' ? disponibles : c.cantidadTotal, docena) : null;
      const dias = Math.max(0, Math.floor((Date.now() - c.pasoDesde.getTime()) / 86_400_000));
      if (!f) avisos.push(`COD ${c.codigo}: su modelo no tiene ficha de costo, faltan los insumos y el precio.`);
      lista.push({
        corteId: c.id,
        codigo: c.codigo,
        modelo: c.version.modelo.nombre,
        prendas: c.paso === 'deposito' ? disponibles : c.cantidadTotal,
        paso: c.paso,
        dias,
        semaforo: semaforoPaso(c.paso, dias),
        invertido: parte(total - falta),
        falta,
        desglose,
        vale: valeUsd != null ? usdABs(valeUsd, tasa) : null,
        valeUsd,
      });
    }
    const pasos = PASOS_CORTE.map((paso) => {
      const cs = lista.filter((x) => x.paso === paso).sort((a, b) => b.dias - a.dias);
      return {
        paso,
        prendas: cs.reduce((a, x) => a + x.prendas, 0),
        invertido: cs.reduce((a, x) => a + x.invertido, 0),
        falta: cs.reduce((a, x) => a + x.falta, 0),
        vale: cs.reduce((a, x) => a + (x.vale ?? 0), 0),
        valeUsd: cs.reduce((a, x) => a + (x.valeUsd ?? 0), 0),
        cortes: cs,
      };
    });
    const enPuerta = pedidos.filter((p) => p.estado === 'pendiente');
    const sumaDesglose = (k: keyof CorteEnCaminoDTO['desglose']) => lista.reduce((a, x) => a + x.desglose[k], 0);
    const pedidosUsd = enPuerta.reduce((a, p) => a + p.ventaUsd, 0);
    return {
      tasaCambio: tasa,
      pedidos: {
        cantidad: enPuerta.length,
        prendas: enPuerta.reduce((a, p) => a + p.prendas, 0),
        necesitas: enPuerta.reduce((a, p) => a + p.costo, 0),
        vale: usdABs(pedidosUsd, tasa),
        valeUsd: pedidosUsd,
      },
      pasos,
      porCobrar: {
        totalUsd: cxc.totalUsd,
        total: usdABs(cxc.totalUsd, tasa),
        vencidoUsd: cxc.vencidoUsd,
        clientes: new Set(cxc.items.map((i) => i.cliente.id)).size,
      },
      cobradoMes: cobrosMes.reduce((a, c) => a + c.bs, 0),
      cobradoMesUsd: cobrosMes.reduce((a, c) => a + c.usd, 0),
      resumen: {
        invertido: pasos.reduce((a, p) => a + p.invertido, 0),
        falta: pasos.reduce((a, p) => a + p.falta, 0),
        desglose: {
          insumosCostura: sumaDesglose('insumosCostura'),
          insumosEmpaque: sumaDesglose('insumosEmpaque'),
          manoDeObra: sumaDesglose('manoDeObra'),
          servicios: sumaDesglose('servicios'),
        },
      },
      avisos,
    };
  },

  /** Lo marca una persona: dónde está el corte ahora. No toca pagos. */
  async cambiarPaso(corteId: string, paso: PasoCorte): Promise<void> {
    if (!(await dineroRepository.cambiarPaso(corteId, paso))) {
      throw new AppError('NO_ENCONTRADO', 'Corte no encontrado', 404);
    }
  },

  // ── Cuentas por cobrar: despachos sin pagar ──
  /** A cada cliente sus cobros le cancelan primero los despachos más viejos;
   *  lo que queda de cada despacho vence en su fecha. */
  async cuentasPorCobrar(): Promise<CuentasPorCobrarDTO> {
    const hoy = hoyEnBolivia();
    const [despachos, cobros, clientes, config] = await Promise.all([
      dineroRepository.listarDespachos(),
      dineroRepository.listarCobros(),
      dineroRepository.listarClientes(),
      configuracionRepository.obtener(),
    ]);
    const celular = new Map(clientes.map((c) => [c.id, c.celular]));
    // todo en $us: un cobro en Bs descuenta su equivalente
    const cobrado = new Map<string, number>();
    for (const c of cobros) cobrado.set(c.clienteId, (cobrado.get(c.clienteId) ?? 0) + c.usd);

    const items: CuentaPorCobrarDTO[] = [];
    const viejosPrimero = [...despachos].sort(
      (a, b) => a.fecha.getTime() - b.fecha.getTime() || a.creadoEn.getTime() - b.creadoEn.getTime(),
    );
    for (const d of viejosPrimero) {
      const total = d.lineas.reduce((a, l) => a + l.totalUsd, 0);
      const disponible = cobrado.get(d.clienteId) ?? 0;
      const aplicado = Math.min(disponible, total);
      cobrado.set(d.clienteId, disponible - aplicado);
      if (total - aplicado <= 0) continue;
      const prendas = d.lineas.reduce((a, l) => a + l.prendas, 0);
      items.push({
        despachoId: d.id,
        cliente: { ...d.cliente, celular: celular.get(d.clienteId) ?? null },
        fecha: dateADia(d.fecha),
        vence: dateADia(d.vence),
        detalle: `${d.lineas.map((l) => l.descripcion).join(', ')} · ${prendas} prendas`,
        totalUsd: total,
        cobradoUsd: aplicado,
        pendienteUsd: total - aplicado,
      });
    }
    items.sort((a, b) => a.vence.localeCompare(b.vence) || b.pendienteUsd - a.pendienteUsd);
    const enSemana = sumarDias(hoy, 7);
    const suma = (xs: CuentaPorCobrarDTO[]) => xs.reduce((a, x) => a + x.pendienteUsd, 0);
    const nombres = new Map(clientes.map((c) => [c.id, c.nombre]));
    return {
      hoy,
      tasaCambio: config.tasaCambioUsd,
      items,
      totalUsd: suma(items),
      vencidoUsd: suma(items.filter((x) => x.vence < hoy)),
      semanaUsd: suma(items.filter((x) => x.vence >= hoy && x.vence <= enSemana)),
      // lo que sobra de los cobros: el cliente pagó de más (adelanto)
      adelantos: [...cobrado]
        .filter(([, m]) => m > 0)
        .map(([id, montoUsd]) => ({ id, nombre: nombres.get(id) ?? '', montoUsd })),
    };
  },

  // ── Cuentas por pagar: proveedores, servicios, operarios y banco ──
  /** A cada proveedor sus pagos le cancelan primero las compras más viejas;
   *  lo que queda de cada compra vence en su fecha. Servicios externos y
   *  operarios: saldo a favor del mes, se paga al cerrar el mes. */
  async cuentasPorPagar(): Promise<CuentasPorPagarDTO> {
    const hoy = hoyEnBolivia();
    const [anio, mes] = hoy.split('-').map(Number);
    const finMes = dateADia(new Date(Date.UTC(anio, mes, 0)));
    const [compras, pagos, consolidado, fijos, config] = await Promise.all([
      dineroRepository.comprasCredito(),
      dineroRepository.pagosProveedor(),
      liquidacionService.consolidado(anio, mes),
      fijosService.mes(anio, mes),
      configuracionRepository.obtener(),
    ]);
    const tasa = config.tasaCambioUsd;
    const items: CuentaPorPagarDTO[] = [];
    const enBs = (monto: number) => ({ moneda: 'BOB' as const, monto, montoBs: monto });

    // los pagos en $us cancelan las compras en $us; los de Bs, las de Bs
    const pagado = new Map<string, number>();
    const clave = (proveedor: string, moneda: Moneda) => `${normalizarProveedor(proveedor)}|${moneda}`;
    for (const p of pagos) pagado.set(clave(p.proveedor, p.moneda), (pagado.get(clave(p.proveedor, p.moneda)) ?? 0) + p.monto);
    const viejasPrimero = [...compras].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
    for (const c of viejasPrimero) {
      const k = clave(c.tienda, c.moneda);
      const monto = montoCompra(c);
      const disponible = pagado.get(k) ?? 0;
      const cubierto = Math.min(disponible, monto);
      pagado.set(k, disponible - cubierto);
      if (monto - cubierto <= 0) continue;
      const falta = monto - cubierto;
      items.push({
        id: `compra:${c.id}`,
        tipo: 'proveedor',
        acreedor: normalizarProveedor(c.tienda),
        detalle: `${c.insumo.nombre} del ${dateADia(c.fecha).split('-').reverse().join('/')}${c.codigoCorte ? ` · COD ${c.codigoCorte}` : ''}${cubierto > 0 ? ' (pagada en parte)' : ''}`,
        moneda: c.moneda,
        monto: falta,
        montoBs: c.moneda === 'USD' ? usdABs(falta, tasa) : falta,
        vence: c.vence ? dateADia(c.vence) : null,
        enlace: '/compras?tab=proveedores',
      });
    }

    const externas = new Set<Cuenta>(SERVICIOS_EXTERNOS);
    const operarios = new Map<Cuenta, number>();
    if (!consolidado.cerrado) {
      for (const cuenta of consolidado.cuentas) {
        for (const f of cuenta.filas) {
          if (f.saldoPeriodo <= 0) continue;
          if (externas.has(cuenta.cuenta)) {
            items.push({
              id: `servicio:${cuenta.cuenta}:${f.operarioId}`,
              tipo: 'servicio',
              acreedor: f.nombre,
              detalle: ETIQUETA_CUENTA[cuenta.cuenta],
              ...enBs(f.saldoPeriodo),
              vence: finMes,
              enlace: `/liquidacion?cuenta=${cuenta.cuenta}`,
            });
          } else {
            operarios.set(cuenta.cuenta, (operarios.get(cuenta.cuenta) ?? 0) + f.saldoPeriodo);
          }
        }
      }
    }
    for (const [cuenta, monto] of operarios) {
      items.push({
        id: `operarios:${cuenta}`,
        tipo: 'operarios',
        acreedor: 'Operarios',
        detalle: `${ETIQUETA_CUENTA[cuenta]} · saldo a favor del mes`,
        ...enBs(monto),
        vence: finMes,
        enlace: `/liquidacion?cuenta=${cuenta}`,
      });
    }

    for (const p of fijos.prestamos.filter((x) => x.activo && !x.pago)) {
      items.push({
        id: `banco:${p.id}`,
        tipo: 'banco',
        acreedor: p.banco,
        detalle: `Cuota de ${mes}/${anio}${p.cuotasRestantes != null ? ` · quedan ${p.cuotasRestantes} cuotas` : ''}`,
        ...enBs(p.cuota),
        vence: p.vence,
        enlace: '/costos-fijos',
      });
    }

    items.sort((a, b) => (a.vence ?? '9999').localeCompare(b.vence ?? '9999') || b.montoBs - a.montoBs);
    const enSemana = sumarDias(hoy, 7);
    const suma = (xs: CuentaPorPagarDTO[]) => xs.reduce((a, x) => a + x.montoBs, 0);
    return {
      hoy,
      tasaCambio: tasa,
      items,
      total: suma(items),
      totalUsd: items.filter((x) => x.moneda === 'USD').reduce((a, x) => a + x.monto, 0),
      vencido: suma(items.filter((x) => x.vence != null && x.vence < hoy)),
      semana: suma(items.filter((x) => x.vence != null && x.vence >= hoy && x.vence <= enSemana)),
    };
  },

  // ── Tablero ──
  async tablero(): Promise<TableroDTO> {
    const hoy = hoyEnBolivia();
    const [anio, mes] = hoy.split('-').map(Number);
    const { inicio: desde, fin: hasta } = rangoMesUTC(anio, mes);
    const [cortes, pedidos, clientes, insumos, stock, consolidado, fijos, proveedores, despachosMes, cobrosMes, config] =
      await Promise.all([
        cortesDinero(),
        this.listarPedidos(),
        this.listarClientes(),
        costosRepository.listarInsumos(),
        stockPorInsumo(),
        liquidacionService.consolidado(anio, mes),
        fijosService.mes(anio, mes),
        this.proveedores(),
        dineroRepository.listarDespachos({ desde, hasta }),
        dineroRepository.listarCobros({ desde, hasta }),
        configuracionRepository.obtener(),
      ]);
    const tasa = config.tasaCambioUsd;
    const avisos: string[] = [];

    // etapas del producto
    const enPuerta = etapa(
      pedidos
        .filter((p) => p.estado === 'pendiente')
        .map((p) => ({
          id: p.id,
          titulo: `${p.ficha.nombre}`,
          detalle: `${p.cliente.nombre}${p.fechaEntrega ? ` · entrega ${p.fechaEntrega.split('-').reverse().join('/')}` : ''}`,
          prendas: p.prendas,
          costo: p.costo,
          venta: usdABs(p.ventaUsd, tasa),
          ventaUsd: p.ventaUsd,
          faltaPagar: p.costo, // todavía no se invirtió nada
        })),
    );
    const vivos = cortes.filter((c) => c.disponibles > 0);
    const enProduccion = etapa(vivos.filter((c) => c.etapa === 'produccion').map(itemCorte));
    const enServicios = etapa(vivos.filter((c) => c.etapa === 'servicios').map(itemCorte));
    const deposito = etapa(vivos.filter((c) => c.etapa === 'deposito').map(itemCorte));
    if (vivos.some((c) => c.precioDocenaUsd == null)) {
      avisos.push(
        'Hay cortes cuyo modelo no tiene ficha de costo vinculada: su precio de venta no se conoce y no entran en la ganancia. Vinculá la ficha en Costos.',
      );
    }
    if (deposito.items.length > 0) {
      avisos.push(
        'Si alguna prenda del depósito ya se vendió antes de usar el tablero, registrá su despacho para que no se cuente dos veces.',
      );
    }

    // por cobrar (en $us; en Bs al último tipo de cambio)
    const deudores = clientes
      .filter((c) => c.porCobrarUsd !== 0)
      .map((c) => ({ id: c.id, nombre: c.nombre, montoUsd: c.porCobrarUsd }))
      .sort((a, b) => b.montoUsd - a.montoUsd);
    const porCobrarUsd = deudores.reduce((a, c) => a + c.montoUsd, 0);
    const porCobrar = { total: usdABs(Math.max(0, porCobrarUsd), tasa), totalUsd: porCobrarUsd, clientes: deudores };

    // insumos en depósito: stock × precio de la última compra
    let sinPrecio = 0;
    const valorInsumos = insumos.reduce(
      (acc, i) => {
        const s = stock.get(i.id)?.stock ?? 0;
        if (s <= 0) return acc;
        const ultima = i.compras[0];
        if (!ultima) {
          sinPrecio += 1;
          return acc;
        }
        return [...acc, costoDeCantidad(fr(s), precioUnitario(ultima))];
      },
      [] as ReturnType<typeof costoDeCantidad>[],
    );
    const insumosValor = valorInsumos.reduce((a, f) => a + redondear(f), 0);
    if (insumos.some((i) => (stock.get(i.id)?.stock ?? 0) > 0 && !stock.get(i.id)?.conteo)) {
      avisos.push(
        'Hay insumos sin conteo físico: su stock suma todo lo comprado y puede estar inflado. Contalos en Inventario.',
      );
    }

    // operarios y servicios: saldos del mes en cada cuenta
    const externas = new Set<Cuenta>(SERVICIOS_EXTERNOS);
    let adelantado = 0;
    let operarios = 0;
    const porCuenta = new Map<Cuenta, number>();
    for (const cuenta of consolidado.cuentas) {
      for (const f of cuenta.filas) {
        const saldo = consolidado.cerrado ? (f.saldoSalida ?? 0) : f.saldoPeriodo;
        if (saldo < 0) adelantado += -saldo;
        else if (externas.has(cuenta.cuenta)) porCuenta.set(cuenta.cuenta, (porCuenta.get(cuenta.cuenta) ?? 0) + saldo);
        else operarios += saldo;
      }
    }
    const servicios = [...porCuenta].filter(([, m]) => m > 0).map(([cuenta, monto]) => ({ cuenta, monto }));
    const deudaServicios = servicios.reduce((a, s) => a + s.monto, 0);
    const deudaProveedores = proveedores
      .filter((p) => p.deuda !== 0)
      .map((p) => ({
        proveedor: p.proveedor,
        moneda: p.moneda,
        monto: p.deuda,
        montoBs: p.moneda === 'USD' ? Math.sign(p.deuda) * usdABs(Math.abs(p.deuda), tasa) : p.deuda,
      }));
    const totalProveedores = deudaProveedores.reduce((a, p) => a + p.montoBs, 0);
    const totalDeudas = totalProveedores + deudaServicios + operarios;

    const tenes =
      insumosValor + enProduccion.costo + enServicios.costo + deposito.costo + porCobrar.total + adelantado;

    // resultado del mes
    const ventas = despachosMes.reduce((a, d) => a + d.lineas.reduce((x, l) => x + l.totalBs, 0), 0);
    const ventasUsd = despachosMes.reduce((a, d) => a + d.lineas.reduce((x, l) => x + l.totalUsd, 0), 0);
    const costoVendido = despachosMes.reduce(
      (a, d) => a + d.lineas.reduce((x, l) => x + l.prendas * l.costoPrenda, 0),
      0,
    );
    const margen = ventas - costoVendido;
    const operativo = margen - fijos.totalGastos;
    const prestamos = fijos.prestamos.filter((p) => p.activo);

    return {
      anio,
      mes,
      enPuerta,
      enProduccion,
      enServicios,
      deposito,
      tasaCambio: tasa,
      porCobrar,
      insumos: { valor: insumosValor, sinPrecio },
      anticiposAdelantados: adelantado,
      tenes,
      deudas: {
        proveedores: {
          total: totalProveedores,
          lista: deudaProveedores,
        },
        servicios: { total: deudaServicios, porCuenta: servicios },
        operarios,
        total: totalDeudas,
      },
      capitalDeTrabajo: tenes - totalDeudas,
      banco: {
        cuotaMes: fijos.totalDeuda,
        prestamos: prestamos.map((p) => ({
          banco: p.banco,
          cuota: p.cuota,
          cuotasRestantes: p.cuotasRestantes,
          pagadaEsteMes: p.pago != null,
        })),
      },
      resultadoMes: {
        ventas,
        ventasUsd,
        costoVendido,
        margen,
        gastosFijos: fijos.totalGastos,
        operativo,
        cuotaBanco: fijos.totalDeuda,
        queda: operativo - fijos.totalDeuda,
        cobrado: cobrosMes.reduce((a, c) => a + c.bs, 0),
        cobradoUsd: cobrosMes.reduce((a, c) => a + c.usd, 0),
        prendasDespachadas: despachosMes.reduce((a, d) => a + d.lineas.reduce((x, l) => x + l.prendas, 0), 0),
      },
      avisos,
    };
  },
};
