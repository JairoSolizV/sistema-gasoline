import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ETIQUETA_CUENTA, formatBs, type EtapaDineroDTO, type TableroDTO } from '@taller/shared';
import { useTablero } from '../../api/dinero';
import { MESES } from '../../lib/meses';

// Tablero de dinero (docs/PLAN_TABLERO_DINERO.md): dónde está la plata del
// taller hoy, etapa por etapa, lo que tenés frente a lo que debés y el
// resultado del mes con la cuota del banco aparte. Solo consulta.

const bs = (c: number) => `Bs ${formatBs(c)}`;

type ClaveEtapa = 'enPuerta' | 'enProduccion' | 'enServicios' | 'deposito';
const ETAPAS: { clave: ClaveEtapa; titulo: string; ayuda: string; falta: string }[] = [
  { clave: 'enPuerta', titulo: 'En puerta', ayuda: 'pedidos sin cortar', falta: 'plata que vas a necesitar' },
  { clave: 'enProduccion', titulo: 'En producción', ayuda: 'cortes abiertos', falta: 'falta pagar para terminar' },
  { clave: 'enServicios', titulo: 'En servicios', ayuda: 'lavandería, bordado…', falta: 'falta pagar al servicio' },
  { clave: 'deposito', titulo: 'Listo para despachar', ayuda: 'en depósito', falta: '' },
];

