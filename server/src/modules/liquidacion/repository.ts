// Único acceso a Prisma del módulo. El cierre de mes es transaccional
// (ARQUITECTURA §3.2): crea el Periodo y todas las Liquidacion de una sola vez.
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

/** Rango [inicio, fin) del mes en UTC — consistente con la comparación del dominio. */
export function rangoMesUTC(anio: number, mes: number) {
  return { inicio: new Date(Date.UTC(anio, mes - 1, 1)), fin: new Date(Date.UTC(anio, mes, 1)) };
}

export function mesAnterior(anio: number, mes: number) {
  return mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 };
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

  /** Liquidaciones del mes anterior → mapa operarioId ⇒ saldoSalida (arrastre). */
  async saldosEntradaDesde(anio: number, mes: number): Promise<Map<string, number>> {
    const prev = mesAnterior(anio, mes);
    const periodo = await prisma.periodo.findUnique({
      where: { anio_mes: { anio: prev.anio, mes: prev.mes } },
      include: { liquidaciones: { select: { operarioId: true, saldoSalida: true } } },
    });
    const mapa = new Map<string, number>();
    for (const l of periodo?.liquidaciones ?? []) mapa.set(l.operarioId, l.saldoSalida);
    return mapa;
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
