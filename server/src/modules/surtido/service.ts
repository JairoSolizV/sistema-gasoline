// Surtido por colores para la lavandería (docs/PLAN_SURTIDO.md). Reglas:
//  - Informativo: guardar o cambiar el surtido no toca ningún pago.
//  - El reparto lo calcula SIEMPRE calcularSurtido() de shared (el mismo que
//    usa la pantalla), así la hoja impresa y los envíos dicen lo mismo.
//  - "Enviar por color" registra un envío a lavandería por cada color con sus
//    prendas, todos o ninguno, con las mismas reglas que un envío suelto
//    (proveedor de lavandería, precio, no pasar de las prendas del corte).
import { Prisma } from '@prisma/client';
import {
  calcularSurtido,
  diaADate,
  tallasEspecialesPorDefecto,
  type ColorLavadoDTO,
  type CorteDetalleDTO,
  type CrearColorLavadoInput,
  type EditarColorLavadoInput,
  type EnviarSurtidoInput,
  type GuardarSurtidoInput,
} from '@taller/shared';
import { AppError } from '../../middleware/errors.js';
import { cortesRepository, type CorteConDetalle } from '../cortes/repository.js';
import { cortesService } from '../cortes/service.js';
import { exigirCantidadDisponible, exigirProveedor, precioDelEnvio } from '../cortes/envios.js';
import { surtidoRepository } from './repository.js';

function comoDuplicado<T>(promesa: Promise<T>): Promise<T> {
  return promesa.catch((e: unknown) => {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new AppError('NOMBRE_DUPLICADO', 'Ya existe un color con ese nombre', 409);
    }
    throw e;
  });
}

async function corteConPrendas(corteId: string): Promise<CorteConDetalle> {
  const corte = await cortesRepository.obtenerDetalle(corteId);
  if (!corte) throw new AppError('NO_ENCONTRADO', 'Corte no encontrado', 404);
  if (corte.estado === 'borrador') {
    throw new AppError('ESTADO_INVALIDO', 'El corte está en borrador; abrilo primero', 409);
  }
  return corte;
}

export const surtidoService = {
  async listarColores(): Promise<ColorLavadoDTO[]> {
    const colores = await surtidoRepository.listarColores();
    return colores.map(({ id, nombre, orden, activo }) => ({ id, nombre, orden, activo }));
  },

  async crearColor(input: CrearColorLavadoInput): Promise<ColorLavadoDTO[]> {
    await comoDuplicado(surtidoRepository.crearColor(input.nombre));
    return this.listarColores();
  },

  async editarColor(id: string, input: EditarColorLavadoInput): Promise<ColorLavadoDTO[]> {
    if (!(await surtidoRepository.obtenerColor(id))) {
      throw new AppError('NO_ENCONTRADO', 'Color no encontrado', 404);
    }
    await comoDuplicado(surtidoRepository.actualizarColor(id, input));
    return this.listarColores();
  },

  /** Los cortes guardan el nombre: borrar un color de la lista no los cambia. */
  async borrarColor(id: string): Promise<ColorLavadoDTO[]> {
    if (!(await surtidoRepository.obtenerColor(id))) {
      throw new AppError('NO_ENCONTRADO', 'Color no encontrado', 404);
    }
    await surtidoRepository.borrarColor(id);
    return this.listarColores();
  },

  async guardar(corteId: string, input: GuardarSurtidoInput): Promise<CorteDetalleDTO> {
    const corte = await corteConPrendas(corteId);
    const tallas = corte.tallas as number[];
    const ajena = input.tallasEspeciales.find((t) => !tallas.includes(t));
    if (ajena !== undefined) {
      throw new AppError('VALIDACION', `La talla ${ajena} no está en este corte`, 400);
    }
    await surtidoRepository.guardarSurtido(corteId, input.colores, input.tallasEspeciales);
    return cortesService.obtener(corteId);
  },

  async enviar(corteId: string, input: EnviarSurtidoInput): Promise<CorteDetalleDTO> {
    const corte = await corteConPrendas(corteId);
    const colores = (corte.surtidoColores as string[] | null) ?? [];
    if (colores.length === 0) {
      throw new AppError('SIN_SURTIDO', 'Elegí primero los colores del surtido', 409);
    }
    const proveedor = exigirProveedor(
      await cortesRepository.obtenerProveedor(input.operarioId),
      'lavanderia',
    );
    const surtido = calcularSurtido({
      tallas: corte.tallas as number[],
      cortePorTalla: corte.cortePorTalla as number[],
      plusPorTalla: corte.plusPorTalla as number[],
      colores,
      tallasEspeciales:
        (corte.tallasEspeciales as number[] | null) ??
        tallasEspecialesPorDefecto(corte.tallas as number[]),
    });
    exigirCantidadDisponible(corte, 'lavanderia', surtido.total);
    const precioPrenda = precioDelEnvio(proveedor, 'lavanderia', input.precioPrenda);
    const fechaEnvio = diaADate(input.fechaEnvio);
    // en una transacción now() es el mismo para todos: horas consecutivas para
    // que los envíos se listen en el orden de los colores
    const ahora = Date.now();

    await surtidoRepository.crearEnvios(
      surtido.porColor
        .filter((c) => c.total > 0)
        .map((c, i) => ({
          corteId,
          servicio: 'lavanderia' as const,
          operarioId: proveedor.id,
          cantidad: c.total,
          precioPrenda,
          total: c.total * precioPrenda, // enteros: exacto, sin redondeo
          fechaEnvio,
          color: c.color,
          creadoEn: new Date(ahora + i),
        })),
    );
    return cortesService.obtener(corteId);
  },
};
