// Tablero de dinero (docs/PLAN_TABLERO_DINERO.md). NO toca pagos: lee cortes,
// liquidación, compras y costos fijos; guarda solo clientes, pedidos,
// despachos, cobros y pagos a proveedores.
import type { Configuracion } from '@prisma/client';
import {
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
  type CorteDineroDTO,
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
  type PagoProveedorInput,
  type PedidoDTO,
  type PedidoInput,
  type ProveedorDeudaDTO,
  type TableroDTO,
  type TableroItemDTO,
} from '@taller/shared';
import { hoyEnBolivia } from '../../lib/hoy.js';
import { AppError } from '../../middleware/errors.js';
import { configuracionRepository } from '../configuracion/repository.js';
import { costosRepository, type FichaConDatos } from '../costos/repository.js';
import { calcularFicha } from '../costos/service.js';
import { costoRealCorte, fichaDeCorte, stockPorInsumo } from '../costos/produccion.js';
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
 *  resultado del mes) y precio de venta tal como lo muestra la ficha. */
function precioYCosto(f: FichaConDatos, config: Configuracion, fijo: ReturnType<typeof fr>) {
  return { costo: calcularFicha(f, config).total, precio: calcularFicha(f, config, fijo).precioVenta };
}

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
    pedidos.filter((p) => p.corteId && p.estado !== 'cancelado').map((p) => [p.corteId!, p.precioPrenda]),
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
    const precio = precioPedido.get(c.id) ?? (f ? precioYCosto(f, config, fijo).precio : null);
    return {
      corteId: c.id,
      codigo: c.codigo,
      modeloNombre: c.version.modelo.nombre,
      etapa,
      prendas: c.cantidadTotal,
      despachadas: vendidas,
      disponibles,
      costoPrenda: d.realPorPrenda,
      precioPrenda: precio,
      // costo de las disponibles: costo real × disponibles ÷ prendas, un redondeo
      costo: redondear({ num: BigInt(d.realTotal * disponibles), den: BigInt(c.cantidadTotal) }),
      venta: precio != null ? precio * disponibles : null,
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
  faltaPagar: c.faltaPagar,
});

// ── DTOs ──

