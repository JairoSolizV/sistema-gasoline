import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { formatBs } from '@taller/shared';
import { useFichasCosto } from '../../api/costos';
import { ComprasTab } from './ComprasTab';
import { CortesCostoTab } from './CortesCostoTab';
import { FijosTab } from './FijosTab';
import { InsumosTab } from './InsumosTab';
import { ProyeccionTab } from './ProyeccionTab';

// Costos de producción (docs/PLAN_COSTOS.md). Solo consulta: nada de esto toca
// los pagos. Pestañas: fichas de costo por modelo, insumos y compras.

const PESTANAS = [
  { clave: 'fichas', etiqueta: 'Fichas de costo' },
  { clave: 'insumos', etiqueta: 'Insumos' },
  { clave: 'compras', etiqueta: 'Compras' },
  { clave: 'cortes', etiqueta: 'Costo real de cortes' },
  { clave: 'proyeccion', etiqueta: 'Proyección del mes' },
  { clave: 'fijos', etiqueta: 'Costos fijos' },
] as const;
type Pestana = (typeof PESTANAS)[number]['clave'];

export function CostosPage() {
  const [parametros, setParametros] = useSearchParams();
  const pedida = parametros.get('tab') as Pestana | null;
  const activa: Pestana = PESTANAS.some((p) => p.clave === pedida) ? pedida! : 'fichas';

  // Costos fijos imprime su propia hoja oficio: el resto de la página no sale
  const soloHoja = activa === 'fijos' ? 'print:hidden' : '';

  return (
    <div className="p-8 print:p-0">
      <h1 className={`text-2xl font-semibold ${soloHoja}`}>Costos de producción</h1>
      <p className={`mt-1 text-sm text-gray-500 ${soloHoja}`}>
        Cuánto cuesta producir cada prenda hoy: materiales con el precio de la última compra, mano
        de obra, empaque y servicio de corte del sistema, y el precio de venta con el margen. Solo
        consulta: no cambia ningún pago.
      </p>
      <div className={`mt-5 flex gap-1 border-b border-gray-200 ${soloHoja}`}>
        {PESTANAS.map((p) => (
          <button
            key={p.clave}
            onClick={() => setParametros({ tab: p.clave }, { replace: true })}
            className={`-mb-px rounded-t-lg border px-4 py-2 text-sm ${
              p.clave === activa
                ? 'border-gray-200 border-b-white bg-white font-semibold'
                : 'border-transparent text-gray-600 hover:bg-gray-50'
            }`}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>
      <div className="mt-4 print:mt-0">
        {activa === 'fichas' && <FichasTab />}
        {activa === 'insumos' && <InsumosTab />}
        {activa === 'compras' && <ComprasTab />}
        {activa === 'cortes' && <CortesCostoTab />}
        {activa === 'proyeccion' && <ProyeccionTab />}
        {activa === 'fijos' && <FijosTab />}
      </div>
    </div>
  );
}

function FichasTab() {
  const { data: fichas, isLoading } = useFichasCosto();
  const navigate = useNavigate();
  return (
    <>
      <div className="mb-3 flex justify-end">
        <button
          onClick={() => navigate('/costos/fichas/nueva')}
          className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-[#265dc2]"
        >
          + Nueva ficha de costo
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
              <th className="px-5 py-3">Código</th>
              <th className="px-3 py-3">Modelo</th>
              <th className="px-3 py-3">Vinculado a</th>
              <th className="px-3 py-3 text-right">Costo por prenda</th>
              <th className="px-5 py-3 text-right">Precio de venta</th>
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
            {fichas?.map((f) => (
              <tr key={f.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
                <td className="mono px-5 py-2.5 text-gray-500">{f.codigo ?? '—'}</td>
                <td className="px-3 py-2.5">
                  <Link to={`/costos/fichas/${f.id}`} className="font-medium text-acento hover:underline">
                    {f.nombre}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-gray-500">{f.modelo?.nombre ?? '—'}</td>
                <td className="mono px-3 py-2.5 text-right font-semibold">
                  Bs {formatBs(f.total)}
                  {f.incompleto && (
                    <span
                      title="Hay insumos sin precio: el costo es parcial"
                      className="ml-1 text-[10px] font-semibold text-amber-700"
                    >
                      incompleto
                    </span>
                  )}
                </td>
                <td className="mono px-5 py-2.5 text-right text-ok">Bs {formatBs(f.precioVenta)}</td>
              </tr>
            ))}
            {fichas?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-gray-500">
                  Todavía no hay fichas de costo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
