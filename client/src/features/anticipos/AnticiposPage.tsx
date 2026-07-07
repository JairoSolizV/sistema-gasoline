import { useMemo, useState } from 'react';
import { formatBs, type AnticipoDTO } from '@taller/shared';
import { useAnticipos } from '../../api/anticipos';
import { useOperarios } from '../../api/operarios';
import { claveSemana, etiquetaSemana } from '../../lib/semana';
import { AnticipoFormModal } from './AnticipoFormModal';
import { Modal } from '../../components/Modal';
import { useEliminarAnticipo } from '../../api/anticipos';
import { ErrorApi } from '../../api/client';

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-BO', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

export function AnticiposPage() {
  const [operarioId, setOperarioId] = useState<string>('');
  const { data: anticipos, isLoading, error } = useAnticipos(operarioId || undefined);
  const { data: operarios } = useOperarios('todos');
  const eliminar = useEliminarAnticipo();
  const [modal, setModal] = useState<
    { tipo: 'nuevo' } | { tipo: 'editar'; anticipo: AnticipoDTO } | { tipo: 'eliminar'; anticipo: AnticipoDTO } | null
  >(null);

  // agrupar por semana lunes–sábado (config del taller)
  const semanas = useMemo(() => {
    if (!anticipos) return [];
    const mapa = new Map<string, AnticipoDTO[]>();
    for (const a of anticipos) {
      const clave = claveSemana(new Date(a.fecha));
      const lista = mapa.get(clave);
      if (lista) lista.push(a);
      else mapa.set(clave, [a]);
    }
    return [...mapa.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [anticipos]);

  const totalMostrado = anticipos?.reduce((a, x) => a + x.monto, 0) ?? 0;

  return (
    <div className="p-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Anticipos</h1>
          <p className="mt-1 text-sm text-gray-500">
            Adelantos a cuenta de lo ganado · normalmente los sábados, con emergencias entre semana
          </p>
        </div>
        <button
          onClick={() => setModal({ tipo: 'nuevo' })}
          className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#265dc2]"
        >
          + Registrar anticipo
        </button>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <select
          value={operarioId}
          onChange={(e) => setOperarioId(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-acento"
        >
          <option value="">Todos los operarios</option>
          {operarios?.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nombre}
              {!o.activo ? ' (baja)' : ''}
            </option>
          ))}
        </select>
        {anticipos && (
          <span className="text-sm text-gray-500">
            {anticipos.length} anticipos · total{' '}
            <span className="mono font-semibold text-gray-800">Bs {formatBs(totalMostrado)}</span>
          </span>
        )}
      </div>

      <div className="mt-4 space-y-4">
        {isLoading && (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            Cargando anticipos…
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-error">
            No se pudieron cargar ({String(error)})
          </div>
        )}
        {anticipos && anticipos.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
            No hay anticipos {operarioId ? 'de este operario' : 'registrados'} todavía.
          </div>
        )}

        {semanas.map(([clave, lista]) => {
          const totalSemana = lista.reduce((a, x) => a + x.monto, 0);
          return (
            <div key={clave} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-2.5">
                <span className="text-sm font-semibold">Semana {etiquetaSemana(clave)}</span>
                <span className="text-xs text-gray-500">
                  {lista.length} anticipos · Σ{' '}
                  <span className="mono font-semibold text-gray-700">Bs {formatBs(totalSemana)}</span>
                </span>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {lista.map((a) => (
                    <tr key={a.id} className="border-b border-gray-100 last:border-0">
                      <td className="px-5 py-2.5 text-gray-500 capitalize">{formatearFecha(a.fecha)}</td>
                      <td className="px-3 py-2.5 font-medium">{a.operarioNombre}</td>
                      <td className="px-3 py-2.5 text-gray-500">{a.nota ?? ''}</td>
                      <td className="mono px-3 py-2.5 text-right font-semibold">Bs {formatBs(a.monto)}</td>
                      <td className="px-5 py-2.5">
                        <div className="flex justify-end gap-3 text-[13px] font-medium">
                          <button
                            onClick={() => setModal({ tipo: 'editar', anticipo: a })}
                            className="text-acento hover:underline"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => setModal({ tipo: 'eliminar', anticipo: a })}
                            className="text-error hover:underline"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>

      {modal?.tipo === 'nuevo' && (
        <AnticipoFormModal anticipo={null} operarios={operarios ?? []} onCerrar={() => setModal(null)} />
      )}
      {modal?.tipo === 'editar' && (
        <AnticipoFormModal
          anticipo={modal.anticipo}
          operarios={operarios ?? []}
          onCerrar={() => setModal(null)}
        />
      )}
      {modal?.tipo === 'eliminar' && (
        <Modal onCerrar={() => setModal(null)}>
          <h2 className="text-lg font-semibold">Eliminar anticipo</h2>
          <p className="mt-2 text-sm text-gray-600">
            Se quitará el anticipo de <strong>{modal.anticipo.operarioNombre}</strong> por{' '}
            <span className="mono font-semibold">Bs {formatBs(modal.anticipo.monto)}</span>. Esto{' '}
            <strong>cambia el saldo</strong> del operario en la liquidación del período.
          </p>
          {eliminar.isError && (
            <p className="mt-3 rounded-lg bg-error-suave px-3 py-2 text-xs text-error">
              {eliminar.error instanceof ErrorApi ? eliminar.error.message : 'Error al eliminar'}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setModal(null)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={async () => {
                try {
                  await eliminar.mutateAsync(modal.anticipo.id);
                  setModal(null);
                } catch {
                  // el error queda en eliminar.error y se muestra arriba
                }
              }}
              disabled={eliminar.isPending}
              className="rounded-lg bg-error px-4 py-2 text-sm font-semibold text-white hover:bg-[#a52d24] disabled:opacity-60"
            >
              Eliminar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
