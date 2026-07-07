import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatBs, type CorteOperacionDTO } from '@taller/shared';
import { useAbrirCorte, useAsignarGrupo, useCerrarCorte, useCorte } from '../../api/cortes';
import { useOperarios } from '../../api/operarios';
import { Modal } from '../../components/Modal';
import { ErrorApi } from '../../api/client';
import { badgeEstadoCorte, etiquetaGrupo } from './estados';
import { hoyLocalISO } from '../../lib/fechas';
import { OperacionFila } from './OperacionFila';

export function CorteDetallePage() {
  const { corteId } = useParams();
  const { data: corte, isLoading, error } = useCorte(corteId);
  const { data: operarios } = useOperarios('activos');
  const abrir = useAbrirCorte();
  const asignarGrupo = useAsignarGrupo();
  const cerrar = useCerrarCorte();

  const [plegados, setPlegados] = useState<Record<string, boolean>>({});
  const [modalCerrar, setModalCerrar] = useState(false);
  const [fechaCierre, setFechaCierre] = useState(hoyLocalISO);

  const grupos = useMemo(() => {
    if (!corte) return [];
    const mapa = new Map<string, CorteOperacionDTO[]>();
    for (const op of corte.operaciones) {
      const lista = mapa.get(op.grupo);
      if (lista) lista.push(op);
      else mapa.set(op.grupo, [op]);
    }
    return [...mapa.entries()];
  }, [corte]);

  if (isLoading) return <div className="p-8 text-sm text-gray-500">Cargando corte…</div>;
  if (error || !corte)
    return <div className="p-8 text-sm text-error">No se encontró el corte ({String(error)})</div>;

  const editable = corte.estado === 'abierto';
  const asignadas = corte.operaciones.filter((o) => o.estado === 'asignada').length;
  const totalOps = corte.operaciones.length;
  const puedeCerrar = editable && totalOps > 0 && asignadas === totalOps;
  const badge = badgeEstadoCorte(corte.estado);
  const totalAsignado = corte.totalesPorOperario.reduce((a, t) => a + t.total, 0);
  const maxPago = Math.max(1, ...corte.totalesPorOperario.map((t) => t.total));

  return (
    <div className="p-8">
      <div className="text-xs text-gray-500">
        <Link to="/cortes" className="hover:underline">
          Cortes
        </Link>{' '}
        / {corte.modeloNombre}
      </div>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {corte.modeloNombre}{' '}
            <span className="rounded-full bg-[rgba(47,111,224,0.1)] px-2 py-0.5 align-middle text-sm font-semibold text-acento">
              v{corte.numeroVersion}
            </span>{' '}
            <span
              className="rounded-full border px-2 py-0.5 align-middle text-xs font-semibold"
              style={{ color: badge.color, background: badge.bg, borderColor: badge.border }}
            >
              {badge.texto}
            </span>
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {corte.codigo ? `${corte.codigo} · ` : ''}
            {corte.cantidadTotal} prendas
            {corte.fechaCierre &&
              ` · cerrado el ${new Date(corte.fechaCierre).toLocaleDateString('es-BO')}`}
          </p>
          {editable && (
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 w-48 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-acento"
                  style={{ width: `${totalOps ? Math.round((asignadas / totalOps) * 100) : 0}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">
                {asignadas}/{totalOps} asignadas
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-right shadow-sm">
            <div className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
              Costo total del corte
            </div>
            <div className="mono text-2xl font-semibold">Bs {formatBs(corte.costoTotalCorte)}</div>
            <div className="text-[11px] text-gray-400">
              {corte.cantidadTotal} × Bs {formatBs(corte.costoManoObraPrenda)}
            </div>
          </div>
          {corte.estado === 'borrador' ? (
            <button
              onClick={() => abrir.mutate(corte.id)}
              className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-[#265dc2]"
            >
              Abrir corte
            </button>
          ) : (
            editable && (
              <button
                onClick={() => setModalCerrar(true)}
                disabled={!puedeCerrar}
                title={
                  puedeCerrar
                    ? 'Fijar fecha de cierre/liquidación'
                    : 'Todas las operaciones deben cuadrar para cerrar'
                }
                className="rounded-lg bg-ok px-4 py-2 text-sm font-semibold text-white hover:bg-[#0e6238] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Cerrar corte
              </button>
            )
          )}
        </div>
      </div>

      <div className="mt-4 inline-block rounded-xl border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
        <table className="text-xs">
          <tbody>
            <tr className="text-gray-400">
              <td className="pr-3 font-semibold uppercase">Talla</td>
              {corte.tallas.map((t, i) => (
                <td key={i} className="mono px-2 text-center text-gray-600">
                  {t}
                </td>
              ))}
            </tr>
            <tr>
              <td className="pr-3 font-semibold text-gray-400 uppercase">Corte</td>
              {corte.cortePorTalla.map((c, i) => (
                <td key={i} className="mono px-2 text-center">
                  {c}
                </td>
              ))}
            </tr>
            <tr>
              <td className="pr-3 font-semibold text-gray-400 uppercase">Plus</td>
              {corte.tallas.map((_, i) => (
                <td key={i} className="mono px-2 text-center text-acento">
                  {corte.plusPorTalla[i] || '·'}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <div className="mt-1 text-[10px] text-gray-400">
          referencia de producción — el pago usa solo la cantidad total ({corte.cantidadTotal})
        </div>
      </div>

      {corte.estado === 'borrador' ? (
        <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          El corte está en borrador. Al abrirlo se copian las operaciones del modelo (snapshot con
          tarifas congeladas) y se puede empezar a asignar.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {grupos.map(([grupo, ops]) => {
            const g = etiquetaGrupo(ops);
            const plegado = plegados[grupo] ?? false;
            return (
              <div key={grupo} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center gap-3 border-b border-gray-200 bg-gray-50 px-5 py-2.5">
                  <button
                    onClick={() => setPlegados((p) => ({ ...p, [grupo]: !plegado }))}
                    className="flex items-center gap-2 text-sm font-semibold"
                  >
                    <span
                      className="inline-block text-gray-400 transition-transform"
                      style={{ transform: plegado ? 'rotate(0deg)' : 'rotate(90deg)' }}
                    >
                      ▸
                    </span>
                    {grupo}
                  </button>
                  <span
                    className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                    style={{ color: g.color, background: g.bg, borderColor: g.border }}
                  >
                    {g.texto}
                  </span>
                  <span className="text-xs text-gray-500">
                    {g.ok}/{ops.length}
                  </span>
                  <span className="mono ml-auto text-xs text-gray-500">
                    Σ CT Bs {formatBs(ops.reduce((a, o) => a + o.ct, 0))}
                  </span>
                  {editable && (
                    <select
                      value=""
                      onChange={(e) => {
                        const operarioId = e.target.value;
                        if (!operarioId) return;
                        const nombre = operarios?.find((o) => o.id === operarioId)?.nombre;
                        if (
                          window.confirm(
                            `Asignar TODO el grupo ${grupo} a ${nombre} (${corte.cantidadTotal} piezas por operación)? Se reemplazan las asignaciones actuales del grupo.`,
                          )
                        ) {
                          asignarGrupo.mutate({
                            corteId: corte.id,
                            input: { grupo, operarioId, esMaestroExterno: false },
                          });
                        }
                        e.target.value = '';
                      }}
                      className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs outline-none focus:border-acento"
                    >
                      <option value="">Asignar grupo completo a…</option>
                      {operarios?.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.nombre}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                {!plegado && (
                  <div>
                    {ops.map((op) => (
                      <OperacionFila
                        key={op.id}
                        corteId={corte.id}
                        op={op}
                        operarios={operarios ?? []}
                        editable={editable}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-2.5">
              <span className="text-sm font-semibold">Total por operario</span>
              <span className="text-xs text-gray-500">
                asignado <span className="mono font-semibold">Bs {formatBs(totalAsignado)}</span> de{' '}
                <span className="mono font-semibold">Bs {formatBs(corte.costoTotalCorte)}</span>
                {totalAsignado === corte.costoTotalCorte && (
                  <span className="ml-1 font-semibold text-ok">✓ cuadra</span>
                )}
              </span>
            </div>
            <div className="space-y-2 px-5 py-3">
              {corte.totalesPorOperario.map((t) => (
                <div key={t.operarioId} className="flex items-center gap-3 text-sm">
                  <span className="w-32 flex-none font-medium">
                    {t.nombre}
                    {t.incluyeMaestro && (
                      <span className="ml-1 rounded-full bg-[rgba(47,111,224,0.1)] px-1.5 text-[10px] font-semibold text-acento">
                        maestro
                      </span>
                    )}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-acento"
                      style={{ width: `${Math.max(4, Math.round((t.total / maxPago) * 100))}%` }}
                    />
                  </div>
                  <span className="mono w-16 flex-none text-right text-xs text-gray-500">
                    {t.piezas} pzs
                  </span>
                  <span className="mono w-24 flex-none text-right font-semibold">
                    Bs {formatBs(t.total)}
                  </span>
                </div>
              ))}
              {corte.totalesPorOperario.length === 0 && (
                <div className="py-3 text-center text-sm text-gray-400">
                  Todavía no hay asignaciones.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {modalCerrar && (
        <Modal onCerrar={() => setModalCerrar(false)}>
          <h2 className="text-lg font-semibold">Cerrar corte</h2>
          <p className="mt-2 text-sm text-gray-600">
            Al cerrar se fija la <strong>fecha de cierre/liquidación</strong> (el eje del consolidado
            semanal y mensual) y el corte deja de ser editable. Lo ganado entra a la liquidación del
            período de esa fecha.
          </p>
          <label className="mt-4 mb-1 block text-sm font-medium">Fecha de cierre</label>
          <input
            type="date"
            value={fechaCierre}
            onChange={(e) => setFechaCierre(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-acento"
          />
          {cerrar.error != null && (
            <p className="mt-3 rounded-lg bg-error-suave px-3 py-2 text-xs text-error">
              {cerrar.error instanceof ErrorApi ? cerrar.error.message : 'Error al cerrar'}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setModalCerrar(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={async () => {
                await cerrar.mutateAsync({
                  corteId: corte.id,
                  input: { fechaCierre: new Date(`${fechaCierre}T12:00:00`) },
                });
                setModalCerrar(false);
              }}
              disabled={cerrar.isPending}
              className="rounded-lg bg-ok px-4 py-2 text-sm font-semibold text-white hover:bg-[#0e6238] disabled:opacity-60"
            >
              Cerrar y liquidar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
