import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CUENTAS,
  ETIQUETA_CUENTA,
  formatBs,
  SERVICIOS_EXTERNOS,
  type Cuenta,
  type CuentaConsolidadoDTO,
  type LiquidacionFilaDTO,
} from '@taller/shared';
import { useConsolidado } from '../../api/liquidacion';
import { MESES } from '../../lib/meses';
import { TABLA } from '../../components/tabla';
import { CerrarMesModal } from './CerrarMesModal';

/** Qué se gana en cada cuenta y cuándo (docs/PLAN_CUENTAS_SEPARADAS.md §2). */
const REGLA_CUENTA: Record<Cuenta, string> = {
  operaciones: 'operaciones de costura de los cortes cerrados en el mes (por fecha de cierre)',
  empaque: 'operaciones de empaque de los cortes cerrados en el mes (por fecha de cierre)',
  servicio_corte: 'búsqueda, trazado, doblado, corte y clasificación (por la fecha de cada trabajo)',
  moldes: 'moldes nuevos y modificaciones (por la fecha del pago)',
  sueldo: 'sueldo semanal de los ayudantes según la asistencia (por día)',
  serigrafia: 'prendas devueltas por la serigrafía (por fecha de devolución)',
  laser: 'prendas devueltas por el servicio de láser (por fecha de devolución)',
  bordado: 'prendas devueltas por la bordadora (por fecha de devolución)',
  lavanderia: 'prendas devueltas por la lavandería (por fecha de devolución)',
};

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

  // la pestaña elegida vive en la URL (?cuenta=…): el inicio enlaza directo a ella
  const [parametros, setParametros] = useSearchParams();
  const pedida = parametros.get('cuenta') as Cuenta | null;
  const cuentaActiva: Cuenta = pedida && CUENTAS.includes(pedida) ? pedida : 'operaciones';
  const activa = data?.cuentas.find((c) => c.cuenta === cuentaActiva);

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
            Una planilla por cuenta: cada cuenta tiene su ganado, anticipos, saldo y arrastre, y{' '}
            <strong>no se mezcla</strong> con las demás. El cierre de mes liquida todas juntas.
          </p>
        </div>
        <div className="no-print flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Imprimir
          </button>
          {data && !data.cerrado && data.cuentas.some((c) => c.filas.length > 0) && (
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

      {isLoading && <div className="mt-6 text-sm text-gray-500">Cargando consolidado…</div>}
      {error && <div className="mt-6 text-sm text-error">No se pudo cargar ({String(error)})</div>}

      {data && (
        <>
          <PestanasCuentas
            cuentas={data.cuentas}
            activa={cuentaActiva}
            onElegir={(c) => setParametros({ cuenta: c }, { replace: true })}
          />
          {activa && (
            <>
              <div className="mt-2 hidden text-lg font-semibold capitalize print:block">
                Planilla de pagos · {ETIQUETA_CUENTA[activa.cuenta]} · {MESES[mes - 1]} {anio}
              </div>
              <p className="no-print mt-3 text-xs text-gray-500">
                {ETIQUETA_CUENTA[activa.cuenta]}: {REGLA_CUENTA[activa.cuenta]}.
              </p>
              <SemanasCards cuenta={activa} />
              <PlanillaTabla cuenta={activa} cerrado={data.cerrado} />
            </>
          )}
        </>
      )}

      {modalCerrar && data && (
        <CerrarMesModal
          anio={anio}
          mes={mes}
          nombreMes={MESES[mes - 1]}
          cuentas={data.cuentas}
          onCerrar={() => setModalCerrar(false)}
        />
      )}
    </div>
  );
}

