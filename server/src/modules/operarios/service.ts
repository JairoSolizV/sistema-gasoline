// Reglas del módulo: baja/reactivación lógica (CA-8.2), eliminación solo de
// operarios de baja sin historial, y armado del DTO (nunca se devuelve el
// modelo Prisma crudo — ARQUITECTURA §5.3).
import type { Prisma } from '@prisma/client';
import {
  dateADia,
  diaADate,
  type CrearOperarioInput,
  type EditarOperarioInput,
  type OperarioDTO,
  type RolOperario,
  type SueldoInput,
} from '@taller/shared';
import { hoyEnBolivia } from '../../lib/hoy.js';
import { AppError } from '../../middleware/errors.js';
import { exigirFechaSinLiquidar } from '../liquidacion/guards.js';
import { operariosRepository, type OperarioConHistorial } from './repository.js';

const iso = (d: Date | null) => (d ? d.toISOString() : null);

// Todo lo que lo ata al histórico: pagos (costura, servicio de corte, moldes),
// anticipos, liquidaciones o ser buscador de un modelo. Con cualquiera de esto
// el operario no se puede eliminar.
function partesHistorial(c: OperarioConHistorial['_count']): string[] {
  return [
    c.asignaciones && `${c.asignaciones} asignación(es)`,
    c.anticipos && `${c.anticipos} anticipo(s)`,
    c.liquidaciones && `${c.liquidaciones} liquidación(es)`,
    c.trabajosCorte && `${c.trabajosCorte} trabajo(s) del servicio de corte`,
    c.modelosBuscados && `buscador de ${c.modelosBuscados} modelo(s)`,
    c.pagosMolde && `${c.pagosMolde} pago(s) de moldes`,
  ].filter((p): p is string => Boolean(p));
}

function aDTO(o: OperarioConHistorial): OperarioDTO {
  return {
    id: o.id,
    nombre: o.nombre,
    tipo: o.tipo,
    roles: o.roles,
    tarifaCorte: o.tarifaCorte,
    tarifaClasificacion: o.tarifaClasificacion,
    activo: o.activo,
    ci: o.ci,
    celular: o.celular,
    fechaNacimiento: iso(o.fechaNacimiento),
    fechaIngreso: o.fechaIngreso.toISOString(),
    fechaSalida: iso(o.fechaSalida),
    fechaBaja: iso(o.fechaBaja),
    tieneHistorial: partesHistorial(o._count).length > 0,
    sueldos: o.sueldos.map((s) => ({
      id: s.id,
      montoSemanal: s.montoSemanal,
      vigenteDesde: dateADia(s.vigenteDesde),
    })),
    sueldoVigente: sueldoVigenteEl(o.sueldos, hoyEnBolivia()),
  };
}

/** Sueldo semanal vigente en un día: el último con vigenteDesde ≤ ese día. */
function sueldoVigenteEl(
  sueldos: { montoSemanal: number; vigenteDesde: Date }[],
  dia: string,
): number | null {
  const vigente = sueldos
    .filter((s) => dateADia(s.vigenteDesde) <= dia)
    .sort((a, b) => b.vigenteDesde.getTime() - a.vigenteDesde.getTime())[0];
  return vigente?.montoSemanal ?? null;
}

async function exigirCiLibre(ci: string, idPropio?: string) {
  const otro = await operariosRepository.buscarPorCi(ci);
  if (otro && otro.id !== idPropio) {
    throw new AppError('CI_DUPLICADO', `La cédula ${ci} ya está registrada para ${otro.nombre}`, 409);
  }
}

