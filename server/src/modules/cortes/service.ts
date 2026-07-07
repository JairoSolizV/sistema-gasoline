// Corazón de la Rebanada 4. Reglas que este service hace cumplir:
//  - snapshot inmutable al abrir (CA-1.4), PLUS pagado (CA-2.2)
//  - suma exacta / máx. 3 / operario activo en cada mutación (CA-3.x)
//  - diferencial de maestro copiado del config a la asignación (CA-4.x)
//  - cierre solo con todo asignada (CA-8.3); cerrado = inmutable
import type {
  AsignarGrupoInput,
  CerrarCorteInput,
  CorteDetalleDTO,
  CorteOperacionDTO,
  CorteResumenDTO,
  CrearCorteInput,
  ReemplazarAsignacionesInput,
  TotalPorOperarioDTO,
} from '@taller/shared';
import { cantidadTotal, sumaCt, tarifaEfectiva, totalAsignacion } from '../../domain/calculo.js';
import {
  puedeCerrarCorte,
  validarMaximoTres,
  validarSumaExacta,
} from '../../domain/validaciones.js';
import { AppError } from '../../middleware/errors.js';
import { exigirFechaSinLiquidar } from '../liquidacion/guards.js';
import { cortesRepository, type CorteConDetalle } from './repository.js';

function aDetalleDTO(corte: CorteConDetalle): CorteDetalleDTO {
  const operaciones: CorteOperacionDTO[] = corte.operaciones.map((op) => {
    // mayor cantidad primero (como el mockup); nombre como desempate estable
    const ordenadas = [...op.asignaciones].sort(
      (a, b) => b.cantidad - a.cantidad || a.operario.nombre.localeCompare(b.operario.nombre),
    );
    const resultado = validarSumaExacta(
      ordenadas.map((a) => a.cantidad),
      op.cantidadObjetivo,
    );
    const asignaciones = ordenadas.map((a) => ({
      id: a.id,
      operarioId: a.operarioId,
      operarioNombre: a.operario.nombre,
      cantidad: a.cantidad,
      esMaestroExterno: a.esMaestroExterno,
      diferencial: a.diferencial,
      tarifaEfectiva: a.tarifaEfectiva,
      total: a.total,
    }));
    return {
      id: op.id,
      orden: op.orden,
      grupo: op.grupo,
      n: op.n,
      equipo: op.equipo,
      proceso: op.proceso,
      pieza: op.pieza,
      ct: op.ct,
      cantidadObjetivo: op.cantidadObjetivo,
      estado: op.estado,
      asignado: resultado.asignado,
      diferencia: resultado.diferencia,
      totalOperacion: asignaciones.reduce((acc, a) => acc + a.total, 0),
      asignaciones,
    };
  });

  const porOperario = new Map<string, TotalPorOperarioDTO>();
  for (const op of operaciones) {
    for (const a of op.asignaciones) {
      const previo = porOperario.get(a.operarioId) ?? {
        operarioId: a.operarioId,
        nombre: a.operarioNombre,
        incluyeMaestro: false,
        piezas: 0,
        total: 0,
      };
      previo.piezas += a.cantidad;
      previo.total += a.total;
      previo.incluyeMaestro = previo.incluyeMaestro || a.esMaestroExterno;
      porOperario.set(a.operarioId, previo);
    }
  }

  const costoManoObraPrenda = sumaCt(corte.operaciones);
  return {
    id: corte.id,
    codigo: corte.codigo,
    modeloVersionId: corte.modeloVersionId,
    modeloNombre: corte.version.modelo.nombre,
    numeroVersion: corte.version.numeroVersion,
    tallas: corte.tallas as number[],
    cortePorTalla: corte.cortePorTalla as number[],
    plusPorTalla: corte.plusPorTalla as number[],
    cantidadTotal: corte.cantidadTotal,
    estado: corte.estado,
    fechaInicio: corte.fechaInicio.toISOString(),
    fechaCierre: corte.fechaCierre ? corte.fechaCierre.toISOString() : null,
    costoManoObraPrenda,
    costoTotalCorte: corte.cantidadTotal * costoManoObraPrenda,
    operaciones,
    totalesPorOperario: [...porOperario.values()].sort((a, b) => b.total - a.total),
  };
}

