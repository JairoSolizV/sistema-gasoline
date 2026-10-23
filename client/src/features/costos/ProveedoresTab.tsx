import { useState } from 'react';
import { aCentavos, formatBs, type CajaBs, type Moneda } from '@taller/shared';
import { useMutacionDinero, useProveedores } from '../../api/dinero';
import { ErrorApi } from '../../api/client';
import { Modal } from '../../components/Modal';
import { SelectorCaja } from '../../components/SelectorCaja';
import { TABLA } from '../../components/tabla';
import { hoyLocalISO } from '../../lib/fechas';
import { fechaCorta, PATRON_BS } from './formato';

// Deudas con proveedores de insumos (docs/PLAN_TABLERO_DINERO.md): compras
// marcadas "a crédito" − pagos anotados acá. El proveedor es la tienda de la
// compra (en mayúsculas, sin espacios de más). Lo comprado en $us (la tela de
// Nancy) se debe y se paga en $us: una fila por proveedor y moneda
// (docs/PLAN_DOLARES.md).

const bs = (c: number) => `Bs ${formatBs(c)}`;
const plata = (c: number, moneda: Moneda) => (moneda === 'USD' ? `$us ${formatBs(c)}` : bs(c));
const claseInput =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-acento';

export function ProveedoresTab() {
  const { data: proveedores, isLoading } = useProveedores();
  const mutar = useMutacionDinero();
  const [abierto, setAbierto] = useState<string | null>(null);
  const [pagar, setPagar] = useState<{ proveedor: string; moneda: Moneda } | null>(null); // proveedor '' = elegir
  const total = (moneda: Moneda) => (proveedores ?? []).filter((p) => p.moneda === moneda).reduce((a, p) => a + p.deuda, 0);
  const clave = (p: { proveedor: string; moneda: Moneda }) => `${p.proveedor}|${p.moneda}`;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          Lo que debés por compras <strong>a crédito</strong> (se marcan al registrar la compra). Total:{' '}
          <span className="mono font-semibold text-error">{plata(total('USD'), 'USD')}</span> y{' '}
          <span className="mono font-semibold text-error">{bs(total('BOB'))}</span>
        </p>
        <button
          onClick={() => setPagar({ proveedor: '', moneda: 'USD' })}
          className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-[#265dc2]"
        >
          + Registrar pago
        </button>
      </div>
      <div className={TABLA.contenedor}>
        <table className="text-sm">
          <thead className={TABLA.cabecera}>
            <tr className={TABLA.filaCabecera}>
              <th className="px-3 py-2.5">Proveedor</th>
              <th className="px-3 py-2.5 text-right">Compras a crédito</th>
              <th className="px-3 py-2.5 text-right">Pagado</th>
              <th className="px-3 py-2.5 text-right">Le debés</th>
              <th className="px-3 py-2.5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-gray-500">
                  Cargando…
                </td>
              </tr>
            )}
            {proveedores?.map((p) => (
              <FilaProveedor
                key={clave(p)}
                p={p}
                abierto={abierto === clave(p)}
                onAbrir={() => setAbierto(abierto === clave(p) ? null : clave(p))}
                onPagar={() => setPagar({ proveedor: p.proveedor, moneda: p.moneda })}
                onQuitarPago={(id) => mutar.mutate({ tipo: 'quitarPago', id })}
              />
            ))}
            {proveedores?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-gray-500">
                  No hay compras a crédito. Al registrar una compra, marcá "A crédito" si la pagás después.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pagar != null && (
        <ModalPago
          proveedor={pagar.proveedor}
          moneda={pagar.moneda}
          proveedores={[...new Set((proveedores ?? []).map((p) => p.proveedor))]}
          onCerrar={() => setPagar(null)}
        />
      )}
    </>
  );
}

