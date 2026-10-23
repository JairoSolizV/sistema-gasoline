import { useState } from 'react';
import { aCentavos, formatBs } from '@taller/shared';
import { useMutacionDinero, useProveedores } from '../../api/dinero';
import { ErrorApi } from '../../api/client';
import { Modal } from '../../components/Modal';
import { TABLA } from '../../components/tabla';
import { hoyLocalISO } from '../../lib/fechas';
import { fechaCorta, PATRON_BS } from './formato';

// Deudas con proveedores de insumos (docs/PLAN_TABLERO_DINERO.md): compras
// marcadas "a crédito" − pagos anotados acá. El proveedor es la tienda de la
// compra (en mayúsculas, sin espacios de más).

const bs = (c: number) => `Bs ${formatBs(c)}`;
const claseInput =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-acento';

export function ProveedoresTab() {
  const { data: proveedores, isLoading } = useProveedores();
  const mutar = useMutacionDinero();
  const [abierto, setAbierto] = useState<string | null>(null);
  const [pagar, setPagar] = useState<string | null>(null); // proveedor ('' = elegir)
  const total = (proveedores ?? []).reduce((a, p) => a + p.deuda, 0);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          Lo que debés por compras <strong>a crédito</strong> (se marcan al registrar la compra). Total:{' '}
          <span className="mono font-semibold text-error">{bs(total)}</span>
        </p>
        <button
          onClick={() => setPagar('')}
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
                key={p.proveedor}
                p={p}
                abierto={abierto === p.proveedor}
                onAbrir={() => setAbierto(abierto === p.proveedor ? null : p.proveedor)}
                onPagar={() => setPagar(p.proveedor)}
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
          proveedor={pagar}
          proveedores={(proveedores ?? []).map((p) => p.proveedor)}
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
        </td>
        <td className="mono px-3 py-2 text-right whitespace-nowrap">{bs(p.comprasCredito)}</td>
        <td className="mono px-3 py-2 text-right whitespace-nowrap text-ok">{bs(p.pagado)}</td>
        <td className={`mono px-3 py-2 text-right font-semibold whitespace-nowrap ${p.deuda > 0 ? 'text-error' : 'text-gray-400'}`}>
          {bs(p.deuda)}
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
            <td className="mono px-3 py-1.5 text-right">{m.tipo === 'compra' ? bs(m.monto) : ''}</td>
            <td className="mono px-3 py-1.5 text-right text-ok">{m.tipo === 'pago' ? bs(m.monto) : ''}</td>
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
  proveedores,
  onCerrar,
}: {
  proveedor: string;
  proveedores: string[];
  onCerrar: () => void;
}) {
  const mutar = useMutacionDinero();
  const [v, setV] = useState({ proveedor, fecha: hoyLocalISO(), monto: '', nota: '' });
  const [error, setError] = useState<string | null>(null);
  const onGuardar = async () => {
    setError(null);
    if (!v.proveedor.trim()) return setError('Indicá el proveedor');
    if (!PATRON_BS.test(v.monto.trim())) return setError('Monto inválido (ej. 5000)');
    try {
      await mutar.mutateAsync({
        tipo: 'pagarProveedor',
        input: { proveedor: v.proveedor, fecha: v.fecha, monto: aCentavos(v.monto.trim().replace(',', '.')), nota: v.nota },
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Fecha</label>
            <input type="date" value={v.fecha} onChange={(e) => setV({ ...v, fecha: e.target.value })} className={claseInput} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Monto (Bs)</label>
            <input value={v.monto} onChange={(e) => setV({ ...v, monto: e.target.value })} inputMode="decimal" className={`mono ${claseInput}`} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Nota</label>
          <input value={v.nota} onChange={(e) => setV({ ...v, nota: e.target.value })} placeholder="opcional" className={claseInput} />
        </div>
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
