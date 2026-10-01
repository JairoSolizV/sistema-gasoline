import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  aCentavos,
  ETIQUETA_MODALIDAD,
  ETIQUETA_PROCESO,
  ETIQUETA_ROL,
  formatBs,
  PERSONAS_POR_PROCESO,
  PROCESOS_CORTE,
  repartirDoblado,
  ROL_DE_PROCESO,
  TARIFA_POR_PERSONA,
  type CorteDetalleDTO,
  type ModalidadDoblado,
  type PersonaDTO,
  type ProcesoCorte,
  type ProcesoServicioDTO,
  type ServicioCorteDTO,
} from '@taller/shared';
import { useEditarServicio, useQuitarProceso, useRegistrarProceso } from '../../api/cortes';
import { useOperarios } from '../../api/operarios';
import { ErrorApi } from '../../api/client';
import { Modal } from '../../components/Modal';
import { aFechaInput, deFechaInput, hoyLocalISO } from '../../lib/fechas';

// Servicio de corte interno en el detalle del corte (docs/PLAN_SERVICIO_CORTE.md):
// una tarjeta por proceso con sus personas, tarifas, fecha y subtotal. Cada
// proceso se paga en la fecha en que se terminó (no al cerrar el corte).

const PATRON_BS = /^\d+([.,]\d{1,2})?$/;
const aTexto = (c: number) => formatBs(c).replace(/ /g, '');
const aCent = (s: string) => aCentavos(s.trim().replace(',', '.'));
const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-BO');
const claseInput =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-acento';

function mensaje(error: unknown) {
  return error instanceof ErrorApi ? error.message : 'Error al guardar';
}

/** Tarifa predeterminada (copiada al corte) de un proceso de tarifa única. */
function tarifaPredeterminada(
  s: ServicioCorteDTO,
  proceso: ProcesoCorte,
  modalidad: ModalidadDoblado,
): number {
  if (proceso === 'busqueda') return s.tarifas.busqueda;
  if (proceso === 'trazado') return s.tarifas.trazado;
  return modalidad === 'hoja' ? s.tarifas.dobladoHoja : s.tarifas.dobladoPares;
}

// ── Modal: registrar / editar un proceso ────────────────────────────────────

interface Fila {
  operarioId: string;
  tarifaBs: string; // solo corte / clasificación
}

