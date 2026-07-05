import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export const configuracionRepository = {
  // La fila siempre existe (la crea el seed); upsert por si acaso.
  async obtener() {
    return prisma.configuracion.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  },

  actualizar(data: Prisma.ConfiguracionUpdateInput) {
    return prisma.configuracion.update({ where: { id: 1 }, data });
  },
};
