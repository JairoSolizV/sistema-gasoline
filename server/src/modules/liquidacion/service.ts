// Consolidado y cierre de mes. Invariantes 5 y 6 (CLAUDE.md §6):
//  - ganado SOLO de cortes cerrados agrupados por fechaCierre (repo lo filtra);
//  - saldo = entrada + ganado − anticipos; el saldoSalida persistido es la ÚNICA
//    fuente del saldoEntrada del mes siguiente (arrastre auditable, negativo incluido).
import type { Operario } from '@prisma/client';
import type {
  CerrarMesInput,
  ConsolidadoDTO,
  LiquidacionFilaDTO,
  SemanaConsolidadoDTO,
} from '@taller/shared';
import { calcularCierreMes, calcularSaldo, semanasDelMes } from '../../domain/saldo.js';
import { AppError } from '../../middleware/errors.js';
import { liquidacionRepository, mesAnteriorA } from './repository.js';

interface DatosOperario {
  operario: Operario;
  saldoEntrada: number;
  ganado: number;
  anticipos: number;
  saldoPeriodo: number;
}

/** Reúne, por operario, saldoEntrada + ganado + anticipos + saldoPeriodo del mes.
 *  Incluye a todo operario activo y a cualquiera con movimiento o arrastre ≠ 0. */
async function reunirDatos(anio: number, mes: number): Promise<DatosOperario[]> {
  const [operarios, asignaciones, anticipos, saldosEntrada] = await Promise.all([
    liquidacionRepository.operariosTodos(),
    liquidacionRepository.asignacionesGanadoDelMes(anio, mes),
    liquidacionRepository.anticiposDelMes(anio, mes),
    liquidacionRepository.saldosEntradaDesde(anio, mes),
  ]);

  const ganadoPorOp = new Map<string, number>();
  for (const a of asignaciones) {
    ganadoPorOp.set(a.operarioId, (ganadoPorOp.get(a.operarioId) ?? 0) + a.total);
  }
  const anticiposPorOp = new Map<string, number>();
  for (const a of anticipos) {
    anticiposPorOp.set(a.operarioId, (anticiposPorOp.get(a.operarioId) ?? 0) + a.monto);
  }

  const datos: DatosOperario[] = [];
  for (const operario of operarios) {
    const saldoEntrada = saldosEntrada.get(operario.id) ?? 0;
    const ganado = ganadoPorOp.get(operario.id) ?? 0;
    const antic = anticiposPorOp.get(operario.id) ?? 0;
    const conMovimiento = ganado !== 0 || antic !== 0 || saldoEntrada !== 0;
    if (!operario.activo && !conMovimiento) continue; // inactivo sin nada que mostrar
    datos.push({
      operario,
      saldoEntrada,
      ganado,
      anticipos: antic,
      saldoPeriodo: calcularSaldo(saldoEntrada, ganado, antic),
    });
  }
  return datos;
}

function semanasConGanado(
  anio: number,
  mes: number,
  asignaciones: { total: number; corteOperacion: { corteId: string; corte: { fechaCierre: Date | null } } }[],
): SemanaConsolidadoDTO[] {
  const semanas = semanasDelMes(anio, mes);
  return semanas.map((s) => {
    const cortes = new Set<string>();
    let ganado = 0;
    for (const a of asignaciones) {
      const f = a.corteOperacion.corte.fechaCierre;
      if (f && f.getTime() >= s.inicio.getTime() && f.getTime() < s.finExclusivo.getTime()) {
        ganado += a.total;
        cortes.add(a.corteOperacion.corteId);
      }
    }
    const sabado = new Date(s.inicio);
    sabado.setUTCDate(sabado.getUTCDate() + 5);
    const dia = (d: Date) => String(d.getUTCDate()).padStart(2, '0');
    const label = `${dia(s.inicio)}–${dia(sabado)} ${sabado.toLocaleDateString('es-BO', { month: 'short', timeZone: 'UTC' })}`;
    return {
      inicioISO: s.inicio.toISOString(),
      finISO: sabado.toISOString(),
      label,
      cortesCerrados: cortes.size,
      ganado,
    };
  });
}

