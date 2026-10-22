import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ETIQUETA_PROCESO,
  ETIQUETA_ROL,
  formatBs,
  formatMetros,
  ROLES_COSTURA,
  SERVICIOS_EXTERNOS,
  type CorteDetalleDTO,
  type CorteOperacionDTO,
} from '@taller/shared';
import {
  useAbrirCorte,
  useAsignarGrupo,
  useCerrarCorte,
  useCorte,
  useEditarCodigo,
  useEditarTendido,
  useReordenarOperacionesCorte,
} from '../../api/cortes';
import {
  GrupoCorte,
  HistorialCambios,
  ModalOperacionCorte,
  type ModalOperacion,
} from './CambiosOperaciones';
import { useOperarios } from '../../api/operarios';
import { Modal } from '../../components/Modal';
import { ErrorApi } from '../../api/client';
import { badgeEstadoCorte } from './estados';
import { hoyLocalISO } from '../../lib/fechas';
import { CamposTendido, tendidoDesdeCorte, validarTendido } from './CamposTendido';
import { ServicioCorte } from './ServicioCorte';
import { EnviosServicio } from './EnviosServicio';
import { DuracionEstimada } from './DuracionEstimada';
import { CalculadoraTendido } from './CalculadoraTendido';

// Datos del tendido: informativos, no entran al cálculo de pagos. Mientras el
// corte no esté cerrado se pueden completar (cortes creados antes de pedirlos)
// o corregir.
function TarjetaTendido({
  corte,
  onEditar,
}: {
  corte: CorteDetalleDTO;
  onEditar: (() => void) | null; // null = no editable (corte cerrado)
}) {
  if (!corte.tela) {
    return (
      <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-2.5 text-xs">
        <div className="mb-1 text-[11px] font-semibold tracking-wider text-amber-700 uppercase">
          Tendido
        </div>
        <p className="text-amber-800">Este corte no tiene cargados los datos del tendido.</p>
        {onEditar && (
          <button
            onClick={onEditar}
            className="mt-2 rounded-lg bg-acento px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#265dc2]"
          >
            Completar datos
          </button>
        )}
      </div>
    );
  }

  const filas: [string, string][] = [
    ['Tela', corte.tela ?? '—'],
    ['Ancho', corte.anchoCm != null ? `${formatMetros(corte.anchoCm)} m` : '—'],
    ['Trazado', corte.trazadoCm != null ? `${formatMetros(corte.trazadoCm)} m` : '—'],
    ['Por capa', corte.prendasPorCapa != null ? `${corte.prendasPorCapa} prendas` : '—'],
  ];
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
      <div className="mb-1 flex items-center justify-between gap-4">
        <span className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
          Tendido
        </span>
        {onEditar && (
          <button onClick={onEditar} className="text-xs font-medium text-acento hover:underline">
            Editar
          </button>
        )}
      </div>
      <table className="text-xs">
        <tbody>
          {filas.map(([etiqueta, valor]) => (
            <tr key={etiqueta}>
              <td className="py-0.5 pr-3 font-semibold text-gray-400 uppercase">{etiqueta}</td>
              <td className="max-w-72 py-0.5">{valor}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ModalTendido({ corte, onCerrar }: { corte: CorteDetalleDTO; onCerrar: () => void }) {
  const editar = useEditarTendido();
  const [valor, setValor] = useState(() => tendidoDesdeCorte(corte));
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  const guardar = async () => {
    setErrorLocal(null);
    const t = validarTendido(valor);
    if (!t.ok) return setErrorLocal(t.error);
    await editar.mutateAsync({ corteId: corte.id, input: t.datos });
    onCerrar();
  };

  return (
    <Modal onCerrar={onCerrar} ancho="max-w-2xl">
      <h2 className="text-lg font-semibold">
        {corte.tela ? 'Editar' : 'Completar'} datos del tendido
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        COD {corte.codigo} · {corte.modeloNombre} v{corte.numeroVersion} · informativo, no
        afecta los pagos
      </p>
      <div className="mt-4">
        <CamposTendido valor={valor} onChange={setValor} />
      </div>
      {(errorLocal || editar.error) && (
        <p className="mt-4 rounded-lg bg-error-suave px-3 py-2 text-sm text-error">
          {errorLocal ??
            (editar.error instanceof ErrorApi ? editar.error.message : 'Error al guardar')}
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onCerrar}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          onClick={guardar}
          disabled={editar.isPending}
          className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-[#265dc2] disabled:opacity-60"
        >
          Guardar
        </button>
      </div>
    </Modal>
  );
}

// Numeración del corte: se puede corregir en cualquier estado (es una etiqueta,
// no toca pagos). El server rechaza un número que ya usa otro corte.
function ModalCodigo({ corte, onCerrar }: { corte: CorteDetalleDTO; onCerrar: () => void }) {
  const editar = useEditarCodigo();
  const [valor, setValor] = useState(String(corte.codigo));
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  const guardar = async () => {
    setErrorLocal(null);
    const codigo = parseInt(valor, 10);
    if (!(codigo >= 1)) return setErrorLocal('Ingresá un número mayor a 0');
    await editar.mutateAsync({ corteId: corte.id, input: { codigo } });
    onCerrar();
  };

  return (
    <Modal onCerrar={onCerrar}>
      <h2 className="text-lg font-semibold">Código del corte</h2>
      <p className="mt-1 text-sm text-gray-500">
        {corte.modeloNombre} v{corte.numeroVersion} · no se puede repetir con otro corte
      </p>
      <label className="mt-4 mb-1 block text-sm font-medium">COD</label>
      <input
        value={valor}
        onChange={(e) => setValor(e.target.value.replace(/\D/g, ''))}
        onKeyDown={(e) => e.key === 'Enter' && guardar()}
        inputMode="numeric"
        autoFocus
        className="mono w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-acento"
      />
      {(errorLocal || editar.error) && (
        <p className="mt-4 rounded-lg bg-error-suave px-3 py-2 text-sm text-error">
          {errorLocal ??
            (editar.error instanceof ErrorApi ? editar.error.message : 'Error al guardar')}
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onCerrar}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          onClick={guardar}
          disabled={editar.isPending}
          className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-[#265dc2] disabled:opacity-60"
        >
          Guardar
        </button>
      </div>
    </Modal>
  );
}

export function CorteDetallePage() {
  const { corteId } = useParams();
  const { data: corte, isLoading, error } = useCorte(corteId);
  // asignación de costura: costureros y ayudantes activos (restricción estricta
  // de roles; los ayudantes también cosen — PLAN_AYUDANTES §2.11)
  const { data: activos } = useOperarios('activos');
  const operarios = activos?.filter((o) => ROLES_COSTURA.some((r) => o.roles.includes(r)));
  const abrir = useAbrirCorte();
  const asignarGrupo = useAsignarGrupo();
  const cerrar = useCerrarCorte();

  const [plegados, setPlegados] = useState<Record<string, boolean>>({});
  const [modalCerrar, setModalCerrar] = useState(false);
  const [modalTendido, setModalTendido] = useState(false);
  const [modalCodigo, setModalCodigo] = useState(false);
  const [modalOp, setModalOp] = useState<ModalOperacion | null>(null);
  const reordenar = useReordenarOperacionesCorte();
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
  const costuraCompleta = totalOps > 0 && asignadas === totalOps;
  const faltaServicio = corte.servicio?.faltantes ?? [];
  const puedeCerrar = editable && costuraCompleta && faltaServicio.length === 0;
  const motivoNoCierre = !costuraCompleta
    ? 'Todas las operaciones de costura deben cuadrar para cerrar'
    : `Falta registrar del servicio de corte: ${faltaServicio
        .map((p) => ETIQUETA_PROCESO[p].toLowerCase())
        .join(', ')}`;
  const badge = badgeEstadoCorte(corte.estado);
  const totalAsignado = corte.totalesPorOperario.reduce((a, t) => a + t.total, 0);
  const maxPago = Math.max(1, ...corte.totalesPorOperario.map((t) => t.total));
  const costoExternos = SERVICIOS_EXTERNOS.reduce((a, s) => a + corte.costoExternos[s], 0);

  return (
    <div className="p-8">
      <div className="text-xs text-gray-500">
        <Link to="/cortes" className="hover:underline">
          Cortes
        </Link>{' '}
        / COD {corte.codigo} · {corte.modeloNombre}
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
            <span className="mono font-semibold text-gray-700">COD {corte.codigo}</span>{' '}
            <button
              onClick={() => setModalCodigo(true)}
              className="text-xs font-medium text-acento hover:underline"
            >
              editar
            </button>
            {' · '}
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
          {/* costos separados: costura · empaque (si hay) · servicio de corte · total */}
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-right shadow-sm">
            <div className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
              Costura
            </div>
            <div className="mono text-lg font-semibold">
              Bs {formatBs(corte.costoTotalCorte - corte.costoEmpaqueCorte)}
            </div>
            <div className="text-[11px] text-gray-400">
              {corte.costoEmpaqueCorte > 0
                ? 'sin las operaciones de empaque'
                : `${corte.cantidadTotal} × Bs ${formatBs(corte.costoManoObraPrenda)}`}
            </div>
          </div>
          {corte.costoEmpaqueCorte > 0 && (
            <div className="rounded-xl border border-violet-200 bg-white px-4 py-3 text-right shadow-sm">
              <div className="text-[11px] font-semibold tracking-wider text-violet-700 uppercase">
                Empaque
              </div>
              <div className="mono text-lg font-semibold">Bs {formatBs(corte.costoEmpaqueCorte)}</div>
              <div className="text-[11px] text-gray-400">se paga por prenda, como la costura</div>
            </div>
          )}
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-right shadow-sm">
            <div className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
              Servicio de corte
            </div>
            <div className="mono text-lg font-semibold">
              {corte.esInterno ? `Bs ${formatBs(corte.costoServicioCorte)}` : '—'}
            </div>
            <div className="text-[11px] text-gray-400">
              {corte.esInterno ? 'trazado, doblado, corte…' : 'corte externo'}
            </div>
          </div>
          {costoExternos > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-right shadow-sm">
              <div className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                Servicios externos
              </div>
              <div className="mono text-lg font-semibold">Bs {formatBs(costoExternos)}</div>
              <div className="text-[11px] text-gray-400">
                {SERVICIOS_EXTERNOS.filter((s) => corte.costoExternos[s] > 0)
                  .map((s) => `${ETIQUETA_ROL[s].toLowerCase()} ${formatBs(corte.costoExternos[s])}`)
                  .join(' · ')}
              </div>
            </div>
          )}
          <div className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-right shadow-sm">
            <div className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
              Costo total del corte
            </div>
            <div className="mono text-2xl font-semibold">Bs {formatBs(corte.costoTotal)}</div>
            <div className="text-[11px] text-gray-400">
              {[
                'costura',
                corte.costoEmpaqueCorte > 0 && 'empaque',
                'servicio',
                costoExternos > 0 && 'servicios externos',
              ]
                .filter(Boolean)
                .join(' + ')}
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
                title={puedeCerrar ? 'Fijar fecha de cierre/liquidación' : motivoNoCierre}
                className="rounded-lg bg-ok px-4 py-2 text-sm font-semibold text-white hover:bg-[#0e6238] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Cerrar corte
              </button>
            )
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-start gap-3">
        <div className="inline-block rounded-xl border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
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
        <TarjetaTendido
          corte={corte}
          onEditar={corte.estado === 'cerrado' ? null : () => setModalTendido(true)}
        />
        {corte.estado !== 'borrador' && <DuracionEstimada corte={corte} />}
        {modalTendido && (
          <ModalTendido corte={corte} onCerrar={() => setModalTendido(false)} />
        )}
        {modalCodigo && <ModalCodigo corte={corte} onCerrar={() => setModalCodigo(false)} />}
      </div>

      <CalculadoraTendido corte={corte} />

      <ServicioCorte corte={corte} />
      <EnviosServicio corte={corte} />

      {corte.estado === 'borrador' ? (
        <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          El corte está en borrador. Al abrirlo se copian las operaciones del modelo (snapshot con
          tarifas congeladas) y se puede empezar a asignar.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {editable && (
            <p className="text-xs text-gray-500">
              Arrastrá <span className="text-gray-400">⠿</span> para reordenar dentro de un grupo.
              Editar, agregar o quitar operaciones aquí cambia <strong>solo este corte</strong>: el
              modelo no se toca y cada cambio queda en el historial.
            </p>
          )}
          {grupos.map(([grupo, ops]) => (
            <GrupoCorte
              key={grupo}
              corte={corte}
              grupo={grupo}
              ops={ops}
              operarios={operarios ?? []}
              editable={editable}
              plegado={plegados[grupo] ?? false}
              onPlegar={() => setPlegados((p) => ({ ...p, [grupo]: !(p[grupo] ?? false) }))}
              onAsignarGrupo={(operarioId) =>
                asignarGrupo.mutate({
                  corteId: corte.id,
                  input: { grupo, operarioId, esMaestroExterno: false },
                })
              }
              // arrastrar dentro del grupo: se manda el orden completo del corte
              onReordenar={(idsGrupo) =>
                reordenar.mutate({
                  corteId: corte.id,
                  operacionIds: grupos.flatMap(([g, os]) =>
                    g === grupo ? idsGrupo : os.map((o) => o.id),
                  ),
                })
              }
              onEditar={(op) => setModalOp({ tipo: 'editar', operacion: op })}
              onQuitar={(op) => setModalOp({ tipo: 'quitar', operacion: op })}
              onAgregar={() => setModalOp({ tipo: 'agregar', grupo })}
            />
          ))}
          {editable && (
            <button
              onClick={() => setModalOp({ tipo: 'agregar' })}
              className="rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:border-acento hover:text-acento"
            >
              + Agregar operación solo a este corte (nuevo grupo)
            </button>
          )}
          {reordenar.error != null && (
            <p className="rounded-lg bg-error-suave px-3 py-2 text-sm text-error">
              {reordenar.error instanceof ErrorApi
                ? reordenar.error.message
                : 'No se pudo guardar el nuevo orden'}
            </p>
          )}
          {modalOp && (
            <ModalOperacionCorte corte={corte} modal={modalOp} onCerrar={() => setModalOp(null)} />
          )}

          <HistorialCambios cambios={corte.cambios} />

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
