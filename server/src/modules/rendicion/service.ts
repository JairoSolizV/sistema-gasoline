// Construye el DTO de rendición SOLO con datos del operario pedido (ARQUITECTURA
// §5.3): el payload jamás incluye a otros. Reutiliza el dominio de saldo y el
// repositorio de liquidación para el arrastre y el estado del mes.
import {
  CUENTAS,
  dateADia,
  type Cuenta,
  type RendicionCorteDTO,
  type RendicionCuentaDTO,
  type RendicionDTO,
  type RendicionMoldeDTO,
  type RendicionOperacionDTO,
  type RendicionSueldoDTO,
  type RendicionTrabajoCorteDTO,
} from '@taller/shared';
import { calcularSaldo } from '../../domain/saldo.js';
import { AppError } from '../../middleware/errors.js';
import { sueldosDelMes } from '../asistencia/sueldoMes.js';
import { claveSaldo, liquidacionRepository } from '../liquidacion/repository.js';
import { rendicionRepository } from './repository.js';

export const rendicionService = {
  async rendir(operarioId: string, anio: number, mes: number): Promise<RendicionDTO> {
    const operario = await rendicionRepository.operario(operarioId);
    if (!operario) throw new AppError('NO_ENCONTRADO', 'Operario no encontrado', 404);

    const [asignaciones, trabajos, moldes, anticipos, saldosEntrada, periodo, sueldoDelOperario] =
      await Promise.all([
        rendicionRepository.asignacionesDelOperario(operarioId, anio, mes),
        rendicionRepository.trabajosCorteDelOperario(operarioId, anio, mes),
        rendicionRepository.moldesDelOperario(operarioId, anio, mes),
        rendicionRepository.anticiposDelOperario(operarioId, anio, mes),
        liquidacionRepository.saldosEntradaDesde(anio, mes),
        liquidacionRepository.periodo(anio, mes),
        sueldosDelMes(anio, mes, operarioId), // consulta filtrada por operario (CA-7)
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

    // agrupar las operaciones de este operario por corte, en dos secciones:
    // costura y empaque (PLAN_AYUDANTES §6) para que no se mezclen las pagas
    const costuraMap = new Map<string, RendicionCorteDTO>();
    const empaqueMap = new Map<string, RendicionCorteDTO>();
    for (const a of asignaciones) {
      const co = a.corteOperacion;
      const c = co.corte;
      const cortesMap = co.esEmpaque ? empaqueMap : costuraMap;
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
        esEmpaque: co.esEmpaque,
        esMaestroExterno: a.esMaestroExterno,
        tarifaEfectiva: a.tarifaEfectiva,
        total: a.total,
      };
      corte.operaciones.push(op);
      corte.totalCorte += a.total;
    }
    const porCierre = (m: Map<string, RendicionCorteDTO>) =>
      [...m.values()].sort((x, y) => (x.fechaCierre ?? '').localeCompare(y.fechaCierre ?? ''));
    const cortes = porCierre(costuraMap);
    const empaque = porCierre(empaqueMap);

    // sueldo (ayudantes): sus días del mes, que suman exacto el total del mes
    const diasSueldo = sueldoDelOperario.get(operarioId) ?? [];
    const sueldo: RendicionSueldoDTO | null =
      diasSueldo.length === 0
        ? null
        : {
            dias: diasSueldo.map((d) => ({
              fecha: dateADia(d.fecha),
              estado: d.estado,
              minutosDescontados: d.minutosDescontados,
              minutosOperaciones: d.minutosOperaciones,
              minutosPagados: d.minutosPagados,
              sueldoSemanal: d.sueldoSemanal,
              monto: d.monto,
            })),
            diasTrabajados: diasSueldo.filter((d) => d.estado === 'trabajo').length,
            faltas: diasSueldo.filter((d) => d.estado === 'falta').length,
            feriados: diasSueldo.filter((d) => d.estado === 'feriado').length,
            minutosDescontados: diasSueldo.reduce((acc, d) => acc + d.minutosDescontados, 0),
            minutosOperaciones: diasSueldo.reduce((acc, d) => acc + d.minutosOperaciones, 0),
            total: diasSueldo.reduce((acc, d) => acc + d.monto, 0),
          };
    const suma = (lista: RendicionCorteDTO[]) => lista.reduce((acc, c) => acc + c.totalCorte, 0);

    const cerrado = periodo?.estado === 'cerrado';

    // Un saldo por cuenta, nunca sumados entre sí (PLAN_CUENTAS_SEPARADAS §3).
    // Mes cerrado: mandan las filas persistidas en Liquidacion (lo que de verdad
    // se liquidó); el cálculo en vivo queda solo para meses abiertos.
    let cuentas: RendicionCuentaDTO[];
    if (cerrado) {
      const propias = periodo!.liquidaciones.filter((l) => l.operarioId === operarioId);
      cuentas = CUENTAS.flatMap((cuenta) => {
        const l = propias.find((x) => x.cuenta === cuenta);
        return l
          ? [
              {
                cuenta,
                saldoEntrada: l.saldoEntrada,
                ganado: l.totalGanado,
                anticipos: l.totalAnticipos,
                saldoPeriodo: l.saldoPeriodo,
                pagado: l.pagado,
                saldoSalida: l.saldoSalida,
              },
            ]
          : [];
      });
    } else {
      const ganado: Record<Cuenta, number> = {
        operaciones: suma(cortes),
        empaque: suma(empaque),
        servicio_corte: servicioCorte.reduce((acc, t) => acc + t.total, 0),
        moldes: moldesDTO.reduce((acc, m) => acc + m.monto, 0),
        sueldo: sueldo?.total ?? 0,
        lavanderia: 0, // rebanada 4 (envíos a proveedores externos)
        bordado: 0,
      };
      cuentas = CUENTAS.flatMap((cuenta) => {
        const saldoEntrada = saldosEntrada.get(claveSaldo(operarioId, cuenta)) ?? 0;
        const antic = anticipos
          .filter((a) => a.cuenta === cuenta)
          .reduce((acc, a) => acc + a.monto, 0);
        if (saldoEntrada === 0 && ganado[cuenta] === 0 && antic === 0) return [];
        return [
          {
            cuenta,
            saldoEntrada,
            ganado: ganado[cuenta],
            anticipos: antic,
            saldoPeriodo: calcularSaldo(saldoEntrada, ganado[cuenta], antic),
            pagado: null,
            saldoSalida: null,
          },
        ];
      });
    }

    return {
      operarioId: operario.id,
      nombre: operario.nombre,
      esMaestro: operario.tipo === 'maestro_externo',
      activo: operario.activo,
      anio,
      mes,
      cerrado,
      cuentas,
      sueldo,
      cortes,
      empaque,
      servicioCorte,
      moldes: moldesDTO,
      anticipos: anticipos.map((a) => ({
        cuenta: a.cuenta,
        fecha: a.fecha.toISOString(),
        monto: a.monto,
        nota: a.nota,
      })),
    };
  },
};
