// Único acceso a Prisma del módulo.
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

const incluirOperario = { operario: true };
export type AnticipoConOperario = Prisma.AnticipoGetPayload<{ include: typeof incluirOperario }>;

export const anticiposRepository = {
  listar(filtro: { operarioId?: string; desde?: Date; hasta?: Date }) {
    const fecha: Prisma.DateTimeFilter = {};
    if (filtro.desde) fecha.gte = filtro.desde;
    if (filtro.hasta) fecha.lte = filtro.hasta;
    return prisma.anticipo.findMany({
      where: {
        ...(filtro.operarioId ? { operarioId: filtro.operarioId } : {}),
        ...(filtro.desde || filtro.hasta ? { fecha } : {}),
      },
      orderBy: { fecha: 'desc' },
      include: incluirOperario,
    });
  },

  obtener(id: string): Promise<AnticipoConOperario | null> {
    return prisma.anticipo.findUnique({ where: { id }, include: incluirOperario });
  },

  crear(data: Prisma.AnticipoUncheckedCreateInput): Promise<AnticipoConOperario> {
    return prisma.anticipo.create({ data, include: incluirOperario });
  },

  actualizar(id: string, data: Prisma.AnticipoUpdateInput): Promise<AnticipoConOperario> {
    return prisma.anticipo.update({ where: { id }, data, include: incluirOperario });
  },

  eliminar(id: string) {
    return prisma.anticipo.delete({ where: { id } });
  },

  obtenerOperario(id: string) {
    return prisma.operario.findUnique({ where: { id } });
  },

  obtenerConfiguracion() {
    return prisma.configuracion.findUnique({ where: { id: 1 } });
  },
};
