// Corazón de la Rebanada 4. Reglas que este service hace cumplir:
//  - snapshot inmutable al abrir (CA-1.4), PLUS pagado (CA-2.2)
//  - suma exacta / máx. 3 / operario activo y con rol costurero en cada mutación (CA-3.x)
//  - diferencial de maestro copiado del config a la asignación (CA-4.x)
//  - cierre solo con todo asignada (CA-8.3); cerrado = inmutable
import type {
  AsignarGrupoInput,
  CerrarCorteInput,
  CorteDetalleDTO,
  CorteOperacionDTO,
  CorteResumenDTO,
  CrearEnvioInput,
  EditarEnvioInput,
  EstimadoDuracionDTO,
  CrearCorteInput,
  EditarCodigoInput,
  EditarOperacionInput,
  EditarRollosInput,
  EditarServicioInput,
  EditarTendidoInput,
  OperacionInput,
  ProcesoCorte,
  ReemplazarAsignacionesInput,
  RegistrarProcesoInput,
  ReordenarOperacionesInput,
  TotalPorOperarioDTO,
} from '@taller/shared';
import { diaADate, ETIQUETA_PROCESO } from '@taller/shared';
import { Prisma } from '@prisma/client';
import { cantidadTotal, sumaCt, tarifaEfectiva, totalAsignacion } from '../../domain/calculo.js';
import {
  esReordenValido,
  puedeCerrarCorte,
  validarMaximoTres,
  validarSumaExacta,
} from '../../domain/validaciones.js';
import { AppError } from '../../middleware/errors.js';
import { exigirFechaSinLiquidar, predicadoLiquidado } from '../liquidacion/guards.js';
import { exigirOperariosHabilitados } from '../operarios/habilitados.js';
import { tiemposDeOperaciones } from '../catalogo/tiempos.js';
import { estimarDuracion } from '../../domain/estimado.js';
import { ROLES_COSTURA } from '@taller/shared';
import {
  cortesRepository,
  type CorteConDetalle,
  type DatosOperacionCorte,
} from './repository.js';
import { aServicioDTO, faltantesServicio, prepararTrabajos, tarifasDeConfig } from './servicio.js';
import {
  aEnviosDTO,
  costoEnvios,
  exigirCantidadDisponible,
  exigirProveedor,
  precioDelEnvio,
} from './envios.js';
import {
  aCambiosDTO,
  camposCambiados,
  cambioAgregarOQuitar,
  cambioEditar,
  cambiosReorden,
  etiquetaOperacion,
  marcasDeOperacion,
} from './cambios.js';

/** Duración estimada (solo informativa): el operario más cargado manda. */
function aEstimadoDTO(operaciones: CorteOperacionDTO[]): EstimadoDuracionDTO {
  const e = estimarDuracion(
    operaciones.map((o) => ({
      etiqueta: etiquetaOperacion(o),
      tiempoSeg: o.tiempoSeg,
      estado: o.estado,
      asignaciones: o.asignaciones,
    })),
  );
  const nombre = operaciones
    .flatMap((o) => o.asignaciones)
    .find((a) => a.operarioId === e.operarioMasCargadoId)?.operarioNombre;
  return {
    duracionSeg: e.duracionSeg,
    operarioMasCargado:
      e.operarioMasCargadoId && nombre ? { id: e.operarioMasCargadoId, nombre } : null,
    operacionesSinTiempo: e.operacionesSinTiempo,
    operacionesSinAsignar: e.operacionesSinAsignar,
  };
}

