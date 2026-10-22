// Consolidado y cierre de mes POR CUENTA (docs/PLAN_CUENTAS_SEPARADAS.md).
// Invariantes 5 y 6 (CLAUDE.md §6):
//  - cada cuenta gana con su regla: operaciones (costura) y empaque, SOLO de
//    cortes cerrados agrupados por fechaCierre; servicio de corte y moldes, por
//    la fecha del trabajo (docs/PLAN_SERVICIO_CORTE.md §2.5); sueldo de
//    ayudantes, por la fecha de asistencia (docs/PLAN_AYUDANTES.md §7);
//  - saldo(operario, cuenta) = entrada + ganado − anticipos DE ESA CUENTA; el
//    saldoSalida persistido es la ÚNICA fuente del saldoEntrada del mes
//    siguiente en la misma cuenta (arrastre auditable, negativo incluido).
//  Las cuentas nunca se suman ni se compensan entre sí.
import type { Operario } from '@prisma/client';
import {
  CUENTAS,
  type CerrarMesInput,
  type ConsolidadoDTO,
  type Cuenta,
  type CuentaConsolidadoDTO,
  type LiquidacionFilaDTO,
  type SemanaConsolidadoDTO,
  type ServicioExterno,
} from '@taller/shared';
import { calcularCierreMes, calcularSaldo, semanasDelMes } from '../../domain/saldo.js';
import { AppError } from '../../middleware/errors.js';
import { asistenciaFaltante, sueldosDelMes } from '../asistencia/sueldoMes.js';
import { claveSaldo, liquidacionRepository, mesAnteriorA } from './repository.js';

/** Algo ganado en el mes, con la fecha que lo ubica en una semana. */
type Movimiento = { operarioId: string; total: number; fecha: Date; corteId?: string };
type MovimientosPorCuenta = Record<Cuenta, Movimiento[]>;

async function movimientosDelMes(anio: number, mes: number): Promise<MovimientosPorCuenta> {
  const [asignaciones, trabajos, moldes, sueldos, envios] = await Promise.all([
    liquidacionRepository.asignacionesGanadoDelMes(anio, mes),
    liquidacionRepository.trabajosCorteDelMes(anio, mes),
    liquidacionRepository.pagosMoldeDelMes(anio, mes),
    sueldosDelMes(anio, mes),
    liquidacionRepository.enviosDevueltosDelMes(anio, mes),
  ]);
  const deEnvios = (servicio: ServicioExterno) =>
    envios
      .filter((e) => e.servicio === servicio)
      .map((e) => ({
        operarioId: e.operarioId,
        total: e.total,
        fecha: e.fechaDevolucion!, // el repo filtra los devueltos
        corteId: e.corteId,
      }));
  const deCortes = asignaciones.map((a) => ({
    esEmpaque: a.corteOperacion.esEmpaque,
    operarioId: a.operarioId,
    total: a.total,
    fecha: a.corteOperacion.corte.fechaCierre!, // el repo filtra cortes cerrados
    corteId: a.corteOperacion.corteId,
  }));
  return {
    operaciones: deCortes.filter((m) => !m.esEmpaque),
    empaque: deCortes.filter((m) => m.esEmpaque),
    servicio_corte: trabajos,
    moldes: moldes.map((m) => ({ operarioId: m.operarioId, total: m.monto, fecha: m.fecha })),
    sueldo: [...sueldos.values()]
      .flat()
      .map((d) => ({ operarioId: d.operarioId, total: d.monto, fecha: d.fecha })),
    // servicios externos: por fecha de devolución
    serigrafia: deEnvios('serigrafia'),
    laser: deEnvios('laser'),
    bordado: deEnvios('bordado'),
    lavanderia: deEnvios('lavanderia'),
  };
}

/** Un operario en una cuenta, calculado en vivo. */
interface FilaCalculada {
  operario: Operario;
  cuenta: Cuenta;
  saldoEntrada: number;
  ganado: number;
  anticipos: number;
  saldoPeriodo: number;
}

/** Saldo por operario y cuenta del mes. Solo entran las combinaciones con
 *  algo: ganado, anticipos o arrastre ≠ 0 (cada cuenta muestra a los suyos). */
async function reunirDatos(anio: number, mes: number) {
  const [operarios, mov, anticipos, saldosEntrada] = await Promise.all([
    liquidacionRepository.operariosTodos(),
    movimientosDelMes(anio, mes),
    liquidacionRepository.anticiposDelMes(anio, mes),
    liquidacionRepository.saldosEntradaDesde(anio, mes),
  ]);

  const sumar = (mapa: Map<string, number>, clave: string, monto: number) =>
    mapa.set(clave, (mapa.get(clave) ?? 0) + monto);
  const anticiposPor = new Map<string, number>();
  for (const a of anticipos) sumar(anticiposPor, claveSaldo(a.operarioId, a.cuenta), a.monto);
  const ganadoPor = new Map<string, number>();
  for (const cuenta of CUENTAS) {
    for (const m of mov[cuenta]) sumar(ganadoPor, claveSaldo(m.operarioId, cuenta), m.total);
  }

  const filas: FilaCalculada[] = [];
  for (const cuenta of CUENTAS) {
    for (const operario of operarios) {
      const clave = claveSaldo(operario.id, cuenta);
      const saldoEntrada = saldosEntrada.get(clave) ?? 0;
      const ganado = ganadoPor.get(clave) ?? 0;
      const antic = anticiposPor.get(clave) ?? 0;
      if (saldoEntrada === 0 && ganado === 0 && antic === 0) continue;
      filas.push({
        operario,
        cuenta,
        saldoEntrada,
        ganado,
        anticipos: antic,
        saldoPeriodo: calcularSaldo(saldoEntrada, ganado, antic),
      });
    }
  }
  return { filas, mov };
}

