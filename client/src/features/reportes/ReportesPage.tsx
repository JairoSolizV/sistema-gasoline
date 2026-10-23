import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  formatBs,
  type ComprasReporteDTO,
  type GananciaModeloDTO,
  type ProduccionReporteDTO,
  type VentasReporteDTO,
} from '@taller/shared';
import { api } from '../../api/client';
import { TABLA } from '../../components/tabla';
import { MESES } from '../../lib/meses';
import { enDocenas } from '../costos/formato';

// Reportes para analizar después (docs/PLAN_DIDACTICO_REPORTES.md): ventas y
// cobros, producción, compras y gastos, ganancia por modelo. Se elige el rango
// de meses; todo se imprime con el botón de arriba (oficio o medio oficio).

const PESTANAS = [
  { clave: 'ventas', etiqueta: '💰 Ventas y cobros' },
  { clave: 'produccion', etiqueta: '✂️ Producción' },
  { clave: 'compras', etiqueta: '🧶 Compras y gastos' },
  { clave: 'ganancia', etiqueta: '📈 Ganancia por modelo' },
] as const;
type Clave = (typeof PESTANAS)[number]['clave'];

const bs = (c: number) => formatBs(c);
const nombreMes = (m: string) => `${MESES[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
const pct = (c: number) => `${(c / 100).toFixed(1)} %`;
const mesActual = () => new Date().toISOString().slice(0, 7);
const haceMeses = (n: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 7);
};

function useReporte<T>(tipo: Clave, desde: string, hasta: string) {
  return useQuery({
    queryKey: ['reportes', tipo, desde, hasta],
    queryFn: () => api<T>(`/reportes/${tipo}?desde=${desde}&hasta=${hasta}`),
    enabled: desde <= hasta,
  });
}

export function ReportesPage() {
  const [parametros, setParametros] = useSearchParams();
  const activa: Clave = (PESTANAS.find((p) => p.clave === parametros.get('tab'))?.clave ?? 'ventas') as Clave;
  const [desde, setDesde] = useState(haceMeses(5));
  const [hasta, setHasta] = useState(mesActual());

  return (
    <div className="p-8 print:p-0">
      <h1 className="text-2xl font-semibold">Reportes</h1>
      <p className="mt-1 text-sm text-gray-600 print:hidden">
        Para mirar cómo te fue mes a mes y decidir qué hacer. Elegí desde qué mes hasta qué mes, y la pestaña del reporte.
      </p>
      <p className="hidden text-sm print:block">
        {PESTANAS.find((p) => p.clave === activa)!.etiqueta} · de {nombreMes(desde)} a {nombreMes(hasta)}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3 print:hidden">
        <label className="text-sm text-gray-600">
          Desde{' '}
          <input type="month" value={desde} onChange={(e) => setDesde(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="text-sm text-gray-600">
          Hasta{' '}
          <input type="month" value={hasta} onChange={(e) => setHasta(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
        </label>
        {desde > hasta && <span className="text-sm text-error">"Desde" tiene que ser antes que "hasta"</span>}
      </div>
      <div className="mt-4 flex flex-wrap gap-1 border-b border-gray-200 print:hidden">
        {PESTANAS.map((p) => (
          <button
            key={p.clave}
            onClick={() => setParametros({ tab: p.clave }, { replace: true })}
            className={`-mb-px rounded-t-lg border px-4 py-2 text-sm ${
              p.clave === activa ? 'border-gray-200 border-b-white bg-white font-semibold' : 'border-transparent text-gray-600 hover:bg-gray-50'
            }`}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {activa === 'ventas' && <Ventas desde={desde} hasta={hasta} />}
        {activa === 'produccion' && <Produccion desde={desde} hasta={hasta} />}
        {activa === 'compras' && <Compras desde={desde} hasta={hasta} />}
        {activa === 'ganancia' && <Ganancia desde={desde} hasta={hasta} />}
      </div>
    </div>
  );
}

// ── piezas comunes ──

function Seccion({ titulo, ayuda, children }: { titulo: string; ayuda?: string; children: ReactNode }) {
  return (
    <section className="mb-6 break-inside-avoid">
      <h2 className="text-base font-semibold">{titulo}</h2>
      {ayuda && <p className="mb-2 text-xs text-gray-500">{ayuda}</p>}
      {children}
    </section>
  );
}

/** Número con una barrita proporcional al más grande de la columna. */
function ConBarra({ valor, max, color = '#378ADD', texto }: { valor: number; max: number; color?: string; texto: string }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-gray-100 print:hidden">
        <div className="h-full rounded-full" style={{ width: `${max > 0 ? Math.max(0, (valor / max) * 100) : 0}%`, background: color }} />
      </div>
      <span className="mono whitespace-nowrap">{texto}</span>
    </div>
  );
}

function Tabla({ cabeceras, children, pie }: { cabeceras: { texto: string; derecha?: boolean }[]; children: ReactNode; pie?: ReactNode }) {
  return (
    <div className={TABLA.contenedorPagina}>
      <table className="text-sm">
        <thead className={TABLA.cabecera}>
          <tr className={TABLA.filaCabecera}>
            {cabeceras.map((c) => (
              <th key={c.texto} className={`px-3 py-2.5 ${c.derecha ? 'text-right' : ''}`}>
                {c.texto}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
        {pie && <tfoot>{pie}</tfoot>}
      </table>
    </div>
  );
}

const Td = ({ children, derecha, clase = '' }: { children: ReactNode; derecha?: boolean; clase?: string }) => (
  <td className={`px-3 py-1.5 ${derecha ? 'mono text-right whitespace-nowrap' : ''} ${clase}`}>{children}</td>
);
const filaTotal = 'border-t-2 border-gray-300 bg-gray-50 font-semibold';
const Cargando = ({ cargando }: { cargando: boolean }) => (cargando ? <div className="text-sm text-gray-500">Cargando…</div> : null);
const max = (xs: number[]) => Math.max(0, ...xs);

// ── Ventas y cobros ──

function Ventas({ desde, hasta }: { desde: string; hasta: string }) {
  const { data: r, isLoading } = useReporte<VentasReporteDTO>('ventas', desde, hasta);
  if (!r) return <Cargando cargando={isLoading} />;
  const t = r.meses.reduce(
    (a, m) => ({ prendas: a.prendas + m.prendas, vendido: a.vendido + m.vendido, ganancia: a.ganancia + m.ganancia, cobrado: a.cobrado + m.cobrado }),
    { prendas: 0, vendido: 0, ganancia: 0, cobrado: 0 },
  );
  return (
    <>
      <Seccion titulo="Mes por mes" ayuda="Vendido = lo que entregaste. Cobrado = la plata que te pagaron ese mes (puede ser de entregas anteriores).">
        <Tabla
          cabeceras={[{ texto: 'Mes' }, { texto: 'Prendas', derecha: true }, { texto: 'Vendido (Bs)', derecha: true }, { texto: 'Ganancia (Bs)', derecha: true }, { texto: 'Cobrado (Bs)', derecha: true }]}
          pie={
            <tr className={filaTotal}>
              <Td>Total</Td>
              <Td derecha>{enDocenas(t.prendas)}</Td>
              <Td derecha>{bs(t.vendido)}</Td>
              <Td derecha>{bs(t.ganancia)}</Td>
              <Td derecha>{bs(t.cobrado)}</Td>
            </tr>
          }
        >
          {r.meses.map((m) => (
            <tr key={m.mes} className={TABLA.fila}>
              <Td clase="capitalize">{nombreMes(m.mes)}</Td>
              <Td derecha>{m.prendas ? enDocenas(m.prendas) : '—'}</Td>
              <Td derecha>
                <ConBarra valor={m.vendido} max={max(r.meses.map((x) => x.vendido))} texto={bs(m.vendido)} color="#7F77DD" />
              </Td>
              <Td derecha clase={m.ganancia < 0 ? 'text-error' : 'text-ok'}>{bs(m.ganancia)}</Td>
              <Td derecha>
                <ConBarra valor={m.cobrado} max={max(r.meses.map((x) => x.cobrado))} texto={bs(m.cobrado)} color="#639922" />
              </Td>
            </tr>
          ))}
        </Tabla>
      </Seccion>
      <Seccion titulo="Por cliente" ayuda="Quién te compra más y quién te debe hoy.">
        <Tabla cabeceras={[{ texto: 'Cliente' }, { texto: 'Prendas', derecha: true }, { texto: 'Vendido (Bs)', derecha: true }, { texto: 'Cobrado (Bs)', derecha: true }, { texto: 'Te debe hoy (Bs)', derecha: true }]}>
          {r.clientes.map((c) => (
            <tr key={c.id} className={TABLA.fila}>
              <Td clase="max-w-[220px] font-medium">{c.nombre}</Td>
              <Td derecha>{enDocenas(c.prendas)}</Td>
              <Td derecha>
                <ConBarra valor={c.vendido} max={max(r.clientes.map((x) => x.vendido))} texto={bs(c.vendido)} color="#7F77DD" />
              </Td>
              <Td derecha>{bs(c.cobrado)}</Td>
              <Td derecha clase={c.debeHoy > 0 ? 'font-semibold text-acento' : 'text-gray-400'}>{bs(c.debeHoy)}</Td>
            </tr>
          ))}
          {r.clientes.length === 0 && <Vacio columnas={5} />}
        </Tabla>
      </Seccion>
      <Seccion titulo="Por modelo" ayuda="Qué modelos se vendieron más.">
        <Tabla cabeceras={[{ texto: 'Modelo' }, { texto: 'Prendas', derecha: true }, { texto: 'Vendido (Bs)', derecha: true }]}>
          {r.modelos.map((m) => (
            <tr key={m.modelo} className={TABLA.fila}>
              <Td clase="max-w-[280px] font-medium">{m.modelo}</Td>
              <Td derecha>{enDocenas(m.prendas)}</Td>
              <Td derecha>
                <ConBarra valor={m.vendido} max={max(r.modelos.map((x) => x.vendido))} texto={bs(m.vendido)} color="#7F77DD" />
              </Td>
            </tr>
          ))}
          {r.modelos.length === 0 && <Vacio columnas={3} />}
        </Tabla>
      </Seccion>
    </>
  );
}

const Vacio = ({ columnas }: { columnas: number }) => (
  <tr>
    <td colSpan={columnas} className="px-5 py-6 text-center text-gray-500">
      No hay datos en estos meses.
    </td>
  </tr>
);

// ── Producción ──

function Produccion({ desde, hasta }: { desde: string; hasta: string }) {
  const { data: r, isLoading } = useReporte<ProduccionReporteDTO>('produccion', desde, hasta);
  if (!r) return <Cargando cargando={isLoading} />;
  return (
    <>
      <Seccion titulo="Mes por mes" ayuda="Prendas terminadas = las de los cortes que se cerraron ese mes. Costura = lo que se pagó por coserlas.">
        <Tabla cabeceras={[{ texto: 'Mes' }, { texto: 'Cortes empezados', derecha: true }, { texto: 'Cortes cerrados', derecha: true }, { texto: 'Prendas terminadas', derecha: true }, { texto: 'Costura (Bs)', derecha: true }]}>
          {r.meses.map((m) => (
            <tr key={m.mes} className={TABLA.fila}>
              <Td clase="capitalize">{nombreMes(m.mes)}</Td>
              <Td derecha>{m.cortesIniciados}</Td>
              <Td derecha>{m.cortesCerrados}</Td>
              <Td derecha>
                <ConBarra valor={m.prendasTerminadas} max={max(r.meses.map((x) => x.prendasTerminadas))} texto={m.prendasTerminadas ? enDocenas(m.prendasTerminadas) : '—'} />
              </Td>
              <Td derecha>{bs(m.costura)}</Td>
            </tr>
          ))}
        </Tabla>
      </Seccion>
      <Seccion titulo="Cortes" ayuda="Cuánto tardó cada corte (de que se empezó a que se cerró) y cuánto costó cada prenda.">
        <Tabla cabeceras={[{ texto: 'COD' }, { texto: 'Modelo' }, { texto: 'Prendas', derecha: true }, { texto: 'Empezó' }, { texto: 'Se cerró' }, { texto: 'Días', derecha: true }, { texto: 'Costo por prenda (Bs)', derecha: true }]}>
          {r.cortes.map((c) => (
            <tr key={c.id} className={TABLA.fila}>
              <Td clase="mono font-semibold">{c.codigo}</Td>
              <Td clase="max-w-[240px]">{c.modelo}</Td>
              <Td derecha>{c.prendas}</Td>
              <Td clase="whitespace-nowrap">{c.inicio.split('-').reverse().join('/')}</Td>
              <Td clase="whitespace-nowrap">{c.cierre ? c.cierre.split('-').reverse().join('/') : 'abierto'}</Td>
              <Td derecha>{c.dias ?? '—'}</Td>
              <Td derecha>{bs(c.costoPorPrenda)}</Td>
            </tr>
          ))}
          {r.cortes.length === 0 && <Vacio columnas={7} />}
        </Tabla>
      </Seccion>
      <Seccion titulo="Por modelo" ayuda="Qué modelos se produjeron más.">
        <Tabla cabeceras={[{ texto: 'Modelo' }, { texto: 'Cortes', derecha: true }, { texto: 'Prendas', derecha: true }]}>
          {r.modelos.map((m) => (
            <tr key={m.modelo} className={TABLA.fila}>
              <Td clase="max-w-[280px] font-medium">{m.modelo}</Td>
              <Td derecha>{m.cortes}</Td>
              <Td derecha>
                <ConBarra valor={m.prendas} max={max(r.modelos.map((x) => x.prendas))} texto={enDocenas(m.prendas)} />
              </Td>
            </tr>
          ))}
          {r.modelos.length === 0 && <Vacio columnas={3} />}
        </Tabla>
      </Seccion>
    </>
  );
}

// ── Compras y gastos ──

function Compras({ desde, hasta }: { desde: string; hasta: string }) {
  const { data: r, isLoading } = useReporte<ComprasReporteDTO>('compras', desde, hasta);
  if (!r) return <Cargando cargando={isLoading} />;
  const t = r.meses.reduce(
    (a, m) => ({
      tela: a.tela + m.tela,
      costura: a.costura + m.insumosCostura,
      empaque: a.empaque + m.insumosEmpaque,
      otros: a.otros + m.otrosGastos,
      total: a.total + m.total,
    }),
    { tela: 0, costura: 0, empaque: 0, otros: 0, total: 0 },
  );
  return (
    <>
      <Seccion titulo="Mes por mes" ayuda="Tela = materia prima. Otros gastos = luz, agua, comida, transporte, banco… lo que se anota en la caja y en costos fijos.">
        <Tabla
          cabeceras={[{ texto: 'Mes' }, { texto: 'Tela', derecha: true }, { texto: 'Insumos de costura', derecha: true }, { texto: 'Insumos de empaque', derecha: true }, { texto: 'Otros gastos', derecha: true }, { texto: 'Total (Bs)', derecha: true }]}
          pie={
            <tr className={filaTotal}>
              <Td>Total</Td>
              <Td derecha>{bs(t.tela)}</Td>
              <Td derecha>{bs(t.costura)}</Td>
              <Td derecha>{bs(t.empaque)}</Td>
              <Td derecha>{bs(t.otros)}</Td>
              <Td derecha>{bs(t.total)}</Td>
            </tr>
          }
        >
          {r.meses.map((m) => (
            <tr key={m.mes} className={TABLA.fila}>
              <Td clase="capitalize">{nombreMes(m.mes)}</Td>
              <Td derecha>{bs(m.tela)}</Td>
              <Td derecha>{bs(m.insumosCostura)}</Td>
              <Td derecha>{bs(m.insumosEmpaque)}</Td>
              <Td derecha>{bs(m.otrosGastos)}</Td>
              <Td derecha>
                <ConBarra valor={m.total} max={max(r.meses.map((x) => x.total))} texto={bs(m.total)} color="#BA7517" />
              </Td>
            </tr>
          ))}
        </Tabla>
      </Seccion>
      <Seccion titulo="Por proveedor" ayuda="A quién le comprás más y cuánto fue a crédito.">
        <Tabla cabeceras={[{ texto: 'Proveedor' }, { texto: 'Compras', derecha: true }, { texto: 'Total (Bs)', derecha: true }, { texto: 'A crédito (Bs)', derecha: true }]}>
          {r.proveedores.map((p) => (
            <tr key={p.proveedor} className={TABLA.fila}>
              <Td clase="font-medium">{p.proveedor}</Td>
              <Td derecha>{p.compras}</Td>
              <Td derecha>
                <ConBarra valor={p.total} max={max(r.proveedores.map((x) => x.total))} texto={bs(p.total)} color="#BA7517" />
              </Td>
              <Td derecha>{p.aCredito ? bs(p.aCredito) : '—'}</Td>
            </tr>
          ))}
          {r.proveedores.length === 0 && <Vacio columnas={4} />}
        </Tabla>
      </Seccion>
      <Seccion titulo="En qué se fue la plata (caja)" ayuda="Todos los gastos de la caja en estos meses, por categoría.">
        <Tabla cabeceras={[{ texto: 'Categoría' }, { texto: 'Gastado (Bs)', derecha: true }]}>
          {r.categorias.map((c) => (
            <tr key={c.categoria} className={TABLA.fila}>
              <Td clase="font-medium">{c.categoria}</Td>
              <Td derecha>
                <ConBarra valor={c.monto} max={max(r.categorias.map((x) => x.monto))} texto={bs(c.monto)} color="#C0362C" />
              </Td>
            </tr>
          ))}
          {r.categorias.length === 0 && <Vacio columnas={2} />}
        </Tabla>
      </Seccion>
    </>
  );
}

// ── Ganancia por modelo ──

function Ganancia({ desde, hasta }: { desde: string; hasta: string }) {
  const { data: r, isLoading } = useReporte<GananciaModeloDTO>('ganancia', desde, hasta);
  if (!r) return <Cargando cargando={isLoading} />;
  return (
    <>
      <Seccion
        titulo="Lo que de verdad te dejó cada modelo"
        ayuda="Con lo que entregaste en estos meses: lo vendido menos lo que costó hacer esas prendas (sin los gastos fijos del taller)."
      >
        <Tabla cabeceras={[{ texto: 'Modelo' }, { texto: 'Prendas', derecha: true }, { texto: 'Vendido (Bs)', derecha: true }, { texto: 'Costó (Bs)', derecha: true }, { texto: 'Ganancia (Bs)', derecha: true }, { texto: 'Por prenda', derecha: true }, { texto: '% ganancia', derecha: true }]}>
          {r.vendidos.map((m) => (
            <tr key={m.modelo} className={TABLA.fila}>
              <Td clase="max-w-[240px] font-medium">{m.modelo}</Td>
              <Td derecha>{enDocenas(m.prendas)}</Td>
              <Td derecha>{bs(m.vendido)}</Td>
              <Td derecha>{bs(m.costo)}</Td>
              <Td derecha clase={m.ganancia < 0 ? 'font-semibold text-error' : 'font-semibold text-ok'}>
                <ConBarra valor={m.ganancia} max={max(r.vendidos.map((x) => x.ganancia))} texto={bs(m.ganancia)} color="#639922" />
              </Td>
              <Td derecha>{bs(m.porPrenda)}</Td>
              <Td derecha>{pct(m.margen)}</Td>
            </tr>
          ))}
          {r.vendidos.length === 0 && <Vacio columnas={7} />}
        </Tabla>
      </Seccion>
      <Seccion
        titulo="Lo que dejaría cada modelo hoy (según la ficha)"
        ayuda="Precio de venta menos costo por prenda, con los precios de hoy y los gastos fijos incluidos. Sirve para comparar modelos aunque todavía no se hayan vendido."
      >
        <Tabla cabeceras={[{ texto: 'Modelo' }, { texto: 'Costo (Bs)', derecha: true }, { texto: 'Precio (Bs)', derecha: true }, { texto: 'Ganancia por prenda', derecha: true }, { texto: '% ganancia', derecha: true }]}>
          {r.fichas.map((f) => (
            <tr key={f.id} className={TABLA.fila}>
              <Td clase="max-w-[280px] font-medium">{f.nombre}</Td>
              <Td derecha>{bs(f.costo)}</Td>
              <Td derecha>{bs(f.precio)}</Td>
              <Td derecha clase={f.ganancia < 0 ? 'text-error' : 'text-ok'}>{bs(f.ganancia)}</Td>
              <Td derecha>{pct(f.margen)}</Td>
            </tr>
          ))}
        </Tabla>
      </Seccion>
    </>
  );
}
