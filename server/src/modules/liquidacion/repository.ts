// Único acceso a Prisma del módulo. El cierre de mes es transaccional
// (ARQUITECTURA §3.2): crea el Periodo y todas las Liquidacion de una sola vez.
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

/** Rango [inicio, fin) del mes en UTC — consistente con la comparación del dominio. */
export function rangoMesUTC(anio: number, mes: number) {
  return { inicio: new Date(Date.UTC(anio, mes - 1, 1)), fin: new Date(Date.UTC(anio, mes, 1)) };
}

/** ¿(anioA, mesA) es un mes anterior a (anioB, mesB)? */
export function mesAnteriorA(anioA: number, mesA: number, anioB: number, mesB: number): boolean {
  return anioA < anioB || (anioA === anioB && mesA < mesB);
}

export const liquidacionRepository = {
  operariosTodos() {
    return prisma.operario.findMany({ orderBy: { nombre: 'asc' } });
  },

  /** Asignaciones de cortes CERRADOS con fechaCierre en el mes, con su operario
   *  y la fecha de cierre del corte (para el ganado por operario y por semana). */
  asignacionesGanadoDelMes(anio: number, mes: number) {
    const { inicio, fin } = rangoMesUTC(anio, mes);
    return prisma.asignacion.findMany({
      where: {
        corteOperacion: {
          corte: { estado: 'cerrado', fechaCierre: { gte: inicio, lt: fin } },
        },
      },
      select: {
        operarioId: true,
        total: true,
        corteOperacion: { select: { corteId: true, corte: { select: { fechaCierre: true } } } },
      },
    });
  },

  /** Trabajos del servicio de corte con `fecha` en el mes: se pagan cuando se
   *  terminó el proceso, no al cerrar el corte (PLAN_SERVICIO_CORTE §2.5). */
  trabajosCorteDelMes(anio: number, mes: number) {
    const { inicio, fin } = rangoMesUTC(anio, mes);
    return prisma.trabajoCorte.findMany({
      where: { fecha: { gte: inicio, lt: fin } },
      select: { operarioId: true, total: true, fecha: true },
    });
  },

  /** Pagos de moldes con `fecha` en el mes (una vez por versión). */
  pagosMoldeDelMes(anio: number, mes: number) {
    const { inicio, fin } = rangoMesUTC(anio, mes);
    return prisma.pagoMolde.findMany({
      where: { fecha: { gte: inicio, lt: fin } },
      select: { operarioId: true, monto: true, fecha: true },
    });
  },

  anticiposDelMes(anio: number, mes: number) {
    const { inicio, fin } = rangoMesUTC(anio, mes);
    return prisma.anticipo.findMany({
      where: { fecha: { gte: inicio, lt: fin } },
      select: { operarioId: true, monto: true },
    });
  },

  periodo(anio: number, mes: number) {
    return prisma.periodo.findUnique({
      where: { anio_mes: { anio, mes } },
      include: { liquidaciones: { include: { operario: true } } },
    });
  },

  /** Liquidaciones del último Periodo cerrado ANTERIOR al mes → mapa
   *  operarioId ⇒ saldoSalida (arrastre). Busca hacia atrás (no solo el mes
   *  inmediato) para que el arrastre atraviese meses vacíos sin cerrar. */
  async saldosEntradaDesde(anio: number, mes: number): Promise<Map<string, number>> {
    const periodo = await prisma.periodo.findFirst({
      where: {
        estado: 'cerrado',
        OR: [{ anio: { lt: anio } }, { anio, mes: { lt: mes } }],
      },
      orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
      include: { liquidaciones: { select: { operarioId: true, saldoSalida: true } } },
    });
    const mapa = new Map<string, number>();
    for (const l of periodo?.liquidaciones ?? []) mapa.set(l.operarioId, l.saldoSalida);
    return mapa;
  },

  /** El Periodo cerrado más reciente de todos (o null si nunca se cerró un mes). */
  ultimoPeriodoCerrado() {
    return prisma.periodo.findFirst({
      where: { estado: 'cerrado' },
      orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
      select: { anio: true, mes: true },
    });
  },

  /** ¿Hay dinero (cortes cerrados, anticipos, trabajos del servicio de corte o
   *  moldes) en los meses ESTRICTAMENTE entre el último cierre y el mes dado? Si
   *  lo hay, cerrar el mes dado lo dejaría sin liquidar. */
  async hayMovimientosEntre(
    despuesDe: { anio: number; mes: number },
    antesDe: { anio: number; mes: number },
  ): Promise<boolean> {
    const inicio = new Date(Date.UTC(despuesDe.anio, despuesDe.mes, 1)); // mes siguiente al último cierre
    const fin = rangoMesUTC(antesDe.anio, antesDe.mes).inicio;
    if (inicio.getTime() >= fin.getTime()) return false;
    const enRango = { gte: inicio, lt: fin };
    const hallazgos = await Promise.all([
      prisma.corte.findFirst({
        where: { estado: 'cerrado', fechaCierre: enRango },
        select: { id: true },
      }),
      prisma.anticipo.findFirst({ where: { fecha: enRango }, select: { id: true } }),
      prisma.trabajoCorte.findFirst({ where: { fecha: enRango }, select: { id: true } }),
      prisma.pagoMolde.findFirst({ where: { fecha: enRango }, select: { id: true } }),
    ]);
    return hallazgos.some((h) => h !== null);
  },

  crearCierre(
    anio: number,
    mes: number,
    fechaCierre: Date,
    liquidaciones: Omit<Prisma.LiquidacionCreateManyPeriodoInput, 'id'>[],
  ) {
    return prisma.$transaction(async (tx) => {
      const periodo = await tx.periodo.create({
        data: { anio, mes, estado: 'cerrado', fechaCierre },
      });
      await tx.liquidacion.createMany({
        data: liquidaciones.map((l) => ({ ...l, periodoId: periodo.id })),
      });
      return periodo;
    });
  },
};
