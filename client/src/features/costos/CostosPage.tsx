import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { formatBs } from '@taller/shared';
import { useFichasCosto } from '../../api/costos';
import { useConfiguracion } from '../../api/configuracion';
import { TABLA } from '../../components/tabla';
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
  const { data: config } = useConfiguracion();
  const navigate = useNavigate();
  const tasa = config ? (config.tasaCambioUsd / 10_000).toFixed(2) : null;
  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-xs text-gray-500">
          {tasa && <>Docena en dólares con el tipo de cambio {tasa} (se cambia en Configuración).</>}
        </div>
        <button
          onClick={() => navigate('/costos/fichas/nueva')}
          className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-[#265dc2]"
        >
          + Nueva ficha de costo
        </button>
      </div>
      <div className={TABLA.contenedor}>
        <table className="text-sm">
          <thead className={TABLA.cabecera}>
            <tr className={TABLA.filaCabecera}>
              <th className="px-3 py-2.5">Código</th>
              <th className="px-3 py-2.5">Modelo</th>
              <th className="px-3 py-2.5">Vinculado a</th>
              <th className="px-3 py-2.5 text-right">Costo por prenda</th>
              <th className="px-3 py-2.5 text-right">Precio de venta</th>
              <th className="px-3 py-2.5 text-right" title={tasa ? `Tipo de cambio ${tasa} (Configuración)` : undefined}>
                Costo docena $us
              </th>
              <th className="px-3 py-2.5 text-right" title={tasa ? `Tipo de cambio ${tasa} (Configuración)` : undefined}>
                Venta docena $us
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-gray-500">
                  Cargando…
                </td>
              </tr>
            )}
            {fichas?.map((f) => (
              <tr key={f.id} className={TABLA.fila}>
                <td className="mono px-3 py-2 text-gray-500">{f.codigo ?? '—'}</td>
                <td className="max-w-[280px] px-3 py-2">
                  <Link to={`/costos/fichas/${f.id}`} className="font-medium text-acento hover:underline">
                    {f.nombre}
                  </Link>
                </td>
                <td className="max-w-[200px] px-3 py-2 text-gray-500">{f.modelo?.nombre ?? '—'}</td>
                <td className="mono px-3 py-2 text-right font-semibold whitespace-nowrap">
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
                <td className="mono px-3 py-2 text-right whitespace-nowrap text-ok">Bs {formatBs(f.precioVenta)}</td>
                <td className="mono px-3 py-2 text-right whitespace-nowrap">$us {formatBs(f.costoDocenaUsd)}</td>
                <td className="mono px-3 py-2 text-right font-semibold whitespace-nowrap text-ok">
                  $us {formatBs(f.ventaDocenaUsd)}
                </td>
              </tr>
            ))}
            {fichas?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-gray-500">
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
