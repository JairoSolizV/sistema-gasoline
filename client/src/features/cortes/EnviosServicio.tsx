import { useState } from 'react';
import {
  aCentavos,
  ETIQUETA_CUENTA,
  formatBs,
  SERVICIOS_EXTERNOS,
  TARIFA_SERVICIO,
  type CorteDetalleDTO,
  type EnvioServicioDTO,
  type ServicioExterno,
} from '@taller/shared';
import { useCrearEnvio, useEditarEnvio, useEliminarEnvio } from '../../api/cortes';
import { useOperarios } from '../../api/operarios';
import { ErrorApi } from '../../api/client';
import { Modal } from '../../components/Modal';
import { hoyLocalISO } from '../../lib/fechas';

// Servicios externos (serigrafía, láser, bordado, lavandería) en el detalle del corte
// (docs/PLAN_CUENTAS_SEPARADAS.md §5): envíos de prendas a proveedores, con el
// precio por prenda del proveedor (editable). Cada envío se paga en su fecha
// de devolución, en la cuenta de su servicio (nunca mezclado con la costura).

export const PATRON_BS = /^\d+([.,]\d{1,2})?$/;
export const aTexto = (c: number) => formatBs(c).replace(/ /g, '');
export const aCent = (s: string) => aCentavos(s.trim().replace(',', '.'));
const fechaCorta = (dia: string) => dia.split('-').reverse().join('/');
export const claseInput =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-acento';

export function mensaje(error: unknown) {
  return error instanceof ErrorApi ? error.message : 'Error al guardar';
}

export const enviadas = (corte: CorteDetalleDTO, servicio: ServicioExterno, excluir?: string) =>
  corte.envios
    .filter((e) => e.servicio === servicio && e.id !== excluir)
    .reduce((a, e) => a + e.cantidad, 0);