function aDetalleDTO(
  corte: CorteConDetalle,
  liquidado: (fecha: Date) => boolean,
): CorteDetalleDTO {
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
      esEmpaque: op.esEmpaque,
      cantidadObjetivo: op.cantidadObjetivo,
      tiempoSeg: op.tiempoSeg,
      estado: op.estado,
      asignado: resultado.asignado,
      diferencia: resultado.diferencia,
      totalOperacion: asignaciones.reduce((acc, a) => acc + a.total, 0),
      asignaciones,
      ...marcasDeOperacion(corte, op),
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
  // costos separados (PLAN_SERVICIO_CORTE §2.11 y PLAN_AYUDANTES §2.10):
  // costura (incluye empaque, que además se informa aparte) · servicio · total
  const costoCostura = corte.cantidadTotal * costoManoObraPrenda;
  const costoEmpaqueCorte =
    corte.cantidadTotal * sumaCt(corte.operaciones.filter((o) => o.esEmpaque));
  const servicio = aServicioDTO(corte);
  const costoServicioCorte = servicio?.total ?? 0;
  const costoLavanderiaCorte = costoEnvios(corte, 'lavanderia');
  const costoBordadoCorte = costoEnvios(corte, 'bordado');
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
    tela: corte.tela,
    anchoCm: corte.anchoCm,
    trazadoCm: corte.trazadoCm,
    prendasPorCapa: corte.prendasPorCapa,
    rollos:
      corte.rollosCm != null
        ? {
            rollosCm: corte.rollosCm as number[],
            traslapeCm: corte.traslapeCm ?? 0,
            retazoMinimoCm: corte.retazoMinimoCm ?? 0,
          }
        : null,
    esInterno: corte.esInterno,
    servicio,
    estado: corte.estado,
    fechaInicio: corte.fechaInicio.toISOString(),
    fechaCierre: corte.fechaCierre ? corte.fechaCierre.toISOString() : null,
    costoManoObraPrenda,
    costoTotalCorte: costoCostura,
    costoEmpaqueCorte,
    costoServicioCorte,
    costoLavanderiaCorte,
    costoBordadoCorte,
    costoTotal: costoCostura + costoServicioCorte + costoLavanderiaCorte + costoBordadoCorte,
    envios: aEnviosDTO(corte, liquidado),
    operaciones,
    totalesPorOperario: [...porOperario.values()].sort((a, b) => b.total - a.total),
    cambios: aCambiosDTO(corte),
    estimado: aEstimadoDTO(operaciones),
  };
}

