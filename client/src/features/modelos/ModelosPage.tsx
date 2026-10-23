import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatBs, type ModeloDTO } from '@taller/shared';
import { useEliminarModelo, useModelos } from '../../api/modelos';
import { ErrorApi } from '../../api/client';
import { Modal } from '../../components/Modal';
import { TABLA } from '../../components/tabla';

/** Confirmación antes de eliminar. Un modelo con cortes o moldes no se puede
 *  borrar (perdería el historial de pagos): se explica y no se ofrece borrar. */
function ModalEliminarModelo({ modelo, onCerrar }: { modelo: ModeloDTO; onCerrar: () => void }) {
  const eliminar = useEliminarModelo();
  const cortes = modelo.versiones.reduce((a, v) => a + v.cantidadCortes, 0);
  const conMoldes = modelo.versiones.some((v) => v.molde);
  const operaciones = modelo.versiones.reduce((a, v) => a + v.cantidadOperaciones, 0);
  const bloqueado = cortes > 0 || conMoldes;

  return (
    <Modal onCerrar={onCerrar}>
      <h2 className="text-lg font-semibold">Eliminar modelo</h2>
      {bloqueado ? (
        <p className="mt-2 text-sm text-gray-600">
          <strong>{modelo.nombre}</strong> no se puede eliminar:{' '}
          {cortes > 0
            ? `ya tiene ${cortes} corte(s) hechos con él`
            : 'tiene moldes registrados (es un pago)'}
          . Borrarlo perdería el historial de lo que se pagó.
          {cortes === 0 && ' Si los moldes fueron un error, quitalos primero desde la versión.'}
        </p>
      ) : (
        <p className="mt-2 text-sm text-gray-600">
          ¿Estás seguro de que querés eliminar <strong>{modelo.nombre}</strong>? Se borran sus{' '}
          {modelo.versiones.length} versión(es) y {operaciones} operación(es).{' '}
          <strong>No se puede deshacer.</strong>
        </p>
      )}
      {eliminar.error != null && (
        <p className="mt-3 rounded-lg bg-error-suave px-3 py-2 text-xs text-error">
          {eliminar.error instanceof ErrorApi ? eliminar.error.message : 'Error al eliminar'}
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onCerrar}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          {bloqueado ? 'Entendido' : 'Cancelar'}
        </button>
        {!bloqueado && (
          <button
            onClick={async () => {
              await eliminar.mutateAsync(modelo.id);
              onCerrar();
            }}
            disabled={eliminar.isPending}
            className="rounded-lg bg-error px-4 py-2 text-sm font-semibold text-white hover:bg-[#a52d24] disabled:opacity-60"
          >
            Sí, eliminar
          </button>
        )}
      </div>
    </Modal>
  );
}

export function ModelosPage() {
  const { data: modelos, isLoading, error } = useModelos();
  const navigate = useNavigate();
  const [aEliminar, setAEliminar] = useState<ModeloDTO | null>(null);

  return (
    <div className="p-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Modelos</h1>
          <p className="mt-1 text-sm text-gray-500">
            Catálogo de prendas, operaciones y tarifas por pieza
          </p>
        </div>
        <button
          onClick={() => navigate('/modelos/nuevo')}
          className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#265dc2]"
        >
          + Nuevo modelo
        </button>
      </div>

      <div className={`mt-6 ${TABLA.contenedor}`}>
        {isLoading && <div className="p-8 text-center text-sm text-gray-500">Cargando catálogo…</div>}
        {error && (
          <div className="p-8 text-center text-sm text-error">
            No se pudo cargar el catálogo ({String(error)})
          </div>
        )}
        {modelos && (
          <table className="text-sm">
            <thead className={TABLA.cabecera}>
              <tr className={TABLA.filaCabecera}>
                <th className="px-3 py-2.5">Modelo</th>
                <th className="px-3 py-2.5">Versiones</th>
                <th className="px-3 py-2.5">Búsqueda</th>
                <th className="px-3 py-2.5 text-right">Operaciones</th>
                <th className="px-3 py-2.5 text-right">Mano de obra / prenda</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {modelos.map((m) => {
                const ultima = m.versiones[0];
                return (
                  <tr key={m.id} className={TABLA.fila}>
                    <td className="max-w-[300px] px-3 py-2">
                      <Link
                        to={`/modelos/versiones/${ultima?.id ?? ''}`}
                        className="font-medium text-acento hover:underline"
                      >
                        {m.nombre}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex max-w-[180px] flex-wrap gap-1">
                        {m.versiones.map((v) => (
                          <Link
                            key={v.id}
                            to={`/modelos/versiones/${v.id}`}
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              v.id === ultima?.id
                                ? 'bg-[rgba(47,111,224,0.1)] text-acento'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                          >
                            v{v.numeroVersion}
                          </Link>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-sm whitespace-nowrap">
                      {m.buscador ? (
                        <span className="text-gray-700">{m.buscador.nombre}</span>
                      ) : m.sinBuscador ? (
                        <span className="text-gray-400">sin buscador</span>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                          pendiente
                        </span>
                      )}
                    </td>
                    <td className="mono px-3 py-2 text-right text-gray-600">{ultima?.cantidadOperaciones ?? 0}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <span className="mono font-semibold">
                        Bs {ultima ? formatBs(ultima.costoManoObraPrenda) : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => setAEliminar(m)}
                        className="text-[13px] font-medium text-error hover:underline"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                );
              })}
              {modelos.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-500">
                    No hay modelos todavía. Creá el primero con "+ Nuevo modelo".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      {aEliminar && <ModalEliminarModelo modelo={aEliminar} onCerrar={() => setAEliminar(null)} />}
    </div>
  );
}
