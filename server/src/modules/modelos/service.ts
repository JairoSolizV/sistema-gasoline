// Reglas del módulo: versionar = copiar (CA-1.3), costo por prenda = Σ ct
// recalculado en cada mutación (CA-1.1/CA-1.2). DTOs, nunca Prisma crudo.
import { Prisma } from '@prisma/client';
import type {
  CrearModeloInput,
  CrearVersionInput,
  EditarOperacionInput,
  ModeloDTO,
  ModeloVersionDetalleDTO,
  OperacionInput,
} from '@taller/shared';
import { sumaCt } from '../../domain/calculo.js';
import { AppError } from '../../middleware/errors.js';
import { modelosRepository, type VersionConOperaciones } from './repository.js';

function aDetalleDTO(v: VersionConOperaciones): ModeloVersionDetalleDTO {
  return {
    id: v.id,
    modeloId: v.modeloId,
    modeloNombre: v.modelo.nombre,
    numeroVersion: v.numeroVersion,
    notas: v.notas,
    costoManoObraPrenda: v.costoManoObraPrenda,
    activa: v.activa,
    operaciones: v.operaciones.map((o) => ({
      id: o.id,
      orden: o.orden,
      grupo: o.grupo,
      n: o.n,
      equipo: o.equipo,
      proceso: o.proceso,
      pieza: o.pieza,
      ct: o.ct,
    })),
  };
}

async function detalleDeVersion(versionId: string): Promise<ModeloVersionDetalleDTO> {
  const version = await modelosRepository.obtenerVersion(versionId);
  if (!version) throw new AppError('NO_ENCONTRADO', 'Versión no encontrada', 404);
  return aDetalleDTO(version);
}

async function versionDeOperacion(operacionId: string) {
  const operacion = await modelosRepository.obtenerOperacion(operacionId);
  if (!operacion) throw new AppError('NO_ENCONTRADO', 'Operación no encontrada', 404);
  return operacion;
}

export const modelosService = {
  async listar(): Promise<ModeloDTO[]> {
    const modelos = await modelosRepository.listar();
    return modelos.map((m) => ({
      id: m.id,
      nombre: m.nombre,
      activo: m.activo,
      versiones: m.versiones.map((v) => ({
        id: v.id,
        numeroVersion: v.numeroVersion,
        notas: v.notas,
        costoManoObraPrenda: v.costoManoObraPrenda,
        activa: v.activa,
        createdAt: v.createdAt.toISOString(),
        cantidadOperaciones: v._count.operaciones,
      })),
    }));
  },

  obtenerVersion(versionId: string): Promise<ModeloVersionDetalleDTO> {
    return detalleDeVersion(versionId);
  },

  async crearModelo(input: CrearModeloInput): Promise<ModeloVersionDetalleDTO> {
    const operaciones = input.operaciones.map((o, i) => ({ ...o, orden: i + 1 }));
    try {
      const modelo = await modelosRepository.crearModeloConV1(
        input.nombre,
        operaciones,
        sumaCt(operaciones),
      );
      return await detalleDeVersion(modelo.versiones[0].id);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new AppError('NOMBRE_DUPLICADO', 'Ya existe un modelo con ese nombre', 409);
      }
      throw e;
    }
  },

  async crearVersion(modeloId: string, input: CrearVersionInput): Promise<ModeloVersionDetalleDTO> {
    const origenId = input.desdeVersionId;
    let origen: VersionConOperaciones | null = null;
    if (origenId) {
      origen = await modelosRepository.obtenerVersion(origenId);
      if (origen && origen.modeloId !== modeloId) {
        throw new AppError('VALIDACION', 'La versión origen no pertenece a ese modelo', 400);
      }
    } else {
      // sin origen explícito, se duplica la versión más reciente del modelo
      const modelos = await modelosRepository.listar();
      const modelo = modelos.find((m) => m.id === modeloId);
      const ultimaId = modelo?.versiones[0]?.id;
      origen = ultimaId ? await modelosRepository.obtenerVersion(ultimaId) : null;
    }
    if (!origen) throw new AppError('NO_ENCONTRADO', 'Modelo o versión origen no encontrada', 404);

    const nueva = await modelosRepository.duplicarVersion(modeloId, origen, input.notas ?? null);
    return detalleDeVersion(nueva.id);
  },

  async agregarOperacion(
    versionId: string,
    input: OperacionInput,
  ): Promise<ModeloVersionDetalleDTO> {
    await detalleDeVersion(versionId); // 404 si no existe
    await modelosRepository.agregarOperacion(versionId, input);
    return detalleDeVersion(versionId);
  },

  async editarOperacion(
    operacionId: string,
    input: EditarOperacionInput,
  ): Promise<ModeloVersionDetalleDTO> {
    const operacion = await versionDeOperacion(operacionId);
    await modelosRepository.editarOperacion(operacionId, operacion.modeloVersionId, input);
    return detalleDeVersion(operacion.modeloVersionId);
  },

  async eliminarOperacion(operacionId: string): Promise<ModeloVersionDetalleDTO> {
    const operacion = await versionDeOperacion(operacionId);
    await modelosRepository.eliminarOperacion(operacionId, operacion.modeloVersionId);
    return detalleDeVersion(operacion.modeloVersionId);
  },
};
