// Único acceso a Prisma del módulo. TODAS las consultas están filtradas por
// operarioId: es la garantía de privacidad (CA-7.1/7.2) en el origen de los datos.
import { prisma } from '../../lib/prisma.js';
import { rangoMesUTC } from '../liquidacion/repository.js';

export const rendicionRepository = {
  operario(id: string) {
    return prisma.operario.findUnique({ where: { id } });
  },

  /** Asignaciones de ESTE operario en cortes cerrados con fechaCierre en el mes,
   *  con el detalle de su operación y el corte. No trae datos de otros operarios. */
  asignacionesDelOperario(operarioId: string, anio: number, mes: number) {
    const { inicio, fin } = rangoMesUTC(anio, mes);
    return prisma.asignacion.findMany({
      where: {
        operarioId,
        corteOperacion: { corte: { estado: 'cerrado', fechaCierre: { gte: inicio, lt: fin } } },
      },
      select: {
        cantidad: true,
        esMaestroExterno: true,
        tarifaEfectiva: true,
        total: true,
        corteOperacion: {
          select: {
            orden: true,
            grupo: true,
            n: true,
            equipo: true,
            proceso: true,
            pieza: true,
            ct: true,
            corte: {
              select: {
                id: true,
                codigo: true,
                fechaCierre: true,
                version: { select: { numeroVersion: true, modelo: { select: { nombre: true } } } },
              },
            },
          },
        },
      },
    });
  },

  /** Trabajos del servicio de corte de ESTE operario con fecha en el mes. Solo
   *  su propia fila: en el doblado no se trae al compañero ni su parte. */
  trabajosCorteDelOperario(operarioId: string, anio: number, mes: number) {
    const { inicio, fin } = rangoMesUTC(anio, mes);
    return prisma.trabajoCorte.findMany({
      where: { operarioId, fecha: { gte: inicio, lt: fin } },
      orderBy: [{ fecha: 'asc' }, { proceso: 'asc' }],
      select: {
        proceso: true,
        fecha: true,
        cantidad: true,
        tarifa: true,
        total: true,
        corte: {
          select: {
            id: true,
            codigo: true,
            modalidadDoblado: true,
            version: { select: { numeroVersion: true, modelo: { select: { nombre: true } } } },
          },
        },
      },
    });
  },

  /** Pagos de moldes de ESTE operario con fecha en el mes. */
  moldesDelOperario(operarioId: string, anio: number, mes: number) {
    const { inicio, fin } = rangoMesUTC(anio, mes);
    return prisma.pagoMolde.findMany({
      where: { operarioId, fecha: { gte: inicio, lt: fin } },
      orderBy: { fecha: 'asc' },
      select: {
        tipo: true,
        fecha: true,
        monto: true,
        version: { select: { numeroVersion: true, modelo: { select: { nombre: true } } } },
      },
    });
  },

  anticiposDelOperario(operarioId: string, anio: number, mes: number) {
    const { inicio, fin } = rangoMesUTC(anio, mes);
    return prisma.anticipo.findMany({
      where: { operarioId, fecha: { gte: inicio, lt: fin } },
      orderBy: { fecha: 'asc' },
      select: { fecha: true, monto: true, nota: true },
    });
  },
};