/** Una pestaña por cuenta, con su saldo del mes (las vacías, atenuadas). */
function PestanasCuentas({
  cuentas,
  activa,
  onElegir,
}: {
  cuentas: CuentaConsolidadoDTO[];
  activa: Cuenta;
  onElegir: (c: Cuenta) => void;
}) {
  return (
    <div className="no-print mt-5 flex flex-wrap gap-1 border-b border-gray-200">
      {cuentas.map((c) => {
        const elegida = c.cuenta === activa;
        const vacia = c.filas.length === 0;
        return (
          <button
            key={c.cuenta}
            onClick={() => onElegir(c.cuenta)}
            className={`-mb-px rounded-t-lg border px-4 py-2 text-left text-sm ${
              elegida
                ? 'border-gray-200 border-b-white bg-white font-semibold'
                : `border-transparent hover:bg-gray-50 ${vacia ? 'text-gray-400' : 'text-gray-600'}`
            }`}
          >
            <div>{ETIQUETA_CUENTA[c.cuenta]}</div>
            <div
              className={`mono text-[11px] ${c.totales.saldoPeriodo < 0 ? 'text-error' : 'text-gray-500'}`}
            >
              {vacia ? '—' : `Bs ${formatBs(c.totales.saldoPeriodo)}`}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function SemanasCards({ cuenta }: { cuenta: CuentaConsolidadoDTO }) {
  const deCortes = cuenta.cuenta === 'operaciones' || cuenta.cuenta === 'empaque';
  return (
    <div className="no-print mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
      {cuenta.semanas.map((s) => (
        <div key={s.inicioISO} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
            {s.label}
          </div>
          <div className="mono mt-1 text-lg font-semibold">Bs {formatBs(s.ganado)}</div>
          {deCortes && (
            <div className="text-[11px] text-gray-400">
              {s.cortesCerrados === 0
                ? 'sin cortes cerrados'
                : `${s.cortesCerrados} corte${s.cortesCerrados > 1 ? 's' : ''} cerrado${s.cortesCerrados > 1 ? 's' : ''}`}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function PlanillaTabla({ cuenta, cerrado }: { cuenta: CuentaConsolidadoDTO; cerrado: boolean }) {
  const t = cuenta.totales;
  // los servicios externos los cobra una empresa (proveedor), no un operario
  const esExterno = (SERVICIOS_EXTERNOS as readonly Cuenta[]).includes(cuenta.cuenta);
  return (
    <div className={`mt-4 ${TABLA.contenedorPagina}`}>
      <table className="text-sm">
        <thead className={TABLA.cabecera}>
          <tr className={TABLA.filaCabecera}>
            <th className="px-3 py-2.5">{esExterno ? 'Empresa' : 'Operario'}</th>
            <th className="px-3 py-2.5 text-right">Saldo entrada</th>
            <th className="px-3 py-2.5 text-right">Ganado</th>
            <th className="px-3 py-2.5 text-right">Anticipos</th>
            <th className="px-3 py-2.5 text-right">Saldo período</th>
            {cerrado && <th className="px-3 py-2.5 text-right">Pagado</th>}
            {cerrado && <th className="px-3 py-2.5 text-right">Saldo salida</th>}
          </tr>
        </thead>
        <tbody>
          {cuenta.filas.map((f) => (
            <FilaPlanilla key={f.operarioId} f={f} cerrado={cerrado} />
          ))}
          {cuenta.filas.length === 0 && (
            <tr>
              <td colSpan={cerrado ? 7 : 5} className="px-5 py-10 text-center text-gray-500">
                Sin movimiento ni saldos en {ETIQUETA_CUENTA[cuenta.cuenta]} este mes.
              </td>
            </tr>
          )}
        </tbody>
        {cuenta.filas.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold whitespace-nowrap">
              <td className="px-3 py-2.5">Totales · {ETIQUETA_CUENTA[cuenta.cuenta]}</td>
              <td className="mono px-3 py-2.5 text-right">Bs {formatBs(t.saldoEntrada)}</td>
              <td className="mono px-3 py-2.5 text-right">Bs {formatBs(t.ganado)}</td>
              <td className="mono px-3 py-2.5 text-right">Bs {formatBs(t.anticipos)}</td>
              <td className="mono px-3 py-2.5 text-right">Bs {formatBs(t.saldoPeriodo)}</td>
              {cerrado && <td className="mono px-3 py-2.5 text-right">Bs {formatBs(t.pagado ?? 0)}</td>}
              {cerrado && (
                <td className="mono px-3 py-2.5 text-right">Bs {formatBs(t.saldoSalida ?? 0)}</td>
              )}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function FilaPlanilla({ f, cerrado }: { f: LiquidacionFilaDTO; cerrado: boolean }) {
  return (
    <tr className={`${TABLA.fila} whitespace-nowrap ${f.activo ? '' : 'opacity-60'}`}>
      <td className="px-3 py-2">
        <span className="font-medium">{f.nombre}</span>
        {f.esMaestro && (
          <span className="ml-1 rounded-full bg-[rgba(47,111,224,0.1)] px-1.5 text-[10px] font-semibold text-acento">
            maestro
          </span>
        )}
        {!f.activo && <span className="ml-1 text-[10px] text-gray-400">(baja)</span>}
      </td>
      <td className="mono px-3 py-2 text-right text-gray-500">
        {f.saldoEntrada !== 0 ? `Bs ${formatBs(f.saldoEntrada)}` : '—'}
      </td>
      <td className="mono px-3 py-2 text-right font-semibold">Bs {formatBs(f.ganado)}</td>
      <td className="mono px-3 py-2 text-right text-gray-500">Bs {formatBs(f.anticipos)}</td>
      <td className="px-3 py-2 text-right">
        <SaldoBadge centavos={f.saldoPeriodo} />
      </td>
      {cerrado && <td className="mono px-3 py-2 text-right">Bs {formatBs(f.pagado ?? 0)}</td>}
      {cerrado && (
        <td className="mono px-3 py-2 text-right">
          {f.arrastraSaldo && (
            <span className="mr-1 text-[10px] font-semibold text-[#9a6a12]">arrastra</span>
          )}
          Bs {formatBs(f.saldoSalida ?? 0)}
        </td>
      )}
    </tr>
  );
}
