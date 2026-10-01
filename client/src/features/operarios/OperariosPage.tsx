import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import {
  aCentavos,
  celularSchema,
  ciSchema,
  ETIQUETA_ROL,
  formatBs,
  ROLES_OPERARIO,
  rolOperarioSchema,
  tipoOperarioSchema,
  type OperarioDTO,
  type RolOperario,
  type TipoOperario,
} from '@taller/shared';
import {
  useCrearOperario,
  useEditarOperario,
  useEliminarOperario,
  useOperarios,
} from '../../api/operarios';
import { ErrorApi } from '../../api/client';
import { Modal } from '../../components/Modal';
import { aFechaInput, deFechaInput, hoyLocalISO } from '../../lib/fechas';
import { HojaOperariosImprimible } from './HojaOperariosImprimible';

// Los <input type="date"> trabajan con 'yyyy-mm-dd' (string); se convierten a
// Date a mediodía local recién al enviar. CI y celular reusan los esquemas
// compartidos (mismas reglas y normalización que la API).
// En el alta todo es obligatorio salvo la salida; al editar, CI/celular/
// nacimiento pueden quedar vacíos (operarios del roster original sin esos datos).
// Tarifa personal en Bs como se tipea ("0.25" o "0,25"); vacía = usar el
// respaldo de Configuración. Solo se valida si el operario tiene ese rol (si
// no, el campo está oculto y se manda null).
const PATRON_TARIFA = /^\d+([.,]\d{1,2})?$/;
const aTarifa = (v: string) => (v.trim() === '' ? null : aCentavos(v.trim().replace(',', '.')));
function errorTarifa(v: string): string | null {
  const s = v.trim();
  if (s === '') return null;
  if (!PATRON_TARIFA.test(s)) return 'Tarifa inválida (ej. 0.25)';
  return aTarifa(s)! > 0 ? null : 'La tarifa debe ser mayor a 0';
}
const TARIFAS_POR_ROL = [
  ['tarifaCorte', 'cortador'],
  ['tarifaClasificacion', 'clasificador'],
] as const;

function crearFormSchema(esAlta: boolean) {
  const vacioOk = <T extends z.ZodType>(s: T) => (esAlta ? s : z.union([z.literal(''), s]));
  return z
    .object({
      nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(60),
      tipo: tipoOperarioSchema,
      roles: z.array(rolOperarioSchema).min(1, 'Elegí al menos un rol'),
      tarifaCorte: z.string(),
      tarifaClasificacion: z.string(),
      ci: vacioOk(ciSchema),
      celular: vacioOk(celularSchema),
      fechaNacimiento: esAlta
        ? z.string().min(1, 'La fecha de nacimiento es obligatoria')
        : z.string(),
      fechaIngreso: z.string().min(1, 'La fecha de ingreso es obligatoria'),
      fechaSalida: z.string(),
    })
    .refine((v) => !v.fechaNacimiento || v.fechaNacimiento <= hoyLocalISO(), {
      path: ['fechaNacimiento'],
      message: 'La fecha de nacimiento no puede ser futura',
    })
    .refine((v) => !v.fechaSalida || v.fechaSalida >= v.fechaIngreso, {
      path: ['fechaSalida'],
      message: 'La salida no puede ser anterior al ingreso',
    })
    .superRefine((v, ctx) => {
      for (const [campo, rol] of TARIFAS_POR_ROL) {
        const error = v.roles.includes(rol) ? errorTarifa(v[campo]) : null;
        if (error) ctx.addIssue({ code: 'custom', path: [campo], message: error });
      }
    });
}
type FormSchema = ReturnType<typeof crearFormSchema>;
type FormValores = z.input<FormSchema>;
type FormSalida = z.output<FormSchema>;

const claseInput =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-acento focus:ring-2 focus:ring-acento/20';

