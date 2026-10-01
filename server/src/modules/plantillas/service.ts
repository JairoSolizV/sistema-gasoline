// Reglas del módulo:
//  - La plantilla guarda un CT de REFERENCIA por operación (opcional). Es solo
//    una sugerencia para el alta de modelo: el CT que se paga es el que queda
//    en el modelo, así que cambiar la referencia no toca modelos ni cortes.
//  - La plantilla protegida (el pantalón clásico) se edita pero no se borra.
//  - Duplicar copia las operaciones; la copia nunca hereda la protección.
//  - Crear un modelo desde una plantilla es trabajo del cliente: carga el
//    detalle, precarga el formulario y el dueño pone los CT. Acá no se toca
//    ningún modelo ni ningún corte.
import { Prisma } from '@prisma/client';
import type {
  CrearPlantillaInput,
  DuplicarPlantillaInput,
  EditarPlantillaInput,
  EditarPlantillaOperacionInput,
  ReemplazarOperacionesInput,
  PlantillaDetalleDTO,
  PlantillaOperacionInput,
  PlantillaResumenDTO,
} from '@taller/shared';
import { AppError } from '../../middleware/errors.js';
import { plantillasRepository, type PlantillaConOperaciones } from './repository.js';

function gruposEnOrden(p: PlantillaConOperaciones): string[] {
  const vistos: string[] = [];
  for (const o of p.operaciones) if (!vistos.includes(o.grupo)) vistos.push(o.grupo);
  return vistos;
}

function aResumen(p: PlantillaConOperaciones): PlantillaResumenDTO {
  return {
    id: p.id,
    nombre: p.nombre,
    notas: p.notas,
    protegida: p.protegida,
    createdAt: p.createdAt.toISOString(),
    cantidadOperaciones: p.operaciones.length,
    grupos: gruposEnOrden(p),
    // enteros en centavos: la suma es exacta, sin redondeos
    costoReferencia: p.operaciones.reduce((acc, o) => acc + (o.ctReferencia ?? 0), 0),
    operacionesConReferencia: p.operaciones.filter((o) => o.ctReferencia != null).length,
  };
}

function aDetalle(p: PlantillaConOperaciones): PlantillaDetalleDTO {
  return {
    ...aResumen(p),
    operaciones: p.operaciones.map((o) => ({
      id: o.id,
      orden: o.orden,
      grupo: o.grupo,
      n: o.n,
      equipo: o.equipo,
      proceso: o.proceso,
      pieza: o.pieza,
      ctReferencia: o.ctReferencia,
    })),
  };
}

function comoDuplicado<T>(promesa: Promise<T>): Promise<T> {
  return promesa.catch((e: unknown) => {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new AppError('NOMBRE_DUPLICADO', 'Ya existe una plantilla con ese nombre', 409);
    }
    throw e;
  });
}

async function exigirPlantilla(id: string): Promise<PlantillaConOperaciones> {
  const plantilla = await plantillasRepository.obtener(id);
  if (!plantilla) throw new AppError('NO_ENCONTRADO', 'Plantilla no encontrada', 404);
  return plantilla;
}

/** Devuelve el detalle recién leído: toda mutación responde el estado completo. */
async function detalleDe(id: string): Promise<PlantillaDetalleDTO> {
  return aDetalle(await exigirPlantilla(id));
}

async function plantillaDeOperacion(operacionId: string) {
  const operacion = await plantillasRepository.obtenerOperacion(operacionId);
  if (!operacion) throw new AppError('NO_ENCONTRADO', 'Operación no encontrada', 404);
  return operacion;
}

export const plantillasService = {
  async listar(): Promise<PlantillaResumenDTO[]> {
    const plantillas = await plantillasRepository.listar();
    return plantillas.map(aResumen);
  },

  obtener(id: string): Promise<PlantillaDetalleDTO> {
    return detalleDe(id);
  },

  async crear(input: CrearPlantillaInput): Promise<PlantillaDetalleDTO> {
    const operaciones = input.operaciones.map((o, i) => ({ ...o, orden: i + 1 }));
    const plantilla = await comoDuplicado(
      plantillasRepository.crear(input.nombre, input.notas ?? null, operaciones),
    );
    return aDetalle(plantilla);
  },

  async duplicar(id: string, input: DuplicarPlantillaInput): Promise<PlantillaDetalleDTO> {
    const origen = await exigirPlantilla(id);
    const copia = await comoDuplicado(plantillasRepository.duplicar(origen, input.nombre));
    return aDetalle(copia);
  },

  async editar(id: string, input: EditarPlantillaInput): Promise<PlantillaDetalleDTO> {
    await exigirPlantilla(id);
    await comoDuplicado(
      plantillasRepository.actualizar(id, {
        ...(input.nombre !== undefined ? { nombre: input.nombre } : {}),
        ...(input.notas !== undefined ? { notas: input.notas } : {}),
      }),
    );
    return detalleDe(id);
  },

  async borrar(id: string): Promise<void> {
    const plantilla = await exigirPlantilla(id);
    if (plantilla.protegida) {
      throw new AppError(
        'PLANTILLA_PROTEGIDA',
        `"${plantilla.nombre}" no se puede eliminar. Duplicala si querés una variante.`,
        409,
      );
    }
    await plantillasRepository.borrar(id);
  },

  async agregarOperacion(
    id: string,
    input: PlantillaOperacionInput,
  ): Promise<PlantillaDetalleDTO> {
    await exigirPlantilla(id);
    await plantillasRepository.agregarOperacion(id, input);
    return detalleDe(id);
  },

  /** Guarda la lista completa tal como quedó en la pantalla. */
  async reemplazarOperaciones(
    id: string,
    input: ReemplazarOperacionesInput,
  ): Promise<PlantillaDetalleDTO> {
    await exigirPlantilla(id);
    await plantillasRepository.reemplazarOperaciones(
      id,
      input.operaciones.map((o, i) => ({ ...o, orden: i + 1 })),
    );
    return detalleDe(id);
  },

  async editarOperacion(
    operacionId: string,
    input: EditarPlantillaOperacionInput,
  ): Promise<PlantillaDetalleDTO> {
    const operacion = await plantillaDeOperacion(operacionId);
    await plantillasRepository.actualizarOperacion(operacionId, input);
    return detalleDe(operacion.plantillaId);
  },

  async eliminarOperacion(operacionId: string): Promise<PlantillaDetalleDTO> {
    const operacion = await plantillaDeOperacion(operacionId);
    await plantillasRepository.borrarOperacion(operacionId);
    return detalleDe(operacion.plantillaId);
  },
};
