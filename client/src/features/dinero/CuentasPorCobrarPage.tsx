import { useState } from 'react';
import { formatBs } from '@taller/shared';
import { useCuentasPorCobrar } from '../../api/dinero';
import { TABLA } from '../../components/tabla';
import { ModalCobro } from './VentasPage';

// Cuentas por cobrar (docs/PLAN_TABLERO_DINERO.md): despachos que los clientes
// todavía no terminaron de pagar, por fecha de cobro. Los cobros de un cliente
// cancelan primero sus despachos más viejos.

const bs = (c: number) => `Bs ${formatBs(c)}`;
const fechaCorta = (dia: string) => dia.split('-').reverse().join('/');
const dias = (hoy: string, vence: string) =>
  Math.round((Date.parse(`${vence}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)) / 86_400_000);

export function CuentasPorCobrarPage() {
  const { data: d, isLoading, error } = useCuentasPorCobrar();
  const [cobrar, setCobrar] = useState<string | null>(null); // cliente
  const tarjeta = (titulo: string, monto: number, clase: string, ayuda: string) => (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">{titulo}</div>
      <div className={`mono mt-1 text-xl font-semibold ${clase}`}>{bs(monto)}</div>
      <div className="text-[11px] text-gray-400">{ayuda}</div>
    </div>
  );
  // por cliente: cuánto debe y cuánto ya venció
  const porCliente = new Map<string, { nombre: string; celular: string | null; total: number; vencido: number }>();
  for (const i of d?.items ?? []) {
    const c = porCliente.get(i.cliente.id) ?? { nombre: i.cliente.nombre, celular: i.cliente.celular, total: 0, vencido: 0 };
    c.total += i.pendiente;
    if (i.vence < d!.hoy) c.vencido += i.pendiente;
    porCliente.set(i.cliente.id, c);
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Cuentas por cobrar</h1>
      <p className="mt-1 text-sm text-gray-500">
        Lo que te deben tus clientes, despacho por despacho, por fecha de cobro. Cada cobro paga primero los despachos más
        viejos del cliente.
      </p>
      {isLoading && <div className="mt-4 text-sm text-gray-500">Cargando…</div>}
      {error && <div className="mt-4 text-sm text-error">No se pudo cargar ({String(error)})</div>}
      {d && (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {tarjeta('Vencido', d.vencido, d.vencido > 0 ? 'text-error' : '', 'ya tendrían que haberte pagado')}
            {tarjeta('Cobrar esta semana', d.semana, d.semana > 0 ? 'text-amber-700' : '', 'vence en los próximos 7 días')}
            {tarjeta('Total que te deben', d.total, 'text-acento', `${porCliente.size} cliente(s)`)}
          </div>

          {porCliente.size > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {[...porCliente]
                .sort((a, b) => b[1].vencido - a[1].vencido || b[1].total - a[1].total)
                .map(([id, c]) => (
                  <button
                    key={id}
                    onClick={() => setCobrar(id)}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm shadow-sm hover:border-acento"
                  >
                    <div className="font-medium">{c.nombre}</div>
                    <div className="mono text-xs">
                      debe {formatBs(c.total)}
                      {c.vencido > 0 && <span className="ml-1 text-error">· vencido {formatBs(c.vencido)}</span>}
                    </div>
                    {c.celular && <div className="text-[11px] text-gray-400">{c.celular}</div>}
                  </button>
                ))}
            </div>
          )}

          <div className={`mt-4 ${TABLA.contenedorPagina}`}>
            <table className="text-sm">
              <thead className={TABLA.cabecera}>
                <tr className={TABLA.filaCabecera}>
                  <th className="px-3 py-2.5">Vence</th>
                  <th className="px-3 py-2.5">Cliente</th>
                  <th className="px-3 py-2.5">Despacho</th>
                  <th className="px-3 py-2.5 text-right">Total</th>
                  <th className="px-3 py-2.5 text-right">Ya pagó</th>
                  <th className="px-3 py-2.5 text-right">Falta</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {d.items.map((i) => {
                  const n = dias(d.hoy, i.vence);
                  const estado =
                    n < 0
                      ? { texto: `vencido hace ${-n} día(s)`, clase: 'text-error font-semibold' }
                      : n === 0
                        ? { texto: 'vence hoy', clase: 'text-error font-semibold' }
                        : n <= 7
                          ? { texto: `en ${n} día(s)`, clase: 'text-amber-700 font-semibold' }
                          : { texto: `en ${n} días`, clase: 'text-gray-500' };
                  return (
                    <tr key={i.despachoId} className={TABLA.fila}>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {fechaCorta(i.vence)}
                        <div className={`text-[11px] ${estado.clase}`}>{estado.texto}</div>
                      </td>
                      <td className="max-w-[180px] px-3 py-2 font-medium">{i.cliente.nombre}</td>
                      <td className="max-w-[300px] px-3 py-2 text-gray-600">
                        <span className="text-xs text-gray-400">{fechaCorta(i.fecha)} · </span>
                        {i.detalle}
                      </td>
                      <td className="mono px-3 py-2 text-right whitespace-nowrap">{bs(i.total)}</td>
                      <td className="mono px-3 py-2 text-right whitespace-nowrap text-ok">{i.cobrado > 0 ? bs(i.cobrado) : '—'}</td>
                      <td className="mono px-3 py-2 text-right font-semibold whitespace-nowrap">{bs(i.pendiente)}</td>
                      <td className="px-3 py-2 text-right text-[13px] font-medium">
                        <button onClick={() => setCobrar(i.cliente.id)} className="text-acento hover:underline">
                          Cobrar
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {d.items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-gray-500">
                      Nadie te debe. Los despachos aparecen acá hasta que el cliente los termina de pagar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {d.adelantos.length > 0 && (
            <p className="mt-3 text-xs text-gray-600">
              Pagaron de más (a cuenta de lo próximo):{' '}
              {d.adelantos.map((a) => `${a.nombre} ${formatBs(a.monto)}`).join(' · ')}
            </p>
          )}
        </>
      )}
      {cobrar && <ModalCobro clienteId={cobrar} onCerrar={() => setCobrar(null)} />}
    </div>
  );
}