function Campo({
  etiqueta,
  opcional,
  error,
  children,
}: {
  etiqueta: string;
  opcional?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">
        {etiqueta} {opcional && <span className="font-normal text-gray-400">({opcional})</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-error">{error}</p>}
    </div>
  );
}

function formatearFecha(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function BadgeTipo({ tipo }: { tipo: TipoOperario }) {
  return tipo === 'maestro_externo' ? (
    <span className="rounded-full bg-[rgba(47,111,224,0.1)] px-2 py-0.5 text-[11px] font-semibold text-acento">
      maestro externo
    </span>
  ) : (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
      regular
    </span>
  );
}

function BadgeEstado({ activo }: { activo: boolean }) {
  return activo ? (
    <span className="rounded-full border border-[#bfe3cd] bg-ok-suave px-2 py-0.5 text-[11px] font-semibold text-ok">
      Activo
    </span>
  ) : (
    <span className="rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
      De baja
    </span>
  );
}

function FormOperario({
  operario,
  onCerrar,
}: {
  operario: OperarioDTO | null; // null = alta
  onCerrar: () => void;
}) {
  const crear = useCrearOperario();
  const editar = useEditarOperario();
  const mutacion = operario ? editar : crear;

  const [formSchema] = useState(() => crearFormSchema(!operario));

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValores, unknown, FormSalida>({
    resolver: standardSchemaResolver(formSchema),
    defaultValues: operario
      ? {
          nombre: operario.nombre,
          tipo: operario.tipo,
          roles: operario.roles,
          tarifaCorte: operario.tarifaCorte != null ? formatBs(operario.tarifaCorte) : '',
          tarifaClasificacion:
            operario.tarifaClasificacion != null ? formatBs(operario.tarifaClasificacion) : '',
          ci: operario.ci ?? '',
          celular: operario.celular ?? '',
          fechaNacimiento: aFechaInput(operario.fechaNacimiento),
          fechaIngreso: aFechaInput(operario.fechaIngreso),
          fechaSalida: aFechaInput(operario.fechaSalida),
        }
      : {
          tipo: 'regular',
          roles: ['costurero'],
          tarifaCorte: '',
          tarifaClasificacion: '',
          ci: '',
          celular: '',
          fechaNacimiento: '',
          fechaIngreso: hoyLocalISO(),
          fechaSalida: '',
        },
  });

  const roles = watch('roles') ?? [];
  const esCortador = roles.includes('cortador');
  const esClasificador = roles.includes('clasificador');

  const onSubmit = handleSubmit(async (v) => {
    const fechaSalida = v.fechaSalida ? deFechaInput(v.fechaSalida) : null;
    // la tarifa personal solo tiene sentido con el rol; sin él se limpia
    const oficio = {
      roles: v.roles,
      tarifaCorte: v.roles.includes('cortador') ? aTarifa(v.tarifaCorte) : null,
      tarifaClasificacion: v.roles.includes('clasificador') ? aTarifa(v.tarifaClasificacion) : null,
    };
    if (operario) {
      await editar.mutateAsync({
        id: operario.id,
        cambios: {
          nombre: v.nombre,
          tipo: v.tipo,
          ...oficio,
          ci: v.ci || null,
          celular: v.celular || null,
          fechaNacimiento: v.fechaNacimiento ? deFechaInput(v.fechaNacimiento) : null,
          fechaIngreso: deFechaInput(v.fechaIngreso),
          fechaSalida,
        },
      });
    } else {
      await crear.mutateAsync({
        nombre: v.nombre,
        tipo: v.tipo,
        ...oficio,
        ci: v.ci,
        celular: v.celular,
        fechaNacimiento: deFechaInput(v.fechaNacimiento),
        fechaIngreso: deFechaInput(v.fechaIngreso),
        fechaSalida,
      });
    }
    onCerrar();
  });

  return (
    <Modal onCerrar={onCerrar} ancho="max-w-lg">
      <h2 className="text-lg font-semibold">{operario ? 'Editar operario' : 'Nuevo operario'}</h2>
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <Campo etiqueta="Nombre" error={errors.nombre?.message}>
          <input {...register('nombre')} autoFocus placeholder="ej. RUBEN" className={claseInput} />
        </Campo>
        <Campo etiqueta="Tipo">
          <select {...register('tipo')} className={`${claseInput} bg-white`}>
            <option value="regular">Regular (tarifa base)</option>
            <option value="maestro_externo">Maestro externo (tarifa base + diferencial)</option>
          </select>
        </Campo>
        <Campo etiqueta="Roles" opcional="uno o varios oficios" error={errors.roles?.message}>
          <Controller
            control={control}
            name="roles"
            render={({ field }) => (
              <div className="flex flex-wrap gap-1.5">
                {ROLES_OPERARIO.map((rol) => {
                  const marcado = field.value?.includes(rol) ?? false;
                  return (
                    <button
                      key={rol}
                      type="button"
                      aria-pressed={marcado}
                      onClick={() =>
                        field.onChange(
                          marcado
                            ? field.value.filter((r: RolOperario) => r !== rol)
                            : [...(field.value ?? []), rol],
                        )
                      }
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        marcado
                          ? 'border-acento bg-acento text-white'
                          : 'border-gray-300 bg-white text-gray-600 hover:border-acento'
                      }`}
                    >
                      {ETIQUETA_ROL[rol]}
                    </button>
                  );
                })}
              </div>
            )}
          />
        </Campo>
        {(esCortador || esClasificador) && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {esCortador && (
              <Campo
                etiqueta="Tarifa de corte (Bs/prenda)"
                opcional="vacía = la de Configuración"
                error={errors.tarifaCorte?.message}
              >
                <input
                  {...register('tarifaCorte')}
                  inputMode="decimal"
                  placeholder="ej. 0.25"
                  className={`mono ${claseInput}`}
                />
              </Campo>
            )}
            {esClasificador && (
              <Campo
                etiqueta="Tarifa de clasificación (Bs/prenda)"
                opcional="vacía = la de Configuración"
                error={errors.tarifaClasificacion?.message}
              >
                <input
                  {...register('tarifaClasificacion')}
                  inputMode="decimal"
                  placeholder="ej. 0.10"
                  className={`mono ${claseInput}`}
                />
              </Campo>
            )}
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo etiqueta="Cédula de identidad" error={errors.ci?.message}>
            <input {...register('ci')} placeholder="ej. 6543210 LP" className={claseInput} />
          </Campo>
          <Campo etiqueta="Número de celular" error={errors.celular?.message}>
            <input
              {...register('celular')}
              type="tel"
              inputMode="tel"
              placeholder="ej. 71234567"
              className={claseInput}
            />
          </Campo>
          <Campo etiqueta="Fecha de nacimiento" error={errors.fechaNacimiento?.message}>
            <input
              type="date"
              max={hoyLocalISO()}
              {...register('fechaNacimiento')}
              className={claseInput}
            />
          </Campo>
          <Campo etiqueta="Fecha de ingreso" error={errors.fechaIngreso?.message}>
            <input type="date" {...register('fechaIngreso')} className={claseInput} />
          </Campo>
          <Campo
            etiqueta="Fecha de salida"
            opcional="prevista; no da de baja"
            error={errors.fechaSalida?.message}
          >
            <input type="date" {...register('fechaSalida')} className={claseInput} />
          </Campo>
        </div>
        {mutacion.error && (
          <p className="rounded-lg bg-error-suave px-3 py-2 text-xs text-error">
            {mutacion.error instanceof ErrorApi ? mutacion.error.message : 'Error al guardar'}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-[#265dc2] disabled:opacity-60"
          >
            {operario ? 'Guardar cambios' : 'Crear operario'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ConfirmarBaja({ operario, onCerrar }: { operario: OperarioDTO; onCerrar: () => void }) {
  const editar = useEditarOperario();
  return (
    <Modal onCerrar={onCerrar}>
      <h2 className="text-lg font-semibold">Dar de baja a {operario.nombre}</h2>
      <p className="mt-2 text-sm text-gray-600">
        La baja es <strong>lógica</strong>: su histórico de cortes, pagos y anticipos se conserva
        intacto. Solo deja de aparecer para asignaciones nuevas. Se puede reactivar después.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onCerrar}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          onClick={async () => {
            await editar.mutateAsync({ id: operario.id, cambios: { activo: false } });
            onCerrar();
          }}
          disabled={editar.isPending}
          className="rounded-lg bg-error px-4 py-2 text-sm font-semibold text-white hover:bg-[#a52d24] disabled:opacity-60"
        >
          Dar de baja
        </button>
      </div>
    </Modal>
  );
}

function ConfirmarEliminar({ operario, onCerrar }: { operario: OperarioDTO; onCerrar: () => void }) {
  const eliminar = useEliminarOperario();
  return (
    <Modal onCerrar={onCerrar}>
      <h2 className="text-lg font-semibold">Eliminar a {operario.nombre}</h2>
      <p className="mt-2 text-sm text-gray-600">
        Se borra <strong>definitivamente</strong> del sistema y no se puede deshacer. Solo se
        permite porque no tiene cortes, anticipos ni liquidaciones registrados.
      </p>
      {eliminar.error && (
        <p className="mt-3 rounded-lg bg-error-suave px-3 py-2 text-xs text-error">
          {eliminar.error instanceof ErrorApi ? eliminar.error.message : 'Error al eliminar'}
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onCerrar}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          onClick={async () => {
            await eliminar.mutateAsync(operario.id);
            onCerrar();
          }}
          disabled={eliminar.isPending}
          className="rounded-lg bg-error px-4 py-2 text-sm font-semibold text-white hover:bg-[#a52d24] disabled:opacity-60"
        >
          Eliminar definitivamente
        </button>
      </div>
    </Modal>
  );
}

export function OperariosPage() {
  const [estado, setEstado] = useState<'activos' | 'todos'>('activos');
  const [rol, setRol] = useState<RolOperario | ''>('');
  const { data: operarios, isLoading, error } = useOperarios(estado, rol || undefined);
  const editar = useEditarOperario();
  const [modal, setModal] = useState<
    | { tipo: 'alta' }
    | { tipo: 'editar' | 'baja' | 'eliminar'; operario: OperarioDTO }
    | null
  >(null);

  return (
    <>
      {operarios && (
        <HojaOperariosImprimible operarios={operarios} estado={estado} rol={rol || undefined} />
      )}
      <div className="p-8 print:hidden">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Operarios</h1>
            <p className="mt-1 text-sm text-gray-500">
              Plantel del taller · {operarios ? `${operarios.length} ${estado === 'activos' ? 'activos' : 'en total'}` : '…'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              disabled={!operarios}
              title={`Hoja oficio vertical · imprime la lista visible (${estado})`}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
            >
              Imprimir lista
            </button>
            <button
              onClick={() => setModal({ tipo: 'alta' })}
              className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#265dc2]"
            >
              + Nuevo operario
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-sm">
            {(['activos', 'todos'] as const).map((op) => (
              <button
                key={op}
                onClick={() => setEstado(op)}
                className={`rounded-md px-3 py-1.5 font-medium capitalize ${
                  estado === op ? 'bg-lateral text-white' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {op}
              </button>
            ))}
          </div>
          <select
            value={rol}
            onChange={(e) => setRol(e.target.value as RolOperario | '')}
            aria-label="Filtrar por rol"
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-acento"
          >
            <option value="">Todos los roles</option>
            {ROLES_OPERARIO.map((r) => (
              <option key={r} value={r}>
                {ETIQUETA_ROL[r]}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          {isLoading && <div className="p-8 text-center text-sm text-gray-500">Cargando plantel…</div>}
          {error && (
            <div className="p-8 text-center text-sm text-error">
              No se pudo cargar el plantel. ¿Está corriendo la API? ({String(error)})
            </div>
          )}
          {operarios && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                  <th className="px-5 py-3">Operario</th>
                  <th className="px-5 py-3">Roles</th>
                  <th className="px-5 py-3">Celular</th>
                  <th className="px-5 py-3">Tipo</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3">Ingreso</th>
                  <th className="px-5 py-3">Salida</th>
                  <th className="px-5 py-3">Baja</th>
                  <th className="px-5 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {operarios.map((o) => (
                  <tr
                    key={o.id}
                    className={`border-b border-gray-100 last:border-0 ${o.activo ? '' : 'opacity-60'}`}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#e8edf5] text-xs font-semibold text-[#41506b]">
                          {o.nombre.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium">{o.nombre}</div>
                          <div className="text-xs text-gray-500">
                            {o.ci ? `CI ${o.ci}` : 'sin CI'}
                            {o.fechaNacimiento && ` · nac. ${formatearFecha(o.fechaNacimiento)}`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex max-w-[260px] flex-wrap gap-1">
                        {o.roles.map((r) => (
                          <span
                            key={r}
                            className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-gray-700"
                          >
                            {ETIQUETA_ROL[r]}
                            {r === 'cortador' && o.tarifaCorte != null && ` · ${formatBs(o.tarifaCorte)}`}
                            {r === 'clasificador' &&
                              o.tarifaClasificacion != null &&
                              ` · ${formatBs(o.tarifaClasificacion)}`}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600 tabular-nums">{o.celular ?? '—'}</td>
                    <td className="px-5 py-3">
                      <BadgeTipo tipo={o.tipo} />
                    </td>
                    <td className="px-5 py-3">
                      <BadgeEstado activo={o.activo} />
                    </td>
                    <td className="px-5 py-3 text-gray-600">{formatearFecha(o.fechaIngreso)}</td>
                    <td className="px-5 py-3 text-gray-600">{formatearFecha(o.fechaSalida)}</td>
                    <td className="px-5 py-3 text-gray-600">{formatearFecha(o.fechaBaja)}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-3 text-[13px] font-medium">
                        <button
                          onClick={() => setModal({ tipo: 'editar', operario: o })}
                          className="text-acento hover:underline"
                        >
                          Editar
                        </button>
                        {o.activo ? (
                          <button
                            onClick={() => setModal({ tipo: 'baja', operario: o })}
                            className="text-error hover:underline"
                          >
                            Dar de baja
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => editar.mutate({ id: o.id, cambios: { activo: true } })}
                              className="text-ok hover:underline"
                            >
                              Reactivar
                            </button>
                            {o.tieneHistorial ? (
                              <span
                                title="Tiene cortes, anticipos o liquidaciones: se conserva como baja para no alterar pagos pasados"
                                className="cursor-help text-gray-400"
                              >
                                Eliminar
                              </span>
                            ) : (
                              <button
                                onClick={() => setModal({ tipo: 'eliminar', operario: o })}
                                className="text-error hover:underline"
                              >
                                Eliminar
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {operarios.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-5 py-8 text-center text-gray-500">
                      No hay operarios {estado === 'activos' ? 'activos' : ''} todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {modal?.tipo === 'alta' && <FormOperario operario={null} onCerrar={() => setModal(null)} />}
        {modal?.tipo === 'editar' && (
          <FormOperario operario={modal.operario} onCerrar={() => setModal(null)} />
        )}
        {modal?.tipo === 'baja' && (
          <ConfirmarBaja operario={modal.operario} onCerrar={() => setModal(null)} />
        )}
        {modal?.tipo === 'eliminar' && (
          <ConfirmarEliminar operario={modal.operario} onCerrar={() => setModal(null)} />
        )}
      </div>
    </>
  );
}
