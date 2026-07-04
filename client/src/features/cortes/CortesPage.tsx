import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { EstadoCorte } from '@taller/shared';
import { useAbrirCorte, useCortes } from '../../api/cortes';
import { badgeEstadoCorte } from './estados';

function formatearFecha(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
}

const FILTROS: { valor: EstadoCorte | undefined; texto: string }[] = [
  { valor: undefined, texto: 'Todos' },
  { valor: 'abierto', texto: 'Abiertos' },
  { valor: 'borrador', texto: 'Borradores' },
  { valor: 'cerrado', texto: 'Cerrados' },
];

export function CortesPage() {
  const [estado, setEstado] = useState<EstadoCorte | undefined>(undefined);
  const { data: cortes, isLoading, error } = useCortes(estado);
  const abrir = useAbrirCorte();
  const navigate = useNavigate();

  return (
    <div className="p-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Cortes</h1>
          <p className="mt-1 text-sm text-gray-500">
            Producción y asignación de trabajo · módulo central
          </p>
        </div>
        <button
          onClick={() => navigate('/cortes/nuevo')}
          className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#265dc2]"
        >
          + Nuevo corte
        </button>
      </div>

      <div className="mt-5 inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-sm">
        {FILTROS.map((f) => (
          <button
            key={f.texto}
            onClick={() => setEstado(f.valor)}
            className={`rounded-md px-3 py-1.5 font-medium ${
              estado === f.valor ? 'bg-lateral text-white' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {f.texto}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading && <div className="p-8 text-center text-sm text-gray-500">Cargando cortes…</div>}
        {error && (
          <div className="p-8 text-center text-sm text-error">
            No se pudieron cargar los cortes ({String(error)})
          </div>
        )}
        {cortes && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                <th className="px-5 py-3">Corte</th>
                <th className="px-5 py-3">Cantidad</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3">Asignación</th>
                <th className="px-5 py-3">Inicio</th>
                <th className="px-5 py-3">Cierre</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cortes.map((c) => {
                const badge = badgeEstadoCorte(c.estado);
                const progreso =
                  c.operacionesTotal > 0
                    ? Math.round((c.operacionesAsignadas / c.operacionesTotal) * 100)
                    : 0;
                return (
                  <tr key={c.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
                    <td className="px-5 py-3">
                      <Link to={`/cortes/${c.id}`} className="font-medium text-acento hover:underline">
                        {c.modeloNombre}
                      </Link>{' '}
                      <span className="text-[11px] font-semibold text-gray-400">
                        v{c.numeroVersion}
                        {c.codigo ? ` · ${c.codigo}` : ''}
                      </span>
                    </td>
                    <td className="mono px-5 py-3">{c.cantidadTotal}</td>
                    <td className="px-5 py-3">
                      <span
                        className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                        style={{ color: badge.color, background: badge.bg, borderColor: badge.border }}
                      >
                        {badge.texto}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {c.estado === 'borrador' ? (
                        <span className="text-xs text-gray-400">sin abrir</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-100">
                            <div
                              className="h-full rounded-full bg-acento"
                              style={{ width: `${progreso}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">
                            {c.operacionesAsignadas}/{c.operacionesTotal}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{formatearFecha(c.fechaInicio)}</td>
                    <td className="px-5 py-3 text-gray-600">{formatearFecha(c.fechaCierre)}</td>
                    <td className="px-5 py-3 text-right">
                      {c.estado === 'borrador' && (
                        <button
                          onClick={() => abrir.mutate(c.id)}
                          className="text-[13px] font-medium text-acento hover:underline"
                        >
                          Abrir
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {cortes.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-gray-500">
                    No hay cortes {estado ? `en estado "${estado}"` : ''} todavía.
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