function aPedidoDTO(p: PedidoConDatos, costoPrenda: number): PedidoDTO {
  return {
    id: p.id,
    cliente: p.cliente,
    ficha: p.ficha,
    prendas: p.prendas,
    precioPrenda: p.precioPrenda,
    costoPrenda,
    venta: p.prendas * p.precioPrenda,
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
    notas: d.notas,
    lineas: d.lineas.map((l) => ({
      id: l.id,
      corte: l.corte,
      ficha: l.ficha,
      descripcion: l.descripcion,
      detalle: l.detalle,
      prendas: l.prendas,
      precioPrenda: l.precioPrenda,
      costoPrenda: l.costoPrenda,
      total: l.total,
    })),
    prendas: d.lineas.reduce((a, l) => a + l.prendas, 0),
    total: d.lineas.reduce((a, l) => a + l.total, 0),
    costo: d.lineas.reduce((a, l) => a + l.prendas * l.costoPrenda, 0),
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
        despachado: t.despachado,
        cobrado: t.cobrado,
        porCobrar: t.despachado - t.cobrado,
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
    const { costo, precio } = precioYCosto(f, config, fijo);
    const p = await dineroRepository.crearPedido({
      clienteId: input.clienteId,
      fichaId: input.fichaId,
      prendas: input.prendas,
      precioPrenda: input.precioPrenda ?? precio,
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
      ...(input.precioPrenda !== undefined ? { precioPrenda: input.precioPrenda } : {}),
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
   *  costos fijos). Un corte tiene que estar cerrado y no se despacha de más. */
  async crearDespacho(input: DespachoInput): Promise<DespachoDTO> {
    const cliente = await clienteOError(input.clienteId);
    const [{ config, fichas, fijo }, cortes] = await Promise.all([contexto(), cortesDinero()]);
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
        const precio = l.precioPrenda ?? c.precioPrenda;
        if (precio == null) {
          throw new AppError('SIN_PRECIO', `Indicá el precio del COD ${c.codigo}: su modelo no tiene ficha`, 400);
        }
        return {
          corteId: c.corteId,
          fichaId: null,
          descripcion: `COD ${c.codigo} · ${c.modeloNombre}`,
          detalle: l.detalle ?? null,
          prendas: l.prendas,
          precioPrenda: precio,
          costoPrenda: c.costoPrenda,
          total: l.prendas * precio,
        };
      }
      const f = fichas.find((x) => x.id === l.fichaId);
      if (!f) throw new AppError('NO_ENCONTRADO', 'Ficha de costo no encontrada', 404);
      const { costo, precio } = precioYCosto(f, config, fijo);
      const precioFinal = l.precioPrenda ?? precio;
      return {
        corteId: null,
        fichaId: f.id,
        descripcion: f.nombre,
        detalle: l.detalle ?? null,
        prendas: l.prendas,
        precioPrenda: precioFinal,
        costoPrenda: costo,
        total: l.prendas * precioFinal,
      };
    });
    const d = await dineroRepository.crearDespacho(
      {
        clienteId: input.clienteId,
        fecha: diaADate(input.fecha),
        vence: diaADate(input.vence ?? sumarDias(input.fecha, cliente.plazoDias)),
        notas: input.notas ?? null,
      },
      lineas,
    );
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
    return (await dineroRepository.listarCobros()).map((c) => ({
      id: c.id,
      cliente: c.cliente,
      fecha: dateADia(c.fecha),
      monto: c.monto,
      nota: c.nota,
      caja: c.caja,
    }));
  },

  async crearCobro(input: CobroInput): Promise<CobroDTO> {
    await clienteOError(input.clienteId);
    const c = await dineroRepository.crearCobro({
      clienteId: input.clienteId,
      fecha: diaADate(input.fecha),
      monto: input.monto,
      nota: input.nota ?? null,
      caja: input.caja,
    });
    return { id: c.id, cliente: c.cliente, fecha: dateADia(c.fecha), monto: c.monto, nota: c.nota, caja: c.caja };
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
    const mapa = new Map<string, ProveedorDeudaDTO>();
    const de = (nombre: string) => {
      const k = normalizarProveedor(nombre);
      if (!mapa.has(k)) mapa.set(k, { proveedor: k, comprasCredito: 0, pagado: 0, deuda: 0, movimientos: [] });
      return mapa.get(k)!;
    };
    for (const c of compras) {
      const p = de(c.tienda);
      p.comprasCredito += c.precioTotal;
      p.movimientos.push({
        tipo: 'compra',
        id: c.id,
        fecha: dateADia(c.fecha),
        detalle: `${c.insumo.nombre}${c.codigoCorte ? ` · COD ${c.codigoCorte}` : ''}`,
        monto: c.precioTotal,
      });
    }
    for (const x of pagos) {
      const p = de(x.proveedor);
      p.pagado += x.monto;
      p.movimientos.push({ tipo: 'pago', id: x.id, fecha: dateADia(x.fecha), detalle: x.nota ?? 'pago', monto: x.monto });
    }
    const lista = [...mapa.values()].map((p) => ({
      ...p,
      deuda: p.comprasCredito - p.pagado,
      movimientos: p.movimientos.sort((a, b) => b.fecha.localeCompare(a.fecha)),
    }));
    return lista.sort((a, b) => b.deuda - a.deuda || a.proveedor.localeCompare(b.proveedor, 'es'));
  },

  async crearPagoProveedor(input: PagoProveedorInput): Promise<ProveedorDeudaDTO[]> {
    await dineroRepository.crearPagoProveedor({
      proveedor: input.proveedor,
      fecha: diaADate(input.fecha),
      monto: input.monto,
      nota: input.nota ?? null,
      caja: input.caja,
    });
    return this.proveedores();
  },

  async eliminarPagoProveedor(id: string): Promise<void> {
    if (!(await dineroRepository.obtenerPagoProveedor(id))) {
      throw new AppError('NO_ENCONTRADO', 'Pago no encontrado', 404);
    }
    await dineroRepository.eliminarPagoProveedor(id);
  },

  // ── Cuentas por cobrar: despachos sin pagar ──
  /** A cada cliente sus cobros le cancelan primero los despachos más viejos;
   *  lo que queda de cada despacho vence en su fecha. */
  async cuentasPorCobrar(): Promise<CuentasPorCobrarDTO> {
    const hoy = hoyEnBolivia();
    const [despachos, cobros, clientes] = await Promise.all([
      dineroRepository.listarDespachos(),
      dineroRepository.listarCobros(),
      dineroRepository.listarClientes(),
    ]);
    const celular = new Map(clientes.map((c) => [c.id, c.celular]));
    const cobrado = new Map<string, number>();
    for (const c of cobros) cobrado.set(c.clienteId, (cobrado.get(c.clienteId) ?? 0) + c.monto);

    const items: CuentaPorCobrarDTO[] = [];
    const viejosPrimero = [...despachos].sort(
      (a, b) => a.fecha.getTime() - b.fecha.getTime() || a.creadoEn.getTime() - b.creadoEn.getTime(),
    );
    for (const d of viejosPrimero) {
      const total = d.lineas.reduce((a, l) => a + l.total, 0);
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
        total,
        cobrado: aplicado,
        pendiente: total - aplicado,
      });
    }
    items.sort((a, b) => a.vence.localeCompare(b.vence) || b.pendiente - a.pendiente);
    const enSemana = sumarDias(hoy, 7);
    const suma = (xs: CuentaPorCobrarDTO[]) => xs.reduce((a, x) => a + x.pendiente, 0);
    const nombres = new Map(clientes.map((c) => [c.id, c.nombre]));
    return {
      hoy,
      items,
      total: suma(items),
      vencido: suma(items.filter((x) => x.vence < hoy)),
      semana: suma(items.filter((x) => x.vence >= hoy && x.vence <= enSemana)),
      // lo que sobra de los cobros: el cliente pagó de más (adelanto)
      adelantos: [...cobrado]
        .filter(([, m]) => m > 0)
        .map(([id, monto]) => ({ id, nombre: nombres.get(id) ?? '', monto })),
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
    const [compras, pagos, consolidado, fijos] = await Promise.all([
      dineroRepository.comprasCredito(),
      dineroRepository.pagosProveedor(),
      liquidacionService.consolidado(anio, mes),
      fijosService.mes(anio, mes),
    ]);
    const items: CuentaPorPagarDTO[] = [];

    const pagado = new Map<string, number>();
    for (const p of pagos) pagado.set(normalizarProveedor(p.proveedor), (pagado.get(normalizarProveedor(p.proveedor)) ?? 0) + p.monto);
    const viejasPrimero = [...compras].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
    for (const c of viejasPrimero) {
      const prov = normalizarProveedor(c.tienda);
      const disponible = pagado.get(prov) ?? 0;
      const cubierto = Math.min(disponible, c.precioTotal);
      pagado.set(prov, disponible - cubierto);
      if (c.precioTotal - cubierto <= 0) continue;
      items.push({
        id: `compra:${c.id}`,
        tipo: 'proveedor',
        acreedor: prov,
        detalle: `${c.insumo.nombre} del ${dateADia(c.fecha).split('-').reverse().join('/')}${c.codigoCorte ? ` · COD ${c.codigoCorte}` : ''}${cubierto > 0 ? ' (pagada en parte)' : ''}`,
        monto: c.precioTotal - cubierto,
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
              monto: f.saldoPeriodo,
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
        monto,
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
        monto: p.cuota,
        vence: p.vence,
        enlace: '/costos-fijos',
      });
    }

    items.sort((a, b) => (a.vence ?? '9999').localeCompare(b.vence ?? '9999') || b.monto - a.monto);
    const enSemana = sumarDias(hoy, 7);
    const suma = (xs: CuentaPorPagarDTO[]) => xs.reduce((a, x) => a + x.monto, 0);
    return {
      hoy,
      items,
      total: suma(items),
      vencido: suma(items.filter((x) => x.vence != null && x.vence < hoy)),
      semana: suma(items.filter((x) => x.vence != null && x.vence >= hoy && x.vence <= enSemana)),
    };
  },

  // ── Tablero ──
  async tablero(): Promise<TableroDTO> {
    const hoy = hoyEnBolivia();
    const [anio, mes] = hoy.split('-').map(Number);
    const { inicio: desde, fin: hasta } = rangoMesUTC(anio, mes);
    const [cortes, pedidos, clientes, insumos, stock, consolidado, fijos, proveedores, despachosMes, cobrosMes] =
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
      ]);
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
          venta: p.venta,
          faltaPagar: p.costo, // todavía no se invirtió nada
        })),
    );
    const vivos = cortes.filter((c) => c.disponibles > 0);
    const enProduccion = etapa(vivos.filter((c) => c.etapa === 'produccion').map(itemCorte));
    const enServicios = etapa(vivos.filter((c) => c.etapa === 'servicios').map(itemCorte));
    const deposito = etapa(vivos.filter((c) => c.etapa === 'deposito').map(itemCorte));
    if (vivos.some((c) => c.precioPrenda == null)) {
      avisos.push(
        'Hay cortes cuyo modelo no tiene ficha de costo vinculada: su precio de venta no se conoce y no entran en la ganancia. Vinculá la ficha en Costos.',
      );
    }
    if (deposito.items.length > 0) {
      avisos.push(
        'Si alguna prenda del depósito ya se vendió antes de usar el tablero, registrá su despacho para que no se cuente dos veces.',
      );
    }

    // por cobrar
    const deudores = clientes
      .filter((c) => c.porCobrar !== 0)
      .map((c) => ({ id: c.id, nombre: c.nombre, monto: c.porCobrar }))
      .sort((a, b) => b.monto - a.monto);
    const porCobrar = { total: deudores.reduce((a, c) => a + c.monto, 0), clientes: deudores };

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
    const deudaProveedores = proveedores.filter((p) => p.deuda !== 0);
    const totalProveedores = deudaProveedores.reduce((a, p) => a + p.deuda, 0);
    const totalDeudas = totalProveedores + deudaServicios + operarios;

    const tenes =
      insumosValor + enProduccion.costo + enServicios.costo + deposito.costo + porCobrar.total + adelantado;

    // resultado del mes
    const ventas = despachosMes.reduce((a, d) => a + d.lineas.reduce((x, l) => x + l.total, 0), 0);
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
      porCobrar,
      insumos: { valor: insumosValor, sinPrecio },
      anticiposAdelantados: adelantado,
      tenes,
      deudas: {
        proveedores: {
          total: totalProveedores,
          lista: deudaProveedores.map((p) => ({ proveedor: p.proveedor, monto: p.deuda })),
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
        costoVendido,
        margen,
        gastosFijos: fijos.totalGastos,
        operativo,
        cuotaBanco: fijos.totalDeuda,
        queda: operativo - fijos.totalDeuda,
        cobrado: cobrosMes.reduce((a, c) => a + c.monto, 0),
        prendasDespachadas: despachosMes.reduce((a, d) => a + d.lineas.reduce((x, l) => x + l.prendas, 0), 0),
      },
      avisos,
    };
  },
};