export const operariosService = {
  async listar(estado: 'activos' | 'todos', rol?: RolOperario): Promise<OperarioDTO[]> {
    const operarios = await operariosRepository.listar(estado === 'activos', rol);
    return operarios.map(aDTO);
  },

  async obtener(id: string): Promise<OperarioDTO> {
    const operario = await operariosRepository.obtener(id);
    if (!operario) throw new AppError('NO_ENCONTRADO', 'Operario no encontrado', 404);
    return aDTO(operario);
  },

  async crear(input: CrearOperarioInput): Promise<OperarioDTO> {
    await exigirCiLibre(input.ci);
    const operario = await operariosRepository.crear({
      nombre: input.nombre,
      tipo: input.tipo,
      roles: input.roles,
      tarifaCorte: input.tarifaCorte ?? null,
      tarifaClasificacion: input.tarifaClasificacion ?? null,
      ci: input.ci,
      celular: input.celular,
      fechaNacimiento: input.fechaNacimiento,
      fechaIngreso: input.fechaIngreso,
      fechaSalida: input.fechaSalida ?? null,
      // ayudante: el sueldo rige desde su día de ingreso
      ...(input.sueldoSemanal != null
        ? {
            sueldos: {
              create: {
                montoSemanal: input.sueldoSemanal,
                vigenteDesde: diaADate(dateADia(input.fechaIngreso)),
              },
            },
          }
        : {}),
    });
    return aDTO(operario);
  },

  /** Sueldo semanal de un ayudante desde una fecha (el sueldo "se ajusta cada
   *  mes"). No se puede tocar un sueldo que rija desde un mes ya liquidado. */
  async guardarSueldo(operarioId: string, input: SueldoInput): Promise<OperarioDTO> {
    const operario = await operariosRepository.obtener(operarioId);
    if (!operario) throw new AppError('NO_ENCONTRADO', 'Operario no encontrado', 404);
    if (!operario.roles.includes('ayudante')) {
      throw new AppError('OPERARIO_SIN_ROL', `${operario.nombre} no tiene el rol "Ayudante"`, 409);
    }
    const desde = diaADate(input.vigenteDesde);
    await exigirFechaSinLiquidar(desde, 'cambiar el sueldo');
    await operariosRepository.guardarSueldo(operarioId, input.montoSemanal, desde);
    return this.obtener(operarioId);
  },

  async eliminarSueldo(operarioId: string, sueldoId: string): Promise<OperarioDTO> {
    const sueldo = await operariosRepository.obtenerSueldo(sueldoId);
    if (!sueldo || sueldo.operarioId !== operarioId) {
      throw new AppError('NO_ENCONTRADO', 'Sueldo no encontrado', 404);
    }
    const operario = (await operariosRepository.obtener(operarioId))!;
    if (operario.roles.includes('ayudante') && operario.sueldos.length === 1) {
      throw new AppError(
        'SUELDO_UNICO',
        'Un ayudante necesita al menos un sueldo: cambiale el monto en vez de quitarlo',
        409,
      );
    }
    await exigirFechaSinLiquidar(sueldo.vigenteDesde, 'quitar un sueldo');
    await operariosRepository.eliminarSueldo(sueldoId);
    return this.obtener(operarioId);
  },

  async editar(id: string, input: EditarOperarioInput): Promise<OperarioDTO> {
    const actual = await operariosRepository.obtener(id);
    if (!actual) throw new AppError('NO_ENCONTRADO', 'Operario no encontrado', 404);

    if (input.ci) await exigirCiLibre(input.ci, id);

    // coherencia contra lo ya guardado: puede cambiar solo una de las dos fechas
    const ingreso = input.fechaIngreso ?? actual.fechaIngreso;
    const salida = input.fechaSalida !== undefined ? input.fechaSalida : actual.fechaSalida;
    if (salida && salida < ingreso) {
      throw new AppError(
        'VALIDACION',
        'fechaSalida: La fecha de salida no puede ser anterior a la de ingreso',
        400,
      );
    }

    const data: Prisma.OperarioUpdateInput = {
      ...(input.nombre !== undefined ? { nombre: input.nombre } : {}),
      ...(input.tipo !== undefined ? { tipo: input.tipo } : {}),
      ...(input.roles !== undefined ? { roles: input.roles } : {}),
      ...(input.tarifaCorte !== undefined ? { tarifaCorte: input.tarifaCorte } : {}),
      ...(input.tarifaClasificacion !== undefined
        ? { tarifaClasificacion: input.tarifaClasificacion }
        : {}),
      ...(input.ci !== undefined ? { ci: input.ci } : {}),
      ...(input.celular !== undefined ? { celular: input.celular } : {}),
      ...(input.fechaNacimiento !== undefined ? { fechaNacimiento: input.fechaNacimiento } : {}),
      ...(input.fechaIngreso !== undefined ? { fechaIngreso: input.fechaIngreso } : {}),
      ...(input.fechaSalida !== undefined ? { fechaSalida: input.fechaSalida } : {}),
    };

    // Baja lógica: al desactivar se fija fechaBaja; al reactivar se limpia.
    if (input.activo !== undefined && input.activo !== actual.activo) {
      data.activo = input.activo;
      data.fechaBaja = input.activo ? null : new Date();
    }

    const operario = await operariosRepository.actualizar(id, data);
    return aDTO(operario);
  },

  // Borrado físico, acotado para no romper CA-8.2: solo un operario ya dado de
  // baja y SIN historial (ver partesHistorial). Quien trabajó o cobró algo se
  // queda para siempre como baja lógica: borrarlo descuadraría cortes cerrados
  // y los saldos de meses ya liquidados.
  async eliminar(id: string): Promise<void> {
    const actual = await operariosRepository.obtener(id);
    if (!actual) throw new AppError('NO_ENCONTRADO', 'Operario no encontrado', 404);
    if (actual.activo) {
      throw new AppError(
        'OPERARIO_ACTIVO',
        `${actual.nombre} está activo: primero hay que darlo de baja`,
        409,
      );
    }
    const partes = partesHistorial(actual._count);
    if (partes.length > 0) {
      throw new AppError(
        'CON_HISTORIAL',
        `${actual.nombre} tiene historial (${partes.join(', ')}); se conserva como baja lógica`,
        409,
      );
    }
    await operariosRepository.eliminar(id);
  },
};
