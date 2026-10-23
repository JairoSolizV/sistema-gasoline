import { useState } from 'react';
import {
  aBolivianos,
  aCentavos,
  formatBs,
  ORIGENES_COMPRA,
  type Caja,
  type CompraDTO,
  type OrigenCompra,
} from '@taller/shared';
import { useCompras, useCrearCompra, useEditarCompra, useEliminarCompra, useInsumos } from '../../api/costos';
import { ErrorApi } from '../../api/client';
import { Modal } from '../../components/Modal';
import { SelectorCaja } from '../../components/SelectorCaja';
import { TABLA } from '../../components/tabla';
import { hoyLocalISO } from '../../lib/fechas';
import {
  aDiezmilesimos,
  aMilesimas,
  bsUnitario,
  deMilesimas,
  ETIQUETA_ORIGEN,
  fechaCorta,
  PATRON_BS,
  PATRON_DECIMAL,
  PATRON_TASA,
} from './formato';

const claseInput =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-acento';
const mensaje = (e: unknown) => (e instanceof ErrorApi ? e.message : 'Error al guardar');
/** 'aaaa-mm-dd' + n días (las compras a crédito vencen por defecto a los 30). */
const masDias = (dia: string, n: number) => {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function ComprasTab() {
  const { data: insumos } = useInsumos();
  const [insumoId, setInsumoId] = useState('');
  const { data: compras, isLoading } = useCompras(insumoId || undefined);
  const eliminar = useEliminarCompra();
  const [nueva, setNueva] = useState(false);
  const [quitar, setQuitar] = useState<CompraDTO | null>(null);
  const [editar, setEditar] = useState<CompraDTO | null>(null);

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <select
          value={insumoId}
          onChange={(e) => setInsumoId(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Todos los insumos</option>
          {insumos?.map((i) => (
            <option key={i.id} value={i.id}>
              {i.nombre}
            </option>
          ))}
        </select>
        <button
          onClick={() => setNueva(true)}
          className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-[#265dc2]"
        >
          + Registrar compra
        </button>
      </div>
      <div className={TABLA.contenedor}>
        <table className="text-sm">
          <thead className={TABLA.cabecera}>
            <tr className={TABLA.filaCabecera}>
              <th className="px-3 py-2.5">Fecha</th>
              <th className="px-3 py-2.5">Insumo</th>
              <th className="px-3 py-2.5">Para el corte</th>
              <th className="px-3 py-2.5">Dónde</th>
              <th className="px-3 py-2.5 text-right">Cantidad</th>
              <th className="px-3 py-2.5 text-right">Pagado</th>
              <th className="px-3 py-2.5 text-right">Por unidad</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-gray-500">
                  Cargando…
                </td>
              </tr>
            )}
            {compras?.map((c) => (
              <tr key={c.id} className={TABLA.fila}>
                <td className="px-3 py-2 whitespace-nowrap text-gray-500">{fechaCorta(c.fecha)}</td>
                <td className="max-w-[200px] px-3 py-2 font-medium">{c.insumo.nombre}</td>
                <td className="mono px-3 py-2 whitespace-nowrap">
                  {c.codigoCorte ? `COD ${c.codigoCorte}` : <span className="text-gray-400">—</span>}
                </td>
                <td className="max-w-[200px] px-3 py-2 text-xs text-gray-600">
                  {c.tienda}
                  <div className="text-gray-400">
                    {[ETIQUETA_ORIGEN[c.origen], c.ciudad, c.presentacion].filter(Boolean).join(' · ')}
                  </div>
                </td>
                <td className="mono px-3 py-2 text-right whitespace-nowrap text-gray-600">
                  {deMilesimas(c.cantidad)} {c.insumo.unidad}
                </td>
                <td className="mono px-3 py-2 text-right whitespace-nowrap">
                  Bs {formatBs(c.precioTotal)}
                  {c.condicion === 'credito' && (
                    <span className="ml-1 rounded-full bg-error-suave px-1.5 text-[10px] font-semibold text-error">crédito</span>
                  )}
                  {c.moneda === 'USD' && (
                    <div className="text-[11px] text-gray-400">
                      $us {formatBs(c.montoUsd!)} × {(c.tasaCambio! / 10_000).toLocaleString('es-BO')}
                    </div>
                  )}
                </td>
                <td className="mono px-3 py-2 text-right font-semibold whitespace-nowrap">{bsUnitario(c.precioUnitarioBs)}</td>
                <td className="px-3 py-2 text-right text-[13px] font-medium whitespace-nowrap">
                  <button onClick={() => setEditar(c)} className="mr-3 text-acento hover:underline">
                    Editar
                  </button>
                  <button onClick={() => setQuitar(c)} className="text-error hover:underline">
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
            {compras?.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-gray-500">
                  No hay compras registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {nueva && <ModalCompra insumoInicial={insumoId} onCerrar={() => setNueva(false)} />}
      {editar && <ModalEditarCompra compra={editar} onCerrar={() => setEditar(null)} />}
      {quitar && (
        <Modal onCerrar={() => setQuitar(null)}>
          <h2 className="text-lg font-semibold">Quitar compra</h2>
          <p className="mt-2 text-sm text-gray-600">
            Se quita la compra de {quitar.insumo.nombre} del {fechaCorta(quitar.fecha)} (Bs{' '}
            {formatBs(quitar.precioTotal)}). Si era la última, las fichas pasan a usar el precio de la
            compra anterior.
          </p>
          {eliminar.error != null && (
            <p className="mt-3 rounded-lg bg-error-suave px-3 py-2 text-xs text-error">{mensaje(eliminar.error)}</p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setQuitar(null)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={() => eliminar.mutate(quitar.id, { onSuccess: () => setQuitar(null) })}
              className="rounded-lg bg-error px-4 py-2 text-sm font-semibold text-white"
            >
              Quitar compra
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function ModalCompra({ insumoInicial, onCerrar }: { insumoInicial: string; onCerrar: () => void }) {
  const { data: insumos } = useInsumos();
  const crear = useCrearCompra();
  const [v, setV] = useState({
    insumoId: insumoInicial,
    fecha: hoyLocalISO(),
    tienda: '',
    origen: 'tienda' as OrigenCompra,
    ciudad: '',
    presentacion: '',
    cantidad: '',
    moneda: 'BOB' as 'BOB' | 'USD',
    precioBs: '',
    montoUsd: '',
    tasa: '',
    codigoCorte: '',
    condicion: 'contado' as 'contado' | 'credito',
    caja: 'efectivo' as Caja,
    vence: '',
    notas: '',
  });
  const [error, setError] = useState<string | null>(null);
  const cambiar = (k: keyof typeof v, valor: string) => setV((x) => ({ ...x, [k]: valor }));
  const insumo = insumos?.find((i) => i.id === v.insumoId);
  const enDolares = v.moneda === 'USD';
  // vista previa del total en Bs (el server lo calcula igual: monto × tasa, una vez)
  const totalBs = enDolares
    ? PATRON_BS.test(v.montoUsd.trim()) && PATRON_TASA.test(v.tasa.trim())
      ? aBolivianos(aCentavos(v.montoUsd.trim().replace(',', '.')), aDiezmilesimos(v.tasa))
      : null
    : PATRON_BS.test(v.precioBs.trim())
      ? aCentavos(v.precioBs.trim().replace(',', '.'))
      : null;
  const cantidadOk = PATRON_DECIMAL.test(v.cantidad.trim()) && aMilesimas(v.cantidad) > 0;

  const onGuardar = async () => {
    setError(null);
    if (!v.insumoId) return setError('Elegí el insumo');
    if (!v.tienda.trim()) return setError('Indicá la tienda o proveedor');
    if (!cantidadOk) return setError('Cantidad inválida (ej. 1800 o 12.5)');
    if (totalBs == null) {
      return setError(enDolares ? 'Indicá el monto en $us y la tasa oficial del día' : 'Indicá el precio pagado');
    }
    await crear.mutateAsync({
      insumoId: v.insumoId,
      fecha: v.fecha,
      tienda: v.tienda,
      origen: v.origen,
      ciudad: v.ciudad,
      presentacion: v.presentacion,
      cantidad: aMilesimas(v.cantidad),
      moneda: v.moneda,
      ...(enDolares
        ? { montoUsd: aCentavos(v.montoUsd.trim().replace(',', '.')), tasaCambio: aDiezmilesimos(v.tasa) }
        : { precioTotal: totalBs }),
      codigoCorte: v.codigoCorte.trim() || undefined,
      condicion: v.condicion,
      caja: v.caja,
      ...(v.condicion === 'credito' ? { vence: v.vence || masDias(v.fecha, 30) } : {}),
      notas: v.notas,
    });
    onCerrar();
  };

  return (
    <Modal onCerrar={onCerrar} ancho="max-w-lg">
      <h2 className="text-lg font-semibold">Registrar compra</h2>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">Insumo</label>
          <select value={v.insumoId} onChange={(e) => cambiar('insumoId', e.target.value)} className={claseInput}>
            <option value="">Elegir insumo…</option>
            {insumos
              ?.filter((i) => i.activo)
              .map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nombre}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Fecha de compra</label>
          <input type="date" value={v.fecha} onChange={(e) => cambiar('fecha', e.target.value)} className={claseInput} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Tienda / proveedor</label>
          <input value={v.tienda} onChange={(e) => cambiar('tienda', e.target.value)} className={claseInput} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Origen</label>
          <select value={v.origen} onChange={(e) => cambiar('origen', e.target.value)} className={claseInput}>
            {ORIGENES_COMPRA.map((o) => (
              <option key={o} value={o}>
                {ETIQUETA_ORIGEN[o]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Ciudad</label>
          <input value={v.ciudad} onChange={(e) => cambiar('ciudad', e.target.value)} placeholder="opcional" className={claseInput} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">
            Cantidad {insumo && <span className="font-normal text-gray-400">({insumo.unidad})</span>}
          </label>
          <input
            value={v.cantidad}
            onChange={(e) => cambiar('cantidad', e.target.value)}
            inputMode="decimal"
            placeholder="ej. 1800"
            className={`mono ${claseInput}`}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Presentación</label>
          <input
            value={v.presentacion}
            onChange={(e) => cambiar('presentacion', e.target.value)}
            placeholder="ej. paquete de 144"
            className={claseInput}
          />
        </div>
        <div className="col-span-2 flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={v.condicion === 'contado'} onChange={() => cambiar('condicion', 'contado')} /> Al
            contado
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={v.condicion === 'credito'} onChange={() => cambiar('condicion', 'credito')} /> A
            crédito <span className="text-xs text-gray-500">(queda como deuda con el proveedor)</span>
          </label>
        </div>
        <div className="col-span-2 flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={!enDolares} onChange={() => cambiar('moneda', 'BOB')} /> En bolivianos
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={enDolares} onChange={() => cambiar('moneda', 'USD')} /> En dólares
          </label>
        </div>
        {enDolares ? (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium">Total pagado ($us)</label>
              <input
                value={v.montoUsd}
                onChange={(e) => cambiar('montoUsd', e.target.value)}
                inputMode="decimal"
                className={`mono ${claseInput}`}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Tasa oficial del día (Bs por $us)</label>
              <input
                value={v.tasa}
                onChange={(e) => cambiar('tasa', e.target.value)}
                inputMode="decimal"
                placeholder="ej. 6.96"
                className={`mono ${claseInput}`}
              />
            </div>
          </>
        ) : (
          <div>
            <label className="mb-1 block text-sm font-medium">Total pagado (Bs)</label>
            <input
              value={v.precioBs}
              onChange={(e) => cambiar('precioBs', e.target.value)}
              inputMode="decimal"
              className={`mono ${claseInput}`}
            />
          </div>
        )}
        {v.condicion === 'contado' ? (
          <SelectorCaja valor={v.caja} onCambiar={(c) => cambiar('caja', c)} etiqueta="Pagado con" />
        ) : (
          <div>
            <label className="mb-1 block text-sm font-medium">Hay que pagarla el</label>
            <input
              type="date"
              value={v.vence || masDias(v.fecha, 30)}
              onChange={(e) => cambiar('vence', e.target.value)}
              className={claseInput}
            />
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium">Para el corte (código)</label>
          <input
            value={v.codigoCorte}
            onChange={(e) => cambiar('codigoCorte', e.target.value)}
            placeholder="ej. 33 o 28-1"
            className={`mono ${claseInput}`}
          />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">Notas</label>
          <input value={v.notas} onChange={(e) => cambiar('notas', e.target.value)} className={claseInput} />
        </div>
      </div>
      {totalBs != null && cantidadOk && (
        <p className="mt-3 text-sm text-gray-600">
          Total <span className="mono font-semibold">Bs {formatBs(totalBs)}</span> · por {insumo?.unidad ?? 'unidad'}{' '}
          <span className="mono font-semibold">{bsUnitario((totalBs / 100) * (1000 / aMilesimas(v.cantidad)))}</span>
        </p>
      )}
      {(error || crear.error != null) && (
        <p className="mt-3 rounded-lg bg-error-suave px-3 py-2 text-xs text-error">{error ?? mensaje(crear.error)}</p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onCerrar} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
          Cancelar
        </button>
        <button
          onClick={() => void onGuardar().catch(() => undefined)}
          disabled={crear.isPending}
          className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-[#265dc2] disabled:opacity-60"
        >
          Registrar compra
        </button>
      </div>
    </Modal>
  );
}

/** Corrige tienda, corte, contado/crédito y caja de una compra (no su precio
 *  ni su cantidad: para eso se quita y se vuelve a cargar). */
function ModalEditarCompra({ compra, onCerrar }: { compra: CompraDTO; onCerrar: () => void }) {
  const editar = useEditarCompra();
  const [v, setV] = useState({
    tienda: compra.tienda,
    codigoCorte: compra.codigoCorte ?? '',
    condicion: compra.condicion,
    caja: compra.caja,
    vence: compra.vence ?? masDias(compra.fecha, 30),
  });
  const onGuardar = () =>
    editar.mutate(
      {
        id: compra.id,
        input: { ...v, codigoCorte: v.codigoCorte.trim() || null, vence: v.condicion === 'credito' ? v.vence : null },
      },
      { onSuccess: onCerrar },
    );
  return (
    <Modal onCerrar={onCerrar}>
      <h2 className="text-lg font-semibold">Editar compra</h2>
      <p className="mt-1 text-xs text-gray-500">
        {compra.insumo.nombre} del {fechaCorta(compra.fecha)} · Bs {formatBs(compra.precioTotal)}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Tienda / proveedor</label>
          <input value={v.tienda} onChange={(e) => setV({ ...v, tienda: e.target.value })} className={claseInput} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Para el corte (código)</label>
          <input value={v.codigoCorte} onChange={(e) => setV({ ...v, codigoCorte: e.target.value })} className={`mono ${claseInput}`} />
        </div>
        <div className="col-span-2 flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={v.condicion === 'contado'} onChange={() => setV({ ...v, condicion: 'contado' })} /> Al
            contado
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={v.condicion === 'credito'} onChange={() => setV({ ...v, condicion: 'credito' })} /> A
            crédito <span className="text-xs text-gray-500">(se la debés al proveedor)</span>
          </label>
        </div>
        {v.condicion === 'contado' ? (
          <SelectorCaja valor={v.caja} onCambiar={(caja) => setV({ ...v, caja })} etiqueta="Pagado con" />
        ) : (
          <div>
            <label className="mb-1 block text-sm font-medium">Hay que pagarla el</label>
            <input type="date" value={v.vence} onChange={(e) => setV({ ...v, vence: e.target.value })} className={claseInput} />
          </div>
        )}
      </div>
      {editar.error != null && <p className="mt-3 rounded-lg bg-error-suave px-3 py-2 text-xs text-error">{mensaje(editar.error)}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onCerrar} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
          Cancelar
        </button>
        <button
          onClick={onGuardar}
          disabled={editar.isPending}
          className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-[#265dc2] disabled:opacity-60"
        >
          Guardar
        </button>
      </div>
    </Modal>
  );
}
