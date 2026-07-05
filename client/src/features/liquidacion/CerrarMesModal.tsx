import { useState } from 'react';
import { aCentavos, formatBs, type LiquidacionFilaDTO } from '@taller/shared';
import { Modal } from '../../components/Modal';
import { useCerrarMes } from '../../api/liquidacion';
import { ErrorApi } from '../../api/client';

const PATRON_BS = /^\d+(\.\d{1,2})?$/;

interface Excepcion {
  arrastra: boolean;
  cobraBs: string; // cuánto cobra realmente (Bs)
}

export function CerrarMesModal({
  anio,
  mes,
  nombreMes,
  filas,
  onCerrar,
}: {
  anio: number;
  mes: number;
  nombreMes: string;
  filas: LiquidacionFilaDTO[];
  onCerrar: () => void;
}) {
  const cerrar = useCerrarMes();
  // solo se puede "cobrar menos" cuando hay saldo a favor (positivo)
  const conSaldoPositivo = filas.filter((f) => f.saldoPeriodo > 0);
  const [exc, setExc] = useState<Record<string, Excepcion>>({});

  const totalNormal = conSaldoPositivo.reduce((a, f) => a + f.saldoPeriodo, 0);

  const cambiar = (id: string, cambio: Partial<Excepcion>) =>
    setExc((e) => {
      const actual = e[id] ?? { arrastra: false, cobraBs: '' };
      return { ...e, [id]: { ...actual, ...cambio } };
    });

  const onConfirmar = async () => {
    const excepciones = conSaldoPositivo
      .filter((f) => exc[f.operarioId]?.arrastra)
      .map((f) => {
        const cobraBs = exc[f.operarioId]?.cobraBs ?? '';
        const pagado = PATRON_BS.test(cobraBs) ? aCentavos(cobraBs) : 0;
        return { operarioId: f.operarioId, pagado, arrastraSaldo: true };
      });
    await cerrar.mutateAsync({ anio, mes, excepciones });
    onCerrar();
  };

  return (
    <Modal onCerrar={onCerrar} ancho="max-w-2xl">
      <h2 className="text-lg font-semibold">Liquidar {nombreMes} {anio}</h2>
      <p className="mt-2 text-sm text-gray-600">
        Por defecto se paga <strong>todo el saldo a favor</strong> y todos quedan en 0. Marcá abajo
        a quien <strong>no cobra todo</strong> (viaje, ahorro, urgencia): su saldo restante se
        arrastra al mes siguiente. Los saldos negativos se arrastran solos.
      </p>

      <div className="mt-4 max-h-72 overflow-y-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
              <th className="px-4 py-2">Operario</th>
              <th className="px-3 py-2 text-right">Saldo a favor</th>
              <th className="px-3 py-2">¿Cobra menos?</th>
              <th className="px-4 py-2 text-right">Cobra</th>
            </tr>
          </thead>
          <tbody>
            {conSaldoPositivo.map((f) => {
              const e = exc[f.operarioId];
              return (
                <tr key={f.operarioId} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-2 font-medium">{f.nombre}</td>
                  <td className="mono px-3 py-2 text-right">Bs {formatBs(f.saldoPeriodo)}</td>
                  <td className="px-3 py-2">
                    <label className="flex items-center gap-1.5 text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={e?.arrastra ?? false}
                        onChange={(ev) => cambiar(f.operarioId, { arrastra: ev.target.checked })}
                      />
                      arrastra saldo
                    </label>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {e?.arrastra ? (
                      <input
                        value={e.cobraBs}
                        onChange={(ev) => cambiar(f.operarioId, { cobraBs: ev.target.value })}
                        placeholder={formatBs(f.saldoPeriodo).replace(/ /g, '')}
                        inputMode="decimal"
                        className="mono w-24 rounded-md border border-gray-300 px-2 py-1 text-right text-sm outline-none focus:border-acento"
                      />
                    ) : (
                      <span className="mono text-gray-500">Bs {formatBs(f.saldoPeriodo)}</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {conSaldoPositivo.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                  Nadie tiene saldo a favor este mes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-sm text-gray-500">
        Total a favor del mes:{' '}
        <span className="mono font-semibold text-gray-800">Bs {formatBs(totalNormal)}</span>
      </div>

      {cerrar.error != null && (
        <p className="mt-3 rounded-lg bg-error-suave px-3 py-2 text-xs text-error">
          {cerrar.error instanceof ErrorApi ? cerrar.error.message : 'Error al liquidar'}
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
          onClick={onConfirmar}
          disabled={cerrar.isPending}
          className="rounded-lg bg-ok px-4 py-2 text-sm font-semibold text-white hover:bg-[#0e6238] disabled:opacity-60"
        >
          Liquidar mes
        </button>
      </div>
    </Modal>
  );
}
