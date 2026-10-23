import { useState } from 'react';
import {
  aCentavos,
  ETIQUETA_CUENTA,
  formatBs,
  type Cuenta,
  type CuentaConsolidadoDTO,
} from '@taller/shared';
import { Modal } from '../../components/Modal';
import { useCerrarMes } from '../../api/liquidacion';
import { ErrorApi } from '../../api/client';

const PATRON_BS = /^\d+(\.\d{1,2})?$/;

interface Excepcion {
  arrastra: boolean;
  cobraBs: string; // cuánto cobra realmente (Bs)
}

const clave = (operarioId: string, cuenta: Cuenta) => `${operarioId}:${cuenta}`;

/** Un solo cierre para todas las cuentas; la excepción "cobra menos y arrastra"
 *  es por operario y CUENTA (docs/PLAN_CUENTAS_SEPARADAS.md §2.3). */
export function CerrarMesModal({
  anio,
  mes,
  nombreMes,
  cuentas,
  onCerrar,
}: {
  anio: number;
  mes: number;
  nombreMes: string;
  cuentas: CuentaConsolidadoDTO[];
  onCerrar: () => void;
}) {
  const cerrar = useCerrarMes();
  // solo se puede "cobrar menos" cuando hay saldo a favor (positivo)
  const grupos = cuentas
    .map((c) => ({ cuenta: c.cuenta, filas: c.filas.filter((f) => f.saldoPeriodo > 0) }))
    .filter((g) => g.filas.length > 0);
  const [exc, setExc] = useState<Record<string, Excepcion>>({});

  const cambiar = (k: string, cambio: Partial<Excepcion>) =>
    setExc((e) => {
      const actual = e[k] ?? { arrastra: false, cobraBs: '' };
      return { ...e, [k]: { ...actual, ...cambio } };
    });

  const onConfirmar = async () => {
    const excepciones = grupos.flatMap((g) =>
      g.filas
        .filter((f) => exc[clave(f.operarioId, g.cuenta)]?.arrastra)
        .map((f) => {
          const cobraBs = exc[clave(f.operarioId, g.cuenta)]?.cobraBs ?? '';
          const pagado = PATRON_BS.test(cobraBs) ? aCentavos(cobraBs) : 0;
          return { operarioId: f.operarioId, cuenta: g.cuenta, pagado, arrastraSaldo: true };
        }),
    );
    await cerrar.mutateAsync({ anio, mes, excepciones });
    onCerrar();
  };

  return (
    <Modal onCerrar={onCerrar} ancho="max-w-2xl">
      <h2 className="text-lg font-semibold">
        Liquidar {nombreMes} {anio}
      </h2>
      <p className="mt-2 text-sm text-gray-600">
        Se liquidan <strong>todas las cuentas</strong>, cada una con su propio saldo. Por defecto se
        paga <strong>todo el saldo a favor</strong> y queda en 0. Marcá abajo a quien{' '}
        <strong>no cobra todo</strong> de una cuenta (viaje, ahorro, urgencia): el resto se arrastra
        al mes siguiente en esa misma cuenta. Los saldos negativos se arrastran solos.
      </p>

      <div className="mt-4 max-h-80 overflow-y-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="sticky top-0">
            <tr className="bg-gray-50 text-left text-[11px] font-semibold tracking-wider text-gray-500 uppercase shadow-[inset_0_-1px_0_#e5e7eb]">
              <th className="px-4 py-2">Operario / empresa</th>
              <th className="px-3 py-2 text-right">Saldo a favor</th>
              <th className="px-3 py-2">¿Cobra menos?</th>
              <th className="px-4 py-2 text-right">Cobra</th>
            </tr>
          </thead>
          {grupos.map((g) => (
            <tbody key={g.cuenta}>
              <tr className="bg-gray-50/60">
                <td colSpan={4} className="px-4 py-1.5 text-xs font-semibold text-gray-700">
                  {ETIQUETA_CUENTA[g.cuenta]}{' '}
                  <span className="mono font-normal text-gray-500">
                    · a favor Bs {formatBs(g.filas.reduce((a, f) => a + f.saldoPeriodo, 0))}
                  </span>
                </td>
              </tr>
              {g.filas.map((f) => {
                const k = clave(f.operarioId, g.cuenta);
                const e = exc[k];
                return (
                  <tr key={k} className="border-b border-gray-200/70 even:bg-slate-100 last:border-0">
                    <td className="px-4 py-2 font-medium">{f.nombre}</td>
                    <td className="mono px-3 py-2 text-right">Bs {formatBs(f.saldoPeriodo)}</td>
                    <td className="px-3 py-2">
                      <label className="flex items-center gap-1.5 text-xs text-gray-600">
                        <input
                          type="checkbox"
                          checked={e?.arrastra ?? false}
                          onChange={(ev) => cambiar(k, { arrastra: ev.target.checked })}
                        />
                        arrastra saldo
                      </label>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {e?.arrastra ? (
                        <input
                          value={e.cobraBs}
                          onChange={(ev) => cambiar(k, { cobraBs: ev.target.value })}
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
            </tbody>
          ))}
          {grupos.length === 0 && (
            <tbody>
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                  Nadie tiene saldo a favor este mes.
                </td>
              </tr>
            </tbody>
          )}
        </table>
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