function FilaProveedor({
  p,
  abierto,
  onAbrir,
  onPagar,
  onQuitarPago,
}: {
  p: NonNullable<ReturnType<typeof useProveedores>['data']>[number];
  abierto: boolean;
  onAbrir: () => void;
  onPagar: () => void;
  onQuitarPago: (id: string) => void;
}) {
  return (
    <>
      <tr className={TABLA.fila}>
        <td className="px-3 py-2">
          <button onClick={onAbrir} className="font-medium text-acento hover:underline">
            {p.proveedor} {abierto ? '▴' : '▾'}
          </button>
          {p.moneda === 'USD' && (
            <span className="ml-2 rounded-full bg-ok-suave px-2 py-0.5 text-[11px] font-semibold text-ok">en dólares</span>
          )}
        </td>
        <td className="mono px-3 py-2 text-right whitespace-nowrap">{plata(p.comprasCredito, p.moneda)}</td>
        <td className="mono px-3 py-2 text-right whitespace-nowrap text-ok">{plata(p.pagado, p.moneda)}</td>
        <td className={`mono px-3 py-2 text-right font-semibold whitespace-nowrap ${p.deuda > 0 ? 'text-error' : 'text-gray-400'}`}>
          {plata(p.deuda, p.moneda)}
        </td>
        <td className="px-3 py-2 text-right text-[13px] font-medium">
          <button onClick={onPagar} className="text-acento hover:underline">
            Pagar
          </button>
        </td>
      </tr>
      {abierto &&
        p.movimientos.map((m) => (
          <tr key={`${m.tipo}-${m.id}`} className="border-b border-gray-100 bg-white text-xs">
            <td className="py-1.5 pr-3 pl-8 text-gray-600">
              {fechaCorta(m.fecha)} · {m.tipo === 'compra' ? 'compra' : 'pago'} · {m.detalle}
            </td>
            <td className="mono px-3 py-1.5 text-right">{m.tipo === 'compra' ? plata(m.monto, p.moneda) : ''}</td>
            <td className="mono px-3 py-1.5 text-right text-ok">{m.tipo === 'pago' ? plata(m.monto, p.moneda) : ''}</td>
            <td />
            <td className="px-3 py-1.5 text-right">
              {m.tipo === 'pago' && (
                <button onClick={() => onQuitarPago(m.id)} className="text-error hover:underline">
                  Quitar
                </button>
              )}
            </td>
          </tr>
        ))}
    </>
  );
}

function ModalPago({
  proveedor,
  moneda,
  proveedores,
  onCerrar,
}: {
  proveedor: string;
  moneda: Moneda;
  proveedores: string[];
  onCerrar: () => void;
}) {
  const mutar = useMutacionDinero();
  const [v, setV] = useState({ proveedor, fecha: hoyLocalISO(), moneda, monto: '', nota: '', caja: 'efectivo' as CajaBs });
  const enUsd = v.moneda === 'USD';
  const [error, setError] = useState<string | null>(null);
  const onGuardar = async () => {
    setError(null);
    if (!v.proveedor.trim()) return setError('Indicá el proveedor');
    if (!PATRON_BS.test(v.monto.trim())) return setError('Monto inválido (ej. 5000)');
    try {
      await mutar.mutateAsync({
        tipo: 'pagarProveedor',
        input: {
          proveedor: v.proveedor,
          fecha: v.fecha,
          moneda: v.moneda,
          monto: aCentavos(v.monto.trim().replace(',', '.')),
          nota: v.nota,
          caja: v.caja,
        },
      });
      onCerrar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'Error al guardar');
    }
  };
  return (
    <Modal onCerrar={onCerrar}>
      <h2 className="text-lg font-semibold">Pago a proveedor</h2>
      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Proveedor</label>
          <input
            value={v.proveedor}
            onChange={(e) => setV({ ...v, proveedor: e.target.value })}
            list="proveedores-credito"
            className={claseInput}
          />
          <datalist id="proveedores-credito">
            {proveedores.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">¿En qué le pagás?</label>
          <div className="flex gap-2">
            {(['USD', 'BOB'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setV({ ...v, moneda: m })}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                  v.moneda === m ? 'border-acento bg-[rgba(47,111,224,0.08)] font-semibold text-acento' : 'border-gray-300'
                }`}
              >
                {m === 'USD' ? '💵 Dólares ($us)' : 'Bolivianos (Bs)'}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-gray-500">Paga la deuda en esa moneda (la tela en $us se paga en $us).</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Fecha</label>
            <input type="date" value={v.fecha} onChange={(e) => setV({ ...v, fecha: e.target.value })} className={claseInput} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Monto ({enUsd ? '$us' : 'Bs'})</label>
            <input value={v.monto} onChange={(e) => setV({ ...v, monto: e.target.value })} inputMode="decimal" className={`mono ${claseInput}`} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Nota</label>
          <input value={v.nota} onChange={(e) => setV({ ...v, nota: e.target.value })} placeholder="opcional" className={claseInput} />
        </div>
        {enUsd ? (
          <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">Sale de la caja de dólares.</p>
        ) : (
          <SelectorCaja valor={v.caja} onCambiar={(caja) => setV({ ...v, caja })} etiqueta="Pagado con" />
        )}
      </div>
      {error && <p className="mt-3 rounded-lg bg-error-suave px-3 py-2 text-xs text-error">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onCerrar} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
          Cancelar
        </button>
        <button
          onClick={() => void onGuardar()}
          disabled={mutar.isPending}
          className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-[#265dc2] disabled:opacity-60"
        >
          Registrar pago
        </button>
      </div>
    </Modal>
  );
}