function semanasDeCuenta(anio: number, mes: number, movs: Movimiento[]): SemanaConsolidadoDTO[] {
  return semanasDelMes(anio, mes).map((s) => {
    const enSemana = movs.filter(
      (m) => m.fecha.getTime() >= s.inicio.getTime() && m.fecha.getTime() < s.finExclusivo.getTime(),
    );
    const cortes = new Set(enSemana.flatMap((m) => (m.corteId ? [m.corteId] : [])));
    const sabado = new Date(s.inicio);
    sabado.setUTCDate(sabado.getUTCDate() + 5);
    const dia = (d: Date) => String(d.getUTCDate()).padStart(2, '0');
    const label = `${dia(s.inicio)}–${dia(sabado)} ${sabado.toLocaleDateString('es-BO', { month: 'short', timeZone: 'UTC' })}`;
    return {
      inicioISO: s.inicio.toISOString(),
      finISO: sabado.toISOString(),
      label,
      cortesCerrados: cortes.size,
      ganado: enSemana.reduce((acc, m) => acc + m.total, 0),
    };
  });
}

const porSaldo = (a: LiquidacionFilaDTO, b: LiquidacionFilaDTO) => b.saldoPeriodo - a.saldoPeriodo;

function datosOperario(o: Operario) {
  return {
    operarioId: o.id,
    nombre: o.nombre,
    activo: o.activo,
    esMaestro: o.tipo === 'maestro_externo',
  };
}

export const liquidacionService = {
  async consolidado(anio: number, mes: number): Promise<ConsolidadoDTO> {
    const periodo = await liquidacionRepository.periodo(anio, mes);
    const cerrado = periodo?.estado === 'cerrado';

    let filas: (LiquidacionFilaDTO & { cuenta: Cuenta })[];
    let mov: MovimientosPorCuenta;
    if (periodo && cerrado) {
      // Mes CERRADO: mandan los valores persistidos en Liquidacion.
      mov = await movimientosDelMes(anio, mes);
      filas = periodo.liquidaciones.map((l) => ({
        cuenta: l.cuenta,
        ...datosOperario(l.operario),
        saldoEntrada: l.saldoEntrada,
        ganado: l.totalGanado,
        anticipos: l.totalAnticipos,
        saldoPeriodo: l.saldoPeriodo,
        pagado: l.pagado,
        arrastraSaldo: l.arrastraSaldo,
        saldoSalida: l.saldoSalida,
      }));
    } else {
      // Mes ABIERTO: calculado en vivo.
      const datos = await reunirDatos(anio, mes);
      mov = datos.mov;
      filas = datos.filas.map((d) => ({
        cuenta: d.cuenta,
        ...datosOperario(d.operario),
        saldoEntrada: d.saldoEntrada,
        ganado: d.ganado,
        anticipos: d.anticipos,
        saldoPeriodo: d.saldoPeriodo,
        pagado: null,
        arrastraSaldo: false,
        saldoSalida: null,
      }));
    }

    const cuentas: CuentaConsolidadoDTO[] = CUENTAS.map((cuenta) => {
      const deCuenta = filas
        .filter((f) => f.cuenta === cuenta)
        .map(({ cuenta: _c, ...fila }) => fila)
        .sort(porSaldo);
      return {
        cuenta,
        semanas: semanasDeCuenta(anio, mes, mov[cuenta]),
        filas: deCuenta,
        totales: sumarTotales(deCuenta, cerrado),
      };
    });

    return {
      anio,
      mes,
      cerrado,
      fechaCierre: periodo?.fechaCierre ? periodo.fechaCierre.toISOString() : null,
      cuentas,
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
          `Hay pagos (cortes cerrados, servicio de corte, moldes, asistencia de ayudantes, envíos a servicios externos devueltos) o anticipos en meses sin liquidar entre ${ultimo.mes}/${ultimo.anio} y ${mes}/${anio}; cerrá esos meses primero, en orden`,
          409,
        );
      }
    }

    // El sueldo del mes sale de la asistencia: con días sin marcar el cierre
    // pagaría de menos (PLAN_AYUDANTES §5). Se dice quién y qué días faltan.
    const faltantes = await asistenciaFaltante(anio, mes);
    if (faltantes.length > 0) {
      const detalle = faltantes
        .map((f) => `${f.nombre} (${f.dias.map((d) => d.slice(8, 10)).join(', ')})`)
        .join('; ');
      throw new AppError(
        'ASISTENCIA_INCOMPLETA',
        `Falta marcar la asistencia de ${mes}/${anio}: ${detalle}`,
        409,
      );
    }

    // Un solo cierre para todas las cuentas; cada (operario, cuenta) con su
    // propia excepción de pago y arrastre (PLAN_CUENTAS_SEPARADAS §2.3).
    const { filas } = await reunirDatos(anio, mes);
    const excepciones = new Map(
      input.excepciones.map((e) => [claveSaldo(e.operarioId, e.cuenta), e]),
    );
    const liquidaciones = filas.map((d) => {
      const exc = excepciones.get(claveSaldo(d.operario.id, d.cuenta));
      const { pagado, saldoSalida } = calcularCierreMes(
        d.saldoPeriodo,
        exc?.arrastraSaldo ?? false,
        exc?.pagado ?? 0,
      );
      return {
        operarioId: d.operario.id,
        cuenta: d.cuenta,
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