async function detalle(corteId: string): Promise<CorteDetalleDTO> {
  const corte = await cortesRepository.obtenerDetalle(corteId);
  if (!corte) throw new AppError('NO_ENCONTRADO', 'Corte no encontrado', 404);
  return aDetalleDTO(corte, await predicadoLiquidado());
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

async function corteNoCerradoOError(corteId: string): Promise<CorteConDetalle> {
  const corte = await cortesRepository.obtenerDetalle(corteId);
  if (!corte) throw new AppError('NO_ENCONTRADO', 'Corte no encontrado', 404);
  if (corte.estado === 'cerrado') {
    throw new AppError('ESTADO_INVALIDO', 'El corte ya está cerrado y no se puede editar', 409);
  }
  return corte;
}

function exigirInterno(corte: CorteConDetalle) {
  if (!corte.esInterno) {
    throw new AppError(
      'CORTE_EXTERNO',
      'Es un corte externo (llegó cortado de afuera): no lleva procesos del servicio de corte',
      409,
    );
  }
}

// ── Código (numeración) del corte: único, automático o elegido a mano ──

function errorCodigoRepetido(codigo: number, modeloNombre?: string) {
  const de = modeloNombre ? ` (${modeloNombre})` : '';
  return new AppError('CODIGO_REPETIDO', `Ya existe el corte COD ${codigo}${de}: elegí otro código`, 409);
}

/** Rechaza un código que ya usa OTRO corte. El índice único de la BD es la
 *  garantía final; esto solo da un mensaje claro antes de intentar guardar. */
async function exigirCodigoLibre(codigo: number, corteId?: string) {
  const otro = await cortesRepository.buscarPorCodigo(codigo);
  if (otro && otro.id !== corteId) throw errorCodigoRepetido(codigo, otro.version.modelo.nombre);
}

/** Dos guardados simultáneos con el mismo código: el índice único rechaza el
 *  segundo (P2002) y lo devolvemos como 409 en vez de error interno. */
function traducirCodigoRepetido(codigo: number) {
  return (e: unknown): never => {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw errorCodigoRepetido(codigo);
    }
    throw e;
  };
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
    // sin código → el siguiente de la numeración (mayor + 1)
    if (input.codigo != null) await exigirCodigoLibre(input.codigo);
    const codigo = input.codigo ?? (await cortesRepository.maximoCodigo()) + 1;
    // snapshot: cambiar Configuración después no altera este corte
    const tarifas = input.esInterno ? await tarifasDeConfig() : null;
    const corte = await cortesRepository
      .crearBorrador({
        modeloVersionId: input.modeloVersionId,
        codigo,
        tallas: input.tallas,
        cortePorTalla: input.cortePorTalla,
        plusPorTalla: input.plusPorTalla,
        cantidadTotal: cantidad,
        tela: input.tela,
        anchoCm: input.anchoCm,
        trazadoCm: input.trazadoCm,
        prendasPorCapa: input.prendasPorCapa ?? null,
        esInterno: input.esInterno,
        tarifas,
      })
      .catch(traducirCodigoRepetido(codigo));
    return detalle(corte.id);
  },

  /** Código que se asignaría automáticamente al próximo corte. */
  async siguienteCodigo(): Promise<{ codigo: number }> {
    return { codigo: (await cortesRepository.maximoCodigo()) + 1 };
  },

  /** Corregir la numeración. Es solo una etiqueta (no toca pagos), por eso se
   *  permite en cualquier estado, también con el corte cerrado. */
  async editarCodigo(corteId: string, input: EditarCodigoInput): Promise<CorteDetalleDTO> {
    const corte = await cortesRepository.obtenerDetalle(corteId);
    if (!corte) throw new AppError('NO_ENCONTRADO', 'Corte no encontrado', 404);
    if (corte.codigo !== input.codigo) {
      await exigirCodigoLibre(input.codigo, corteId);
      await cortesRepository
        .actualizarCodigo(corteId, input.codigo)
        .catch(traducirCodigoRepetido(input.codigo));
    }
    return detalle(corteId);
  },

  // Completar/corregir el tendido (informativo: no toca pagos). Cerrado = inmutable.
  async editarTendido(corteId: string, input: EditarTendidoInput): Promise<CorteDetalleDTO> {
    const corte = await corteNoCerradoOError(corteId);
    await cortesRepository.actualizarTendido(corte.id, {
      tela: input.tela,
      anchoCm: input.anchoCm,
      trazadoCm: input.trazadoCm,
      prendasPorCapa: input.prendasPorCapa ?? null,
    });
    return detalle(corteId);
  },

  /** Rollos de tela para la calculadora de tendido (informativo, no toca pagos).
   *  Como el tendido: se puede cargar o corregir mientras el corte no esté cerrado. */
  async editarRollos(corteId: string, input: EditarRollosInput): Promise<CorteDetalleDTO> {
    const corte = await corteNoCerradoOError(corteId);
    await cortesRepository.actualizarRollos(corte.id, input);
    return detalle(corteId);
  },

  /** Interno ↔ externo. Para pasar a externo no puede tener procesos pagados;
   *  al pasar a interno se copian las tarifas de Configuración si no las tenía. */
  async editarServicio(corteId: string, input: EditarServicioInput): Promise<CorteDetalleDTO> {
    const corte = await corteNoCerradoOError(corteId);
    if (!input.esInterno && corte.trabajos.length > 0) {
      throw new AppError(
        'SERVICIO_CON_TRABAJOS',
        'Este corte ya tiene procesos del servicio registrados: quitalos antes de marcarlo como externo',
        409,
      );
    }
    const tarifas =
      input.esInterno && corte.tarifaBusqueda == null ? await tarifasDeConfig() : undefined;
    await cortesRepository.actualizarServicio(corteId, { esInterno: input.esInterno, tarifas });
    return detalle(corteId);
  },

  /** Registra o reemplaza un proceso del servicio de corte (todas sus personas).
   *  Se paga en `fecha`: ni la nueva ni la de lo ya registrado pueden caer en
   *  un mes liquidado. */
  async registrarProceso(
    corteId: string,
    proceso: ProcesoCorte,
    input: RegistrarProcesoInput,
  ): Promise<CorteDetalleDTO> {
    const corte = await corteNoCerradoOError(corteId);
    exigirInterno(corte);
    const previos = corte.trabajos.filter((t) => t.proceso === proceso);
    if (previos.length > 0) {
      await exigirFechaSinLiquidar(previos[0].fecha, `modificar ${ETIQUETA_PROCESO[proceso].toLowerCase()}`);
    }
    await exigirFechaSinLiquidar(input.fecha, `registrar ${ETIQUETA_PROCESO[proceso].toLowerCase()}`);
    const { filas, modalidad, extra } = await prepararTrabajos(corte, proceso, input);
    await cortesRepository.reemplazarTrabajos(corteId, proceso, filas, { modalidad, extra });
    return detalle(corteId);
  },

  async quitarProceso(corteId: string, proceso: ProcesoCorte): Promise<CorteDetalleDTO> {
    const corte = await corteNoCerradoOError(corteId);
    const previos = corte.trabajos.filter((t) => t.proceso === proceso);
    if (previos.length === 0) {
      throw new AppError('NO_ENCONTRADO', 'Ese proceso no está registrado en el corte', 404);
    }
    await exigirFechaSinLiquidar(previos[0].fecha, `quitar ${ETIQUETA_PROCESO[proceso].toLowerCase()}`);
    await cortesRepository.eliminarTrabajos(corteId, proceso);
    return detalle(corteId);
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

    // snapshot: ct y tiempo del catálogo congelados + cantidad objetivo = cantidad
    // del corte (PLUS incluido)
    const tiempos = await tiemposDeOperaciones(version.operaciones);
    await cortesRepository.abrir(
      corteId,
      version.operaciones.map((o, i) => ({
        tiempoSeg: tiempos[i],
        operacionOrigenId: o.id,
        orden: o.orden,
        grupo: o.grupo,
        n: o.n,
        equipo: o.equipo,
        proceso: o.proceso,
        pieza: o.pieza,
        ct: o.ct,
        esEmpaque: o.esEmpaque,
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
    await exigirOperariosHabilitados(ids, ROLES_COSTURA, 'recibir asignaciones de costura');

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
    await exigirOperariosHabilitados(
      [input.operarioId],
      ROLES_COSTURA,
      'recibir asignaciones de costura',
    );

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
    // corte interno: todos los procesos del servicio registrados (PLAN §2.7)
    const faltan = faltantesServicio(corte);
    if (faltan.length > 0) {
      throw new AppError(
        'SERVICIO_INCOMPLETO',
        `No se puede cerrar: falta registrar ${faltan.map((p) => ETIQUETA_PROCESO[p].toLowerCase()).join(', ')} del servicio de corte`,
        409,
      );
    }
    const fechaCierre = input.fechaCierre ?? new Date();
    await exigirFechaSinLiquidar(fechaCierre, 'cerrar el corte');
    await cortesRepository.cerrar(corteId, fechaCierre);
    return detalle(corteId);
  },

  // ── Cambios de último momento a las operaciones (solo este corte, nunca el
  //    modelo). Solo con el corte abierto; cada uno queda en el historial. ──

  /** Nuevo orden (arrastrar). No cambia ningún pago. */
  async reordenarOperaciones(
    corteId: string,
    input: ReordenarOperacionesInput,
  ): Promise<CorteDetalleDTO> {
    const corte = await corteAbiertoOError(corteId);
    const actuales = corte.operaciones; // ya vienen por orden
    if (!esReordenValido(actuales.map((o) => o.id), input.operacionIds)) {
      throw new AppError(
        'ORDEN_INVALIDO',
        'El nuevo orden no coincide con las operaciones del corte; recargá la página',
        409,
      );
    }
    const porId = new Map(actuales.map((o) => [o.id, o]));
    const nuevas = input.operacionIds.map((id) => porId.get(id)!);
    if (nuevas.every((o, i) => o.id === actuales[i].id)) return detalle(corteId); // sin cambios
    await cortesRepository.reordenarOperaciones(
      corteId,
      input.operacionIds,
      cambiosReorden(actuales, nuevas),
    );
    return detalle(corteId);
  },

  /** Cambiar máquina, proceso, pieza, N, grupo o CT de una operación del corte.
   *  Si cambia el CT se recalculan tarifa y total de sus asignaciones (el
   *  diferencial de maestro se conserva); la suma de piezas no cambia. */
  async editarOperacion(
    corteId: string,
    corteOperacionId: string,
    input: EditarOperacionInput,
  ): Promise<CorteDetalleDTO> {
    const corte = await corteAbiertoOError(corteId);
    const op = corte.operaciones.find((o) => o.id === corteOperacionId);
    if (!op) throw new AppError('NO_ENCONTRADO', 'Operación del corte no encontrada', 404);
    const campos = camposCambiados(op, input);
    if (campos.length === 0) return detalle(corteId);

    const ct = input.ct ?? op.ct;
    const asignaciones =
      ct === op.ct
        ? []
        : op.asignaciones.map((a) => {
            const tarifa = tarifaEfectiva(ct, a.diferencial);
            return { id: a.id, tarifaEfectiva: tarifa, total: totalAsignacion(a.cantidad, tarifa) };
          });
    const data = Object.fromEntries(campos.map((c) => [c.campo, c.despues])) as Partial<
      DatosOperacionCorte
    > & { tiempoSeg?: number | null };
    // otra máquina/proceso/pieza = otra operación: se toma su tiempo del catálogo
    if (campos.some((c) => c.campo === 'equipo' || c.campo === 'proceso' || c.campo === 'pieza')) {
      [data.tiempoSeg] = await tiemposDeOperaciones([{ ...op, ...data }]);
    }
    await cortesRepository.editarOperacion(
      corteId,
      corteOperacionId,
      data,
      asignaciones,
      cambioEditar(op, campos),
    );
    return detalle(corteId);
  },

  /** Operación extra solo para este corte: empieza sin asignar, así que hay que
   *  asignarla (suma exacta) antes de poder cerrar. */
  async agregarOperacion(corteId: string, input: OperacionInput): Promise<CorteDetalleDTO> {
    const corte = await corteAbiertoOError(corteId);
    const datos = {
      grupo: input.grupo,
      n: input.n ?? null,
      equipo: input.equipo,
      proceso: input.proceso,
      pieza: input.pieza ?? null,
      ct: input.ct,
      esEmpaque: input.esEmpaque ?? false,
    };
    const [tiempoSeg] = await tiemposDeOperaciones([datos]);
    await cortesRepository.agregarOperacion(
      corteId,
      { ...datos, cantidadObjetivo: corte.cantidadTotal, tiempoSeg },
      cambioAgregarOQuitar('agregar', datos),
    );
    return detalle(corteId);
  },

  /** Quitar una operación que no se hace en este corte. Si tiene operarios
   *  asignados hay que quitarlos antes (así nunca se borra un pago sin querer). */
  async quitarOperacion(corteId: string, corteOperacionId: string): Promise<CorteDetalleDTO> {
    const corte = await corteAbiertoOError(corteId);
    const op = corte.operaciones.find((o) => o.id === corteOperacionId);
    if (!op) throw new AppError('NO_ENCONTRADO', 'Operación del corte no encontrada', 404);
    if (op.asignaciones.length > 0) {
      throw new AppError(
        'OPERACION_CON_ASIGNACIONES',
        'Esta operación tiene operarios asignados: quitalos antes de eliminarla del corte',
        409,
      );
    }
    if (corte.operaciones.length === 1) {
      throw new AppError('SIN_OPERACIONES', 'El corte debe conservar al menos una operación', 409);
    }
    await cortesRepository.quitarOperacion(corteId, corteOperacionId, {
      ...cambioAgregarOQuitar('quitar', op),
      corteOperacionId: null,
    });
    return detalle(corteId);
  },

  // ── Lavandería y bordado externos (PLAN_CUENTAS_SEPARADAS §5) ──
  // Se mandan prendas de un corte ya abierto (o cerrado: lavado y bordado suelen
  // venir después de la costura). El dinero cuenta en la fecha de devolución.

  async crearEnvio(corteId: string, input: CrearEnvioInput): Promise<CorteDetalleDTO> {
    const corte = await corteConPrendasOError(corteId);
    const proveedor = exigirProveedor(
      await cortesRepository.obtenerProveedor(input.operarioId),
      input.servicio,
    );
    exigirCantidadDisponible(corte, input.servicio, input.cantidad);
    const precioPrenda = precioDelEnvio(proveedor, input.servicio, input.precioPrenda);
    await cortesRepository.crearEnvio({
      corteId,
      servicio: input.servicio,
      operarioId: proveedor.id,
      cantidad: input.cantidad,
      precioPrenda,
      total: input.cantidad * precioPrenda, // enteros: exacto, sin redondeo
      fechaEnvio: diaADate(input.fechaEnvio),
      nota: input.nota ?? null,
    });
    return detalle(corteId);
  },

  /** Corregir un envío o registrar (null: deshacer) su devolución. Un envío
   *  devuelto en un mes liquidado ya no se toca. */
  async editarEnvio(
    corteId: string,
    envioId: string,
    input: EditarEnvioInput,
  ): Promise<CorteDetalleDTO> {
    const corte = await corteConPrendasOError(corteId);
    const envio = corte.envios.find((e) => e.id === envioId);
    if (!envio) throw new AppError('NO_ENCONTRADO', 'Envío no encontrado en este corte', 404);
    if (envio.fechaDevolucion) {
      await exigirFechaSinLiquidar(envio.fechaDevolucion, 'modificar un envío ya devuelto');
    }
    const devolucion =
      input.fechaDevolucion !== undefined
        ? input.fechaDevolucion && diaADate(input.fechaDevolucion)
        : envio.fechaDevolucion;
    const fechaEnvio = input.fechaEnvio ? diaADate(input.fechaEnvio) : envio.fechaEnvio;
    if (devolucion) {
      if (devolucion < fechaEnvio) {
        throw new AppError('VALIDACION', 'La devolución no puede ser anterior al envío', 400);
      }
      await exigirFechaSinLiquidar(devolucion, 'registrar la devolución');
    }
    const cantidad = input.cantidad ?? envio.cantidad;
    if (input.cantidad !== undefined) {
      exigirCantidadDisponible(corte, envio.servicio, cantidad, envio.id);
    }
    const precioPrenda = input.precioPrenda ?? envio.precioPrenda;
    await cortesRepository.actualizarEnvio(envioId, {
      cantidad,
      precioPrenda,
      total: cantidad * precioPrenda,
      fechaEnvio,
      fechaDevolucion: devolucion ?? null,
      ...(input.nota !== undefined ? { nota: input.nota } : {}),
    });
    return detalle(corteId);
  },

  async eliminarEnvio(corteId: string, envioId: string): Promise<CorteDetalleDTO> {
    const corte = await corteConPrendasOError(corteId);
    const envio = corte.envios.find((e) => e.id === envioId);
    if (!envio) throw new AppError('NO_ENCONTRADO', 'Envío no encontrado en este corte', 404);
    if (envio.fechaDevolucion) {
      await exigirFechaSinLiquidar(envio.fechaDevolucion, 'quitar un envío ya devuelto');
    }
    await cortesRepository.eliminarEnvio(envioId);
    return detalle(corteId);
  },
};

/** Corte abierto o cerrado (un borrador todavía no tiene prendas cortadas). */
async function corteConPrendasOError(corteId: string): Promise<CorteConDetalle> {
  const corte = await cortesRepository.obtenerDetalle(corteId);
  if (!corte) throw new AppError('NO_ENCONTRADO', 'Corte no encontrado', 404);
  if (corte.estado === 'borrador') {
    throw new AppError('ESTADO_INVALIDO', 'El corte está en borrador; abrilo primero', 409);
  }
  return corte;
}
