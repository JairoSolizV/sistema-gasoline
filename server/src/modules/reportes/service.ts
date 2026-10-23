// Reportes para analizar después (docs/PLAN_DIDACTICO_REPORTES.md). Solo
// lectura: arma resúmenes por mes, cliente, modelo y proveedor con lo que ya
// está registrado. No toca ningún pago.
import {
  calcularMargen,
  dateADia,
  esInsumoDeEmpaque,
  normalizarProveedor,
  type ComprasReporteDTO,
  type GananciaModeloDTO,
  type ProduccionReporteDTO,
  type RangoReporte,
  type VentasReporteDTO,
} from '@taller/shared';
import { prisma } from '../../lib/prisma.js';
import { diaEnBolivia } from '../../lib/hoy.js';
import { configuracionRepository } from '../configuracion/repository.js';
import { costosRepository } from '../costos/repository.js';
import { calcularFicha } from '../costos/service.js';
import { costoFijoPorPrenda } from '../costos/fijos.js';
import { costoRealCorte, fichaDeCorte } from '../costos/produccion.js';
import { movimientos } from '../caja/service.js';
import { dineroService } from '../dinero/service.js';

/** Los meses 'aaaa-mm' del rango, en orden. */
function mesesDe({ desde, hasta }: RangoReporte): string[] {
  const lista: string[] = [];
  let [a, m] = desde.split('-').map(Number);
  while (`${a}-${String(m).padStart(2, '0')}` <= hasta) {
    lista.push(`${a}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      a += 1;
    }
  }
  return lista;
}
/** [primer día del primer mes, primer día del mes siguiente al último). */
function limites(r: RangoReporte) {
  const [a, m] = r.hasta.split('-').map(Number);
  const fin = new Date(Date.UTC(a, m, 1));
  return { gte: new Date(`${r.desde}-01T00:00:00Z`), lt: fin, desdeDia: `${r.desde}-01`, hastaDia: dateADia(fin) };
}
const mesDe = (d: Date) => dateADia(d).slice(0, 7);
/** "COD 23 · CLASICO" → "CLASICO": el modelo de una línea de despacho. */
const modeloDeLinea = (l: { descripcion: string; corteId: string | null }) =>
  l.corteId ? l.descripcion.replace(/^COD \d+ · /, '') : l.descripcion;

export const reportesService = {
  async ventas(r: RangoReporte): Promise<VentasReporteDTO> {
    const { gte, lt } = limites(r);
    const [despachos, cobros, clientes] = await Promise.all([
      prisma.despacho.findMany({ where: { fecha: { gte, lt } }, include: { lineas: true, cliente: true } }),
      prisma.cobro.findMany({ where: { fecha: { gte, lt } } }),
      dineroService.listarClientes(),
    ]);
    const meses = mesesDe(r).map((mes) => {
      const ds = despachos.filter((d) => mesDe(d.fecha) === mes);
      const lineas = ds.flatMap((d) => d.lineas);
      const vendido = lineas.reduce((a, l) => a + l.totalBs, 0);
      const costo = lineas.reduce((a, l) => a + l.prendas * l.costoPrenda, 0);
      const cs = cobros.filter((c) => mesDe(c.fecha) === mes);
      return {
        mes,
        prendas: lineas.reduce((a, l) => a + l.prendas, 0),
        vendidoUsd: lineas.reduce((a, l) => a + l.totalUsd, 0),
        vendido,
        costo,
        ganancia: vendido - costo,
        cobradoUsd: cs.reduce((a, c) => a + c.usd, 0),
        cobrado: cs.reduce((a, c) => a + c.bs, 0),
      };
    });
    const porCliente = clientes
      .map((c) => {
        const lineas = despachos.filter((d) => d.clienteId === c.id).flatMap((d) => d.lineas);
        return {
          id: c.id,
          nombre: c.nombre,
          prendas: lineas.reduce((a, l) => a + l.prendas, 0),
          vendidoUsd: lineas.reduce((a, l) => a + l.totalUsd, 0),
          cobradoUsd: cobros.filter((x) => x.clienteId === c.id).reduce((a, x) => a + x.usd, 0),
          debeHoyUsd: c.porCobrarUsd,
        };
      })
      .filter((c) => c.vendidoUsd > 0 || c.cobradoUsd > 0 || c.debeHoyUsd !== 0)
      .sort((a, b) => b.vendidoUsd - a.vendidoUsd);
    const modelos = new Map<string, { prendas: number; vendidoUsd: number }>();
    for (const l of despachos.flatMap((d) => d.lineas)) {
      const k = modeloDeLinea(l);
      const x = modelos.get(k) ?? { prendas: 0, vendidoUsd: 0 };
      x.prendas += l.prendas;
      x.vendidoUsd += l.totalUsd;
      modelos.set(k, x);
    }
    return {
      meses,
      clientes: porCliente,
      modelos: [...modelos].map(([modelo, x]) => ({ modelo, ...x })).sort((a, b) => b.vendidoUsd - a.vendidoUsd),
    };
  },

  async produccion(r: RangoReporte): Promise<ProduccionReporteDTO> {
    const { gte, lt } = limites(r);
    const config = await configuracionRepository.obtener();
    const [todos, fichas] = await Promise.all([costosRepository.cortesParaCosto(), costosRepository.listarFichas()]);
    const enRango = (d: Date | null) => d != null && d >= gte && d < lt;
    const cerrados = await prisma.corte.findMany({
      where: { OR: [{ fechaInicio: { gte, lt } }, { fechaCierre: { gte, lt } }] },
      select: { id: true, fechaInicio: true, fechaCierre: true },
    });
    const fechas = new Map(cerrados.map((c) => [c.id, c]));
    const cortes = todos
      .filter((c) => fechas.has(c.id))
      .map((c) => {
        const f = fechas.get(c.id)!;
        const d = costoRealCorte(c, fichaDeCorte(c, fichas), config);
        const mano = d.rubros.filter((x) => x.rubro === 'costura' || x.rubro === 'empaque').reduce((a, x) => a + (x.real ?? 0), 0);
        return {
          id: c.id,
          codigo: c.codigo,
          modelo: c.version.modelo.nombre,
          prendas: c.cantidadTotal,
          inicio: diaEnBolivia(f.fechaInicio),
          cierre: f.fechaCierre ? diaEnBolivia(f.fechaCierre) : null,
          dias: f.fechaCierre ? Math.round((f.fechaCierre.getTime() - f.fechaInicio.getTime()) / 86_400_000) : null,
          costoPorPrenda: d.realPorPrenda,
          costura: mano,
          _inicio: f.fechaInicio,
          _cierre: f.fechaCierre,
        };
      })
      .sort((a, b) => b.codigo - a.codigo);
    const meses = mesesDe(r).map((mes) => {
      const cerr = cortes.filter((c) => c._cierre && enRango(c._cierre) && mesDe(c._cierre) === mes);
      return {
        mes,
        cortesIniciados: cortes.filter((c) => enRango(c._inicio) && mesDe(c._inicio) === mes).length,
        cortesCerrados: cerr.length,
        prendasTerminadas: cerr.reduce((a, c) => a + c.prendas, 0),
        costura: cerr.reduce((a, c) => a + c.costura, 0),
      };
    });
    const modelos = new Map<string, { cortes: number; prendas: number }>();
    for (const c of cortes) {
      const x = modelos.get(c.modelo) ?? { cortes: 0, prendas: 0 };
      x.cortes += 1;
      x.prendas += c.prendas;
      modelos.set(c.modelo, x);
    }
    return {
      meses,
      cortes: cortes.map(({ _inicio, _cierre, ...c }) => c),
      modelos: [...modelos].map(([modelo, x]) => ({ modelo, ...x })).sort((a, b) => b.prendas - a.prendas),
    };
  },

  async compras(r: RangoReporte): Promise<ComprasReporteDTO> {
    const { gte, lt, desdeDia, hastaDia } = limites(r);
    const [compras, movs] = await Promise.all([
      prisma.compraInsumo.findMany({
        where: { fecha: { gte, lt } },
        include: { insumo: { select: { categoria: true, nombre: true } } },
      }),
      movimientos(desdeDia, hastaDia),
    ]);
    // gastos que no son compras de insumos ni pagos a operarios: lo anotado a mano,
    // comida y demás compras de costos fijos y la cuota del banco
    const otros = movs.filter(
      (m) => m.tipo === 'egreso' && (m.origen === 'manual' || m.origen === 'compra_gasto' || m.origen === 'pago_prestamo'),
    );
    const meses = mesesDe(r).map((mes) => {
      const cs = compras.filter((c) => mesDe(c.fecha) === mes);
      const suma = (f: (c: (typeof cs)[number]) => boolean) => cs.filter(f).reduce((a, c) => a + c.precioTotal, 0);
      const tela = suma((c) => c.insumo.categoria === 'tela');
      const empaque = suma((c) => c.insumo.categoria !== 'tela' && esInsumoDeEmpaque(c.insumo.categoria, c.insumo.nombre));
      const costura = suma((c) => c.insumo.categoria !== 'tela' && !esInsumoDeEmpaque(c.insumo.categoria, c.insumo.nombre));
      const otrosGastos = otros.filter((m) => m.fecha.startsWith(mes)).reduce((a, m) => a + m.montoBs, 0);
      return { mes, tela, insumosCostura: costura, insumosEmpaque: empaque, otrosGastos, total: tela + costura + empaque + otrosGastos };
    });
    const proveedores = new Map<string, { total: number; aCredito: number; compras: number }>();
    for (const c of compras) {
      const k = normalizarProveedor(c.tienda);
      const x = proveedores.get(k) ?? { total: 0, aCredito: 0, compras: 0 };
      x.total += c.precioTotal;
      x.compras += 1;
      if (c.condicion === 'credito') x.aCredito += c.precioTotal;
      proveedores.set(k, x);
    }
    const categorias = new Map<string, number>();
    for (const m of movs.filter((x) => x.tipo === 'egreso' && x.categoria)) {
      categorias.set(m.categoria!.nombre, (categorias.get(m.categoria!.nombre) ?? 0) + m.montoBs);
    }
    return {
      meses,
      proveedores: [...proveedores].map(([proveedor, x]) => ({ proveedor, ...x })).sort((a, b) => b.total - a.total),
      categorias: [...categorias].map(([categoria, monto]) => ({ categoria, monto })).sort((a, b) => b.monto - a.monto),
    };
  },

  async ganancia(r: RangoReporte): Promise<GananciaModeloDTO> {
    const { gte, lt } = limites(r);
    const config = await configuracionRepository.obtener();
    const [despachos, fichas, fijo] = await Promise.all([
      prisma.despacho.findMany({ where: { fecha: { gte, lt } }, include: { lineas: true } }),
      costosRepository.listarFichas(),
      costoFijoPorPrenda(config),
    ]);
    const modelos = new Map<string, { prendas: number; vendidoUsd: number; vendido: number; costo: number }>();
    for (const l of despachos.flatMap((d) => d.lineas)) {
      const k = modeloDeLinea(l);
      const x = modelos.get(k) ?? { prendas: 0, vendidoUsd: 0, vendido: 0, costo: 0 };
      x.prendas += l.prendas;
      x.vendidoUsd += l.totalUsd;
      x.vendido += l.totalBs;
      x.costo += l.prendas * l.costoPrenda;
      modelos.set(k, x);
    }
    return {
      vendidos: [...modelos]
        .map(([modelo, x]) => {
          const ganancia = x.vendido - x.costo;
          return {
            modelo,
            ...x,
            ganancia,
            porPrenda: x.prendas ? Math.round(ganancia / x.prendas) : 0,
            margen: calcularMargen(ganancia, x.vendido),
          };
        })
        .sort((a, b) => b.ganancia - a.ganancia),
      fichas: fichas
        .map((f) => {
          const c = calcularFicha(f, config, fijo);
          const ganancia = c.precioVenta - c.total;
          return {
            id: f.id,
            nombre: f.nombre,
            costo: c.total,
            precio: c.precioVenta,
            ganancia,
            margen: calcularMargen(ganancia, c.precioVenta),
            docenaUsd: c.ventaDocenaUsd,
            docenaFija: c.precioDocenaFijo,
          };
        })
        .sort((a, b) => b.ganancia - a.ganancia),
    };
  },
};