export function EnviosServicio({ corte }: { corte: CorteDetalleDTO }) {
  const [modal, setModal] = useState<
    | { tipo: 'nuevo'; servicio: ServicioExterno }
    | { tipo: 'editar' | 'devolver' | 'quitar'; envio: EnvioServicioDTO }
    | null
  >(null);

  if (corte.estado === 'borrador') return null; // todavía no hay prendas cortadas

  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-5 py-3">
        <div className="text-sm font-semibold">Servicios externos</div>
        <div className="text-xs text-gray-500">
          Proveedores externos · se paga por prenda en la fecha de devolución, cada servicio en su
          propia cuenta
        </div>
      </div>
      <div className="divide-y divide-gray-100">
        {SERVICIOS_EXTERNOS.map((servicio) => {
          const lista = corte.envios.filter((e) => e.servicio === servicio);
          const total = lista.reduce((a, e) => a + e.total, 0);
          const yaEnviadas = enviadas(corte, servicio);
          return (
            <div key={servicio} className="px-5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  <span className="font-semibold">{ETIQUETA_CUENTA[servicio]}</span>
                  <span className="ml-2 text-xs text-gray-500">
                    {yaEnviadas} de {corte.cantidadTotal} prendas enviadas
                    {total > 0 && (
                      <>
                        {' · '}
                        <span className="mono font-semibold text-gray-700">Bs {formatBs(total)}</span>
                      </>
                    )}
                  </span>
                </div>
                {yaEnviadas < corte.cantidadTotal && (
                  <button
                    onClick={() => setModal({ tipo: 'nuevo', servicio })}
                    className="text-[13px] font-medium text-acento hover:underline"
                  >
                    + Enviar a {ETIQUETA_CUENTA[servicio].toLowerCase()}
                  </button>
                )}
              </div>
              {lista.length > 0 && (
                <table className="mt-2 w-full text-sm">
                  <tbody>
                    {lista.map((e) => (
                      <FilaEnvio
                        key={e.id}
                        e={e}
                        onDevolver={() => setModal({ tipo: 'devolver', envio: e })}
                        onEditar={() => setModal({ tipo: 'editar', envio: e })}
                        onQuitar={() => setModal({ tipo: 'quitar', envio: e })}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>

      {modal?.tipo === 'nuevo' && (
        <ModalEnvio corte={corte} servicio={modal.servicio} envio={null} onCerrar={() => setModal(null)} />
      )}
      {modal?.tipo === 'editar' && (
        <ModalEnvio
          corte={corte}
          servicio={modal.envio.servicio}
          envio={modal.envio}
          onCerrar={() => setModal(null)}
        />
      )}
      {modal?.tipo === 'devolver' && (
        <ModalDevolucion corteId={corte.id} envio={modal.envio} onCerrar={() => setModal(null)} />
      )}
      {modal?.tipo === 'quitar' && (
        <ModalQuitar corteId={corte.id} envio={modal.envio} onCerrar={() => setModal(null)} />
      )}
    </div>
  );
}

function FilaEnvio({
  e,
  onDevolver,
  onEditar,
  onQuitar,
}: {
  e: EnvioServicioDTO;
  onDevolver: () => void;
  onEditar: () => void;
  onQuitar: () => void;
}) {
  return (
    <tr className="border-t border-gray-100">
      <td className="py-2 pr-3 font-medium">
        {e.operario.nombre}
        {e.color && (
          <span
            className="ml-2 rounded-full border border-sky-200 bg-sky-50 px-1.5 py-px text-[10px] font-semibold text-sky-700"
            title="Color de lavado (salió del surtido)"
          >
            {e.color}
          </span>
        )}
      </td>
      <td className="mono px-3 py-2 text-right text-gray-600">{e.cantidad} prendas</td>
      <td className="mono px-3 py-2 text-right text-gray-500">× Bs {formatBs(e.precioPrenda)}</td>
      <td className="mono px-3 py-2 text-right font-semibold">Bs {formatBs(e.total)}</td>
      <td className="px-3 py-2 text-xs text-gray-500">enviado {fechaCorta(e.fechaEnvio)}</td>
      <td className="px-3 py-2 text-xs">
        {e.fechaDevolucion ? (
          <span className="rounded-full bg-ok-suave px-2 py-0.5 font-semibold text-ok">
            devuelto {fechaCorta(e.fechaDevolucion)}
          </span>
        ) : (
          <button
            onClick={onDevolver}
            className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 font-semibold text-amber-800 hover:bg-amber-100"
            title="Se paga en la fecha en que vuelven las prendas"
          >
            sin devolver · registrar devolución
          </button>
        )}
      </td>
      <td className="py-2 pl-3 text-right text-[13px] font-medium whitespace-nowrap">
        {e.bloqueado ? (
          <span className="text-xs text-gray-400" title="Devuelto en un mes ya liquidado">
            liquidado
          </span>
        ) : (
          <span className="flex justify-end gap-3">
            <button onClick={onEditar} className="text-acento hover:underline">
              Editar
            </button>
            <button onClick={onQuitar} className="text-error hover:underline">
              Quitar
            </button>
          </span>
        )}
      </td>
    </tr>
  );
}

/** Nuevo envío o edición (proveedor fijo al editar; ahí también la devolución). */
function ModalEnvio({
  corte,
  servicio,
  envio,
  onCerrar,
}: {
  corte: CorteDetalleDTO;
  servicio: ServicioExterno;
  envio: EnvioServicioDTO | null;
  onCerrar: () => void;
}) {
  const crear = useCrearEnvio();
  const editar = useEditarEnvio();
  const mutacion = envio ? editar : crear;
  const { data: proveedores } = useOperarios('activos', servicio);
  const disponibles = corte.cantidadTotal - enviadas(corte, servicio, envio?.id);

  const [operarioId, setOperarioId] = useState(envio?.operario.id ?? '');
  const [cantidad, setCantidad] = useState(String(envio?.cantidad ?? disponibles));
  const [precioBs, setPrecioBs] = useState(envio ? aTexto(envio.precioPrenda) : '');
  const [fechaEnvio, setFechaEnvio] = useState(envio?.fechaEnvio ?? hoyLocalISO());
  const [fechaDevolucion, setFechaDevolucion] = useState(envio?.fechaDevolucion ?? '');
  const [nota, setNota] = useState(envio?.nota ?? '');
  const [error, setError] = useState<string | null>(null);

  // al elegir el proveedor se propone su precio (se puede cambiar)
  const elegirProveedor = (id: string) => {
    setOperarioId(id);
    const p = proveedores?.find((o) => o.id === id);
    const precio = p?.[TARIFA_SERVICIO[servicio]];
    if (precio != null) setPrecioBs(aTexto(precio));
  };

  const n = Number(cantidad);
  const precioValido = PATRON_BS.test(precioBs.trim());
  const totalVivo = Number.isInteger(n) && n > 0 && precioValido ? n * aCent(precioBs) : null;

  const guardar = async () => {
    setError(null);
    if (!envio && !operarioId) return setError('Elegí el proveedor');
    if (!Number.isInteger(n) || n < 1) return setError('Las prendas deben ser un número entero mayor a 0');
    if (n > disponibles) return setError(`Quedan ${disponibles} prendas por enviar a este servicio`);
    if (!precioValido) return setError('Precio por prenda inválido (ej. 1.50)');
    if (fechaDevolucion && fechaDevolucion < fechaEnvio) {
      return setError('La devolución no puede ser anterior al envío');
    }
    if (envio) {
      await editar.mutateAsync({
        corteId: corte.id,
        envioId: envio.id,
        cambios: {
          cantidad: n,
          precioPrenda: aCent(precioBs),
          fechaEnvio,
          fechaDevolucion: fechaDevolucion || null,
          nota,
        },
      });
    } else {
      await crear.mutateAsync({
        corteId: corte.id,
        input: { servicio, operarioId, cantidad: n, precioPrenda: aCent(precioBs), fechaEnvio, nota },
      });
    }
    onCerrar();
  };

  return (
    <Modal onCerrar={onCerrar}>
      <h2 className="text-lg font-semibold">
        {envio ? 'Editar envío' : 'Enviar'} a {ETIQUETA_CUENTA[servicio].toLowerCase()}
      </h2>
      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Proveedor</label>
          {envio ? (
            <div className="text-sm font-medium">{envio.operario.nombre}</div>
          ) : (
            <select value={operarioId} onChange={(e) => elegirProveedor(e.target.value)} className={claseInput}>
              <option value="">Elegir proveedor…</option>
              {proveedores?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </select>
          )}
          {!envio && proveedores?.length === 0 && (
            <p className="mt-1 text-xs text-amber-700">
              No hay proveedores de {ETIQUETA_CUENTA[servicio].toLowerCase()}: registralos en
              Operarios con tipo "Proveedor externo".
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Prendas</label>
            <input
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              inputMode="numeric"
              className={`mono ${claseInput}`}
            />
            <p className="mt-1 text-xs text-gray-500">quedan {disponibles} por enviar</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Precio por prenda (Bs)</label>
            <input
              value={precioBs}
              onChange={(e) => setPrecioBs(e.target.value)}
              inputMode="decimal"
              placeholder="ej. 1.50"
              className={`mono ${claseInput}`}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Fecha de envío</label>
            <input type="date" value={fechaEnvio} onChange={(e) => setFechaEnvio(e.target.value)} className={claseInput} />
          </div>
          {envio && (
            <div>
              <label className="mb-1 block text-sm font-medium">
                Devolución <span className="font-normal text-gray-400">(vacía = sin devolver)</span>
              </label>
              <input
                type="date"
                value={fechaDevolucion}
                min={fechaEnvio}
                onChange={(e) => setFechaDevolucion(e.target.value)}
                className={claseInput}
              />
            </div>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">
            Nota <span className="font-normal text-gray-400">(opcional)</span>
          </label>
          <input value={nota} onChange={(e) => setNota(e.target.value)} className={claseInput} />
        </div>
        {totalVivo != null && (
          <p className="text-sm text-gray-600">
            Total: <span className="mono font-semibold">Bs {formatBs(totalVivo)}</span>
            <span className="text-xs text-gray-500"> · se paga al devolver</span>
          </p>
        )}
        {(error || mutacion.error != null) && (
          <p className="rounded-lg bg-error-suave px-3 py-2 text-xs text-error">
            {error ?? mensaje(mutacion.error)}
          </p>
        )}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onCerrar} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
          Cancelar
        </button>
        <button
          onClick={() => void guardar().catch(() => undefined)}
          disabled={mutacion.isPending}
          className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-[#265dc2] disabled:opacity-60"
        >
          {envio ? 'Guardar cambios' : 'Registrar envío'}
        </button>
      </div>
    </Modal>
  );
}

function ModalDevolucion({
  corteId,
  envio,
  onCerrar,
}: {
  corteId: string;
  envio: EnvioServicioDTO;
  onCerrar: () => void;
}) {
  const editar = useEditarEnvio();
  const [fecha, setFecha] = useState(hoyLocalISO());
  const guardar = async () => {
    await editar.mutateAsync({ corteId, envioId: envio.id, cambios: { fechaDevolucion: fecha } });
    onCerrar();
  };
  return (
    <Modal onCerrar={onCerrar}>
      <h2 className="text-lg font-semibold">Registrar devolución</h2>
      <p className="mt-2 text-sm text-gray-600">
        <strong>{envio.operario.nombre}</strong> devolvió {envio.cantidad} prendas. Se le paga{' '}
        <span className="mono font-semibold">Bs {formatBs(envio.total)}</span> en la cuenta de{' '}
        {ETIQUETA_CUENTA[envio.servicio]}, en el mes de esta fecha.
      </p>
      <div className="mt-4 max-w-48">
        <label className="mb-1 block text-sm font-medium">Fecha de devolución</label>
        <input
          type="date"
          value={fecha}
          min={envio.fechaEnvio}
          onChange={(e) => setFecha(e.target.value)}
          className={claseInput}
        />
      </div>
      {editar.error != null && (
        <p className="mt-3 rounded-lg bg-error-suave px-3 py-2 text-xs text-error">{mensaje(editar.error)}</p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onCerrar} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
          Cancelar
        </button>
        <button
          onClick={() => void guardar().catch(() => undefined)}
          disabled={editar.isPending || !fecha}
          className="rounded-lg bg-ok px-4 py-2 text-sm font-semibold text-white hover:bg-[#0e6238] disabled:opacity-60"
        >
          Registrar devolución
        </button>
      </div>
    </Modal>
  );
}

function ModalQuitar({
  corteId,
  envio,
  onCerrar,
}: {
  corteId: string;
  envio: EnvioServicioDTO;
  onCerrar: () => void;
}) {
  const quitar = useEliminarEnvio();
  const confirmar = async () => {
    await quitar.mutateAsync({ corteId, envioId: envio.id });
    onCerrar();
  };
  return (
    <Modal onCerrar={onCerrar}>
      <h2 className="text-lg font-semibold">Quitar envío</h2>
      <p className="mt-2 text-sm text-gray-600">
        Se quita el envío de {envio.cantidad} prendas a <strong>{envio.operario.nombre}</strong> (
        <span className="mono">Bs {formatBs(envio.total)}</span>).
        {envio.fechaDevolucion && ' Ya estaba devuelto: deja de pagarse.'}
      </p>
      {quitar.error != null && (
        <p className="mt-3 rounded-lg bg-error-suave px-3 py-2 text-xs text-error">{mensaje(quitar.error)}</p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onCerrar} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
          Cancelar
        </button>
        <button
          onClick={() => void confirmar().catch(() => undefined)}
          disabled={quitar.isPending}
          className="rounded-lg bg-error px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          Quitar envío
        </button>
      </div>
    </Modal>
  );
}
