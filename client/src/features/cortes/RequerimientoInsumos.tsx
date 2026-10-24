import { Link } from 'react-router-dom';
import {
  formatBs,
  type CorteDetalleDTO,
  type GrupoRequerimiento,
  type LineaRequerimiento,
  type RequerimientoCorteDTO,
  type TituloHilo,
} from '@taller/shared';
import { useElegirHilos, useRequerimiento } from '../../api/surtido';
import { BotonImprimir, type Tamano } from '../../components/Imprimir';
import { HojaOficio } from '../../components/HojaOficio';
import { mensaje } from './EnviosServicio';

// Requerimiento de insumos del corte (docs/PLAN_REQUERIMIENTO.md): qué comprar
// para producirlo — cierres por talla, hilos por máquina y empaque de la ficha —
// en envases completos y descontando lo que hay en inventario. Solo consulta:
// no registra compras ni toca pagos.

const GRUPOS: GrupoRequerimiento[] = ['Cierres', 'Hilos', 'Empaque'];

/** "8 × 120" o, por unidad, "14". */
const textoCompra = (l: LineaRequerimiento) =>
  l.unidadesPorEnvase > 1 ? `${l.envases} × ${l.unidadesPorEnvase}` : String(l.envases);

export function RequerimientoInsumos({
  corte,
  onImprimir,
}: {
  corte: CorteDetalleDTO;
  onImprimir: (tamano: Tamano) => void;
}) {
  const { data: r, isLoading, error } = useRequerimiento(corte.id);
  const elegir = useElegirHilos();

  const elegirHilo = (titulo: TituloHilo, id: string) => {
    if (!r) return;
    const actuales = Object.fromEntries(r.hilos.map((h) => [h.titulo, h.elegido?.id ?? null]));
    elegir.mutate({ corteId: corte.id, input: { hilos: { ...actuales, [titulo]: id || null } } });
  };

  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 px-5 py-3">
        <div>
          <div className="text-sm font-semibold">Requerimiento de insumos</div>
          <div className="text-xs text-gray-500">
            Qué comprar para este corte, en bolsas / rollos / conos completos y descontando lo que hay
            en inventario · no registra compras
          </div>
        </div>
        {r && <BotonImprimir texto="Imprimir" alElegir={onImprimir} />}
      </div>

      {isLoading && <p className="px-5 py-4 text-sm text-gray-500">Calculando…</p>}
      {error != null && <p className="px-5 py-4 text-sm text-error">{mensaje(error)}</p>}

      {r && (
        <div className="space-y-4 px-5 py-4">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-600">
            <span>
              Ficha:{' '}
              {r.ficha ? (
                <Link to={`/costos/fichas/${r.ficha.id}`} className="font-medium text-acento hover:underline">
                  {r.ficha.nombre}
                </Link>
              ) : (
                <span className="font-medium text-amber-700">sin ficha</span>
              )}
            </span>
            <span>
              Cierres:{' '}
              {r.reglaCierres === 'ficha' ? 'regla de la ficha' : 'regla general (hasta 44: 12 · 46–48: 15 · 50+: 18 cm)'}
            </span>
            <span>{r.prendas} prendas</span>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            {r.hilos.map((h) => (
              <label key={h.titulo} className="text-xs">
                <span className="mb-1 block font-medium text-gray-600">Hilo {h.titulo}</span>
                <select
                  value={h.elegido?.id ?? ''}
                  onChange={(e) => elegirHilo(h.titulo, e.target.value)}
                  disabled={elegir.isPending}
                  className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-acento"
                >
                  <option value="">Elegir color…</option>
                  {h.opciones.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nombre}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            {elegir.error != null && <span className="text-xs text-error">{mensaje(elegir.error)}</span>}
          </div>

          <TablaRequerimiento r={r} />

          {r.avisos.length > 0 && (
            <ul className="space-y-1 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {r.avisos.map((a) => (
                <li key={a}>• {a}</li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-gray-400">
            "Hay" sale del stock de Costos → Insumos (último conteo + compras − consumo). Sin conteo
            físico puede estar inflado.
          </p>
        </div>
      )}
    </div>
  );
}

function TablaRequerimiento({ r }: { r: RequerimientoCorteDTO }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
            <th className="py-1.5 pr-3">Insumo</th>
            <th className="px-3 py-1.5 text-right">Necesita</th>
            <th className="px-3 py-1.5 text-right">Hay</th>
            <th className="px-3 py-1.5 text-right">Falta</th>
            <th className="px-3 py-1.5 text-right" title="Envases completos × unidades del envase">
              Comprar
            </th>
            <th className="px-3 py-1.5 text-right">Sobran</th>
            <th className="px-3 py-1.5 text-right">Precio envase</th>
            <th className="py-1.5 pl-3 text-right">Monto</th>
          </tr>
        </thead>
        {GRUPOS.map((g) => {
          const lineas = r.lineas.filter((l) => l.grupo === g);
          if (lineas.length === 0) return null;
          return (
            <tbody key={g}>
              <tr>
                <td colSpan={8} className="pt-3 pb-1 text-xs font-bold tracking-wide text-gray-500 uppercase">
                  {g}
                </td>
              </tr>
              {lineas.map((l, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-1.5 pr-3">
                    <span className={l.insumoId ? 'font-medium' : 'font-medium text-amber-700'}>{l.nombre}</span>
                    <span className="ml-2 text-xs text-gray-400">{l.detalle}</span>
                  </td>
                  <td className="mono px-3 py-1.5 text-right">{l.necesita}</td>
                  <td className="mono px-3 py-1.5 text-right text-gray-500">{l.hay ?? '—'}</td>
                  <td className="mono px-3 py-1.5 text-right">{l.falta}</td>
                  <td className="mono px-3 py-1.5 text-right font-semibold">{l.insumoId ? textoCompra(l) : '—'}</td>
                  <td className="mono px-3 py-1.5 text-right text-gray-500">{l.sobran || ''}</td>
                  <td className="mono px-3 py-1.5 text-right text-gray-500">
                    {l.precioEnvase != null ? formatBs(l.precioEnvase) : '—'}
                  </td>
                  <td className="mono py-1.5 pl-3 text-right font-semibold">
                    {l.monto != null ? formatBs(l.monto) : <span className="text-amber-700">sin precio</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          );
        })}
        <tfoot>
          <tr className="border-t-2 border-gray-300 font-semibold">
            <td colSpan={7} className="py-2 pr-3 text-right">
              Total a comprar{r.sinPrecio > 0 && <span className="font-normal text-amber-700"> ({r.sinPrecio} sin precio, no suman)</span>}
            </td>
            <td className="mono py-2 pl-3 text-right text-base">Bs {formatBs(r.total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Hoja para ir a comprar (solo se ve al imprimir). */
export function HojaRequerimiento({ corte }: { corte: CorteDetalleDTO }) {
  const { data: r } = useRequerimiento(corte.id);
  if (!r) return null;
  return (
    <HojaOficio
      titulo={`Requerimiento de insumos · COD ${corte.codigo}`}
      detalle={`${corte.modeloNombre} · ${r.prendas} prendas`}
      resumen={`Bs ${formatBs(r.total)}`}
      tamanoLetra="11pt"
    >
      <table>
        <thead>
          <tr>
            <th>Insumo</th>
            <th>Detalle</th>
            <th className="num">Necesita</th>
            <th className="num">Hay</th>
            <th className="num">Comprar</th>
            <th className="num">Sobran</th>
            <th className="num">Precio</th>
            <th className="num">Monto</th>
          </tr>
        </thead>
        <tbody>
          {GRUPOS.flatMap((g) => {
            const lineas = r.lineas.filter((l) => l.grupo === g);
            if (lineas.length === 0) return [];
            return [
              <tr key={g} className="grupo">
                <td colSpan={8}>{g}</td>
              </tr>,
              ...lineas.map((l, i) => (
                <tr key={`${g}${i}`}>
                  <td style={{ fontWeight: 600 }}>{l.nombre}</td>
                  <td className="tenue">{l.detalle}</td>
                  <td className="num">{l.necesita}</td>
                  <td className="num tenue">{l.hay ?? '—'}</td>
                  <td className="num" style={{ fontWeight: 700 }}>
                    {l.insumoId ? textoCompra(l) : '—'}
                  </td>
                  <td className="num tenue">{l.sobran || ''}</td>
                  <td className="num">{l.precioEnvase != null ? formatBs(l.precioEnvase) : '—'}</td>
                  <td className="num">{l.monto != null ? formatBs(l.monto) : 'sin precio'}</td>
                </tr>
              )),
            ];
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={7}>Total a comprar</td>
            <td className="num">Bs {formatBs(r.total)}</td>
          </tr>
        </tfoot>
      </table>
      {r.avisos.length > 0 && (
        <div style={{ marginTop: '10pt', fontSize: '9pt' }}>
          {r.avisos.map((a) => (
            <div key={a}>• {a}</div>
          ))}
        </div>
      )}
    </HojaOficio>
  );
}