export const liquidacionService = {
  async consolidado(anio: number, mes: number): Promise<ConsolidadoDTO> {
    const periodo = await liquidacionRepository.periodo(anio, mes);
    const asignaciones = await liquidacionRepository.asignacionesGanadoDelMes(anio, mes);
    const semanas = semanasConGanado(anio, mes, asignaciones);

    // Mes CERRADO: se muestran los valores persistidos en Liquidacion.
    if (periodo && periodo.estado === 'cerrado') {
      const filas: LiquidacionFilaDTO[] = periodo.liquidaciones
        .map((l) => ({
          operarioId: l.operarioId,
          nombre: l.operario.nombre,
          activo: l.operario.activo,
          esMaestro: l.operario.tipo === 'maestro_externo',
          saldoEntrada: l.saldoEntrada,
          ganado: l.totalGanado,
          anticipos: l.totalAnticipos,
          saldoPeriodo: l.saldoPeriodo,
          pagado: l.pagado,
          arrastraSaldo: l.arrastraSaldo,
          saldoSalida: l.saldoSalida,
        }))
        .sort((a, b) => b.saldoPeriodo - a.saldoPeriodo);
      return {
        anio,
        mes,
        cerrado: true,
        fechaCierre: periodo.fechaCierre ? periodo.fechaCierre.toISOString() : null,
        semanas,
        filas,
        totales: sumarTotales(filas, true),
      };
    }

    // Mes ABIERTO: consolidado calculado en vivo.
    const datos = await reunirDatos(anio, mes);
    const filas: LiquidacionFilaDTO[] = datos
      .map((d) => ({
        operarioId: d.operario.id,
        nombre: d.operario.nombre,
        activo: d.operario.activo,
        esMaestro: d.operario.tipo === 'maestro_externo',
        saldoEntrada: d.saldoEntrada,
        ganado: d.ganado,
        anticipos: d.anticipos,
        saldoPeriodo: d.saldoPeriodo,
        pagado: null,
        arrastraSaldo: false,
        saldoSalida: null,
      }))
      .sort((a, b) => b.saldoPeriodo - a.saldoPeriodo);

    return {
      anio,
      mes,
      cerrado: false,
      fechaCierre: null,
      semanas,
      filas,
      totales: sumarTotales(filas, false),
    };
  },

  async cerrarMes(input: CerrarMesInput): Promise<ConsolidadoDTO> {
    const { anio, mes } = input;
    const existente = await liquidacionRepository.periodo(anio, mes);
    if (existente) {
      throw new AppError('MES_YA_CERRADO', `El mes ${mes}/${anio} ya fue cerrado`, 409);
    }

    // Los meses se cierran hacia adelante: cerrar uno anterior al último cierre, o
    // saltarse un mes CON movimientos, rompería la cadena de arrastre y dejaría
    // dinero sin liquidar (los meses vacíos sí se pueden saltar: el arrastre los
    // atraviesa vía saldosEntradaDesde). El primer cierre de la historia ancla la cadena.
    const ultimo = await liquidacionRepository.ultimoPeriodoCerrado();
    if (ultimo) {
      if (mesAnteriorA(anio, mes, ultimo.anio, ultimo.mes)) {
        throw new AppError(
          'CIERRE_FUERA_DE_ORDEN',
          `Ya hay un cierre más reciente (${ultimo.mes}/${ultimo.anio}); no se puede cerrar ${mes}/${anio}`,
          409,
        );
      }
      if (await liquidacionRepository.hayMovimientosEntre(ultimo, { anio, mes })) {
        throw new AppError(
          'CIERRE_FUERA_DE_ORDEN',
          `Hay cortes cerrados o anticipos en meses sin liquidar entre ${ultimo.mes}/${ultimo.anio} y ${mes}/${anio}; cerrá esos meses primero, en orden`,
          409,
        );
      }
    }

    const datos = await reunirDatos(anio, mes);
    const excepciones = new Map(input.excepciones.map((e) => [e.operarioId, e]));

    const liquidaciones = datos.map((d) => {
      const exc = excepciones.get(d.operario.id);
      const { pagado, saldoSalida } = calcularCierreMes(
        d.saldoPeriodo,
        exc?.arrastraSaldo ?? false,
        exc?.pagado ?? 0,
      );
      return {
        operarioId: d.operario.id,
        saldoEntrada: d.saldoEntrada,
        totalGanado: d.ganado,
        totalAnticipos: d.anticipos,
        saldoPeriodo: d.saldoPeriodo,
        pagado,
        arrastraSaldo: exc?.arrastraSaldo ?? false,
        saldoSalida,
      };
    });

    await liquidacionRepository.crearCierre(anio, mes, new Date(), liquidaciones);
    return this.consolidado(anio, mes);
  },
};

function sumarTotales(filas: LiquidacionFilaDTO[], cerrado: boolean) {
  const t = filas.reduce(
    (acc, f) => ({
      saldoEntrada: acc.saldoEntrada + f.saldoEntrada,
      ganado: acc.ganado + f.ganado,
      anticipos: acc.anticipos + f.anticipos,
      saldoPeriodo: acc.saldoPeriodo + f.saldoPeriodo,
      pagado: acc.pagado + (f.pagado ?? 0),
      saldoSalida: acc.saldoSalida + (f.saldoSalida ?? 0),
    }),
    { saldoEntrada: 0, ganado: 0, anticipos: 0, saldoPeriodo: 0, pagado: 0, saldoSalida: 0 },
  );
  return {
    saldoEntrada: t.saldoEntrada,
    ganado: t.ganado,
    anticipos: t.anticipos,
    saldoPeriodo: t.saldoPeriodo,
    pagado: cerrado ? t.pagado : null,
    saldoSalida: cerrado ? t.saldoSalida : null,
  };
}
