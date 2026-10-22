import { useState } from 'react';
import {
  ETIQUETA_CUENTA,
  ETIQUETA_MODALIDAD,
  ETIQUETA_PROCESO,
  formatBs,
  type Cuenta,
  type RendicionCorteDTO,
  type RendicionCuentaDTO,
  type RendicionDTO,
  type RendicionSueldoDTO,
} from '@taller/shared';
import { useOperarios } from '../../api/operarios';
import { useRendicion } from '../../api/rendicion';
import { MESES } from '../../lib/meses';

function SaldoBadge({ centavos }: { centavos: number }) {
  const neg = centavos < 0;
  return (
    <span
      className="mono rounded-md px-2 py-0.5 text-sm font-semibold"
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
      </div>

      {/* Un bloque por cuenta, cada una con SU saldo: no se suman entre sí
          (docs/PLAN_CUENTAS_SEPARADAS.md §6) */}
      {data.cuentas.length === 0 ? (
        <div className="mb-5 rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          Sin ganado, anticipos ni saldo en ninguna cuenta este mes.
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2">
          {data.cuentas.map((c) => (
            <BloqueCuenta key={c.cuenta} c={c} cerrado={data.cerrado} />
          ))}
        </div>
      )}

      {/* Sueldo (ayudantes): días del mes según la asistencia */}
      {data.sueldo && <SeccionSueldo sueldo={data.sueldo} />}

      {/* Costura: cortes cerrados en el mes */}
      <h2 className="mb-2 flex justify-between text-sm font-semibold text-gray-700">
        <span>
          Costura ({data.cortes.length} corte{data.cortes.length === 1 ? '' : 's'})
        </span>
        <span className="mono">Bs {formatBs(ganadoDe(data, 'operaciones'))}</span>
      </h2>
      <ListaCortes cortes={data.cortes} vacio="Sin costura en cortes cerrados este mes." />

      {/* Empaque: por prenda como la costura, pero aparte (PLAN_AYUDANTES §6) */}
      {data.empaque.length > 0 && (
        <>
          <h2 className="mt-6 mb-2 flex justify-between text-sm font-semibold text-gray-700">
            <span>
              Empaque ({data.empaque.length} corte{data.empaque.length === 1 ? '' : 's'})
            </span>
            <span className="mono">Bs {formatBs(ganadoDe(data, 'empaque'))}</span>
          </h2>
          <ListaCortes cortes={data.empaque} vacio="" />
        </>
      )}

      {/* Servicio de corte interno: cada trabajo en su línea */}
      {data.servicioCorte.length > 0 && (
        <>
          <h2 className="mt-6 mb-2 flex justify-between text-sm font-semibold text-gray-700">
            <span>Servicio de corte ({data.servicioCorte.length})</span>
            <span className="mono">Bs {formatBs(ganadoDe(data, 'servicio_corte'))}</span>
          </h2>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <tbody>
                {data.servicioCorte.map((t, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0">
                    <td className="px-5 py-2 text-gray-500">{fechaCorta(t.fecha)}</td>
                    <td className="px-3 py-2 font-medium">
                      {ETIQUETA_PROCESO[t.proceso]}
                      {t.modalidad && (
                        <span className="font-normal text-gray-500">
                          {' '}
                          · {ETIQUETA_MODALIDAD[t.modalidad].toLowerCase()}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {t.modeloNombre}
                      <span className="ml-1 text-[11px] font-semibold text-gray-400">
                        v{t.numeroVersion}
                        {` · COD ${t.codigo}`}
                      </span>
                    </td>
                    <td className="mono px-3 py-2 text-right text-gray-500">{t.cantidad} prendas</td>
                    <td className="mono px-3 py-2 text-right text-gray-500">
                      Bs {formatBs(t.tarifa)}
                      {t.proceso === 'doblado' && <span className="text-[10px]"> ÷ 2</span>}
                    </td>
                    <td className="mono w-24 px-5 py-2 text-right font-semibold">
                      Bs {formatBs(t.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Lavandería y bordado (proveedor externo): envíos devueltos en el mes */}
      {data.envios.length > 0 && (
        <>
          <h2 className="mt-6 mb-2 text-sm font-semibold text-gray-700">
            Lavandería y bordado ({data.envios.length})
          </h2>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <tbody>
                {data.envios.map((e, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0">
                    <td className="px-5 py-2 text-gray-500">{fechaDia(e.fechaDevolucion)}</td>
                    <td className="px-3 py-2 font-medium">{ETIQUETA_CUENTA[e.servicio]}</td>
                    <td className="px-3 py-2 text-gray-600">
                      {e.modeloNombre}
                      <span className="ml-1 text-[11px] font-semibold text-gray-400">
                        v{e.numeroVersion}
                        {` · COD ${e.codigo}`}
                      </span>
                    </td>
                    <td className="mono px-3 py-2 text-right text-gray-500">{e.cantidad} prendas</td>
                    <td className="mono px-3 py-2 text-right text-gray-500">Bs {formatBs(e.precioPrenda)}</td>
                    <td className="mono w-24 px-5 py-2 text-right font-semibold">Bs {formatBs(e.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Moldes / patronaje */}
      {data.moldes.length > 0 && (
        <>
          <h2 className="mt-6 mb-2 flex justify-between text-sm font-semibold text-gray-700">
            <span>Moldes ({data.moldes.length})</span>
            <span className="mono">Bs {formatBs(ganadoDe(data, 'moldes'))}</span>
          </h2>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <tbody>
                {data.moldes.map((m, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0">
                    <td className="px-5 py-2 text-gray-500">{fechaCorta(m.fecha)}</td>
                    <td className="px-3 py-2 font-medium">
                      {m.tipo === 'nuevo' ? 'Modelo nuevo' : 'Modificación de moldes'}
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {m.modeloNombre}
                      <span className="ml-1 text-[11px] font-semibold text-gray-400">
                        v{m.numeroVersion}
                      </span>
                    </td>
                    <td className="mono w-24 px-5 py-2 text-right font-semibold">
                      Bs {formatBs(m.monto)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
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
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                      {ETIQUETA_CUENTA[a.cuenta]}
                    </span>
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

const ESTADO_DIA: Record<RendicionSueldoDTO['dias'][number]['estado'], string> = {
  trabajo: 'Trabajó',
  falta: 'Faltó',
  feriado: 'Feriado',
};

/** Sueldo del mes: cada día con lo que se descontó y su parte del total (los
 *  días suman exacto el sueldo del mes, PLAN_AYUDANTES §3). */
function SeccionSueldo({ sueldo }: { sueldo: RendicionSueldoDTO }) {
  const resumen = [
    `${sueldo.diasTrabajados} trabajado${sueldo.diasTrabajados === 1 ? '' : 's'}`,
    sueldo.faltas > 0 && `${sueldo.faltas} falta${sueldo.faltas === 1 ? '' : 's'}`,
    sueldo.feriados > 0 && `${sueldo.feriados} feriado${sueldo.feriados === 1 ? '' : 's'}`,
    sueldo.minutosDescontados > 0 && `${horasMin(sueldo.minutosDescontados)} de atrasos`,
    sueldo.minutosOperaciones > 0 && `${horasMin(sueldo.minutosOperaciones)} en operaciones`,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <>
      <h2 className="mb-2 flex justify-between text-sm font-semibold text-gray-700">
        <span>
          Sueldo <span className="font-normal text-gray-500">({resumen})</span>
        </span>
        <span className="mono">Bs {formatBs(sueldo.total)}</span>
      </h2>
      <div className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <tbody>
            {sueldo.dias.map((d) => (
              <tr key={d.fecha} className="border-b border-gray-100 last:border-0">
                <td className="w-36 px-5 py-1.5 text-gray-500 capitalize">{fechaDia(d.fecha)}</td>
                <td className={`px-3 py-1.5 ${d.estado === 'falta' ? 'text-error' : ''}`}>
                  {ESTADO_DIA[d.estado]}
                </td>
                <td className="px-3 py-1.5 text-xs text-gray-500">
                  {[
                    d.minutosDescontados > 0 && `−${horasMin(d.minutosDescontados)} atraso`,
                    d.minutosOperaciones > 0 && `−${horasMin(d.minutosOperaciones)} en operaciones`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </td>
                <td className="mono px-3 py-1.5 text-right text-xs text-gray-400">
                  {formatBs(d.sueldoSemanal)}/sem
                </td>
                <td className="mono w-28 px-5 py-1.5 text-right font-semibold whitespace-nowrap">
                  {d.monto > 0 ? `Bs ${formatBs(d.monto)}` : <span className="text-gray-300">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** 80 → "1 h 20 min"; 20 → "20 min". */
function horasMin(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return [h > 0 && `${h} h`, m > 0 && `${m} min`].filter(Boolean).join(' ');
}

/** 'aaaa-mm-dd' sin hora: se formatea en UTC para que no corra un día atrás. */
const fechaDia = (dia: string) =>
  new Date(`${dia}T00:00:00.000Z`).toLocaleDateString('es-BO', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });

/** Cortes de la sección (costura o empaque) con las operaciones de ESTE operario. */
function ListaCortes({ cortes, vacio }: { cortes: RendicionCorteDTO[]; vacio: string }) {
  return cortes.length === 0 ? (
    <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
      {vacio}
    </div>
  ) : (
    <div className="space-y-3">
      {cortes.map((c) => (
        <div key={c.corteId} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-2.5">
            <div className="text-sm">
              <span className="font-semibold">{c.modeloNombre}</span>
              <span className="ml-1 text-[11px] font-semibold text-gray-400">
                v{c.numeroVersion}
                {` · COD ${c.codigo}`}
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
  );
}

/** Lo ganado en el mes en una cuenta (0 si no tuvo nada en ella). */
const ganadoDe = (data: RendicionDTO, cuenta: Cuenta) =>
  data.cuentas.find((c) => c.cuenta === cuenta)?.ganado ?? 0;

/** El saldo de UNA cuenta: entrada + ganado − anticipos, y al cerrar, lo pagado. */
function BloqueCuenta({ c, cerrado }: { c: RendicionCuentaDTO; cerrado: boolean }) {
  const fila = (titulo: string, valor: number, tenue = true) => (
    <div className="flex justify-between py-0.5">
      <span className="text-gray-500">{titulo}</span>
      <span className={`mono ${tenue ? 'text-gray-600' : 'font-semibold'}`}>Bs {formatBs(valor)}</span>
    </div>
  );
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{ETIQUETA_CUENTA[c.cuenta]}</span>
        <SaldoBadge centavos={c.saldoPeriodo} />
      </div>
      <div className="mt-2 text-xs">
        {c.saldoEntrada !== 0 && fila('Saldo entrada', c.saldoEntrada)}
        {fila('Ganado', c.ganado, false)}
        {fila('Anticipos', -c.anticipos)}
        {cerrado && fila('Pagado', c.pagado ?? 0, false)}
        {cerrado && (c.saldoSalida ?? 0) !== 0 && fila('Pasa al mes siguiente', c.saldoSalida ?? 0)}
      </div>
    </div>
  );
}

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString('es-BO', { weekday: 'short', day: '2-digit', month: 'short' });
