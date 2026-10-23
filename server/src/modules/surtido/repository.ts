// Único lugar del módulo que habla con Prisma (ARQUITECTURA §2.1).
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export const surtidoRepository = {
  listarColores() {
    return prisma.colorLavado.findMany({ orderBy: [{ orden: 'asc' }, { nombre: 'asc' }] });
  },

  async crearColor(nombre: string) {
    const ultimo = await prisma.colorLavado.aggregate({ _max: { orden: true } });
    return prisma.colorLavado.create({ data: { nombre, orden: (ultimo._max.orden ?? 0) + 1 } });
  },

  obtenerColor(id: string) {
    return prisma.colorLavado.findUnique({ where: { id } });
  },

  actualizarColor(id: string, data: Prisma.ColorLavadoUpdateInput) {
    return prisma.colorLavado.update({ where: { id }, data });
  },

  borrarColor(id: string) {
    return prisma.colorLavado.delete({ where: { id } });
  },

  guardarSurtido(corteId: string, colores: string[], tallasEspeciales: number[]) {
    return prisma.corte.update({
      where: { id: corteId },
      data: { surtidoColores: colores, tallasEspeciales },
    });
  },

  /** Un envío por color, todos o ninguno. */
  crearEnvios(envios: Prisma.EnvioServicioUncheckedCreateInput[]) {
    return prisma.$transaction(envios.map((data) => prisma.envioServicio.create({ data })));
  },
};
