import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { formatBs, type CorteDineroDTO } from '@taller/shared';
import { useDeposito } from '../../api/dinero';
import { TABLA } from '../../components/tabla';
import { enDocenas } from './formato';

// Producto terminado (docs/PLAN_TABLERO_DINERO.md): prendas de los cortes
// cerrados que todavía no se despacharon, agrupadas por modelo. Se venden en
// docenas surtidas: se muestra en docenas y sueltas. Sale de los despachos.

const bs = (c: number) => `Bs ${formatBs(c)}`;

export function ProductoTerminadoTab() {
  const { data: cortes, isLoading } = useDeposito();
  const porModelo = new Map<string, CorteDineroDTO[]>();
  for (const c of cortes ?? []) porModelo.set(c.modeloNombre, [...(porModelo.get(c.modeloNombre) ?? []), c]);
  const grupos = [...porModelo].sort((a, b) => a[0].localeCompare(b[0], 'es'));
  const total = (cs: CorteDineroDTO[]) => ({
    prendas: cs.reduce((a, c) => a + c.disponibles, 0),
    costo: cs.reduce((a, c) => a + c.costo, 0),
    venta: cs.some((c) => c.venta == null) ? null : cs.reduce((a, c) => a + c.venta!, 0),
  });
  const todo = total(cortes ?? []);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          {todo.prendas.toLocaleString('es-BO')} prendas ({enDocenas(todo.prendas)}) · invertido{' '}
          <span className="mono font-semibold">{bs(todo.costo)}</span>
          {todo.venta != null && (
            <>
              {' '}
              · valen <span className="mono font-semibold text-ok">{bs(todo.venta)}</span>
            </>
          )}
        </p>
        <Link to="/ventas?tab=despachos" className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-[#265dc2]">
          Registrar despacho
        </Link>
      </div>
      <div className={TABLA.contenedor}>
        <table className="text-sm">
          <thead className={TABLA.cabecera}>
            <tr className={TABLA.filaCabecera}>
              <th className="px-3 py-2.5">Modelo · corte</th>
              <th className="px-3 py-2.5 text-right">Disponibles</th>
              <th className="px-3 py-2.5 text-right">Docenas</th>
              <th className="px-3 py-2.5 text-right">Costo por prenda</th>
              <th className="px-3 py-2.5 text-right">Invertido</th>
              <th className="px-3 py-2.5 text-right">Valen</th>
            </tr>
          </thead>
          {isLoading && (
            <tbody>
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-gray-500">
                  Cargando…
                </td>
              </tr>
            </tbody>
          )}
          {grupos.map(([modelo, cs]) => {
            const t = total(cs);
            return (
              <Fragment key={modelo}>
                <tbody>
                  <tr className="bg-gray-200/70 font-semibold">
                    <td className="px-3 py-1.5">{modelo}</td>
                    <td className="mono px-3 py-1.5 text-right">{t.prendas}</td>
                    <td className="mono px-3 py-1.5 text-right whitespace-nowrap">{enDocenas(t.prendas)}</td>
                    <td />
                    <td className="mono px-3 py-1.5 text-right whitespace-nowrap">{bs(t.costo)}</td>
                    <td className="mono px-3 py-1.5 text-right whitespace-nowrap text-ok">{t.venta != null ? bs(t.venta) : '—'}</td>
                  </tr>
                  {cs.map((c) => (
                    <tr key={c.corteId} className={TABLA.fila}>
                      <td className="px-3 py-1.5 pl-6">
                        <Link to={`/cortes/${c.corteId}`} className="text-acento hover:underline">
                          COD {c.codigo}
                        </Link>
                        <span className="ml-1 text-xs text-gray-500">
                          {c.despachadas > 0 ? `· ${c.despachadas} de ${c.prendas} ya despachadas` : `· ${c.prendas} prendas`}
                          {c.etapa === 'servicios' && ` · con prendas en ${c.serviciosPendientes.join(', ')}`}
                        </span>
                      </td>
                      <td className="mono px-3 py-1.5 text-right">{c.disponibles}</td>
                      <td className="mono px-3 py-1.5 text-right whitespace-nowrap">{enDocenas(c.disponibles)}</td>
                      <td className="mono px-3 py-1.5 text-right whitespace-nowrap">{bs(c.costoPrenda)}</td>
                      <td className="mono px-3 py-1.5 text-right whitespace-nowrap">{bs(c.costo)}</td>
                      <td className="mono px-3 py-1.5 text-right whitespace-nowrap text-ok">
                        {c.venta != null ? bs(c.venta) : <span className="text-xs text-gray-400">sin ficha</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Fragment>
            );
          })}
          {!isLoading && grupos.length === 0 && (
            <tbody>
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-gray-500">
                  No hay prendas terminadas en el depósito.
                </td>
              </tr>
            </tbody>
          )}
        </table>
      </div>
    </>
  );
}