async function detalle(corteId: string): Promise<CorteDetalleDTO> {
  const corte = await cortesRepository.obtenerDetalle(corteId);
  if (!corte) throw new AppError('NO_ENCONTRADO', 'Corte no encontrado', 404);
  return aDetalleDTO(corte);
}

async function corteAbiertoOError(corteId: string): Promise<CorteConDetalle> {
  const corte = await cortesRepository.obtenerDetalle(corteId);
  if (!corte) throw new AppError('NO_ENCONTRADO', 'Corte no encontrado', 404);
  if (corte.estado === 'borrador') {
    throw new AppError('ESTADO_INVALIDO', 'El corte está en borrador; abrilo primero', 409);
  }
  if (corte.estado === 'cerrado') {
    throw new AppError('ESTADO_INVALIDO', 'El corte ya está cerrado y no se puede editar', 409);
  }
  return corte;
}

async function operariosActivosOError(ids: string[]) {
  const operarios = await cortesRepository.listarOperariosPorIds(ids);
  if (operarios.length !== ids.length) {
    throw new AppError('NO_ENCONTRADO', 'Algún operario no existe', 404);
  }
  const inactivo = operarios.find((o) => !o.activo);
  if (inactivo) {
    throw new AppError(
      'OPERARIO_INACTIVO',
      `${inactivo.nombre} está dado de baja y no puede recibir asignaciones nuevas`,
      409,
    );
  }
}

async function diferencialDeConfig(): Promise<number> {
  const config = await cortesRepository.obtenerConfiguracion();
  return config?.diferencialMaestroExterno ?? 10;
}

