import { useState } from 'react';
import { formatBs, type ConsolidadoDTO, type LiquidacionFilaDTO } from '@taller/shared';
import { useConsolidado } from '../../api/liquidacion';
import { MESES } from '../../lib/meses';
import { CerrarMesModal } from './CerrarMesModal';

function SaldoBadge({ centavos }: { centavos: number }) {
  const neg = centavos < 0;
  return (
    <span
      className="mono rounded-md px-2 py-0.5 text-sm font-semibold"
      style={{
        color: neg ? '#c0362c' : '#127a45',
        background: neg ? '#fbeceb' : '#e6f4ec',
      }}
    >
      Bs {formatBs(centavos)}
    </span>
  );
}

export function LiquidacionPage() {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const { data, isLoading, error } = useConsolidado(anio, mes);
  const [modalCerrar, setModalCerrar] = useState(false);

  const irMes = (delta: number) => {
    const d = new Date(anio, mes - 1 + delta, 1);
    setAnio(d.getFullYear());
    setMes(d.getMonth() + 1);
  };

  return (
    <div className="p-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Liquidación</h1>
          <p className="mt-1 text-sm text-gray-500">
            Consolidado por operario · ganado (costura de cortes cerrados + servicio de corte +
            moldes, por la fecha de cada trabajo), anticipos y saldo con arrastre
          </p>
        </div>
        <div className="no-print flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Imprimir
          </button>
          {data && !data.cerrado && data.filas.length > 0 && (
            <button
              onClick={() => setModalCerrar(true)}
              className="rounded-lg bg-ok px-4 py-2 text-sm font-semibold text-white hover:bg-[#0e6238]"
            >
              Liquidar mes
            </button>
          )}
        </div>
      </div>

      <div className="no-print mt-5 flex items-center gap-3">
        <button
          onClick={() => irMes(-1)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          ‹
        </button>
        <div className="min-w-40 text-center text-lg font-semibold capitalize">
          {MESES[mes - 1]} {anio}
        </div>
        <button
          onClick={() => irMes(1)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          ›
        </button>
        {data?.cerrado && (
          <span className="rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500">
            Mes cerrado{' '}
            {data.fechaCierre && `el ${new Date(data.fechaCierre).toLocaleDateString('es-BO')}`}
          </span>
        )}
      </div>

      <div className="mt-2 hidden text-lg font-semibold capitalize print:block">
        Planilla de pagos · {MESES[mes - 1]} {anio}
      </div>

      {isLoading && <div className="mt-6 text-sm text-gray-500">Cargando consolidado…</div>}
      {error && <div className="mt-6 text-sm text-error">No se pudo cargar ({String(error)})</div>}

      {data && (
        <>
          <SemanasCards data={data} />
          <PlanillaTabla data={data} />
        </>
      )}

      {modalCerrar && data && (
        <CerrarMesModal
          anio={anio}
          mes={mes}
          nombreMes={MESES[mes - 1]}
          filas={data.filas}
          onCerrar={() => setModalCerrar(false)}
        />
      )}
    </div>
  );
}

function SemanasCards({ data }: { data: ConsolidadoDTO }) {
  return (
    <div className="no-print mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
      {data.semanas.map((s) => (
        <div key={s.inicioISO} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
            {s.label}
          </div>
          <div className="mono mt-1 text-lg font-semibold">Bs {formatBs(s.ganado)}</div>
          <div className="text-[11px] text-gray-400">
            {s.cortesCerrados === 0
              ? 'sin cierres de costura'
              : `${s.cortesCerrados} corte${s.cortesCerrados > 1 ? 's' : ''} cerrado${s.cortesCerrados > 1 ? 's' : ''}`}
          </div>
          {(s.desglose.servicioCorte > 0 || s.desglose.moldes > 0) && (
            <div className="mono mt-1 text-[11px] text-gray-500">
              costura {formatBs(s.desglose.costura)}
              {s.desglose.servicioCorte > 0 && ` · corte ${formatBs(s.desglose.servicioCorte)}`}
              {s.desglose.moldes > 0 && ` · moldes ${formatBs(s.desglose.moldes)}`}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function PlanillaTabla({ data }: { data: ConsolidadoDTO }) {
  const cerrado = data.cerrado;
  const t = data.totales;
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-left text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
            <th className="px-5 py-3">Operario</th>
            <th className="px-3 py-3 text-right">Saldo entrada</th>
            <th className="px-3 py-3 text-right">Costura</th>
            <th className="px-3 py-3 text-right">Servicio de corte</th>
            <th className="px-3 py-3 text-right">Moldes</th>
            <th className="px-3 py-3 text-right">Ganado</th>
            <th className="px-3 py-3 text-right">Anticipos</th>
            <th className="px-3 py-3 text-right">Saldo período</th>
            {cerrado && <th className="px-3 py-3 text-right">Pagado</th>}
            {cerrado && <th className="px-5 py-3 text-right">Saldo salida</th>}
          </tr>
        </thead>
        <tbody>
          {data.filas.map((f) => (
            <FilaPlanilla key={f.operarioId} f={f} cerrado={cerrado} />
          ))}
          {data.filas.length === 0 && (
            <tr>
              <td colSpan={cerrado ? 10 : 8} className="px-5 py-10 text-center text-gray-500">
                No hay movimiento ni saldos en este mes.
              </td>
            </tr>
          )}
        </tbody>
        {data.filas.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
              <td className="px-5 py-3">Totales</td>
              <td className="mono px-3 py-3 text-right">Bs {formatBs(t.saldoEntrada)}</td>
              <td className="mono px-3 py-3 text-right">Bs {formatBs(t.desglose.costura)}</td>
              <td className="mono px-3 py-3 text-right">Bs {formatBs(t.desglose.servicioCorte)}</td>
              <td className="mono px-3 py-3 text-right">Bs {formatBs(t.desglose.moldes)}</td>
              <td className="mono px-3 py-3 text-right">Bs {formatBs(t.ganado)}</td>
              <td className="mono px-3 py-3 text-right">Bs {formatBs(t.anticipos)}</td>
              <td className="mono px-3 py-3 text-right">Bs {formatBs(t.saldoPeriodo)}</td>
              {cerrado && <td className="mono px-3 py-3 text-right">Bs {formatBs(t.pagado ?? 0)}</td>}
              {cerrado && (
                <td className="mono px-5 py-3 text-right">Bs {formatBs(t.saldoSalida ?? 0)}</td>
              )}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/** Monto de un tipo de trabajo: "—" si no hubo, para que se lea qué hizo cada uno. */
function MontoTenue({ centavos }: { centavos: number }) {
  return (
    <td className="mono px-3 py-2.5 text-right text-gray-600">
      {centavos !== 0 ? formatBs(centavos) : <span className="text-gray-300">—</span>}
    </td>
  );
}

function FilaPlanilla({ f, cerrado }: { f: LiquidacionFilaDTO; cerrado: boolean }) {
  return (
    <tr className={`border-b border-gray-100 last:border-0 ${f.activo ? '' : 'opacity-60'}`}>
      <td className="px-5 py-2.5">
        <span className="font-medium">{f.nombre}</span>
        {f.esMaestro && (
          <span className="ml-1 rounded-full bg-[rgba(47,111,224,0.1)] px-1.5 text-[10px] font-semibold text-acento">
            maestro
          </span>
        )}
        {!f.activo && <span className="ml-1 text-[10px] text-gray-400">(baja)</span>}
      </td>
      <td className="mono px-3 py-2.5 text-right text-gray-500">
        {f.saldoEntrada !== 0 ? `Bs ${formatBs(f.saldoEntrada)}` : '—'}
      </td>
      <MontoTenue centavos={f.desglose.costura} />
      <MontoTenue centavos={f.desglose.servicioCorte} />
      <MontoTenue centavos={f.desglose.moldes} />
      <td className="mono px-3 py-2.5 text-right font-semibold">Bs {formatBs(f.ganado)}</td>
      <td className="mono px-3 py-2.5 text-right text-gray-500">Bs {formatBs(f.anticipos)}</td>
      <td className="px-3 py-2.5 text-right">
        <SaldoBadge centavos={f.saldoPeriodo} />
      </td>
      {cerrado && <td className="mono px-3 py-2.5 text-right">Bs {formatBs(f.pagado ?? 0)}</td>}
      {cerrado && (
        <td className="mono px-5 py-2.5 text-right">
          {f.arrastraSaldo && (
            <span className="mr-1 text-[10px] font-semibold text-[#9a6a12]">arrastra</span>
          )}
          Bs {formatBs(f.saldoSalida ?? 0)}
        </td>
      )}
    </tr>
  );
}