export function TableroPage() {
  const { data: t, isLoading, error } = useTablero();
  const [abierta, setAbierta] = useState<ClaveEtapa | null>(null);

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Tablero de dinero</h1>
          <p className="mt-1 text-sm text-gray-500">
            Dónde está tu plata hoy: en cada etapa del producto, lo que tenés y lo que debés.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/ventas?tab=pedidos" className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50">
            Pedidos
          </Link>
          <Link to="/ventas?tab=despachos" className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50">
            Despachos
          </Link>
          <Link to="/ventas?tab=cobros" className="rounded-lg bg-acento px-3 py-2 text-sm font-semibold text-white hover:bg-[#265dc2]">
            Registrar cobro
          </Link>
        </div>
      </div>

      {isLoading && <div className="mt-6 text-sm text-gray-500">Calculando…</div>}
      {error && <div className="mt-6 text-sm text-error">No se pudo cargar ({String(error)})</div>}

      {t && (
        <>
          <h2 className="mt-6 mb-2 text-sm font-semibold text-gray-700">El camino de tu producto</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {ETAPAS.map((e) => (
              <TarjetaEtapa
                key={e.clave}
                titulo={e.titulo}
                ayuda={e.ayuda}
                falta={e.falta}
                etapa={t[e.clave]}
                activa={abierta === e.clave}
                onClick={() => setAbierta(abierta === e.clave ? null : e.clave)}
              />
            ))}
            <Link
              to="/ventas?tab=clientes"
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-acento"
            >
              <div className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">Por cobrar</div>
              <div className="mono mt-1 text-xl font-semibold text-acento">{bs(t.porCobrar.total)}</div>
              <div className="mt-0.5 text-[11px] text-gray-400">
                {t.porCobrar.clientes.filter((c) => c.monto > 0).length} cliente(s) te deben
              </div>
              <ul className="mt-2 space-y-0.5 text-xs text-gray-600">
                {t.porCobrar.clientes.slice(0, 4).map((c) => (
                  <li key={c.id} className="flex justify-between gap-2">
                    <span className="truncate">{c.nombre}</span>
                    <span className="mono">{formatBs(c.monto)}</span>
                  </li>
                ))}
              </ul>
            </Link>
          </div>
          {abierta && <DetalleEtapa etapa={t[abierta]} />}

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <LoQueTenes t={t} />
            <LoQueDebes t={t} />
          </div>
          <CapitalYBanco t={t} />
          <ResultadoMes t={t} />

          {t.avisos.length > 0 && (
            <ul className="mt-4 space-y-1 text-xs text-amber-800">
              {t.avisos.map((a) => (
                <li key={a}>⚠ {a}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function TarjetaEtapa({
  titulo,
  ayuda,
  falta,
  etapa,
  activa,
  onClick,
}: {
  titulo: string;
  ayuda: string;
  falta: string;
  etapa: EtapaDineroDTO;
  activa: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border bg-white p-4 text-left shadow-sm hover:border-acento ${activa ? 'border-acento ring-2 ring-acento/20' : 'border-gray-200'}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">{titulo}</span>
        <span className="text-[11px] text-gray-400">{etapa.prendas.toLocaleString('es-BO')} prendas</span>
      </div>
      <div className="text-[11px] text-gray-400">{ayuda}</div>
      <dl className="mt-2 space-y-1 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-gray-500">Invertido</dt>
          <dd className="mono font-semibold">{bs(etapa.costo)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-gray-500">Vale</dt>
          <dd className="mono font-semibold text-ok">{bs(etapa.venta)}</dd>
        </div>
        {etapa.sinPrecio > 0 && (
          <div className="text-right text-[11px] text-amber-700">
            {etapa.sinPrecio} sin precio (modelo sin ficha)
          </div>
        )}
        <div className="flex justify-between gap-2 border-t border-gray-100 pt-1">
          <dt className="text-gray-500">Ganancia</dt>
          <dd className={`mono font-semibold ${etapa.ganancia < 0 ? 'text-error' : 'text-ok'}`}>{bs(etapa.ganancia)}</dd>
        </div>
        {falta && etapa.faltaPagar > 0 && (
          <div className="flex justify-between gap-2 text-xs">
            <dt className="text-amber-700">{falta}</dt>
            <dd className="mono text-amber-700">{bs(etapa.faltaPagar)}</dd>
          </div>
        )}
      </dl>
      <div className="mt-2 text-[11px] text-acento">{activa ? 'ocultar detalle ▴' : 'ver detalle ▾'}</div>
    </button>
  );
}

function DetalleEtapa({ etapa }: { etapa: EtapaDineroDTO }) {
  return (
    <div className="mt-3 w-fit max-w-full overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="text-sm">
        <thead>
          <tr className="bg-gray-50 text-left text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
            <th className="px-3 py-2">Qué</th>
            <th className="px-3 py-2 text-right">Prendas</th>
            <th className="px-3 py-2 text-right">Invertido</th>
            <th className="px-3 py-2 text-right">Vale</th>
            <th className="px-3 py-2 text-right">Falta pagar</th>
          </tr>
        </thead>
        <tbody>
          {etapa.items.map((i) => (
            <tr key={i.id} className="border-b border-gray-200/70 last:border-0 even:bg-slate-100">
              <td className="max-w-[320px] px-3 py-1.5">
                <div className="font-medium">{i.titulo}</div>
                {i.detalle && <div className="text-xs text-gray-500">{i.detalle}</div>}
              </td>
              <td className="mono px-3 py-1.5 text-right">{i.prendas}</td>
              <td className="mono px-3 py-1.5 text-right whitespace-nowrap">{bs(i.costo)}</td>
              <td className="mono px-3 py-1.5 text-right whitespace-nowrap text-ok">
                {i.venta != null ? bs(i.venta) : <span className="text-gray-400">sin precio</span>}
              </td>
              <td className="mono px-3 py-1.5 text-right whitespace-nowrap text-amber-700">
                {i.faltaPagar > 0 ? bs(i.faltaPagar) : '—'}
              </td>
            </tr>
          ))}
          {etapa.items.length === 0 && (
            <tr>
              <td colSpan={5} className="px-5 py-6 text-center text-gray-500">
                No hay nada en esta etapa.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Fila({ etiqueta, monto, ayuda, a }: { etiqueta: string; monto: number; ayuda?: string; a?: string }) {
  const texto = (
    <>
      <div>
        <div className="text-sm">{etiqueta}</div>
        {ayuda && <div className="text-[11px] text-gray-400">{ayuda}</div>}
      </div>
      <div className="mono text-sm font-semibold whitespace-nowrap">{bs(monto)}</div>
    </>
  );
  const clase = 'flex items-start justify-between gap-4 border-b border-gray-100 px-4 py-2 last:border-0';
  return a ? (
    <Link to={a} className={`${clase} hover:bg-blue-50`}>
      {texto}
    </Link>
  ) : (
    <div className={clase}>{texto}</div>
  );
}

function LoQueTenes({ t }: { t: TableroDTO }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-baseline justify-between border-b border-gray-200 bg-ok-suave px-4 py-2.5">
        <span className="text-sm font-semibold text-ok">Lo que tenés (invertido)</span>
        <span className="mono font-semibold text-ok">{bs(t.tenes)}</span>
      </div>
      <Fila
        etiqueta="Insumos en depósito"
        monto={t.insumos.valor}
        ayuda={`stock × precio de la última compra${t.insumos.sinPrecio ? ` · ${t.insumos.sinPrecio} sin precio` : ''}`}
        a="/inventario"
      />
      <Fila etiqueta="En producción" monto={t.enProduccion.costo} ayuda="cortes abiertos, a costo" />
      <Fila etiqueta="En servicios externos" monto={t.enServicios.costo} ayuda="cortes cerrados con prendas afuera" />
      <Fila etiqueta="Listo para despachar" monto={t.deposito.costo} ayuda="depósito, a costo" />
      <Fila etiqueta="Por cobrar a clientes" monto={t.porCobrar.total} a="/ventas?tab=clientes" />
      <Fila
        etiqueta="Anticipos adelantados a operarios"
        monto={t.anticiposAdelantados}
        ayuda="plata entregada por trabajo que todavía no se cerró"
        a="/liquidacion"
      />
    </div>
  );
}

function LoQueDebes({ t }: { t: TableroDTO }) {
  const d = t.deudas;
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-baseline justify-between border-b border-gray-200 bg-error-suave px-4 py-2.5">
        <span className="text-sm font-semibold text-error">Lo que debés (de la producción)</span>
        <span className="mono font-semibold text-error">{bs(d.total)}</span>
      </div>
      {d.proveedores.lista.map((p) => (
        <Fila key={p.proveedor} etiqueta={p.proveedor} monto={p.monto} ayuda="compras a crédito − pagos" a="/compras?tab=proveedores" />
      ))}
      {d.proveedores.lista.length === 0 && (
        <Fila etiqueta="Proveedores" monto={0} ayuda="marcá las compras a crédito en Compras" a="/compras?tab=proveedores" />
      )}
      {d.servicios.porCuenta.map((s) => (
        <Fila key={s.cuenta} etiqueta={ETIQUETA_CUENTA[s.cuenta]} monto={s.monto} ayuda="saldo pendiente del mes" a={`/liquidacion?cuenta=${s.cuenta}`} />
      ))}
      <Fila etiqueta="Operarios" monto={d.operarios} ayuda="saldos a favor del mes (lo ganado menos anticipos)" a="/liquidacion" />
    </div>
  );
}

function CapitalYBanco({ t }: { t: TableroDTO }) {
  const positivo = t.capitalDeTrabajo >= 0;
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className={`rounded-xl border p-4 shadow-sm ${positivo ? 'border-ok/40 bg-ok-suave' : 'border-error/40 bg-error-suave'}`}>
        <div className="text-[11px] font-semibold tracking-wider text-gray-600 uppercase">Lo que tenés − lo que debés</div>
        <div className={`mono mt-1 text-2xl font-semibold ${positivo ? 'text-ok' : 'text-error'}`}>{bs(t.capitalDeTrabajo)}</div>
        <p className="mt-1 text-xs text-gray-600">
          {positivo
            ? 'Lo que tenés invertido en el taller alcanza para cubrir lo que debés de la producción.'
            : 'Debés más de lo que tenés invertido: cuidado con comprometer más compras a crédito.'}{' '}
          No incluye el préstamo del banco.
        </p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">Banco (aparte)</div>
        <div className="mono mt-1 text-xl font-semibold">{bs(t.banco.cuotaMes)} / mes</div>
        <ul className="mt-1 space-y-0.5 text-xs text-gray-600">
          {t.banco.prestamos.map((p) => (
            <li key={p.banco}>
              {p.banco}: cuota {bs(p.cuota)}
              {p.cuotasRestantes != null && ` · quedan ${p.cuotasRestantes} cuotas`} ·{' '}
              <span className={p.pagadaEsteMes ? 'text-ok' : 'text-amber-700'}>
                {p.pagadaEsteMes ? 'pagada este mes' : 'sin pagar este mes'}
              </span>
            </li>
          ))}
        </ul>
        <Link to="/costos-fijos" className="mt-1 inline-block text-xs text-acento hover:underline">
          ver costos fijos
        </Link>
      </div>
    </div>
  );
}

function ResultadoMes({ t }: { t: TableroDTO }) {
  const r = t.resultadoMes;
  const partesBanco = r.margen > 0 ? Math.round((r.cuotaBanco / r.margen) * 100) : null;
  const linea = (etiqueta: string, monto: number, signo: '' | '−' | '=', fuerte = false) => (
    <div className={`flex justify-between gap-4 px-4 py-1.5 ${fuerte ? 'border-t border-gray-300 font-semibold' : ''}`}>
      <span className="text-sm">
        <span className="mono mr-2 inline-block w-3 text-gray-400">{signo}</span>
        {etiqueta}
      </span>
      <span className={`mono text-sm whitespace-nowrap ${fuerte ? (monto < 0 ? 'text-error' : 'text-ok') : ''}`}>{bs(monto)}</span>
    </div>
  );
  return (
    <div className="mt-4 max-w-2xl overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-2.5">
        <div className="text-sm font-semibold">
          Resultado de {MESES[t.mes - 1]} {t.anio}
        </div>
        <div className="text-xs text-gray-500">
          Según lo despachado en el mes ({r.prendasDespachadas.toLocaleString('es-BO')} prendas). Entró en cobros:{' '}
          <span className="mono font-semibold">{bs(r.cobrado)}</span>
        </div>
      </div>
      <div className="py-1">
        {linea('Ventas (lo despachado)', r.ventas, '')}
        {linea('Costo de lo vendido', r.costoVendido, '−')}
        {linea('Margen', r.margen, '=', true)}
        {linea('Costos fijos del taller (sueldos, servicios, máquinas…)', r.gastosFijos, '−')}
        {linea('Resultado del taller', r.operativo, '=', true)}
        {linea('Cuota del banco', r.cuotaBanco, '−')}
        {linea('Te queda', r.queda, '=', true)}
      </div>
      {partesBanco != null && (
        <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-600">
          La cuota del banco se lleva el <strong>{partesBanco} %</strong> del margen de este mes.
        </div>
      )}
    </div>
  );
}
