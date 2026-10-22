// Costos fijos del taller (docs/PLAN_COSTOS.md §7c). SOLO CONSULTA.
//  - cada gasto cuenta su PARTE DEL TALLER (monto × %), porque luz, agua y comida
//    se comparten con la casa;
//  - un gasto mensual vale el monto vigente; uno "por compras", la suma de las
//    compras anotadas en el mes;
//  - el préstamo carga la CUOTA COMPLETA (decisión del dueño: recuperación de deuda);
//  - para las fichas se usa un presupuesto mensual (montos vigentes, promedio de
//    las compras de los últimos 3 meses con compras y las cuotas) ÷ las prendas de
//    referencia de Configuración (1500): precio seguro aunque un mes salga poco.
import type { Configuracion } from '@prisma/client';
import {
  dateADia,
  diaADate,
  fijoPorPrenda,
  parteTaller,
  redondear,
  sumarFracciones,
  type CompraGastoInput,
  type CostosFijosMesDTO,
  type EditarGastoFijoInput,
  type EditarPrestamoInput,
  type Fraccion,
  type GastoFijoInput,
  type GastoFijoMesDTO,
  type MontoGastoInput,
  type PagoPrestamoInput,
  type PrestamoInput,
  type PrestamoMesDTO,
} from '@taller/shared';
import { hoyEnBolivia } from '../../lib/hoy.js';
import { AppError } from '../../middleware/errors.js';
import { configuracionRepository } from '../configuracion/repository.js';
import { fijosRepository, type GastoConDatos } from './fijosRepository.js';

const SIMULACION = [1500, 2000, 3000, 4000];
const fr = (n: number): Fraccion => ({ num: BigInt(n), den: 1n });
const claveMes = (dia: string) => dia.slice(0, 7); // 'aaaa-mm'
const finDeMes = (anio: number, mes: number) => dateADia(new Date(Date.UTC(anio, mes, 0)));

/** Monto mensual vigente en un día (el último que ya empezó a regir). */
function montoVigente(g: GastoConDatos, dia: string): number {
  return g.montos.find((m) => dateADia(m.vigenteDesde) <= dia)?.monto ?? 0;
}

/** Base del gasto en un mes: monto vigente al fin del mes o suma de sus compras. */
function baseDelMes(g: GastoConDatos, anio: number, mes: number): number {
  if (g.tipo === 'mensual') return montoVigente(g, finDeMes(anio, mes));
  const clave = `${anio}-${String(mes).padStart(2, '0')}`;
  return g.compras.filter((c) => claveMes(dateADia(c.fecha)) === clave).reduce((a, c) => a + c.monto, 0);
}

/** Base para el presupuesto de las fichas: monto vigente hoy, o el promedio
 *  de las compras de los últimos 3 meses (anteriores al actual) que tienen
 *  compras; sin historia todavía, lo anotado en el mes actual. */
function basePresupuesto(g: GastoConDatos, hoy: string): Fraccion {
  if (g.tipo === 'mensual') return fr(montoVigente(g, hoy));
  const porMes = new Map<string, number>();
  for (const c of g.compras) {
    const k = claveMes(dateADia(c.fecha));
    porMes.set(k, (porMes.get(k) ?? 0) + c.monto);
  }
  const anteriores = [...porMes].filter(([k]) => k < claveMes(hoy)).sort(([a], [b]) => b.localeCompare(a)).slice(0, 3);
  if (anteriores.length === 0) return fr(porMes.get(claveMes(hoy)) ?? 0);
  return { num: BigInt(anteriores.reduce((a, [, v]) => a + v, 0)), den: BigInt(anteriores.length) };
}

/** Presupuesto mensual de costos fijos del taller (exacto), para las fichas. */
export async function presupuestoFijo(): Promise<Fraccion> {
  const [gastos, prestamos] = await Promise.all([
    fijosRepository.listarGastos(),
    fijosRepository.listarPrestamos(),
  ]);
  const hoy = hoyEnBolivia();
  const partes = gastos
    .filter((g) => g.activo)
    .map((g) => {
      const base = basePresupuesto(g, hoy);
      return { num: base.num * BigInt(g.porcentajeTaller), den: base.den * 10_000n };
    });
  const cuotas = prestamos.filter((p) => p.activo).map((p) => fr(p.cuota));
  return sumarFracciones([...partes, ...cuotas]);
}

