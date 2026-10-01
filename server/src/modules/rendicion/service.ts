// Construye el DTO de rendición SOLO con datos del operario pedido (ARQUITECTURA
// §5.3): el payload jamás incluye a otros. Reutiliza el dominio de saldo y el
// repositorio de liquidación para el arrastre y el estado del mes.
import type {
  GanadoDesgloseDTO,
  RendicionCorteDTO,
  RendicionDTO,
  RendicionMoldeDTO,
  RendicionOperacionDTO,
  RendicionTrabajoCorteDTO,
} from '@taller/shared';
import { calcularSaldo } from '../../domain/saldo.js';
import { AppError } from '../../middleware/errors.js';
import { liquidacionRepository } from '../liquidacion/repository.js';
import { rendicionRepository } from './repository.js';

export const rendicionService = {
  async rendir(operarioId: string, anio: number, mes: number): Promise<RendicionDTO> {
    const operario = await rendicionRepository.operario(operarioId);
    if (!operario) throw new AppError('NO_ENCONTRADO', 'Operario no encontrado', 404);

    const [asignaciones, trabajos, moldes, anticipos, saldosEntrada, periodo] = await Promise.all([
      rendicionRepository.asignacionesDelOperario(operarioId, anio, mes),
      rendicionRepository.trabajosCorteDelOperario(operarioId, anio, mes),
      rendicionRepository.moldesDelOperario(operarioId, anio, mes),
      rendicionRepository.anticiposDelOperario(operarioId, anio, mes),
      liquidacionRepository.saldosEntradaDesde(anio, mes),
      liquidacionRepository.periodo(anio, mes),
    ]);

    // servicio de corte y moldes: cada trabajo es una línea propia, separada de
    // la costura para que no se mezclen las pagas (PLAN_SERVICIO_CORTE §2.12)
    const servicioCorte: RendicionTrabajoCorteDTO[] = trabajos.map((t) => ({
      corteId: t.corte.id,
      codigo: t.corte.codigo,
      modeloNombre: t.corte.version.modelo.nombre,
      numeroVersion: t.corte.version.numeroVersion,
      proceso: t.proceso,
      modalidad: t.proceso === 'doblado' ? t.corte.modalidadDoblado : null,
      fecha: t.fecha.toISOString(),
      cantidad: t.cantidad,
      tarifa: t.tarifa,
      total: t.total,
    }));
    const moldesDTO: RendicionMoldeDTO[] = moldes.map((m) => ({
      modeloNombre: m.version.modelo.nombre,
      numeroVersion: m.version.numeroVersion,
      tipo: m.tipo,
      fecha: m.fecha.toISOString(),
      monto: m.monto,
    }));

    // agrupar las operaciones de este operario por corte
    const cortesMap = new Map<string, RendicionCorteDTO>();
    for (const a of asignaciones) {
      const co = a.corteOperacion;
      const c = co.corte;
      let corte = cortesMap.get(c.id);
      if (!corte) {
        corte = {
          corteId: c.id,
          codigo: c.codigo,
          modeloNombre: c.version.modelo.nombre,
          numeroVersion: c.version.numeroVersion,
          fechaCierre: c.fechaCierre ? c.fechaCierre.toISOString() : null,
          operaciones: [],
          totalCorte: 0,
        };
        cortesMap.set(c.id, corte);
      }
      const op: RendicionOperacionDTO = {
        grupo: co.grupo,
        n: co.n,
        equipo: co.equipo,
        proceso: co.proceso,
        pieza: co.pieza,
        ct: co.ct,
        cantidad: a.cantidad,
        esMaestroExterno: a.esMaestroExterno,
        tarifaEfectiva: a.tarifaEfectiva,
        total: a.total,
      };
      corte.operaciones.push(op);
      corte.totalCorte += a.total;
    }
    const cortes = [...cortesMap.values()].sort((x, y) =>
      (x.fechaCierre ?? '').localeCompare(y.fechaCierre ?? ''),
    );

    const cerrado = periodo?.estado === 'cerrado';
    const liquidacion = cerrado
      ? periodo!.liquidaciones.find((l) => l.operarioId === operarioId)
      : undefined;

    // Mes cerrado: mandan los totales persistidos en Liquidacion (lo que de
    // verdad se liquidó); el cálculo en vivo queda solo para meses abiertos.
    const desglose: GanadoDesgloseDTO = liquidacion
      ? {
          costura:
            liquidacion.totalGanado - liquidacion.ganadoServicioCorte - liquidacion.ganadoMoldes,
          servicioCorte: liquidacion.ganadoServicioCorte,
          moldes: liquidacion.ganadoMoldes,
        }
      : {
          costura: asignaciones.reduce((acc, a) => acc + a.total, 0),
          servicioCorte: servicioCorte.reduce((acc, t) => acc + t.total, 0),
          moldes: moldesDTO.reduce((acc, m) => acc + m.monto, 0),
        };
    const totalGanado = liquidacion
      ? liquidacion.totalGanado
      : desglose.costura + desglose.servicioCorte + desglose.moldes;
    const totalAnticipos = liquidacion
      ? liquidacion.totalAnticipos
      : anticipos.reduce((acc, a) => acc + a.monto, 0);
    const saldoEntrada = liquidacion
      ? liquidacion.saldoEntrada
      : (saldosEntrada.get(operarioId) ?? 0);
    const saldoPeriodo = liquidacion
      ? liquidacion.saldoPeriodo
      : calcularSaldo(saldoEntrada, totalGanado, totalAnticipos);

    return {
      operarioId: operario.id,
      nombre: operario.nombre,
      esMaestro: operario.tipo === 'maestro_externo',
      activo: operario.activo,
      anio,
      mes,
      cerrado,
      saldoEntrada,
      totalGanado,
      desglose,
      totalAnticipos,
      saldoPeriodo,
      pagado: liquidacion ? liquidacion.pagado : null,
      saldoSalida: liquidacion ? liquidacion.saldoSalida : null,
      cortes,
      servicioCorte,
      moldes: moldesDTO,
      anticipos: anticipos.map((a) => ({
        fecha: a.fecha.toISOString(),
        monto: a.monto,
        nota: a.nota,
      })),
    };
  },
};
