import { Link, useNavigate } from 'react-router-dom';
import {
  ETIQUETA_CUENTA,
  formatBs,
  type DashboardCorteDTO,
  type DashboardCuentaDTO,
} from '@taller/shared';
import { useDashboard } from '../../api/dashboard';
import { HojaOficio } from '../../components/HojaOficio';
import { MESES } from '../../lib/meses';

export function InicioPage() {
  const { data, isLoading, error } = useDashboard();
  const navigate = useNavigate();
  const hoy = new Date();

  return (
    <>
    <div className="p-8 print:hidden">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Inicio</h1>
          <p className="mt-1 text-sm text-gray-500 capitalize">
            {hoy.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}{' '}
            · panorama del taller
          </p>
        </div>
        <div className="flex gap-2">
          {data && (
            <button
              onClick={() => window.print()}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Imprimir cuentas
            </button>
          )}
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
    {data && <HojaCuentas cuentas={data.kpis.cuentas} mes={data.kpis.mes} anio={data.kpis.anio} />}
    </>
  );
}

/** Una fila por cuenta: cada una se paga aparte, así que no hay total general
 *  (docs/PLAN_CUENTAS_SEPARADAS.md §6). Clic en una fila → su planilla. */
function CuentasDelMes({ cuentas, mes }: { cuentas: DashboardCuentaDTO[]; mes: number }) {
  const navigate = useNavigate();
  const monto = (c: number) => (c !== 0 ? `Bs ${formatBs(c)}` : '—');
  return (
    <div className="mt-6 w-fit max-w-full overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-left text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
            <th className="py-2.5 pr-6 pl-4">Cuenta · {MESES[mes - 1]}</th>
            <th className="px-4 py-2.5 text-right">Total a pagar</th>
            <th className="px-4 py-2.5 text-right">Anticipos</th>
            <th className="px-4 py-2.5 text-right">Saldo pendiente</th>
            <th className="py-2.5 pr-4 pl-4 text-right">Cortes activos</th>
          </tr>
        </thead>
        <tbody>
          {cuentas.map((c) => {
            const vacia = c.totalAPagar === 0 && c.anticiposEntregados === 0 && c.saldoPendiente === 0;
            return (
              <tr
                key={c.cuenta}
                onClick={() => navigate(`/liquidacion?cuenta=${c.cuenta}`)}
                className={`cursor-pointer border-b border-gray-200/70 last:border-0 even:bg-slate-100 hover:bg-blue-50 ${vacia ? 'text-gray-400' : ''}`}
              >
                <td className="py-2 pr-6 pl-4 font-medium whitespace-nowrap">{ETIQUETA_CUENTA[c.cuenta]}</td>
                <td className="mono px-4 py-2 text-right whitespace-nowrap">{monto(c.totalAPagar)}</td>
                <td className="mono px-4 py-2 text-right whitespace-nowrap">{monto(c.anticiposEntregados)}</td>
                <td className={`mono px-4 py-2 text-right font-semibold whitespace-nowrap ${c.saldoPendiente < 0 ? 'text-error' : vacia ? '' : 'text-acento'}`}>
                  {monto(c.saldoPendiente)}
                </td>
                <td className="mono py-2 pr-4 pl-4 text-right">
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

/** Las cuentas del mes en oficio vertical (ver HojaOficio), con fondo alterno
 *  por fila. Mismos números que la pantalla. */
function HojaCuentas({ cuentas, mes, anio }: { cuentas: DashboardCuentaDTO[]; mes: number; anio: number }) {
  const monto = (c: number) => (c !== 0 ? formatBs(c) : '—');
  return (
    <HojaOficio
      titulo={`Cuentas del mes · ${MESES[mes - 1]} ${anio}`}
      detalle="Cada cuenta se paga aparte: no se suman entre sí."
      resumen={`${cuentas.length} cuentas`}
      className="cebra"
    >
      <table>
        <thead>
          <tr>
            <th>Cuenta</th>
            <th className="num">Total a pagar</th>
            <th className="num">Anticipos</th>
            <th className="num">Saldo pendiente</th>
            <th className="num">Cortes activos</th>
          </tr>
        </thead>
        <tbody>
          {cuentas.map((c) => (
            <tr key={c.cuenta}>
              <td>{ETIQUETA_CUENTA[c.cuenta]}</td>
              <td className="num">{monto(c.totalAPagar)}</td>
              <td className="num">{monto(c.anticiposEntregados)}</td>
              <td className="num">{monto(c.saldoPendiente)}</td>
              <td className="num">{c.cortesActivos == null ? '—' : c.cortesActivos}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </HojaOficio>
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
