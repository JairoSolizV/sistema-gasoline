// Único lugar del módulo que habla con Prisma (ARQUITECTURA §2.1).
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export const operariosRepository = {
  listar(soloActivos: boolean) {
    return prisma.operario.findMany({
      where: soloActivos ? { activo: true } : undefined,
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
    });
  },

  obtener(id: string) {
    return prisma.operario.findUnique({ where: { id } });
  },

  crear(data: Prisma.OperarioCreateInput) {
    return prisma.operario.create({ data });
  },

  actualizar(id: string, data: Prisma.OperarioUpdateInput) {
    return prisma.operario.update({ where: { id }, data });
  },
};
