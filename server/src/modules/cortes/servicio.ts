// Servicio de corte interno (docs/PLAN_SERVICIO_CORTE.md): arma los pagos de cada
// proceso del corte y dice qué falta para poder cerrarlo. Reglas:
//  - personas por proceso y rol exigido (solo a quien se agrega);
//  - tarifas: la editada en el registro → la personal del operario (corte y
//    clasificación) → la predeterminada copiada al corte al crearlo;
//  - doblado: total exacto del proceso repartido en 2, centavo sobrante al 1.º;
//  - búsqueda: al registrar el corte se agrega sola si el modelo tiene buscador
//    activo (uno de baja ya no cobra en cortes nuevos y no bloquea el cierre).
import {
  ETIQUETA_PROCESO,
  PERSONAS_POR_PROCESO,
  PROCESOS_CORTE,
  repartirDoblado,
  ROL_DE_PROCESO,
  TARIFA_POR_PERSONA,
  type ModalidadDoblado,
  type ProcesoCorte,
  type ProcesoServicioDTO,
  type RegistrarProcesoInput,
  type ServicioCorteDTO,
} from '@taller/shared';
import { AppError } from '../../middleware/errors.js';
import { configuracionRepository } from '../configuracion/repository.js';
import { exigirOperariosHabilitados } from '../operarios/habilitados.js';
import { operariosRepository } from '../operarios/repository.js';
import type { CorteConDetalle, FilaTrabajo, TarifasServicioData } from './repository.js';

export async function tarifasDeConfig(): Promise<TarifasServicioData> {
  const c = await configuracionRepository.obtener();
  return {
    tarifaBusqueda: c.tarifaBusqueda,
    tarifaTrazado: c.tarifaTrazado,
    tarifaDobladoHoja: c.tarifaDobladoHoja,
    tarifaDobladoPares: c.tarifaDobladoPares,
    tarifaCorteRespaldo: c.tarifaCorteRespaldo,
    tarifaClasificacionRespaldo: c.tarifaClasificacionRespaldo,
  };
}

const trabajosDe = (corte: CorteConDetalle, proceso: ProcesoCorte) =>
  corte.trabajos.filter((t) => t.proceso === proceso);

/** Procesos que faltan para cerrar un corte interno (vacío si es externo). */
export function faltantesServicio(corte: CorteConDetalle): ProcesoCorte[] {
  if (!corte.esInterno) return [];
  const faltan: ProcesoCorte[] = [];
  const modelo = corte.version.modelo;
  const busquedaResuelta =
    trabajosDe(corte, 'busqueda').length > 0 ||
    modelo.sinBuscador ||
    (modelo.buscador != null && !modelo.buscador.activo);
  if (!busquedaResuelta) faltan.push('busqueda');
  for (const p of ['trazado', 'doblado', 'corte', 'clasificacion'] as const) {
    if (trabajosDe(corte, p).length < PERSONAS_POR_PROCESO[p][0]) faltan.push(p);
  }
  return faltan;
}

export function aServicioDTO(corte: CorteConDetalle): ServicioCorteDTO | null {
  if (!corte.esInterno) return null;
  const procesos: ProcesoServicioDTO[] = [];
  for (const proceso of PROCESOS_CORTE) {
    const ts = trabajosDe(corte, proceso);
    if (ts.length === 0) continue;
    procesos.push({
      proceso,
      fecha: ts[0].fecha.toISOString(),
      modalidad: proceso === 'doblado' ? corte.modalidadDoblado : null,
      trabajos: ts.map((t) => ({
        id: t.id,
        operario: t.operario,
        orden: t.orden,
        tarifa: t.tarifa,
        cantidad: t.cantidad,
        total: t.total,
      })),
      subtotal: ts.reduce((a, t) => a + t.total, 0),
    });
  }
  const modelo = corte.version.modelo;
  return {
    procesos,
    total: procesos.reduce((a, p) => a + p.subtotal, 0),
    faltantes: faltantesServicio(corte),
    tarifas: {
      busqueda: corte.tarifaBusqueda ?? 0,
      trazado: corte.tarifaTrazado ?? 0,
      dobladoHoja: corte.tarifaDobladoHoja ?? 0,
      dobladoPares: corte.tarifaDobladoPares ?? 0,
      corteRespaldo: corte.tarifaCorteRespaldo ?? 0,
      clasificacionRespaldo: corte.tarifaClasificacionRespaldo ?? 0,
    },
    buscadorModelo: modelo.buscador,
    sinBuscador: modelo.sinBuscador,
  };
}

