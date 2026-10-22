// Panorama del taller en el mes en curso. Reutiliza los servicios existentes:
// no hay acceso a datos propio, solo composición (ARQUITECTURA §2).
import type { Cuenta, DashboardAlertaDTO, DashboardDTO } from '@taller/shared';
import { cortesRepository } from '../cortes/repository.js';
import { cortesService } from '../cortes/service.js';
import { liquidacionService } from '../liquidacion/service.js';
import { anticiposRepository } from '../anticipos/repository.js';
import { configuracionRepository } from '../configuracion/repository.js';
import { rangoMesUTC } from '../liquidacion/repository.js';
import { asistenciaFaltante } from '../asistencia/sueldoMes.js';
import { hoyEnBolivia } from '../../lib/hoy.js';
import { fijosService } from '../costos/fijos.js';

// procesos del servicio de corte que siempre se registran a mano (la búsqueda
// se resuelve sola al registrar el corte)
const PROCESOS_OBLIGATORIOS = ['trazado', 'doblado', 'corte', 'clasificacion'] as const;

export const dashboardService = {
  async panorama(anio: number, mes: number): Promise<DashboardDTO> {
    const [consolidado, abiertos, pendientes, sinDevolver, config] = await Promise.all([
      liquidacionService.consolidado(anio, mes),
      cortesService.listar({ estado: 'abierto' }),
      cortesRepository.abiertosConPendientes(),
      cortesRepository.enviosSinDevolver(),
      configuracionRepository.obtener(),
    ]);

    // Cortes abiertos con trabajo pendiente de cada cuenta; null = no aplica
    // (el sueldo y los moldes no dependen de un corte).
    const sinCuadrar = (empaque: boolean) =>
      pendientes.filter((c) =>
        c.operaciones.some((o) => o.esEmpaque === empaque && o.estado !== 'asignada'),
      ).length;
    const cortesPorCuenta: Record<Cuenta, number | null> = {
      operaciones: sinCuadrar(false),
      empaque: sinCuadrar(true),
      servicio_corte: pendientes.filter(
        (c) =>
          c.esInterno &&
          PROCESOS_OBLIGATORIOS.some((p) => !c.trabajos.some((t) => t.proceso === p)),
      ).length,
      moldes: null,
      sueldo: null,
      // lavandería y bordado: cortes (abiertos o cerrados) con envíos sin devolver
      lavanderia: new Set(sinDevolver.filter((e) => e.servicio === 'lavanderia').map((e) => e.corteId)).size,
      bordado: new Set(sinDevolver.filter((e) => e.servicio === 'bordado').map((e) => e.corteId)).size,
    };

    // Una fila por cuenta (reusa los totales del consolidado); sin total
    // general: las cuentas no se mezclan (PLAN_CUENTAS_SEPARADAS §6).
    const kpis = {
      anio,
      mes,
      cuentas: consolidado.cuentas.map((c) => ({
        cuenta: c.cuenta,
        totalAPagar: c.totales.ganado,
        anticiposEntregados: c.totales.anticipos,
        saldoPendiente: c.totales.saldoPeriodo,
        cortesActivos: cortesPorCuenta[c.cuenta],
      })),
      cortesActivos: abiertos.length,
    };

    const cortesActivos = abiertos.map((c) => ({
      id: c.id,
      modeloNombre: c.modeloNombre,
      numeroVersion: c.numeroVersion,
      cantidadTotal: c.cantidadTotal,
      operacionesAsignadas: c.operacionesAsignadas,
      operacionesTotal: c.operacionesTotal,
      fechaInicio: c.fechaInicio,
    }));

    const alertas: DashboardAlertaDTO[] = [];

    // 1) cortes abiertos que no se pueden cerrar (operaciones sin asignar/parciales)
    for (const c of cortesActivos) {
      const faltan = c.operacionesTotal - c.operacionesAsignadas;
      if (faltan > 0) {
        alertas.push({
          tipo: 'error',
          texto: `${c.modeloNombre} v${c.numeroVersion}: ${faltan} ${faltan > 1 ? 'operaciones' : 'operación'} sin cuadrar — no se puede cerrar.`,
        });
      }
    }

    // 2) anticipos del mes que superan el tope configurado
    const { inicio, fin } = rangoMesUTC(anio, mes);
    const anticipos = await anticiposRepository.listar({ desde: inicio, hasta: fin });
    const sobreTope = anticipos.filter((a) => a.monto > config.topeAnticipoAdvertencia);
    for (const a of sobreTope) {
      alertas.push({
        tipo: 'warn',
        texto: `Anticipo de ${a.operario.nombre} supera el tope configurado.`,
      });
    }

    // 3) asistencia de ayudantes sin marcar hasta hoy: sin ella el sueldo sale
    //    de menos y el mes no se puede cerrar (PLAN_AYUDANTES §5)
    if (!consolidado.cerrado) {
      const hoyDia = hoyEnBolivia();
      const delMes = hoyDia.startsWith(`${anio}-${String(mes).padStart(2, '0')}`);
      const mesPasado = `${anio}-${String(mes).padStart(2, '0')}` < hoyDia.slice(0, 7);
      if (delMes || mesPasado) {
        const faltantes = await asistenciaFaltante(anio, mes, delMes ? hoyDia : undefined);
        for (const f of faltantes) {
          alertas.push({
            tipo: 'warn',
            texto: `Asistencia de ${f.nombre}: ${f.dias.length} ${f.dias.length > 1 ? 'días' : 'día'} sin marcar.`,
          });
        }
      }
    }

    // 4) cuotas de préstamos por vencer o vencidas (costos fijos, PLAN_COSTOS §7c)
    for (const c of await fijosService.cuotasPorVencer()) {
      const fecha = c.vence.split('-').reverse().join('/');
      alertas.push({
        tipo: c.vencida ? 'error' : 'warn',
        texto: `Cuota ${c.banco} de Bs ${(c.cuota / 100).toFixed(2)} ${c.vencida ? `vencida el ${fecha}` : `vence el ${fecha}`}: marcala como pagada en Costos fijos.`,
      });
    }

    // 5) fin de mes cercano con liquidación pendiente
    const hoy = new Date();
    if (!consolidado.cerrado && hoy.getUTCFullYear() === anio && hoy.getUTCMonth() + 1 === mes) {
      const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
      if (ultimoDia - hoy.getUTCDate() <= 3 && consolidado.cuentas.some((c) => c.filas.length > 0)) {
        alertas.push({
          tipo: 'warn',
          texto: `Fin de mes cercano — la liquidación de este mes aún está pendiente.`,
        });
      }
    }

    return { kpis, periodoCerrado: consolidado.cerrado, cortesActivos, alertas };
  },
};