function ModalProceso({
  corte,
  servicio,
  proceso,
  onCerrar,
}: {
  corte: CorteDetalleDTO;
  servicio: ServicioCorteDTO;
  proceso: ProcesoCorte;
  onCerrar: () => void;
}) {
  const rol = ROL_DE_PROCESO[proceso];
  const { data: conRol } = useOperarios('activos', rol);
  const registrar = useRegistrarProceso();
  const actual = servicio.procesos.find((p) => p.proceso === proceso);
  const [min, max] = PERSONAS_POR_PROCESO[proceso];
  const porPersona = TARIFA_POR_PERSONA[proceso];
  const respaldo =
    proceso === 'corte' ? servicio.tarifas.corteRespaldo : servicio.tarifas.clasificacionRespaldo;

  const [fecha, setFecha] = useState(actual ? aFechaInput(actual.fecha) : hoyLocalISO());
  const [modalidad, setModalidad] = useState<ModalidadDoblado>(actual?.modalidad ?? 'pares');
  const [tarifaBs, setTarifaBs] = useState(() =>
    aTexto(actual ? actual.trabajos[0].tarifa : tarifaPredeterminada(servicio, proceso, 'pares')),
  );
  const [filas, setFilas] = useState<Fila[]>(() => {
    if (actual) {
      return actual.trabajos.map((t) => ({ operarioId: t.operario.id, tarifaBs: aTexto(t.tarifa) }));
    }
    // búsqueda: se propone el buscador del modelo
    const inicial =
      proceso === 'busqueda' && servicio.buscadorModelo?.activo ? servicio.buscadorModelo.id : '';
    return Array.from({ length: min }, (_, i) => ({ operarioId: i === 0 ? inicial : '', tarifaBs: '' }));
  });
  const [error, setError] = useState<string | null>(null);

  // quienes ya figuraban pueden quedar aunque hoy no estén activos o sin el rol
  const yaEstaban: PersonaDTO[] = actual?.trabajos.map((t) => t.operario) ?? [];
  const personas: (PersonaDTO & { tarifaPropia: number | null })[] = [
    ...(conRol ?? []).map((o) => ({
      id: o.id,
      nombre: o.nombre,
      tarifaPropia: proceso === 'corte' ? o.tarifaCorte : o.tarifaClasificacion,
    })),
    ...yaEstaban
      .filter((p) => !conRol?.some((o) => o.id === p.id))
      .map((p) => ({ ...p, tarifaPropia: null })),
  ];

  const elegir = (i: number, operarioId: string) => {
    const p = personas.find((x) => x.id === operarioId);
    // corte / clasificación: al elegir se precarga su tarifa personal (o el respaldo)
    const tarifa = porPersona && operarioId ? aTexto(p?.tarifaPropia ?? respaldo) : filas[i].tarifaBs;
    setFilas(filas.map((f, j) => (j === i ? { operarioId, tarifaBs: tarifa } : f)));
  };

  // vista previa del pago (el server recalcula lo mismo al guardar)
  const cantidad = corte.cantidadTotal;
  const tarifaValida = PATRON_BS.test(tarifaBs.trim());
  const totales: (number | null)[] = (() => {
    if (proceso === 'doblado') {
      if (!tarifaValida) return filas.map(() => null);
      return repartirDoblado(cantidad, aCent(tarifaBs));
    }
    return filas.map((f) => {
      const t = porPersona ? f.tarifaBs : tarifaBs;
      return PATRON_BS.test(t.trim()) ? cantidad * aCent(t) : null;
    });
  })();
  const subtotal = totales.every((t) => t != null) ? totales.reduce((a: number, t) => a + t!, 0) : null;

  const guardar = async () => {
    setError(null);
    const elegidas = filas.filter((f) => f.operarioId);
    if (elegidas.length < min) {
      return setError(
        min === max
          ? `${ETIQUETA_PROCESO[proceso]} lleva exactamente ${min} persona${min > 1 ? 's' : ''}`
          : `Elegí al menos ${min} persona`,
      );
    }
    if (new Set(elegidas.map((f) => f.operarioId)).size !== elegidas.length) {
      return setError('Hay personas repetidas');
    }
    if (!fecha) return setError('Ingresá la fecha en que se terminó');
    if (fecha > hoyLocalISO()) return setError('La fecha no puede ser futura');
    if (!porPersona && !tarifaValida) return setError('Tarifa inválida (ej. 0.30)');
    if (porPersona && elegidas.some((f) => !PATRON_BS.test(f.tarifaBs.trim()))) {
      return setError('Revisá la tarifa de cada persona (ej. 0.25)');
    }
    await registrar.mutateAsync({
      corteId: corte.id,
      proceso,
      input: {
        fecha: deFechaInput(fecha),
        ...(porPersona ? {} : { tarifa: aCent(tarifaBs) }),
        ...(proceso === 'doblado' ? { modalidad } : {}),
        personas: elegidas.map((f) => ({
          operarioId: f.operarioId,
          ...(porPersona ? { tarifa: aCent(f.tarifaBs) } : {}),
        })),
      },
    });
    onCerrar();
  };

  return (
    <Modal onCerrar={onCerrar} ancho="max-w-2xl">
      <h2 className="text-lg font-semibold">
        {actual ? 'Editar' : 'Registrar'} {ETIQUETA_PROCESO[proceso].toLowerCase()}
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        {cantidad} prendas ·{' '}
        {proceso === 'doblado'
          ? 'tarifa del proceso completo, mitad y mitad entre los 2 (el centavo sobrante al primero)'
          : porPersona
            ? 'cada persona cobra su propia tarifa por prenda'
            : 'tarifa por prenda'}
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium">Fecha en que se terminó</label>
          <input
            type="date"
            value={fecha}
            max={hoyLocalISO()}
            onChange={(e) => setFecha(e.target.value)}
            className={claseInput}
          />
        </div>
        {proceso === 'doblado' && (
          <div>
            <label className="mb-1 block text-xs font-medium">Modalidad</label>
            <select
              value={modalidad}
              onChange={(e) => {
                const m = e.target.value as ModalidadDoblado;
                // si la tarifa sigue siendo la predeterminada, acompaña a la modalidad
                if (tarifaBs === aTexto(tarifaPredeterminada(servicio, proceso, modalidad))) {
                  setTarifaBs(aTexto(tarifaPredeterminada(servicio, proceso, m)));
                }
                setModalidad(m);
              }}
              className={claseInput}
            >
              <option value="pares">{ETIQUETA_MODALIDAD.pares}</option>
              <option value="hoja">{ETIQUETA_MODALIDAD.hoja}</option>
            </select>
          </div>
        )}
        {!porPersona && (
          <div>
            <label className="mb-1 block text-xs font-medium">
              Tarifa por prenda (Bs){proceso === 'doblado' ? ' · total' : ''}
            </label>
            <input
              value={tarifaBs}
              onChange={(e) => setTarifaBs(e.target.value.replace(/[^\d.,]/g, ''))}
              inputMode="decimal"
              className={`mono ${claseInput}`}
            />
          </div>
        )}
      </div>

      <div className="mt-4 space-y-2">
        <div className="text-xs font-medium">
          {ETIQUETA_ROL[rol]}
          {min === max ? ` (${min})` : ` (${min} a ${max})`}
        </div>
        {filas.map((f, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-4 text-xs text-gray-400">{i + 1}</span>
            <select
              value={f.operarioId}
              onChange={(e) => elegir(i, e.target.value)}
              className={`${claseInput} flex-1`}
            >
              <option value="">
                {personas.length > 0
                  ? 'Elegir…'
                  : `Nadie tiene el rol ${ETIQUETA_ROL[rol]} (asignalo en Operarios)`}
              </option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            {porPersona && (
              <input
                value={f.tarifaBs}
                onChange={(e) =>
                  setFilas(
                    filas.map((x, j) =>
                      j === i ? { ...x, tarifaBs: e.target.value.replace(/[^\d.,]/g, '') } : x,
                    ),
                  )
                }
                inputMode="decimal"
                placeholder="0.25"
                aria-label="Tarifa por prenda"
                className="mono w-24 rounded-lg border border-gray-300 px-2 py-2 text-right text-sm outline-none focus:border-acento"
              />
            )}
            <span className="mono w-24 text-right text-sm text-gray-600">
              {totales[i] != null ? `Bs ${formatBs(totales[i]!)}` : '—'}
            </span>
            {filas.length > min && (
              <button
                onClick={() => setFilas(filas.filter((_, j) => j !== i))}
                className="text-gray-400 hover:text-error"
                title="Quitar"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {filas.length < max && (
          <button
            onClick={() => setFilas([...filas, { operarioId: '', tarifaBs: '' }])}
            className="text-[13px] font-medium text-acento hover:underline"
          >
            + Agregar persona
          </button>
        )}
      </div>

      <div className="mt-4 flex justify-end text-sm">
        Subtotal:{' '}
        <span className="mono ml-2 font-semibold">
          {subtotal != null ? `Bs ${formatBs(subtotal)}` : '—'}
        </span>
      </div>

      {(error || registrar.error) && (
        <p className="mt-3 rounded-lg bg-error-suave px-3 py-2 text-sm text-error">
          {error ?? mensaje(registrar.error)}
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
          disabled={registrar.isPending}
          className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-[#265dc2] disabled:opacity-60"
        >
          Guardar
        </button>
      </div>
    </Modal>
  );
}

// ── Tarjeta de un proceso ───────────────────────────────────────────────────

function TarjetaProceso({
  corte,
  servicio,
  proceso,
  editable,
  onRegistrar,
  onQuitar,
}: {
  corte: CorteDetalleDTO;
  servicio: ServicioCorteDTO;
  proceso: ProcesoCorte;
  editable: boolean;
  onRegistrar: () => void;
  onQuitar: () => void;
}) {
  const p: ProcesoServicioDTO | undefined = servicio.procesos.find((x) => x.proceso === proceso);
  const falta = servicio.faltantes.includes(proceso);

  // búsqueda sin registrar: depende de cómo está el modelo
  let notaBusqueda: React.ReactNode = null;
  if (proceso === 'busqueda' && !p) {
    if (servicio.sinBuscador) notaBusqueda = 'Modelo sin buscador: no se paga.';
    else if (servicio.buscadorModelo && !servicio.buscadorModelo.activo)
      notaBusqueda = `${servicio.buscadorModelo.nombre} está de baja: no cobra en cortes nuevos.`;
    else if (servicio.buscadorModelo)
      notaBusqueda = `Se registra sola al cargar el corte de tela (${servicio.buscadorModelo.nombre}).`;
    else
      notaBusqueda = (
        <>
          Buscador pendiente en el modelo:{' '}
          <Link to={`/modelos/versiones/${corte.modeloVersionId}`} className="text-acento hover:underline">
            definilo en Modelos
          </Link>
          .
        </>
      );
  }

  return (
    <div
      className={`rounded-xl border bg-white px-4 py-3 shadow-sm ${falta ? 'border-amber-300' : 'border-gray-200'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{ETIQUETA_PROCESO[proceso]}</span>
        {p ? (
          <span className="mono text-sm font-semibold">Bs {formatBs(p.subtotal)}</span>
        ) : (
          falta && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
              falta
            </span>
          )
        )}
      </div>

      {p ? (
        <>
          <div className="mt-0.5 text-xs text-gray-500">
            {fechaCorta(p.fecha)}
            {p.modalidad && ` · ${ETIQUETA_MODALIDAD[p.modalidad].toLowerCase()}`}
            {!TARIFA_POR_PERSONA[proceso] && ` · Bs ${formatBs(p.trabajos[0].tarifa)}/prenda`}
          </div>
          <ul className="mt-2 space-y-0.5 text-sm">
            {p.trabajos.map((t) => (
              <li key={t.id} className="flex justify-between gap-2">
                <span>
                  {t.operario.nombre}
                  {TARIFA_POR_PERSONA[proceso] && (
                    <span className="text-xs text-gray-500"> · {formatBs(t.tarifa)}/prenda</span>
                  )}
                </span>
                <span className="mono text-gray-600">{formatBs(t.total)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-1 text-xs text-gray-500">{notaBusqueda ?? 'Sin registrar.'}</p>
      )}

      {editable && (
        <div className="mt-2 flex gap-3 text-xs font-medium">
          <button onClick={onRegistrar} className="text-acento hover:underline">
            {p ? 'Editar' : 'Registrar'}
          </button>
          {p && (
            <button onClick={onQuitar} className="text-error hover:underline">
              Quitar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sección completa ────────────────────────────────────────────────────────

export function ServicioCorte({ corte }: { corte: CorteDetalleDTO }) {
  const editarServicio = useEditarServicio();
  const quitar = useQuitarProceso();
  const [modal, setModal] = useState<
    { tipo: 'registrar' | 'quitar'; proceso: ProcesoCorte } | null
  >(null);
  const editable = corte.estado !== 'cerrado';
  const servicio = corte.servicio;

  if (!corte.esInterno || !servicio) {
    return (
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-gray-300 bg-white px-5 py-3 text-sm">
        <span className="text-gray-600">
          <strong>Corte externo</strong>: llegó cortado de afuera, no lleva servicio de corte.
        </span>
        {editable && (
          <button
            onClick={() => editarServicio.mutate({ corteId: corte.id, input: { esInterno: true } })}
            disabled={editarServicio.isPending}
            className="text-xs font-medium text-acento hover:underline"
          >
            Marcar como corte interno
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <h2 className="text-base font-semibold">Servicio de corte interno</h2>
          {servicio.faltantes.length > 0 ? (
            <span className="text-xs font-medium text-amber-700">
              Falta: {servicio.faltantes.map((p) => ETIQUETA_PROCESO[p].toLowerCase()).join(', ')}
            </span>
          ) : (
            <span className="text-xs font-medium text-ok">✓ Completo</span>
          )}
        </div>
        <div className="flex items-baseline gap-4">
          {editable && servicio.procesos.length === 0 && (
            <button
              onClick={() => editarServicio.mutate({ corteId: corte.id, input: { esInterno: false } })}
              disabled={editarServicio.isPending}
              className="text-xs font-medium text-gray-500 hover:underline"
            >
              Es un corte externo
            </button>
          )}
          <span className="text-sm">
            Total <span className="mono font-semibold">Bs {formatBs(servicio.total)}</span>
          </span>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {PROCESOS_CORTE.map((proceso) => (
          <TarjetaProceso
            key={proceso}
            corte={corte}
            servicio={servicio}
            proceso={proceso}
            editable={editable}
            onRegistrar={() => setModal({ tipo: 'registrar', proceso })}
            onQuitar={() => setModal({ tipo: 'quitar', proceso })}
          />
        ))}
      </div>

      {editarServicio.error != null && (
        <p className="mt-3 rounded-lg bg-error-suave px-3 py-2 text-sm text-error">
          {mensaje(editarServicio.error)}
        </p>
      )}

      {modal?.tipo === 'registrar' && (
        <ModalProceso
          corte={corte}
          servicio={servicio}
          proceso={modal.proceso}
          onCerrar={() => setModal(null)}
        />
      )}
      {modal?.tipo === 'quitar' && (
        <Modal onCerrar={() => setModal(null)}>
          <h2 className="text-lg font-semibold">Quitar {ETIQUETA_PROCESO[modal.proceso].toLowerCase()}</h2>
          <p className="mt-2 text-sm text-gray-600">
            Se borran los pagos de este proceso en el corte. No se puede si su fecha ya está en un
            mes liquidado.
          </p>
          {quitar.error != null && (
            <p className="mt-3 rounded-lg bg-error-suave px-3 py-2 text-sm text-error">
              {mensaje(quitar.error)}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setModal(null)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={async () => {
                await quitar.mutateAsync({ corteId: corte.id, proceso: modal.proceso });
                setModal(null);
              }}
              disabled={quitar.isPending}
              className="rounded-lg bg-error px-4 py-2 text-sm font-semibold text-white hover:bg-[#a52d24] disabled:opacity-60"
            >
              Quitar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
