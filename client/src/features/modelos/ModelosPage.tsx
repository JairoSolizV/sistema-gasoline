import { Link, useNavigate } from 'react-router-dom';
import { formatBs } from '@taller/shared';
import { useModelos } from '../../api/modelos';

export function ModelosPage() {
  const { data: modelos, isLoading, error } = useModelos();
  const navigate = useNavigate();

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

      <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading && <div className="p-8 text-center text-sm text-gray-500">Cargando catálogo…</div>}
        {error && (
          <div className="p-8 text-center text-sm text-error">
            No se pudo cargar el catálogo ({String(error)})
          </div>
        )}
        {modelos && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                <th className="px-5 py-3">Modelo</th>
                <th className="px-5 py-3">Versiones</th>
                <th className="px-5 py-3">Operaciones</th>
                <th className="px-5 py-3 text-right">Mano de obra / prenda</th>
              </tr>
            </thead>
            <tbody>
              {modelos.map((m) => {
                const ultima = m.versiones[0];
                return (
                  <tr key={m.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
                    <td className="px-5 py-3">
                      <Link
                        to={`/modelos/versiones/${ultima?.id ?? ''}`}
                        className="font-medium text-acento hover:underline"
                      >
                        {m.nombre}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
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
                    <td className="px-5 py-3 text-gray-600">{ultima?.cantidadOperaciones ?? 0}</td>
                    <td className="px-5 py-3 text-right">
                      <span className="mono font-semibold">
                        Bs {ultima ? formatBs(ultima.costoManoObraPrenda) : '—'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {modelos.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-gray-500">
                    No hay modelos todavía. Creá el primero con "+ Nuevo modelo".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
