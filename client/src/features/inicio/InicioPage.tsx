import { Link, useNavigate } from 'react-router-dom';
import {
  ETIQUETA_CUENTA,
  formatBs,
  type DashboardCorteDTO,
  type DashboardCuentaDTO,
} from '@taller/shared';
import { useDashboard } from '../../api/dashboard';
import { MESES } from '../../lib/meses';

export function InicioPage() {
  const { data, isLoading, error } = useDashboard();
  const navigate = useNavigate();
  const hoy = new Date();

  return (
    <div className="p-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Inicio</h1>
          <p className="mt-1 text-sm text-gray-500 capitalize">
            {hoy.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}{' '}
            · panorama del taller
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/cortes/nuevo')}
            className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#265dc2]"
          >
            + Nuevo corte
          </button>
          <button
            onClick={() => navigate('/anticipos')}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Registrar anticipo
          </button>
        </div>
      </div>

      {isLoading && <div className="mt-6 text-sm text-gray-500">Cargando panorama…</div>}
      {error && <div className="mt-6 text-sm text-error">No se pudo cargar ({String(error)})</div>}

      {data && (
        <>
          <CuentasDelMes cuentas={data.kpis.cuentas} mes={data.kpis.mes} />

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-5 py-3 text-sm font-semibold">Cortes activos</div>
              <div className="divide-y divide-gray-100">
                {data.cortesActivos.map((c) => (
                  <CorteActivo key={c.id} c={c} />
                ))}
                {data.cortesActivos.length === 0 && (
                  <div className="px-5 py-8 text-center text-sm text-gray-500">
                    No hay cortes en producción.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-gray-200 px-5 py-3 text-sm font-semibold">
                Alertas
                {data.alertas.length > 0 && (
                  <span className="rounded-full bg-error-suave px-1.5 text-[11px] font-semibold text-error">
                    {data.alertas.length}
                  </span>
                )}
              </div>
              <div className="divide-y divide-gray-100">
                {data.alertas.map((a, i) => (
                  <div key={i} className="flex items-start gap-2 px-5 py-3 text-sm">
                    <span
                      className="mt-1.5 h-2 w-2 flex-none rounded-full"
                      style={{ background: a.tipo === 'error' ? '#c0362c' : '#9a6a12' }}
                    />
                    <span className="text-gray-700">{a.texto}</span>
                  </div>
                ))}
                {data.alertas.length === 0 && (
                  <div className="px-5 py-8 text-center text-sm text-gray-500">
                    Todo en orden. Sin alertas.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Una fila por cuenta: cada una se paga aparte, así que no hay total general
 *  (docs/PLAN_CUENTAS_SEPARADAS.md §6). Clic en una fila → su planilla. */
function CuentasDelMes({ cuentas, mes }: { cuentas: DashboardCuentaDTO[]; mes: number }) {
  const navigate = useNavigate();
  const monto = (c: number) => (c !== 0 ? `Bs ${formatBs(c)}` : '—');
  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-left text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
            <th className="px-5 py-3">Cuenta · {MESES[mes - 1]}</th>
            <th className="px-4 py-3 text-right">Total a pagar</th>
            <th className="px-4 py-3 text-right">Anticipos entregados</th>
            <th className="px-4 py-3 text-right">Saldo pendiente</th>
            <th className="px-5 py-3 text-right">Cortes activos</th>
          </tr>
        </thead>
        <tbody>
          {cuentas.map((c) => {
            const vacia = c.totalAPagar === 0 && c.anticiposEntregados === 0 && c.saldoPendiente === 0;
            return (
              <tr
                key={c.cuenta}
                onClick={() => navigate(`/liquidacion?cuenta=${c.cuenta}`)}
                className={`cursor-pointer border-b border-gray-100 last:border-0 hover:bg-gray-50/60 ${vacia ? 'text-gray-400' : ''}`}
              >
                <td className="px-5 py-3 font-medium">{ETIQUETA_CUENTA[c.cuenta]}</td>
                <td className="mono px-4 py-3 text-right">{monto(c.totalAPagar)}</td>
                <td className="mono px-4 py-3 text-right">{monto(c.anticiposEntregados)}</td>
                <td className={`mono px-4 py-3 text-right font-semibold ${c.saldoPendiente < 0 ? 'text-error' : vacia ? '' : 'text-acento'}`}>
                  {monto(c.saldoPendiente)}
                </td>
                <td className="mono px-5 py-3 text-right">
                  {c.cortesActivos == null ? '—' : c.cortesActivos}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CorteActivo({ c }: { c: DashboardCorteDTO }) {
  const pct = c.operacionesTotal > 0 ? Math.round((c.operacionesAsignadas / c.operacionesTotal) * 100) : 0;
  return (
    <Link to={`/cortes/${c.id}`} className="block px-5 py-3 hover:bg-gray-50/60">
      <div className="flex items-center justify-between">
        <div className="text-sm">
          <span className="font-medium">{c.modeloNombre}</span>
          <span className="ml-1 text-[11px] font-semibold text-gray-400">v{c.numeroVersion}</span>
        </div>
        <span className="text-xs text-gray-500">{c.cantidadTotal} prendas</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-acento" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs text-gray-500">
          {c.operacionesAsignadas}/{c.operacionesTotal} asignadas
        </span>
      </div>
    </Link>
  );
}
