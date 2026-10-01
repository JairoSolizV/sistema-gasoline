// Las dos operaciones del catálogo que reescriben las operaciones de los
// modelos: **unir** dos entradas y **renombrar** una.
//
// Las dos tienen el mismo motivo: `Operacion` guarda el texto, así que si el
// catálogo cambia un nombre y las operaciones no, quedan apuntando a algo que ya
// no existe (desaparecen de la cascada y su contador de uso cae a 0). Por eso
// ambas reescriben `Operacion`, en transacción.
//
// Lo que NUNCA se toca es `CorteOperacion`: es el snapshot pagable (CA-1.4).
// Un corte ya creado sigue diciendo lo que decía el día que se abrió, aunque el
// catálogo se haya limpiado después. Ningún monto cambia en ningún caso.
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/errors.js';

/** Comparación sin mayúsculas, igual que el resto del módulo. */
const mismoTexto = (valor: string) => ({ equals: valor, mode: 'insensitive' as const });

function exigirDistintos(origenId: string, destinoId: string) {
  if (origenId === destinoId) {
    throw new AppError('FUSION_INVALIDA', 'No se puede unir una entrada consigo misma', 400);
  }
}

/** Mueve las piezas de un proceso a otro; las que ya existen allá se descartan
 *  (el texto de la operación ya es correcto, solo sobraba la fila del catálogo). */
async function migrarPiezas(tx: Prisma.TransactionClient, origenId: string, destinoId: string) {
  const [piezasOrigen, piezasDestino] = await Promise.all([
    tx.pieza.findMany({ where: { procesoId: origenId } }),
    tx.pieza.findMany({ where: { procesoId: destinoId } }),
  ]);
  const nombresDestino = new Set(piezasDestino.map((p) => p.nombre.toLowerCase()));

  for (const pieza of piezasOrigen) {
    if (nombresDestino.has(pieza.nombre.toLowerCase())) {
      await tx.pieza.delete({ where: { id: pieza.id } });
    } else {
      await tx.pieza.update({ where: { id: pieza.id }, data: { procesoId: destinoId } });
    }
  }
}

/** Ídem para los procesos de una máquina; los homónimos se fusionan entre sí. */
async function migrarProcesos(tx: Prisma.TransactionClient, origenId: string, destinoId: string) {
  const [procesosOrigen, procesosDestino] = await Promise.all([
    tx.proceso.findMany({ where: { maquinaId: origenId } }),
    tx.proceso.findMany({ where: { maquinaId: destinoId } }),
  ]);
  const porNombre = new Map(procesosDestino.map((p) => [p.nombre.toLowerCase(), p]));

  for (const proceso of procesosOrigen) {
    const gemelo = porNombre.get(proceso.nombre.toLowerCase());
    if (gemelo) {
      await migrarPiezas(tx, proceso.id, gemelo.id);
      await tx.proceso.delete({ where: { id: proceso.id } });
    } else {
      await tx.proceso.update({ where: { id: proceso.id }, data: { maquinaId: destinoId } });
    }
  }
}

/** Las dos tablas que guardan el texto de una operación: los modelos y las
 *  plantillas. Las dos se reescriben juntas, o una plantilla quedaría apuntando
 *  a un nombre que ya no está en el catálogo. */
type FiltroRama = {
  grupo?: Prisma.StringFilter;
  equipo?: Prisma.StringFilter;
  proceso?: Prisma.StringFilter;
  pieza?: Prisma.StringFilter;
};
type CambioTexto = { grupo?: string; equipo?: string; proceso?: string; pieza?: string };

/** Reescribe el texto viejo por el nuevo, acotado a la rama. Devuelve cuántas
 *  filas cambiaron entre modelos y plantillas. */
async function reescribir(tx: Prisma.TransactionClient, where: FiltroRama, data: CambioTexto) {
  const [modelos, plantillas] = await Promise.all([
    tx.operacion.updateMany({ where, data }),
    tx.plantillaOperacion.updateMany({ where, data }),
  ]);
  return modelos.count + plantillas.count;
}

/** Renombrar (y de paso activar/desactivar u ordenar). Si el nombre cambia, las
 *  operaciones que lo usaban pasan a decir el nombre nuevo. */
