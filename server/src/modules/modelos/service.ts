// Reglas del módulo: versionar = copiar (CA-1.3), costo por prenda = Σ ct
// recalculado en cada mutación (CA-1.1/CA-1.2). DTOs, nunca Prisma crudo.
// Servicio de corte (docs/PLAN_SERVICIO_CORTE.md §2.8-2.9): buscador del modelo
// (o "sin buscador") y moldes por versión — v1 = nuevo, otras = modificación —,
// pagados una vez en su fecha, con rol y mes sin liquidar exigidos.
import { Prisma } from '@prisma/client';
import type {
  CrearModeloInput,
  CrearVersionInput,
  EditarBuscadorInput,
  EditarOperacionInput,
  ModeloDTO,
  ModeloVersionDetalleDTO,
  MoldeInput,
  OperacionInput,
  PagoMoldeDTO,
} from '@taller/shared';
import { sumaCt } from '../../domain/calculo.js';
import { AppError } from '../../middleware/errors.js';
import { configuracionRepository } from '../configuracion/repository.js';
import { exigirFechaSinLiquidar } from '../liquidacion/guards.js';
import { exigirOperariosHabilitados } from '../operarios/habilitados.js';
import {
  modelosRepository,
  type PagoMoldeData,
  type VersionConOperaciones,
} from './repository.js';

type MoldeConOperario = {
  id: string;
  tipo: 'nuevo' | 'modificacion';
  monto: number;
  fecha: Date;
  operario: { id: string; nombre: string };
};

function aMoldeDTO(m: MoldeConOperario | null): PagoMoldeDTO | null {
  if (!m) return null;
  return {
    id: m.id,
    tipo: m.tipo,
    operario: m.operario,
    monto: m.monto,
    fecha: m.fecha.toISOString(),
  };
}

/** Valida y completa los moldes: rol creador de moldes, mes sin liquidar y el
 *  monto de Configuración si no vino uno editado. */
async function resolverMolde(
  input: MoldeInput | null | undefined,
  tipo: 'nuevo' | 'modificacion',
): Promise<PagoMoldeData | null> {
  if (!input) return null;
  await exigirOperariosHabilitados([input.moldistaId], 'moldista', 'figurar como creador de moldes');
  await exigirFechaSinLiquidar(input.fecha, 'registrar moldes');
  const config = await configuracionRepository.obtener();
  const predeterminado =
    tipo === 'nuevo' ? config.tarifaMoldeNuevo : config.tarifaMoldeModificacion;
  return { operarioId: input.moldistaId, tipo, monto: input.monto ?? predeterminado, fecha: input.fecha };
}

async function exigirBuscador(buscadorId: string | null | undefined) {
  if (buscadorId) {
    await exigirOperariosHabilitados([buscadorId], 'buscador', 'figurar como buscador del modelo');
  }
}

function aDetalleDTO(v: VersionConOperaciones): ModeloVersionDetalleDTO {
  return {
    id: v.id,
    modeloId: v.modeloId,
    modeloNombre: v.modelo.nombre,
    numeroVersion: v.numeroVersion,
    notas: v.notas,
    costoManoObraPrenda: v.costoManoObraPrenda,
    activa: v.activa,
    buscador: v.modelo.buscador,
    sinBuscador: v.modelo.sinBuscador,
    molde: aMoldeDTO(v.molde),
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
      buscador: m.buscador,
      sinBuscador: m.sinBuscador,
      versiones: m.versiones.map((v) => ({
        id: v.id,
        numeroVersion: v.numeroVersion,
        notas: v.notas,
        costoManoObraPrenda: v.costoManoObraPrenda,
        activa: v.activa,
        createdAt: v.createdAt.toISOString(),
        cantidadOperaciones: v._count.operaciones,
        molde: aMoldeDTO(v.molde),
      })),
    }));
  },

  /** Asigna el buscador, marca "sin buscador" o lo deja pendiente (ambos vacíos).
   *  Solo se exige rol y alta al buscador NUEVO: el actual puede quedar. */
  async editarBuscador(modeloId: string, input: EditarBuscadorInput): Promise<ModeloDTO> {
    const modelo = await modelosRepository.obtenerModelo(modeloId);
    if (!modelo) throw new AppError('NO_ENCONTRADO', 'Modelo no encontrado', 404);
    if (input.buscadorId !== modelo.buscadorId) await exigirBuscador(input.buscadorId);
    await modelosRepository.actualizarBuscador(modeloId, {
      buscadorId: input.buscadorId,
      sinBuscador: input.sinBuscador,
    });
    const modelos = await this.listar();
    return modelos.find((m) => m.id === modeloId)!;
  },

  /** Registra o corrige los moldes de una versión. El tipo sale del número de
   *  versión; no se toca un pago cuya fecha ya cayó en un mes liquidado. */
  async guardarMolde(versionId: string, input: MoldeInput): Promise<ModeloVersionDetalleDTO> {
    const version = await modelosRepository.obtenerVersion(versionId);
    if (!version) throw new AppError('NO_ENCONTRADO', 'Versión no encontrada', 404);
    if (version.molde) await exigirFechaSinLiquidar(version.molde.fecha, 'modificar moldes');
    const tipo = version.numeroVersion === 1 ? 'nuevo' : 'modificacion';
    const datos = await resolverMolde(input, tipo);
    await modelosRepository.guardarMolde(versionId, datos!);
    return detalleDeVersion(versionId);
  },

  async eliminarMolde(versionId: string): Promise<ModeloVersionDetalleDTO> {
    const version = await modelosRepository.obtenerVersion(versionId);
    if (!version) throw new AppError('NO_ENCONTRADO', 'Versión no encontrada', 404);
    if (!version.molde) {
      throw new AppError('NO_ENCONTRADO', 'Esta versión no tiene moldes registrados', 404);
    }
    await exigirFechaSinLiquidar(version.molde.fecha, 'quitar moldes');
    await modelosRepository.eliminarMolde(versionId);
    return detalleDeVersion(versionId);
  },

  obtenerVersion(versionId: string): Promise<ModeloVersionDetalleDTO> {
    return detalleDeVersion(versionId);
  },

  async crearModelo(input: CrearModeloInput): Promise<ModeloVersionDetalleDTO> {
    const operaciones = input.operaciones.map((o, i) => ({ ...o, orden: i + 1 }));
    await exigirBuscador(input.buscadorId);
    const molde = await resolverMolde(input.molde, 'nuevo');
    try {
      const modelo = await modelosRepository.crearModeloConV1(
        input.nombre,
        operaciones,
        sumaCt(operaciones),
        { buscadorId: input.buscadorId ?? null, sinBuscador: input.sinBuscador, molde },
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

    const molde = await resolverMolde(input.molde, 'modificacion');
    const nueva = await modelosRepository.duplicarVersion(
      modeloId,
      origen,
      input.notas ?? null,
      molde,
    );
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
