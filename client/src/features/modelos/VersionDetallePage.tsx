import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatBs, type OperacionDTO } from '@taller/shared';
import {
  useAgregarOperacion,
  useCrearVersion,
  useEditarOperacionModelo,
  useEliminarOperacionModelo,
  useModelos,
  useVersion,
} from '../../api/modelos';
import { Modal } from '../../components/Modal';
import { OperacionFormModal } from './OperacionFormModal';

type ModalAbierto =
  | { tipo: 'agregar'; grupo?: string }
  | { tipo: 'editar'; operacion: OperacionDTO }
  | { tipo: 'eliminar'; operacion: OperacionDTO }
  | { tipo: 'nueva-version' }
  | null;

export function VersionDetallePage() {
  const { versionId } = useParams();
  const navigate = useNavigate();
  const { data: detalle, isLoading, error } = useVersion(versionId);
  const { data: modelos } = useModelos();
  const agregar = useAgregarOperacion();
  const editar = useEditarOperacionModelo();
  const eliminar = useEliminarOperacionModelo();
  const crearVersion = useCrearVersion();
  const [modal, setModal] = useState<ModalAbierto>(null);
  const [notasVersion, setNotasVersion] = useState('');

  const grupos = useMemo(() => {
    if (!detalle) return [];
    const mapa = new Map<string, OperacionDTO[]>();
    for (const op of detalle.operaciones) {
      const lista = mapa.get(op.grupo);
      if (lista) lista.push(op);
      else mapa.set(op.grupo, [op]);
    }
    return [...mapa.entries()];
  }, [detalle]);

  if (isLoading) return <div className="p-8 text-sm text-gray-500">Cargando versión…</div>;
  if (error || !detalle)
    return <div className="p-8 text-sm text-error">No se encontró la versión ({String(error)})</div>;

  const versionesDelModelo =
    modelos?.find((m) => m.id === detalle.modeloId)?.versiones ?? [];

  return (
    <div className="p-8">
      <div className="text-xs text-gray-500">
        <Link to="/modelos" className="hover:underline">
          Modelos
        </Link>{' '}
        / {detalle.modeloNombre}
      </div>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {detalle.modeloNombre}{' '}
            <span className="rounded-full bg-[rgba(47,111,224,0.1)] px-2 py-0.5 align-middle text-sm font-semibold text-acento">
              v{detalle.numeroVersion}
            </span>
          </h1>
          {detalle.notas && <p className="mt-1 text-sm text-gray-500">{detalle.notas}</p>}
          <div className="mt-2 flex gap-1">
            {versionesDelModelo.map((v) => (
              <button
                key={v.id}
                onClick={() => navigate(`/modelos/versiones/${v.id}`)}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  v.id === detalle.id
                    ? 'bg-lateral text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                v{v.numeroVersion}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-right shadow-sm">
            <div className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
              Mano de obra / prenda
            </div>
            <div className="mono text-2xl font-semibold">
              Bs {formatBs(detalle.costoManoObraPrenda)}
            </div>
            <div className="text-[11px] text-gray-400">{detalle.operaciones.length} operaciones</div>
          </div>
          <button
            onClick={() => setModal({ tipo: 'nueva-version' })}
            className="rounded-lg border border-acento px-4 py-2 text-sm font-semibold text-acento hover:bg-[rgba(47,111,224,0.06)]"
          >
            Crear nueva versión
          </button>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {grupos.map(([grupo, ops]) => (
          <div key={grupo} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-2.5">
              <div className="flex items-baseline gap-3">
                <span className="text-sm font-semibold">{grupo}</span>
                <span className="text-xs text-gray-500">{ops.length} operaciones</span>
              </div>
              <span className="mono text-sm font-semibold text-gray-600">
                Bs {formatBs(ops.reduce((a, o) => a + o.ct, 0))}
              </span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {ops.map((op) => (
                  <tr key={op.id} className="border-b border-gray-100 last:border-0">
                    <td className="w-14 px-5 py-2 text-gray-400">{op.n ?? '—'}</td>
                    <td className="w-32 px-3 py-2 text-gray-600">{op.equipo}</td>
                    <td className="px-3 py-2 font-medium">{op.proceso}</td>
                    <td className="px-3 py-2 text-gray-600">{op.pieza ?? '—'}</td>
                    <td className="w-28 px-3 py-2 text-right">
                      <span className="mono font-semibold">Bs {formatBs(op.ct)}</span>
                    </td>
                    <td className="w-36 px-5 py-2">
                      <div className="flex justify-end gap-3 text-[13px] font-medium">
                        <button
                          onClick={() => setModal({ tipo: 'editar', operacion: op })}
                          className="text-acento hover:underline"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => setModal({ tipo: 'eliminar', operacion: op })}
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
            <div className="border-t border-gray-100 px-5 py-2">
              <button
                onClick={() => setModal({ tipo: 'agregar', grupo })}
                className="text-[13px] font-medium text-acento hover:underline"
              >
                + Agregar operación a {grupo}
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => setModal({ tipo: 'agregar' })}
        className="mt-4 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:border-acento hover:text-acento"
      >
        + Agregar operación (nuevo grupo)
      </button>

      {modal?.tipo === 'agregar' && (
        <OperacionFormModal
          titulo="Agregar operación"
          operacion={null}
          grupoSugerido={modal.grupo}
          errorGuardar={agregar.error}
          onGuardar={(input) => agregar.mutateAsync({ versionId: detalle.id, input })}
          onCerrar={() => setModal(null)}
        />
      )}
      {modal?.tipo === 'editar' && (
        <OperacionFormModal
          titulo="Editar operación"
          operacion={modal.operacion}
          errorGuardar={editar.error}
          onGuardar={(input) =>
            editar.mutateAsync({ operacionId: modal.operacion.id, cambios: input })
          }
          onCerrar={() => setModal(null)}
        />
      )}
      {modal?.tipo === 'eliminar' && (
        <Modal onCerrar={() => setModal(null)}>
          <h2 className="text-lg font-semibold">Eliminar operación</h2>
          <p className="mt-2 text-sm text-gray-600">
            Se quitará <strong>{modal.operacion.proceso}</strong> ({modal.operacion.grupo}, Bs{' '}
            {formatBs(modal.operacion.ct)}) de la v{detalle.numeroVersion} y el costo por prenda se
            recalculará. Los cortes ya creados no cambian (usan su propio snapshot).
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setModal(null)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={async () => {
                await eliminar.mutateAsync({ operacionId: modal.operacion.id });
                setModal(null);
              }}
              disabled={eliminar.isPending}
              className="rounded-lg bg-error px-4 py-2 text-sm font-semibold text-white hover:bg-[#a52d24] disabled:opacity-60"
            >
              Eliminar
            </button>
          </div>
        </Modal>
      )}
      {modal?.tipo === 'nueva-version' && (
        <Modal onCerrar={() => setModal(null)}>
          <h2 className="text-lg font-semibold">Crear nueva versión</h2>
          <p className="mt-2 text-sm text-gray-600">
            Se creará la <strong>v{Math.max(...versionesDelModelo.map((v) => v.numeroVersion)) + 1}</strong>{' '}
            como copia exacta de la v{detalle.numeroVersion}. La versión actual queda{' '}
            <strong>intacta</strong> (histórico conservado); después podés quitar o editar las
            operaciones optimizadas.
          </p>
          <label className="mt-4 mb-1 block text-sm font-medium">
            Notas <span className="font-normal text-gray-400">(opcional)</span>
          </label>
          <input
            value={notasVersion}
            onChange={(e) => setNotasVersion(e.target.value)}
            placeholder='ej. "optimizado: se quitó doble despunte"'
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-acento"
          />
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setModal(null)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={async () => {
                const nueva = await crearVersion.mutateAsync({
                  modeloId: detalle.modeloId,
                  desdeVersionId: detalle.id,
                  notas: notasVersion.trim() === '' ? null : notasVersion.trim(),
                });
                setModal(null);
                setNotasVersion('');
                navigate(`/modelos/versiones/${nueva.id}`);
              }}
              disabled={crearVersion.isPending}
              className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-[#265dc2] disabled:opacity-60"
            >
              Crear versión
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
