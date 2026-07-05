// Panorama del taller en el mes en curso. Reutiliza los servicios existentes:
// no hay acceso a datos propio, solo composición (ARQUITECTURA §2).
import type { DashboardAlertaDTO, DashboardDTO } from '@taller/shared';
import { cortesService } from '../cortes/service.js';
import { liquidacionService } from '../liquidacion/service.js';
import { anticiposRepository } from '../anticipos/repository.js';
import { configuracionRepository } from '../configuracion/repository.js';
import { rangoMesUTC } from '../liquidacion/repository.js';

export const dashboardService = {
  async panorama(anio: number, mes: number): Promise<DashboardDTO> {
    const [consolidado, abiertos, config] = await Promise.all([
      liquidacionService.consolidado(anio, mes),
      cortesService.listar({ estado: 'abierto' }),
      configuracionRepository.obtener(),
    ]);

    // KPIs del período (reusa los totales del consolidado)
    const kpis = {
      anio,
      mes,
      totalAPagar: consolidado.totales.ganado,
      anticiposEntregados: consolidado.totales.anticipos,
      saldoPendiente: consolidado.totales.saldoPeriodo,
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
          texto: `${c.modeloNombre} v${c.numeroVersion}: ${faltan} operación${faltan > 1 ? 'es' : ''} sin cuadrar — no se puede cerrar.`,
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

    // 3) fin de mes cercano con liquidación pendiente
    const hoy = new Date();
    if (!consolidado.cerrado && hoy.getUTCFullYear() === anio && hoy.getUTCMonth() + 1 === mes) {
      const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
      if (ultimoDia - hoy.getUTCDate() <= 3 && consolidado.filas.length > 0) {
        alertas.push({
          tipo: 'warn',
          texto: `Fin de mes cercano — la liquidación de este mes aún está pendiente.`,
        });
      }
    }

    return { kpis, periodoCerrado: consolidado.cerrado, cortesActivos, alertas };
  },
};
