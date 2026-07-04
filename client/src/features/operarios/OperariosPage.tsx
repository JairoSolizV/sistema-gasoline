import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { crearOperarioSchema, type OperarioDTO, type TipoOperario } from '@taller/shared';
import { useCrearOperario, useEditarOperario, useOperarios } from '../../api/operarios';
import { ErrorApi } from '../../api/client';

// El esquema compartido + tolerancia al <input type="date"> vacío del form.
const formSchema = crearOperarioSchema.extend({
  fechaIngreso: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.coerce.date().optional(),
  ),
});
type FormValores = z.input<typeof formSchema>;
type FormSalida = z.output<typeof formSchema>;

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

function Modal({ children, onCerrar }: { children: React.ReactNode; onCerrar: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
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

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValores, unknown, FormSalida>({
    resolver: standardSchemaResolver(formSchema),
    defaultValues: operario
      ? { nombre: operario.nombre, tipo: operario.tipo }
      : { tipo: 'regular' },
  });

  const onSubmit = handleSubmit(async (valores) => {
    if (operario) {
      await editar.mutateAsync({
        id: operario.id,
        cambios: { nombre: valores.nombre, tipo: valores.tipo },
      });
    } else {
      await crear.mutateAsync(valores);
    }
    onCerrar();
  });

  return (
    <Modal onCerrar={onCerrar}>
      <h2 className="text-lg font-semibold">{operario ? 'Editar operario' : 'Nuevo operario'}</h2>
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Nombre</label>
          <input
            {...register('nombre')}
            autoFocus
            placeholder="ej. RUBEN"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-acento focus:ring-2 focus:ring-acento/20"
          />
          {errors.nombre && <p className="mt-1 text-xs text-error">{errors.nombre.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Tipo</label>
          <select
            {...register('tipo')}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-acento"
          >
            <option value="regular">Regular (tarifa base)</option>
            <option value="maestro_externo">Maestro externo (tarifa base + diferencial)</option>
          </select>
        </div>
        {!operario && (
          <div>
            <label className="mb-1 block text-sm font-medium">
              Fecha de ingreso <span className="font-normal text-gray-400">(opcional, hoy por defecto)</span>
            </label>
            <input
              type="date"
              {...register('fechaIngreso')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-acento"
            />
          </div>
        )}
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

export function OperariosPage() {
  const [estado, setEstado] = useState<'activos' | 'todos'>('activos');
  const { data: operarios, isLoading, error } = useOperarios(estado);
  const editar = useEditarOperario();
  const [modal, setModal] = useState<
    { tipo: 'alta' } | { tipo: 'editar'; operario: OperarioDTO } | { tipo: 'baja'; operario: OperarioDTO } | null
  >(null);

  return (
    <div className="p-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Operarios</h1>
          <p className="mt-1 text-sm text-gray-500">
            Plantel del taller · {operarios ? `${operarios.length} ${estado === 'activos' ? 'activos' : 'en total'}` : '…'}
          </p>
        </div>
        <button
          onClick={() => setModal({ tipo: 'alta' })}
          className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#265dc2]"
        >
          + Nuevo operario
        </button>
      </div>

      <div className="mt-5 inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-sm">
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

      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
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
                <th className="px-5 py-3">Tipo</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3">Ingreso</th>
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
                      <span className="font-medium">{o.nombre}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <BadgeTipo tipo={o.tipo} />
                  </td>
                  <td className="px-5 py-3">
                    <BadgeEstado activo={o.activo} />
                  </td>
                  <td className="px-5 py-3 text-gray-600">{formatearFecha(o.fechaIngreso)}</td>
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
                        <button
                          onClick={() => editar.mutate({ id: o.id, cambios: { activo: true } })}
                          className="text-ok hover:underline"
                        >
                          Reactivar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {operarios.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-500">
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
    </div>
  );
}
