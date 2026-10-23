import { Link } from 'react-router-dom';
import { formatBs, type CuentaPorPagarDTO } from '@taller/shared';
import { useCuentasPorPagar } from '../../api/dinero';
import { TABLA } from '../../components/tabla';

// Cuentas por pagar (docs/PLAN_TABLERO_DINERO.md): todo lo que debés en un
// solo lugar, por fecha de vencimiento. Cada renglón lleva a donde se paga.

const bs = (c: number) => `Bs ${formatBs(c)}`;
const fechaCorta = (dia: string) => dia.split('-').reverse().join('/');
const TIPO: Record<CuentaPorPagarDTO['tipo'], string> = {
  proveedor: 'Proveedor',
  servicio: 'Servicio externo',
  operarios: 'Operarios',
  banco: 'Banco',
};

/** Días entre hoy y el vencimiento (negativo = vencida). */
const dias = (hoy: string, vence: string) =>
  Math.round((Date.parse(`${vence}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)) / 86_400_000);

export function CuentasPorPagarPage() {
  const { data: d, isLoading, error } = useCuentasPorPagar();
  const tarjeta = (titulo: string, monto: number, clase: string, ayuda: string) => (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">{titulo}</div>
      <div className={`mono mt-1 text-xl font-semibold ${clase}`}>{bs(monto)}</div>
      <div className="text-[11px] text-gray-400">{ayuda}</div>
    </div>
  );

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Cuentas por pagar</h1>
      <p className="mt-1 text-sm text-gray-500">
        Todo lo que debés, por fecha de vencimiento: proveedores (compras a crédito), servicios externos, operarios y la
        cuota del banco.
      </p>
      {isLoading && <div className="mt-4 text-sm text-gray-500">Cargando…</div>}
      {error && <div className="mt-4 text-sm text-error">No se pudo cargar ({String(error)})</div>}
      {d && (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {tarjeta('Vencido', d.vencido, d.vencido > 0 ? 'text-error' : '', 'ya pasó la fecha')}
            {tarjeta('Vence esta semana', d.semana, d.semana > 0 ? 'text-amber-700' : '', 'en los próximos 7 días')}
            {tarjeta('Total que debés', d.total, '', 'sin el resto del préstamo')}
          </div>
          <div className={`mt-4 ${TABLA.contenedorPagina}`}>
            <table className="text-sm">
              <thead className={TABLA.cabecera}>
                <tr className={TABLA.filaCabecera}>
                  <th className="px-3 py-2.5">Vence</th>
                  <th className="px-3 py-2.5">A quién</th>
                  <th className="px-3 py-2.5">Qué</th>
                  <th className="px-3 py-2.5 text-right">Monto</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {d.items.map((i) => {
                  const n = i.vence ? dias(d.hoy, i.vence) : null;
                  const estado =
                    n == null
                      ? { texto: 'sin fecha', clase: 'text-gray-400' }
                      : n < 0
                        ? { texto: `vencida hace ${-n} día(s)`, clase: 'text-error font-semibold' }
                        : n === 0
                          ? { texto: 'vence hoy', clase: 'text-error font-semibold' }
                          : n <= 7
                            ? { texto: `en ${n} día(s)`, clase: 'text-amber-700 font-semibold' }
                            : { texto: `en ${n} días`, clase: 'text-gray-500' };
                  return (
                    <tr key={i.id} className={TABLA.fila}>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {i.vence ? fechaCorta(i.vence) : '—'}
                        <div className={`text-[11px] ${estado.clase}`}>{estado.texto}</div>
                      </td>
                      <td className="max-w-[200px] px-3 py-2">
                        <div className="font-medium">{i.acreedor}</div>
                        <div className="text-[11px] text-gray-400">{TIPO[i.tipo]}</div>
                      </td>
                      <td className="max-w-[320px] px-3 py-2 text-gray-600">{i.detalle}</td>
                      <td className="mono px-3 py-2 text-right font-semibold whitespace-nowrap">{bs(i.monto)}</td>
                      <td className="px-3 py-2 text-right text-[13px] font-medium whitespace-nowrap">
                        <Link to={i.enlace} className="text-acento hover:underline">
                          Pagar
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {d.items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-gray-500">
                      No debés nada pendiente. Las compras a crédito aparecen acá cuando las marcás así en Compras.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            A cada proveedor sus pagos le cancelan primero las compras más viejas. Servicios externos y operarios: lo que se
            les debe del mes, se paga al cerrar el mes en Liquidación.
          </p>
        </>
      )}
    </div>
  );
}