export const cortesService = {
  async listar(filtro: {
    estado?: 'borrador' | 'abierto' | 'cerrado';
    modeloId?: string;
  }): Promise<CorteResumenDTO[]> {
    const cortes = await cortesRepository.listar(filtro);
    return cortes.map((c) => ({
      id: c.id,
      codigo: c.codigo,
      modeloNombre: c.version.modelo.nombre,
      numeroVersion: c.version.numeroVersion,
      cantidadTotal: c.cantidadTotal,
      estado: c.estado,
      fechaInicio: c.fechaInicio.toISOString(),
      fechaCierre: c.fechaCierre ? c.fechaCierre.toISOString() : null,
      operacionesTotal: c.operaciones.length,
      operacionesAsignadas: c.operaciones.filter((o) => o.estado === 'asignada').length,
    }));
  },

  obtener(corteId: string): Promise<CorteDetalleDTO> {
    return detalle(corteId);
  },

  async crear(input: CrearCorteInput): Promise<CorteDetalleDTO> {
    const version = await cortesRepository.obtenerVersionConOperaciones(input.modeloVersionId);
    if (!version) throw new AppError('NO_ENCONTRADO', 'Versión de modelo no encontrada', 404);

    const cantidad = cantidadTotal(input.cortePorTalla, input.plusPorTalla);
    if (cantidad < 1) {
      throw new AppError('VALIDACION', 'El corte debe tener al menos una prenda', 400);
    }

    const corte = await cortesRepository.crearBorrador({
      modeloVersionId: input.modeloVersionId,
      codigo: input.codigo ?? null,
      tallas: input.tallas,
      cortePorTalla: input.cortePorTalla,
      plusPorTalla: input.plusPorTalla,
      cantidadTotal: cantidad,
    });
    return detalle(corte.id);
  },

  async abrir(corteId: string): Promise<CorteDetalleDTO> {
    const corte = await cortesRepository.obtenerDetalle(corteId);
    if (!corte) throw new AppError('NO_ENCONTRADO', 'Corte no encontrado', 404);
    if (corte.estado !== 'borrador') {
      throw new AppError('ESTADO_INVALIDO', 'El corte ya fue abierto', 409);
    }

    const version = await cortesRepository.obtenerVersionConOperaciones(corte.modeloVersionId);
    if (!version || version.operaciones.length === 0) {
      throw new AppError('SIN_OPERACIONES', 'La versión no tiene operaciones que asignar', 409);
    }

    // snapshot: ct congelado + cantidad objetivo = cantidad del corte (PLUS incluido)
    await cortesRepository.abrir(
      corteId,
      version.operaciones.map((o) => ({
        operacionOrigenId: o.id,
        orden: o.orden,
        grupo: o.grupo,
        n: o.n,
        equipo: o.equipo,
        proceso: o.proceso,
        pieza: o.pieza,
        ct: o.ct,
        cantidadObjetivo: corte.cantidadTotal,
      })),
    );
    return detalle(corteId);
  },

  async reemplazarAsignaciones(
    corteId: string,
    corteOperacionId: string,
    input: ReemplazarAsignacionesInput,
  ): Promise<CorteDetalleDTO> {
    await corteAbiertoOError(corteId);
    const operacion = await cortesRepository.obtenerCorteOperacion(corteOperacionId);
    if (!operacion || operacion.corteId !== corteId) {
      throw new AppError('NO_ENCONTRADO', 'Operación del corte no encontrada', 404);
    }
    if (!validarMaximoTres(input.asignaciones.length)) {
      throw new AppError('VALIDACION', 'Máximo 3 operarios por operación', 400);
    }
    const ids = input.asignaciones.map((a) => a.operarioId);
    if (new Set(ids).size !== ids.length) {
      throw new AppError('VALIDACION', 'No se puede repetir un operario en la misma operación', 400);
    }
    if (ids.length > 0) await operariosActivosOError(ids);

    const diferencialConfig = await diferencialDeConfig();
    const filas = input.asignaciones.map((a) => {
      const diferencial = a.esMaestroExterno ? (a.diferencial ?? diferencialConfig) : 0;
      const tarifa = tarifaEfectiva(operacion.ct, diferencial);
      return {
        operarioId: a.operarioId,
        cantidad: a.cantidad,
        esMaestroExterno: a.esMaestroExterno,
        diferencial,
        tarifaEfectiva: tarifa,
        total: totalAsignacion(a.cantidad, tarifa),
      };
    });

    const { estado } = validarSumaExacta(
      filas.map((f) => f.cantidad),
      operacion.cantidadObjetivo,
    );
    await cortesRepository.reemplazarAsignaciones(corteOperacionId, filas, estado);
    return detalle(corteId);
  },

  async asignarGrupo(corteId: string, input: AsignarGrupoInput): Promise<CorteDetalleDTO> {
    await corteAbiertoOError(corteId);
    const operaciones = await cortesRepository.listarOperacionesDeGrupo(corteId, input.grupo);
    if (operaciones.length === 0) {
      throw new AppError('NO_ENCONTRADO', `El corte no tiene grupo "${input.grupo}"`, 404);
    }
    await operariosActivosOError([input.operarioId]);

    const diferencialConfig = await diferencialDeConfig();
    const diferencial = input.esMaestroExterno ? diferencialConfig : 0;

    await cortesRepository.asignarGrupoCompleto(
      operaciones.map((op) => {
        const tarifa = tarifaEfectiva(op.ct, diferencial);
        return {
          id: op.id,
          asignacion: {
            operarioId: input.operarioId,
            cantidad: op.cantidadObjetivo,
            esMaestroExterno: input.esMaestroExterno,
            diferencial,
            tarifaEfectiva: tarifa,
            total: totalAsignacion(op.cantidadObjetivo, tarifa),
          },
        };
      }),
    );
    return detalle(corteId);
  },

  async cerrar(corteId: string, input: CerrarCorteInput): Promise<CorteDetalleDTO> {
    const corte = await corteAbiertoOError(corteId);
    const estados = corte.operaciones.map((o) => o.estado);
    if (!puedeCerrarCorte(estados)) {
      const sinAsignar = estados.filter((e) => e === 'sin_asignar').length;
      const parciales = estados.filter((e) => e === 'parcial').length;
      throw new AppError(
        'CORTE_INCOMPLETO',
        `No se puede cerrar: ${sinAsignar} operaciones sin asignar y ${parciales} con descuadre`,
        409,
      );
    }
    const fechaCierre = input.fechaCierre ?? new Date();
    await exigirFechaSinLiquidar(fechaCierre, 'cerrar el corte');
    await cortesRepository.cerrar(corteId, fechaCierre);
    return detalle(corteId);
  },
};
