import { Link, useNavigate } from 'react-router-dom';
import { formatBs } from '@taller/shared';
import { useFichasCosto } from '../../api/costos';
import { useConfiguracion } from '../../api/configuracion';
import { PaginaPestanas } from '../../components/PaginaPestanas';
import { TABLA } from '../../components/tabla';
import { ComprasTab } from './ComprasTab';
import { CortesCostoTab } from './CortesCostoTab';
import { FijosTab } from './FijosTab';
import { InsumosTab } from './InsumosTab';
import { ProyeccionTab } from './ProyeccionTab';
import { ProveedoresTab } from './ProveedoresTab';
import { ProductoTerminadoTab } from './ProductoTerminadoTab';

// Páginas del módulo Costos (docs/PLAN_COSTOS.md), repartidas por área del
// menú: Costos (fichas, costo real, proyección), Compras, Inventario y Costos
// fijos (Finanzas). Solo consulta: nada de esto toca los pagos.

export function CostosPage() {
  return (
    <PaginaPestanas
      titulo="Costos de producción"
      descripcion="Cuánto cuesta producir cada prenda hoy: materiales con el precio de la última compra, mano de obra, empaque y servicio de corte del sistema, y el precio de venta con el margen. Solo consulta: no cambia ningún pago."
      pestanas={[
        { clave: 'fichas', etiqueta: 'Fichas de costo', contenido: () => <FichasTab /> },
        { clave: 'cortes', etiqueta: 'Costo real de cortes', contenido: () => <CortesCostoTab /> },
        { clave: 'proyeccion', etiqueta: 'Proyección del mes', contenido: () => <ProyeccionTab /> },
      ]}
    />
  );
}

export function ComprasPage() {
  return (
    <PaginaPestanas
      titulo="Compras"
      descripcion="Lo que comprás para producir: telas, hilos, cierres, botones… al contado o a crédito, y lo que le debés a cada proveedor."
      pestanas={[
        { clave: 'compras', etiqueta: 'Compras', contenido: () => <ComprasTab /> },
        { clave: 'proveedores', etiqueta: 'Deudas a proveedores', contenido: () => <ProveedoresTab /> },
      ]}
    />
  );
}

export function InventarioPage() {
  return (
    <PaginaPestanas
      titulo="Inventario"
      descripcion="Lo que tenés en el depósito: telas e insumos (último conteo + compras − lo que gastó cada corte) y prendas terminadas sin despachar."
      pestanas={[
        { clave: 'materia_prima', etiqueta: 'Materia prima (telas)', contenido: () => <InsumosTab alcance="materia_prima" /> },
        { clave: 'insumos', etiqueta: 'Insumos', contenido: () => <InsumosTab alcance="insumos" /> },
        { clave: 'terminado', etiqueta: 'Producto terminado', contenido: () => <ProductoTerminadoTab /> },
      ]}
    />
  );
}

export function CostosFijosPage() {
  return (
    <PaginaPestanas
      titulo="Costos fijos"
      descripcion="Lo que cuesta mantener el taller cada mes (la parte del taller de cada gasto) y la cuota del préstamo, repartidos por prenda en las fichas."
      pestanas={[{ clave: 'fijos', etiqueta: 'Costos fijos', contenido: () => <FijosTab />, imprimeSola: true }]}
    />
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