export const renombreRepository = {
  maquina(id: string, data: { nombre?: string; activo?: boolean; orden?: number }) {
    return prisma.$transaction(async (tx) => {
      const actual = await tx.maquina.findUnique({ where: { id } });
      if (!actual) throw new AppError('NO_ENCONTRADO', 'Máquina no encontrada', 404);

      const fila = await tx.maquina.update({ where: { id }, data });
      if (data.nombre != null && data.nombre !== actual.nombre) {
        await reescribir(tx, { equipo: mismoTexto(actual.nombre) }, { equipo: data.nombre });
      }
      return fila;
    });
  },

  proceso(id: string, data: { nombre?: string; activo?: boolean; orden?: number }) {
    return prisma.$transaction(async (tx) => {
      const actual = await tx.proceso.findUnique({ where: { id }, include: { maquina: true } });
      if (!actual) throw new AppError('NO_ENCONTRADO', 'Proceso no encontrado', 404);

      const fila = await tx.proceso.update({ where: { id }, data });
      if (data.nombre != null && data.nombre !== actual.nombre) {
        await reescribir(
          tx,
          { equipo: mismoTexto(actual.maquina.nombre), proceso: mismoTexto(actual.nombre) },
          { proceso: data.nombre },
        );
      }
      return fila;
    });
  },

  pieza(id: string, data: { nombre?: string; activo?: boolean; orden?: number }) {
    return prisma.$transaction(async (tx) => {
      const actual = await tx.pieza.findUnique({
        where: { id },
        include: { proceso: { include: { maquina: true } } },
      });
      if (!actual) throw new AppError('NO_ENCONTRADO', 'Pieza no encontrada', 404);

      const fila = await tx.pieza.update({ where: { id }, data });
      if (data.nombre != null && data.nombre !== actual.nombre) {
        await reescribir(
          tx,
          {
            equipo: mismoTexto(actual.proceso.maquina.nombre),
            proceso: mismoTexto(actual.proceso.nombre),
            pieza: mismoTexto(actual.nombre),
          },
          { pieza: data.nombre },
        );
      }
      return fila;
    });
  },

  grupo(id: string, data: { nombre?: string; activo?: boolean; orden?: number }) {
    return prisma.$transaction(async (tx) => {
      const actual = await tx.grupo.findUnique({ where: { id } });
      if (!actual) throw new AppError('NO_ENCONTRADO', 'Grupo no encontrado', 404);

      const fila = await tx.grupo.update({ where: { id }, data });
      if (data.nombre != null && data.nombre !== actual.nombre) {
        await reescribir(tx, { grupo: mismoTexto(actual.nombre) }, { grupo: data.nombre });
      }
      return fila;
    });
  },
};

export const fusionRepository = {
  async grupos(origenId: string, destinoId: string) {
    exigirDistintos(origenId, destinoId);
    return prisma.$transaction(async (tx) => {
      const [origen, destino] = await Promise.all([
        tx.grupo.findUnique({ where: { id: origenId } }),
        tx.grupo.findUnique({ where: { id: destinoId } }),
      ]);
      if (!origen || !destino) throw new AppError('NO_ENCONTRADO', 'Grupo no encontrado', 404);

      const operaciones = await reescribir(
        tx,
        { grupo: mismoTexto(origen.nombre) },
        { grupo: destino.nombre },
      );
      await tx.grupo.delete({ where: { id: origenId } });
      return { destino, nombreAbsorbido: origen.nombre, operaciones };
    });
  },

  async maquinas(origenId: string, destinoId: string) {
    exigirDistintos(origenId, destinoId);
    return prisma.$transaction(async (tx) => {
      const [origen, destino] = await Promise.all([
        tx.maquina.findUnique({ where: { id: origenId } }),
        tx.maquina.findUnique({ where: { id: destinoId } }),
      ]);
      if (!origen || !destino) throw new AppError('NO_ENCONTRADO', 'Máquina no encontrada', 404);

      const operaciones = await reescribir(
        tx,
        { equipo: mismoTexto(origen.nombre) },
        { equipo: destino.nombre },
      );
      await migrarProcesos(tx, origenId, destinoId);
      await tx.maquina.delete({ where: { id: origenId } });
      return { destino, nombreAbsorbido: origen.nombre, operaciones };
    });
  },

  async procesos(origenId: string, destinoId: string) {
    exigirDistintos(origenId, destinoId);
    return prisma.$transaction(async (tx) => {
      const incluirMaquina = { include: { maquina: true } };
      const [origen, destino] = await Promise.all([
        tx.proceso.findUnique({ where: { id: origenId }, ...incluirMaquina }),
        tx.proceso.findUnique({ where: { id: destinoId }, ...incluirMaquina }),
      ]);
      if (!origen || !destino) throw new AppError('NO_ENCONTRADO', 'Proceso no encontrado', 404);
      // Unir procesos de máquinas distintas cambiaría con qué se cose la prenda.
      if (origen.maquinaId !== destino.maquinaId) {
        throw new AppError(
          'FUSION_INVALIDA',
          `"${origen.nombre}" es de ${origen.maquina.nombre} y "${destino.nombre}" de ${destino.maquina.nombre}: solo se unen procesos de la misma máquina`,
          400,
        );
      }

      const operaciones = await reescribir(
        tx,
        { equipo: mismoTexto(origen.maquina.nombre), proceso: mismoTexto(origen.nombre) },
        { proceso: destino.nombre },
      );
      await migrarPiezas(tx, origenId, destinoId);
      await tx.proceso.delete({ where: { id: origenId } });
      return { destino, nombreAbsorbido: origen.nombre, operaciones };
    });
  },

  async piezas(origenId: string, destinoId: string) {
    exigirDistintos(origenId, destinoId);
    return prisma.$transaction(async (tx) => {
      const incluirRama = { include: { proceso: { include: { maquina: true } } } };
      const [origen, destino] = await Promise.all([
        tx.pieza.findUnique({ where: { id: origenId }, ...incluirRama }),
        tx.pieza.findUnique({ where: { id: destinoId }, ...incluirRama }),
      ]);
      if (!origen || !destino) throw new AppError('NO_ENCONTRADO', 'Pieza no encontrada', 404);
      if (origen.procesoId !== destino.procesoId) {
        throw new AppError(
          'FUSION_INVALIDA',
          'Solo se unen piezas del mismo proceso de la misma máquina',
          400,
        );
      }

      const operaciones = await reescribir(
        tx,
        {
          equipo: mismoTexto(origen.proceso.maquina.nombre),
          proceso: mismoTexto(origen.proceso.nombre),
          pieza: mismoTexto(origen.nombre),
        },
        { pieza: destino.nombre },
      );
      await tx.pieza.delete({ where: { id: origenId } });
      return { destino, nombreAbsorbido: origen.nombre, operaciones };
    });
  },
};
