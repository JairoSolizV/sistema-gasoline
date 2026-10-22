import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatBs, type RubroCostoDTO } from '@taller/shared';
import { useCostoCorte, useCostosCortes } from '../../api/costos';

// Costo real de cada corte frente a su ficha (docs/PLAN_COSTOS.md §7b): lo que se
// pagó o se va a pagar (costura, empaque, servicio de corte, envíos) y la tela
// según el tizado real. Clic en un corte → el detalle por rubro.

const ETIQUETA_RUBRO: Record<RubroCostoDTO['rubro'], string> = {
  tela: 'Tela',
  materiales: 'Hilos, cierres y avíos',
  externos: 'Lavandería, bordado y otros',
  logistica: 'Logística',
  costura: 'Costura',
  empaque: 'Empaque',
  servicio_corte: 'Servicio de corte',
};

/** Diferencia real − ficha, en rojo si salió más caro. */
function Diferencia({ real, ficha }: { real: number | null; ficha: number | null }) {
  if (real == null || ficha == null) return <span className="text-gray-300">—</span>;
  const d = real - ficha;
  if (d === 0) return <span className="text-gray-400">igual</span>;
  return <span className={d > 0 ? 'text-error' : 'text-ok'}>{d > 0 ? '+' : '−'}Bs {formatBs(Math.abs(d))}</span>;
}

export function CortesCostoTab() {
  const { data: cortes, isLoading } = useCostosCortes();
  const [abierto, setAbierto] = useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-left text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
            <th className="px-5 py-3">Corte</th>
            <th className="px-3 py-3">Ficha</th>
            <th className="px-3 py-3 text-right">Prendas</th>
            <th className="px-3 py-3 text-right">Ficha / prenda</th>
            <th className="px-3 py-3 text-right">Real / prenda</th>
            <th className="px-5 py-3 text-right">Diferencia</th>
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr>
              <td colSpan={6} className="px-5 py-8 text-center text-gray-500">
                Cargando…
              </td>
            </tr>
          )}
          {cortes?.map((c) => (
            <FilaCorte
              key={c.corteId}
              c={c}
              abierto={abierto === c.corteId}
              onClick={() => setAbierto(abierto === c.corteId ? null : c.corteId)}
            />
          ))}
          {cortes?.length === 0 && (
            <tr>
              <td colSpan={6} className="px-5 py-10 text-center text-gray-500">
                Todavía no hay cortes abiertos o cerrados.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function FilaCorte({
  c,
  abierto,
  onClick,
}: {
  c: NonNullable<ReturnType<typeof useCostosCortes>['data']>[number];
  abierto: boolean;
  onClick: () => void;
}) {
  return (
    <>
      <tr onClick={onClick} className="cursor-pointer border-b border-gray-100 hover:bg-gray-50/60">
        <td className="px-5 py-2.5">
          <span className="font-medium">COD {c.codigo}</span>{' '}
          <span className="text-gray-600">{c.modeloNombre}</span>
          <span className="ml-2 text-[11px] text-gray-400">{c.estado}</span>
        </td>
        <td className="px-3 py-2.5 text-gray-600">
          {c.ficha ? (
            <Link to={`/costos/fichas/${c.ficha.id}`} onClick={(e) => e.stopPropagation()} className="text-acento hover:underline">
              {c.ficha.nombre}
            </Link>
          ) : (
            <span className="text-xs text-amber-700">sin ficha vinculada</span>
          )}
        </td>
        <td className="mono px-3 py-2.5 text-right text-gray-600">{c.prendas}</td>
        <td className="mono px-3 py-2.5 text-right">
          {c.fichaPorPrenda != null ? `Bs ${formatBs(c.fichaPorPrenda)}` : '—'}
        </td>
        <td className="mono px-3 py-2.5 text-right font-semibold">Bs {formatBs(c.realPorPrenda)}</td>
        <td className="mono px-5 py-2.5 text-right">
          <Diferencia real={c.realPorPrenda} ficha={c.fichaPorPrenda} />
        </td>
      </tr>
      {abierto && (
        <tr className="border-b border-gray-100 bg-gray-50/50">
          <td colSpan={6} className="px-5 py-3">
            <DetalleCorte corteId={c.corteId} />
          </td>
        </tr>
      )}
    </>
  );
}

function DetalleCorte({ corteId }: { corteId: string }) {
  const { data: d, isLoading } = useCostoCorte(corteId);
  if (isLoading || !d) return <div className="text-sm text-gray-500">Cargando…</div>;
  return (
    <div>
      <table className="w-full max-w-3xl text-sm">
        <thead>
          <tr className="text-left text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
            <th className="py-1.5">Rubro ({d.prendas} prendas)</th>
            <th className="py-1.5 text-right">Ficha</th>
            <th className="py-1.5 text-right">Real</th>
            <th className="py-1.5 text-right">Diferencia</th>
          </tr>
        </thead>
        <tbody>
          {d.rubros.map((r) => (
            <tr key={r.rubro} className="border-t border-gray-200/70">
              <td className="py-1.5">
                {ETIQUETA_RUBRO[r.rubro]}
                {r.nota && <div className="text-[11px] text-gray-400">{r.nota}</div>}
              </td>
              <td className="mono py-1.5 text-right">{r.ficha != null ? `Bs ${formatBs(r.ficha)}` : '—'}</td>
              <td className="mono py-1.5 text-right">{r.real != null ? `Bs ${formatBs(r.real)}` : '—'}</td>
              <td className="mono py-1.5 text-right">
                <Diferencia real={r.real} ficha={r.ficha} />
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-gray-300 font-semibold">
            <td className="py-1.5">Total</td>
            <td className="mono py-1.5 text-right">{d.fichaTotal != null ? `Bs ${formatBs(d.fichaTotal)}` : '—'}</td>
            <td className="mono py-1.5 text-right">Bs {formatBs(d.realTotal)}</td>
            <td className="mono py-1.5 text-right">
              <Diferencia real={d.realTotal} ficha={d.fichaTotal} />
            </td>
          </tr>
        </tbody>
      </table>
      {d.avisos.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-xs text-amber-700">
          {d.avisos.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
      <Link to={`/cortes/${d.corteId}`} className="mt-2 inline-block text-xs text-acento hover:underline">
        Ver el corte →
      </Link>
    </div>
  );
}
