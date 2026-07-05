import { useState } from 'react';
import { formatBs, type RendicionDTO } from '@taller/shared';
import { useOperarios } from '../../api/operarios';
import { useRendicion } from '../../api/rendicion';
import { MESES } from '../../lib/meses';

function SaldoBadge({ centavos, grande }: { centavos: number; grande?: boolean }) {
  const neg = centavos < 0;
  return (
    <span
      className={`mono rounded-md font-semibold ${grande ? 'px-3 py-1 text-2xl' : 'px-2 py-0.5 text-sm'}`}
      style={{ color: neg ? '#c0362c' : '#127a45', background: neg ? '#fbeceb' : '#e6f4ec' }}
    >
      Bs {formatBs(centavos)}
    </span>
  );
}

export function RendicionPage() {
  const hoy = new Date();
  const { data: operarios } = useOperarios('todos');
  const [operarioId, setOperarioId] = useState<string>('');
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const { data, isLoading, error } = useRendicion(operarioId || undefined, anio, mes);

  const irMes = (delta: number) => {
    const d = new Date(anio, mes - 1 + delta, 1);
    setAnio(d.getFullYear());
    setMes(d.getMonth() + 1);
  };

  return (
    <div className="p-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Rendición de cuentas</h1>
          <p className="mt-1 text-sm text-gray-500">
            Detalle individual de cada operario — solo lo suyo, para mostrárselo y evitar
            comparaciones
          </p>
        </div>
        {data && (
          <button
            onClick={() => window.print()}
            className="no-print rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Imprimir
          </button>
        )}
      </div>

      <div className="no-print mt-5 flex flex-wrap items-center gap-3">
        <select
          value={operarioId}
          onChange={(e) => setOperarioId(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-acento"
        >
          <option value="">Elegir operario…</option>
          {operarios?.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nombre}
              {!o.activo ? ' (baja)' : ''}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <button
            onClick={() => irMes(-1)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            ‹
          </button>
          <div className="min-w-36 text-center font-semibold capitalize">
            {MESES[mes - 1]} {anio}
          </div>
          <button
            onClick={() => irMes(1)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            ›
          </button>
        </div>
      </div>

      {!operarioId && (
        <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          Elegí un operario para ver su rendición de cuentas.
        </div>
      )}
      {operarioId && isLoading && <div className="mt-6 text-sm text-gray-500">Cargando…</div>}
      {operarioId && error && (
        <div className="mt-6 text-sm text-error">No se pudo cargar ({String(error)})</div>
      )}

      {data && <Detalle data={data} nombreMes={MESES[mes - 1]} />}
    </div>
  );
}

function Detalle({ data, nombreMes }: { data: RendicionDTO; nombreMes: string }) {
  return (
    <div className="mt-5">
      {/* Encabezado imprimible */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div>
          <div className="text-2xl font-semibold">
            {data.nombre}
            {data.esMaestro && (
              <span className="ml-2 rounded-full bg-[rgba(47,111,224,0.1)] px-2 py-0.5 align-middle text-sm font-semibold text-acento">
                maestro externo
              </span>
            )}
          </div>
          <div className="mt-1 text-sm text-gray-500 capitalize">
            Rendición de {nombreMes} {data.anio}
            {data.cerrado && ' · mes cerrado'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
            {data.cerrado ? 'Saldo del período' : 'Saldo a la fecha'}
          </div>
          <SaldoBadge centavos={data.saldoPeriodo} grande />
        </div>
      </div>

      {/* Resumen numérico */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tarjeta titulo="Saldo entrada" valor={data.saldoEntrada} tenue />
        <Tarjeta titulo="Ganado" valor={data.totalGanado} />
        <Tarjeta titulo="Anticipos" valor={data.totalAnticipos} tenue />
        {data.cerrado ? (
          <Tarjeta titulo="Pagado" valor={data.pagado ?? 0} />
        ) : (
          <Tarjeta titulo="Saldo período" valor={data.saldoPeriodo} />
        )}
      </div>

      {/* Cortes trabajados */}
      <h2 className="mb-2 text-sm font-semibold text-gray-700">
        Trabajo del mes ({data.cortes.length} corte{data.cortes.length === 1 ? '' : 's'})
      </h2>
      {data.cortes.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          No trabajó en cortes cerrados este mes.
        </div>
      ) : (
        <div className="space-y-3">
          {data.cortes.map((c) => (
            <div key={c.corteId} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-2.5">
                <div className="text-sm">
                  <span className="font-semibold">{c.modeloNombre}</span>
                  <span className="ml-1 text-[11px] font-semibold text-gray-400">
                    v{c.numeroVersion}
                    {c.codigo ? ` · ${c.codigo}` : ''}
                  </span>
                  {c.fechaCierre && (
                    <span className="ml-2 text-xs text-gray-500">
                      cerrado {new Date(c.fechaCierre).toLocaleDateString('es-BO')}
                    </span>
                  )}
                </div>
                <span className="mono text-sm font-semibold">Bs {formatBs(c.totalCorte)}</span>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {c.operaciones.map((op, i) => (
                    <tr key={i} className="border-b border-gray-100 last:border-0">
                      <td className="w-14 px-5 py-2 text-gray-400">{op.n ?? '—'}</td>
                      <td className="px-3 py-2 text-gray-600">{op.grupo}</td>
                      <td className="px-3 py-2 font-medium">
                        {op.proceso}
                        {op.pieza && <span className="font-normal text-gray-500"> · {op.pieza}</span>}
                      </td>
                      <td className="mono px-3 py-2 text-right text-gray-500">{op.cantidad} pzs</td>
                      <td className="mono px-3 py-2 text-right text-gray-500">
                        Bs {formatBs(op.tarifaEfectiva)}
                        {op.esMaestroExterno && <span className="ml-1 text-[10px] text-acento">✦</span>}
                      </td>
                      <td className="mono w-24 px-5 py-2 text-right font-semibold">
                        Bs {formatBs(op.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Anticipos */}
      <h2 className="mt-6 mb-2 text-sm font-semibold text-gray-700">
        Anticipos del mes ({data.anticipos.length})
      </h2>
      {data.anticipos.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          Sin anticipos este mes.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <tbody>
              {data.anticipos.map((a, i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0">
                  <td className="px-5 py-2 text-gray-500 capitalize">
                    {new Date(a.fecha).toLocaleDateString('es-BO', {
                      weekday: 'short',
                      day: '2-digit',
                      month: 'short',
                    })}
                  </td>
                  <td className="px-3 py-2 text-gray-500">{a.nota ?? ''}</td>
                  <td className="mono px-5 py-2 text-right font-semibold">Bs {formatBs(a.monto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Tarjeta({ titulo, valor, tenue }: { titulo: string; valor: number; tenue?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">{titulo}</div>
      <div className={`mono mt-1 text-lg font-semibold ${tenue ? 'text-gray-500' : ''}`}>
        Bs {formatBs(valor)}
      </div>
    </div>
  );
}