/** Costo fijo por prenda que se suma a cada ficha (exacto). */
export async function costoFijoPorPrenda(config: Configuracion): Promise<Fraccion> {
  return fijoPorPrenda(await presupuestoFijo(), config.prendasMesCostoFijo);
}

/** Día de vencimiento dentro del mes (si el mes es más corto, el último día). */
function vencimiento(anio: number, mes: number, dia: number): string {
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return `${anio}-${String(mes).padStart(2, '0')}-${String(Math.min(dia, ultimo)).padStart(2, '0')}`;
}

async function gastoOError(id: string) {
  const g = await fijosRepository.obtenerGasto(id);
  if (!g) throw new AppError('NO_ENCONTRADO', 'Gasto fijo no encontrado', 404);
  return g;
}
async function prestamoOError(id: string) {
  const p = await fijosRepository.obtenerPrestamo(id);
  if (!p) throw new AppError('NO_ENCONTRADO', 'Préstamo no encontrado', 404);
  return p;
}
async function exigirNombreLibre(nombre: string, id?: string) {
  const otro = await fijosRepository.buscarGastoPorNombre(nombre);
  if (otro && otro.id !== id) throw new AppError('NOMBRE_REPETIDO', `Ya hay un gasto "${nombre}"`, 409);
}

export const fijosService = {
  async mes(anio: number, mes: number): Promise<CostosFijosMesDTO> {
    const [gastos, prestamos, prendasReales, config, presupuesto] = await Promise.all([
      fijosRepository.listarGastos(),
      fijosRepository.listarPrestamos(),
      fijosRepository.prendasCerradas(anio, mes),
      configuracionRepository.obtener(),
      presupuestoFijo(),
    ]);
    const clave = `${anio}-${String(mes).padStart(2, '0')}`;
    const partes: Fraccion[] = [];
    const gastosDTO: GastoFijoMesDTO[] = gastos.map((g) => {
      const base = baseDelMes(g, anio, mes);
      const parte = parteTaller(base, g.porcentajeTaller);
      if (g.activo) partes.push(parte);
      return {
        id: g.id,
        nombre: g.nombre,
        grupo: g.grupo,
        tipo: g.tipo,
        porcentajeTaller: g.porcentajeTaller,
        activo: g.activo,
        notas: g.notas,
        montos: g.montos.map((m) => ({ id: m.id, monto: m.monto, vigenteDesde: dateADia(m.vigenteDesde) })),
        base,
        parteTaller: redondear(parte),
        compras: g.compras
          .filter((c) => claveMes(dateADia(c.fecha)) === clave)
          .map((c) => ({ id: c.id, fecha: dateADia(c.fecha), monto: c.monto, nota: c.nota })),
      };
    });
    const prestamosDTO: PrestamoMesDTO[] = prestamos.map((p) => {
      const pago = p.pagos.find((x) => x.anio === anio && x.mes === mes);
      return {
        id: p.id,
        banco: p.banco,
        cuota: p.cuota,
        diaVencimiento: p.diaVencimiento,
        cuotasRestantes: p.cuotasRestantes,
        activo: p.activo,
        notas: p.notas,
        vence: vencimiento(anio, mes, p.diaVencimiento),
        pago: pago ? { fecha: dateADia(pago.fecha), monto: pago.monto } : null,
      };
    });
    const totalGastosExacto = sumarFracciones(partes);
    const totalGastos = redondear(totalGastosExacto);
    const totalDeuda = prestamos.filter((p) => p.activo).reduce((a, p) => a + p.cuota, 0);
    const totalExacto = sumarFracciones([totalGastosExacto, fr(totalDeuda)]);
    return {
      anio,
      mes,
      gastos: gastosDTO,
      prestamos: prestamosDTO,
      totalGastos,
      totalDeuda,
      total: redondear(totalExacto),
      prendasReales,
      porPrendaReal: prendasReales > 0 ? redondear(fijoPorPrenda(totalExacto, prendasReales)) : null,
      presupuestoMensual: redondear(presupuesto),
      prendasReferencia: config.prendasMesCostoFijo,
      porPrendaFicha: redondear(fijoPorPrenda(presupuesto, config.prendasMesCostoFijo)),
      simulacion: SIMULACION.map((prendas) => ({ prendas, porPrenda: redondear(fijoPorPrenda(presupuesto, prendas)) })),
    };
  },

  async crearGasto(input: GastoFijoInput): Promise<void> {
    await exigirNombreLibre(input.nombre);
    await fijosRepository.crearGasto({
      nombre: input.nombre,
      grupo: input.grupo,
      tipo: input.tipo,
      porcentajeTaller: input.porcentajeTaller,
      notas: input.notas ?? null,
      ...(input.tipo === 'mensual'
        ? { montos: { create: { monto: input.monto!, vigenteDesde: diaADate(input.vigenteDesde!) } } }
        : {}),
    });
  },

  async editarGasto(id: string, input: EditarGastoFijoInput): Promise<void> {
    await gastoOError(id);
    if (input.nombre) await exigirNombreLibre(input.nombre, id);
    await fijosRepository.actualizarGasto(id, input);
  },

  async eliminarGasto(id: string): Promise<void> {
    await gastoOError(id);
    await fijosRepository.eliminarGasto(id);
  },

  async guardarMonto(gastoId: string, input: MontoGastoInput): Promise<void> {
    const g = await gastoOError(gastoId);
    if (g.tipo !== 'mensual') {
      throw new AppError('VALIDACION', `"${g.nombre}" se calcula con sus compras: anotá compras, no un monto`, 400);
    }
    await fijosRepository.guardarMonto(gastoId, input.monto, diaADate(input.vigenteDesde));
  },

  async eliminarMonto(gastoId: string, montoId: string): Promise<void> {
    const m = await fijosRepository.obtenerMonto(montoId);
    if (!m || m.gastoId !== gastoId) throw new AppError('NO_ENCONTRADO', 'Monto no encontrado', 404);
    await fijosRepository.eliminarMonto(montoId);
  },

  async crearCompra(gastoId: string, input: CompraGastoInput): Promise<void> {
    const g = await gastoOError(gastoId);
    if (g.tipo !== 'por_compras') {
      throw new AppError('VALIDACION', `"${g.nombre}" es un gasto mensual: cambiá su monto, no anotes compras`, 400);
    }
    await fijosRepository.crearCompra({
      gastoId,
      fecha: diaADate(input.fecha),
      monto: input.monto,
      nota: input.nota ?? null,
    });
  },

  async eliminarCompra(id: string): Promise<void> {
    if (!(await fijosRepository.obtenerCompra(id))) {
      throw new AppError('NO_ENCONTRADO', 'Compra no encontrada', 404);
    }
    await fijosRepository.eliminarCompra(id);
  },

  async crearPrestamo(input: PrestamoInput): Promise<void> {
    await fijosRepository.crearPrestamo({
      banco: input.banco,
      cuota: input.cuota,
      diaVencimiento: input.diaVencimiento,
      cuotasRestantes: input.cuotasRestantes ?? null,
      notas: input.notas ?? null,
    });
  },

  async editarPrestamo(id: string, input: EditarPrestamoInput): Promise<void> {
    await prestamoOError(id);
    await fijosRepository.actualizarPrestamo(id, input);
  },

  async eliminarPrestamo(id: string): Promise<void> {
    await prestamoOError(id);
    await fijosRepository.eliminarPrestamo(id);
  },

  /** Marca la cuota del mes como pagada (otra vez = corrige fecha y monto). */
  async pagarCuota(id: string, input: PagoPrestamoInput): Promise<void> {
    await prestamoOError(id);
    await fijosRepository.guardarPago(id, input.anio, input.mes, diaADate(input.fecha), input.monto);
  },

  async quitarPago(id: string, anio: number, mes: number): Promise<void> {
    await prestamoOError(id);
    await fijosRepository.eliminarPago(id, anio, mes);
  },

  /** Cuotas de este mes sin pagar que vencen en los próximos 5 días o ya
   *  vencieron (avisos del inicio). */
  async cuotasPorVencer(): Promise<{ banco: string; vence: string; cuota: number; vencida: boolean }[]> {
    const hoy = hoyEnBolivia();
    const [anio, mes] = hoy.split('-').map(Number);
    const limite = dateADia(new Date(diaADate(hoy).getTime() + 5 * 86_400_000));
    const prestamos = await fijosRepository.listarPrestamos();
    return prestamos
      .filter((p) => p.activo && !p.pagos.some((x) => x.anio === anio && x.mes === mes))
      .map((p) => ({ banco: p.banco, vence: vencimiento(anio, mes, p.diaVencimiento), cuota: p.cuota }))
      .filter((p) => p.vence <= limite)
      .map((p) => ({ ...p, vencida: p.vence < hoy }));
  },
};
