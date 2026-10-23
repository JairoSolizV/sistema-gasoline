import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatBs, INFO_PASO, type CaminoDTO, type PasoCaminoDTO, type PasoCorte } from '@taller/shared';
import { api } from '../../api/client';
import { COLOR_SEMAFORO, PasosCorte } from '../../components/PasosCorte';
import { enDocenas } from '../costos/formato';

// "¿Dónde está mi plata?" (docs/PLAN_DIDACTICO_REPORTES.md): el camino de las
// prendas, del pedido al cobro, con lo que ya está puesto y lo que falta en cada
// paso. Pensado para que lo entienda cualquiera: dibujos, palabras simples y
// semáforo.

const bs = (c: number) => `Bs ${formatBs(c)}`;
const peor = (p: PasoCaminoDTO) =>
  p.cortes.some((c) => c.semaforo === 'demora') ? 'demora' : p.cortes.some((c) => c.semaforo === 'atencion') ? 'atencion' : 'ok';

export function MiPlataPage() {
  const { data: d, isLoading, error } = useQuery({
    queryKey: ['dinero', 'camino'],
    queryFn: () => api<CaminoDTO>('/dinero/camino'),
  });
  const [abierto, setAbierto] = useState<PasoCorte | null>(null);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">¿Dónde está mi plata?</h1>
      <p className="mt-1 text-sm text-gray-600">
        El camino de tus prendas, desde que te hacen el pedido hasta que te pagan. En cada paso ves cuánta plata ya pusiste,
        cuánta falta poner para terminar y cuánto vale.
      </p>
      {isLoading && <div className="mt-6 text-sm text-gray-500">Calculando…</div>}
      {error && <div className="mt-6 text-sm text-error">No se pudo cargar ({String(error)})</div>}
      {d && (
        <>
          <Resumen d={d} />

          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Estacion
              numero={1}
              icono="📋"
              nombre="Pedidos por hacer"
              explicacion="Lo que te encargaron y todavía no se cortó"
              prendas={d.pedidos.prendas}
              filas={[
                { texto: 'Vas a necesitar', monto: d.pedidos.necesitas, clase: 'text-amber-700' },
                { texto: 'Vale', monto: d.pedidos.vale, clase: 'text-ok' },
              ]}
              enlace="/ventas?tab=pedidos"
            />
            {d.pasos.map((p, k) => {
              const s = COLOR_SEMAFORO[peor(p)];
              return (
                <Estacion
                  key={p.paso}
                  numero={k + 2}
                  icono={INFO_PASO[p.paso].icono}
                  nombre={INFO_PASO[p.paso].nombre}
                  explicacion={INFO_PASO[p.paso].que}
                  prendas={p.prendas}
                  semaforo={p.cortes.length > 0 ? s : undefined}
                  filas={[
                    { texto: 'Ya pusiste', monto: p.invertido, clase: '' },
                    ...(p.paso !== 'deposito' ? [{ texto: 'Falta poner', monto: p.falta, clase: 'text-amber-700' }] : []),
                    { texto: 'Vale', monto: p.vale, clase: 'text-ok' },
                  ]}
                  activa={abierto === p.paso}
                  onClick={() => setAbierto(abierto === p.paso ? null : p.paso)}
                  pie={`${p.cortes.length} corte(s)`}
                />
              );
            })}
            <Estacion
              numero={7}
              icono="🚚"
              nombre="Entregado, por cobrar"
              explicacion="Ya lo llevaste y el cliente todavía no pagó"
              filas={[
                { texto: 'Te deben', monto: d.porCobrar.total, clase: 'text-acento' },
                ...(d.porCobrar.vencido > 0 ? [{ texto: 'Ya vencido', monto: d.porCobrar.vencido, clase: 'text-error' }] : []),
              ]}
              semaforo={d.porCobrar.vencido > 0 ? COLOR_SEMAFORO.demora : undefined}
              pie={`${d.porCobrar.clientes} cliente(s)`}
              enlace="/cuentas-por-cobrar"
            />
            <Estacion
              numero={8}
              icono="💰"
              nombre="Cobrado este mes"
              explicacion="La plata que ya entró este mes"
              filas={[{ texto: 'Entró', monto: d.cobradoMes, clase: 'text-ok' }]}
              enlace="/ventas?tab=cobros"
            />
          </div>

          {abierto && <DetallePaso p={d.pasos.find((p) => p.paso === abierto)!} />}

          <div className="mt-6 flex flex-wrap gap-4 text-xs text-gray-600">
            <span className="font-semibold">Semáforo:</span>
            {Object.values(COLOR_SEMAFORO).map((s) => (
              <span key={s.texto} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.punto }} /> {s.texto}
              </span>
            ))}
            <span className="text-gray-400">(según los días que lleva en ese paso)</span>
          </div>
          {d.avisos.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-amber-800">
              {d.avisos.map((a) => (
                <li key={a}>⚠ {a}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function Resumen({ d }: { d: CaminoDTO }) {
  const r = d.resumen;
  const chip = (icono: string, texto: string, monto: number) => (
    <div className="rounded-lg bg-white/70 px-3 py-2">
      <div className="text-xs text-gray-600">
        {icono} {texto}
      </div>
      <div className="mono font-semibold">{bs(monto)}</div>
    </div>
  );
  return (
    <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="text-sm text-gray-600">En la producción ya pusiste</div>
        <div className="mono mt-1 text-3xl font-semibold">{bs(r.invertido)}</div>
        <div className="mt-1 text-xs text-gray-500">tela, cortes, insumos y trabajo de lo que está en el taller</div>
      </div>
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 shadow-sm">
        <div className="text-sm text-amber-900">Para terminar todo lo que está en el taller te falta</div>
        <div className="mono mt-1 text-3xl font-semibold text-amber-800">{bs(r.falta)}</div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {chip('🧵', 'Insumos de costura', r.desglose.insumosCostura)}
          {chip('🛍️', 'Insumos de empaque', r.desglose.insumosEmpaque)}
          {chip('👩‍🔧', 'Mano de obra', r.desglose.manoDeObra)}
          {chip('🫧', 'Lavandería y otros', r.desglose.servicios)}
        </div>
      </div>
    </div>
  );
}

function Estacion({
  numero,
  icono,
  nombre,
  explicacion,
  prendas,
  filas,
  semaforo,
  pie,
  enlace,
  activa,
  onClick,
}: {
  numero: number;
  icono: string;
  nombre: string;
  explicacion: string;
  prendas?: number;
  filas: { texto: string; monto: number; clase: string }[];
  semaforo?: { punto: string; texto: string };
  pie?: string;
  enlace?: string;
  activa?: boolean;
  onClick?: () => void;
}) {
  const contenido = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-3xl" aria-hidden="true">
          {icono}
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-gray-400">
          {semaforo && <span className="h-3 w-3 rounded-full" style={{ background: semaforo.punto }} title={semaforo.texto} />}
          paso {numero}
        </span>
      </div>
      <div className="mt-1 font-semibold">{nombre}</div>
      <div className="text-[11px] leading-tight text-gray-500">{explicacion}</div>
      {prendas != null && (
        <div className="mt-2 text-sm">
          <span className="mono font-semibold">{prendas.toLocaleString('es-BO')}</span> prendas
          <span className="ml-1 text-xs text-gray-400">({enDocenas(prendas)})</span>
        </div>
      )}
      <dl className="mt-2 space-y-0.5 text-sm">
        {filas.map((f) => (
          <div key={f.texto} className="flex justify-between gap-2">
            <dt className="text-gray-500">{f.texto}</dt>
            <dd className={`mono font-semibold ${f.clase}`}>{bs(f.monto)}</dd>
          </div>
        ))}
      </dl>
      {pie && <div className="mt-2 text-[11px] text-acento">{pie}{onClick ? (activa ? ' · ocultar ▴' : ' · ver ▾') : ' · abrir ›'}</div>}
    </>
  );
  const clase = `imprime block rounded-xl border bg-white p-4 text-left shadow-sm hover:border-acento ${activa ? 'border-acento ring-2 ring-acento/20' : 'border-gray-200'}`;
  if (enlace) {
    return (
      <Link to={enlace} className={clase}>
        {contenido}
      </Link>
    );
  }
  return (
    <button onClick={onClick} className={clase}>
      {contenido}
    </button>
  );
}

function DetallePaso({ p }: { p: PasoCaminoDTO }) {
  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-semibold">
        {INFO_PASO[p.paso].icono} {INFO_PASO[p.paso].nombre}: {p.cortes.length} corte(s)
      </div>
      {p.cortes.length === 0 && <p className="mt-2 text-sm text-gray-500">No hay cortes en este paso.</p>}
      <div className="mt-3 space-y-3">
        {p.cortes.map((c) => {
          const s = COLOR_SEMAFORO[c.semaforo];
          return (
            <div key={c.corteId} className="rounded-lg border border-gray-200 p-3" style={{ background: s.fondo }}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link to={`/cortes/${c.corteId}`} className="font-semibold text-acento hover:underline">
                  COD {c.codigo} · {c.modelo}
                </Link>
                <span className="flex items-center gap-1.5 text-xs" style={{ color: s.punto }}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.punto }} />
                  hace {c.dias} día(s) · {s.texto}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                <span>
                  {c.prendas} prendas <span className="text-xs text-gray-500">({enDocenas(c.prendas)})</span>
                </span>
                <span>
                  Ya pusiste <span className="mono font-semibold">{bs(c.invertido)}</span>
                </span>
                {c.falta > 0 && (
                  <span className="text-amber-800">
                    Falta <span className="mono font-semibold">{bs(c.falta)}</span>
                    <span className="text-xs">
                      {' '}
                      ({[
                        c.desglose.insumosCostura > 0 && `insumos de costura ${formatBs(c.desglose.insumosCostura)}`,
                        c.desglose.insumosEmpaque > 0 && `insumos de empaque ${formatBs(c.desglose.insumosEmpaque)}`,
                        c.desglose.manoDeObra > 0 && `mano de obra ${formatBs(c.desglose.manoDeObra)}`,
                        c.desglose.servicios > 0 && `lavandería y otros ${formatBs(c.desglose.servicios)}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')})
                    </span>
                  </span>
                )}
                {c.vale != null && (
                  <span className="text-ok">
                    Vale <span className="mono font-semibold">{bs(c.vale)}</span>
                  </span>
                )}
              </div>
              <div className="mt-2 print:hidden">
                <PasosCorte corteId={c.corteId} paso={c.paso} pasoDesde={new Date(Date.now() - c.dias * 86_400_000).toISOString()} compacta />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