/** Valida personas y arma las filas a guardar (totales fijados). */
export async function prepararTrabajos(
  corte: CorteConDetalle,
  proceso: ProcesoCorte,
  input: RegistrarProcesoInput,
): Promise<{ filas: FilaTrabajo[]; modalidad?: ModalidadDoblado; extra?: FilaTrabajo[] }> {
  const etiqueta = ETIQUETA_PROCESO[proceso];
  const [min, max] = PERSONAS_POR_PROCESO[proceso];
  const n = input.personas.length;
  if (n < min || n > max) {
    throw new AppError(
      'VALIDACION',
      min === max
        ? `${etiqueta} lleva exactamente ${min} persona${min > 1 ? 's' : ''}`
        : `${etiqueta} lleva entre ${min} y ${max} personas`,
      400,
    );
  }

  // rol y alta solo a quienes se agregan: quien ya figuraba puede quedar
  const yaEstaban = new Set(trabajosDe(corte, proceso).map((t) => t.operarioId));
  await exigirOperariosHabilitados(
    input.personas.map((p) => p.operarioId).filter((id) => !yaEstaban.has(id)),
    ROL_DE_PROCESO[proceso],
    `figurar en ${etiqueta.toLowerCase()}`,
  );

  const cantidad = corte.cantidadTotal;
  const fecha = input.fecha;
  const fila = (operarioId: string, orden: number, tarifa: number, total: number): FilaTrabajo => ({
    proceso,
    operarioId,
    orden,
    tarifa,
    cantidad,
    total,
    fecha,
  });

  if (proceso === 'doblado') {
    if (!input.modalidad) {
      throw new AppError('VALIDACION', 'Elegí la modalidad del doblado (por hoja o por pares)', 400);
    }
    const predeterminada =
      input.modalidad === 'hoja' ? corte.tarifaDobladoHoja : corte.tarifaDobladoPares;
    const tarifa = input.tarifa ?? predeterminada ?? 0;
    const partes = repartirDoblado(cantidad, tarifa);
    return {
      filas: input.personas.map((p, i) => fila(p.operarioId, i + 1, tarifa, partes[i])),
      modalidad: input.modalidad,
    };
  }

  let filas: FilaTrabajo[];
  if (TARIFA_POR_PERSONA[proceso]) {
    // corte / clasificación: tarifa editada → personal del operario → respaldo
    const operarios = await operariosRepository.listarPorIds(input.personas.map((p) => p.operarioId));
    const personal = (id: string) => {
      const o = operarios.find((x) => x.id === id);
      return proceso === 'corte' ? o?.tarifaCorte : o?.tarifaClasificacion;
    };
    const respaldo =
      proceso === 'corte' ? corte.tarifaCorteRespaldo : corte.tarifaClasificacionRespaldo;
    filas = input.personas.map((p, i) => {
      const tarifa = p.tarifa ?? personal(p.operarioId) ?? respaldo ?? 0;
      return fila(p.operarioId, i + 1, tarifa, cantidad * tarifa);
    });
  } else {
    const predeterminada = proceso === 'busqueda' ? corte.tarifaBusqueda : corte.tarifaTrazado;
    const tarifa = input.tarifa ?? predeterminada ?? 0;
    filas = input.personas.map((p, i) => fila(p.operarioId, i + 1, tarifa, cantidad * tarifa));
  }

  // búsqueda automática: al registrar el corte, si todavía no está y el modelo
  // tiene un buscador activo, se le paga con la misma fecha
  let extra: FilaTrabajo[] | undefined;
  const buscador = corte.version.modelo.buscador;
  if (proceso === 'corte' && trabajosDe(corte, 'busqueda').length === 0 && buscador?.activo) {
    const tarifa = corte.tarifaBusqueda ?? 0;
    extra = [
      { proceso: 'busqueda', operarioId: buscador.id, orden: 1, tarifa, cantidad, total: cantidad * tarifa, fecha },
    ];
  }
  return { filas, extra };
}
