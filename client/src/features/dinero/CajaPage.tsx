import { useState } from 'react';
import {
  aCentavos,
  CAJAS,
  ETIQUETA_CAJA,
  formatBs,
  ORIGENES_CAJA,
  type Caja,
  type CajaMesDTO,
  type CategoriaCajaDTO,
  type MovimientoCajaDTO,
  type OrigenCaja,
  type ResumenCajaDTO,
} from '@taller/shared';
import { useCaja, useMutacionCaja } from '../../api/caja';
import { ErrorApi } from '../../api/client';
import { Modal } from '../../components/Modal';
import { SelectorCaja } from '../../components/SelectorCaja';
import { TABLA } from '../../components/tabla';
import { hoyLocalISO } from '../../lib/fechas';
import { MESES } from '../../lib/meses';

// Caja (docs/PLAN_CAJA.md): efectivo y banco. Lo registrado en otras pantallas
// (cobros, compras al contado, pagos a proveedores, comida, cuota del banco,
// anticipos, cierre de mes) entra solo; acá se anota lo demás, se transfiere
// entre cajas y se hace el arqueo.

const PATRON_BS = /^-?\d+([.,]\d{1,2})?$/;
const bs = (c: number) => `Bs ${formatBs(c)}`;
const aCent = (s: string) => {
  const t = s.trim().replace(',', '.');
  return t.startsWith('-') ? -aCentavos(t.slice(1)) : aCentavos(t);
};
const fechaCorta = (dia: string) => dia.split('-').reverse().join('/');
const claseInput =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-acento';
const mensaje = (e: unknown) => (e instanceof ErrorApi ? e.message : 'Error al guardar');
const esAutomatico = (o: MovimientoCajaDTO['origen']): o is OrigenCaja => (ORIGENES_CAJA as readonly string[]).includes(o);

const ORIGEN: Record<MovimientoCajaDTO['origen'], string> = {
  manual: 'a mano',
  transferencia: 'transferencia',
  arqueo: 'arqueo',
  cobro: 'cobro',
  pago_proveedor: 'pago a proveedor',
  compra: 'compra',
  compra_gasto: 'costos fijos',
  pago_prestamo: 'préstamo',
  anticipo: 'anticipo',
  liquidacion: 'cierre de mes',
};

type ModalCaja =
  | { tipo: 'movimiento'; clase: 'ingreso' | 'egreso' | 'transferencia' }
  | { tipo: 'arqueo'; caja: Caja; saldo: number }
  | { tipo: 'inicio'; caja: Caja; actual: ResumenCajaDTO }
  | { tipo: 'categorias' }
  | null;

export function CajaPage() {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const { data: d, isLoading, error } = useCaja(anio, mes);
  const [modal, setModal] = useState<ModalCaja>(null);
  const [filtroCaja, setFiltroCaja] = useState<Caja | ''>('');
  const [filtroCat, setFiltroCat] = useState('');
  const irMes = (delta: number) => {
    const x = new Date(anio, mes - 1 + delta, 1);
    setAnio(x.getFullYear());
    setMes(x.getMonth() + 1);
  };
  const sinConfigurar = d?.cajas.filter((c) => !c.configurada) ?? [];

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Caja</h1>
          <p className="mt-1 text-sm text-gray-500">
            Cuánta plata tenés en efectivo y en el banco, y en qué se va. Lo que registrás en otras pantallas entra solo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setModal({ tipo: 'categorias' })} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50">
            Categorías
          </button>
          <button onClick={() => setModal({ tipo: 'movimiento', clase: 'transferencia' })} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50">
            Transferir
          </button>
          <button onClick={() => setModal({ tipo: 'movimiento', clase: 'ingreso' })} className="rounded-lg border border-ok px-3 py-2 text-sm font-semibold text-ok hover:bg-ok-suave">
            + Ingreso
          </button>
          <button onClick={() => setModal({ tipo: 'movimiento', clase: 'egreso' })} className="rounded-lg bg-acento px-3 py-2 text-sm font-semibold text-white hover:bg-[#265dc2]">
            + Gasto
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button onClick={() => irMes(-1)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
          ‹
        </button>
        <div className="min-w-40 text-center text-lg font-semibold capitalize">
          {MESES[mes - 1]} {anio}
        </div>
        <button onClick={() => irMes(1)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
          ›
        </button>
      </div>

      {isLoading && <div className="mt-4 text-sm text-gray-500">Cargando…</div>}
      {error && <div className="mt-4 text-sm text-error">No se pudo cargar ({String(error)})</div>}

      {d && (
        <>
          {sinConfigurar.map((c) => (
            <div key={c.caja} className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
              <strong>{ETIQUETA_CAJA[c.caja]}:</strong> indicá desde qué día llevás esta caja y con cuánta plata empezás.
              Lo anterior a esa fecha no se cuenta.{' '}
              <button onClick={() => setModal({ tipo: 'inicio', caja: c.caja, actual: c })} className="font-semibold text-acento hover:underline">
                Configurar
              </button>
            </div>
          ))}
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {d.cajas
              .filter((c) => c.configurada)
              .map((c) => (
                <TarjetaCaja
                  key={c.caja}
                  c={c}
                  onArqueo={() => setModal({ tipo: 'arqueo', caja: c.caja, saldo: c.saldoFinal })}
                  onInicio={() => setModal({ tipo: 'inicio', caja: c.caja, actual: c })}
                />
              ))}
          </div>
          <PorCategoria d={d} />
          <Movimientos
            d={d}
            filtroCaja={filtroCaja}
            filtroCat={filtroCat}
            onFiltroCaja={setFiltroCaja}
            onFiltroCat={setFiltroCat}
          />
        </>
      )}

      {modal?.tipo === 'movimiento' && d && (
        <ModalMovimiento clase={modal.clase} categorias={d.categorias} onCerrar={() => setModal(null)} />
      )}
      {modal?.tipo === 'arqueo' && <ModalArqueo caja={modal.caja} saldo={modal.saldo} onCerrar={() => setModal(null)} />}
      {modal?.tipo === 'inicio' && <ModalInicio caja={modal.caja} actual={modal.actual} onCerrar={() => setModal(null)} />}
      {modal?.tipo === 'categorias' && d && <ModalCategorias categorias={d.categorias} onCerrar={() => setModal(null)} />}
    </div>
  );
}

function TarjetaCaja({ c, onArqueo, onInicio }: { c: ResumenCajaDTO; onArqueo: () => void; onInicio: () => void }) {
  const fila = (etiqueta: string, monto: number, clase = '') => (
    <div className="flex justify-between gap-2">
      <span className="text-gray-500">{etiqueta}</span>
      <span className={`mono ${clase}`}>{bs(monto)}</span>
    </div>
  );
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">{ETIQUETA_CAJA[c.caja]}</span>
        <button onClick={onArqueo} className="text-xs font-semibold text-acento hover:underline">
          Hacer arqueo
        </button>
      </div>
      <div className={`mono mt-1 text-2xl font-semibold ${c.saldoFinal < 0 ? 'text-error' : ''}`}>{bs(c.saldoFinal)}</div>
      <div className="mt-2 space-y-0.5 text-sm">
        {fila('Al empezar el mes', c.saldoInicioMes)}
        {fila('+ Entró', c.ingresos, 'text-ok')}
        {fila('− Salió', c.egresos, 'text-error')}
        {c.ajustes !== 0 && fila('Ajustes de arqueo', c.ajustes, c.ajustes < 0 ? 'text-error' : 'text-ok')}
      </div>
      <div className="mt-2 text-[11px] text-gray-400">
        {c.ultimoArqueo
          ? `Último arqueo ${fechaCorta(c.ultimoArqueo.fecha)}: contado ${formatBs(c.ultimoArqueo.contado)}${
              c.ultimoArqueo.diferencia !== 0
                ? ` (${c.ultimoArqueo.diferencia > 0 ? 'sobrante' : 'faltante'} ${formatBs(Math.abs(c.ultimoArqueo.diferencia))})`
                : ' (cuadró)'
            }`
          : 'Sin arqueos todavía'}
        {' · '}
        <button onClick={onInicio} className="hover:underline">
          desde {c.desde && fechaCorta(c.desde)} con {bs(c.saldoInicial)}
        </button>
      </div>
      {c.saldoFinal < 0 && (
        <p className="mt-2 text-xs text-error">
          Saldo negativo: falta anotar algún ingreso, o un gasto quedó en la caja equivocada. Un arqueo lo corrige.
        </p>
      )}
    </div>
  );
}

function PorCategoria({ d }: { d: CajaMesDTO }) {
  const bloque = (tipo: 'ingreso' | 'egreso', titulo: string, color: string) => {
    const filas = d.porCategoria.filter((p) => p.tipo === tipo);
    const total = filas.reduce((a, p) => a + p.monto, 0);
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold">{titulo}</span>
          <span className="mono text-sm font-semibold">{bs(total)}</span>
        </div>
        <div className="mt-2 space-y-1.5">
          {filas.map((p) => (
            <div key={p.categoria.id}>
              <div className="flex justify-between gap-2 text-sm">
                <span>{p.categoria.nombre}</span>
                <span className="mono">
                  {bs(p.monto)} <span className="text-xs text-gray-400">{total ? Math.round((p.monto / total) * 100) : 0} %</span>
                </span>
              </div>
              <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${total ? (p.monto / total) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
          {filas.length === 0 && <div className="text-sm text-gray-400">Nada este mes.</div>}
        </div>
      </div>
    );
  };
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
      {bloque('egreso', 'En qué se fue la plata', 'bg-error')}
      {bloque('ingreso', 'De dónde entró', 'bg-ok')}
    </div>
  );
}

function Movimientos({
  d,
  filtroCaja,
  filtroCat,
  onFiltroCaja,
  onFiltroCat,
}: {
  d: CajaMesDTO;
  filtroCaja: Caja | '';
  filtroCat: string;
  onFiltroCaja: (c: Caja | '') => void;
  onFiltroCat: (c: string) => void;
}) {
  const mutar = useMutacionCaja();
  const lista = d.movimientos.filter(
    (m) => (!filtroCaja || m.caja === filtroCaja) && (!filtroCat || m.categoria?.id === filtroCat),
  );
  const quitar = (m: MovimientoCajaDTO) =>
    mutar.mutate(m.origen === 'arqueo' ? { tipo: 'quitarArqueo', id: m.origenId } : { tipo: 'quitarMovimiento', id: m.origenId });

  return (
    <>
      <div className="mt-6 mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-700">Movimientos del mes ({lista.length})</h2>
        <div className="flex gap-2">
          <select value={filtroCaja} onChange={(e) => onFiltroCaja(e.target.value as Caja | '')} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm">
            <option value="">Las dos cajas</option>
            {CAJAS.map((c) => (
              <option key={c} value={c}>
                {ETIQUETA_CAJA[c]}
              </option>
            ))}
          </select>
          <select value={filtroCat} onChange={(e) => onFiltroCat(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm">
            <option value="">Todas las categorías</option>
            {d.categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>
      {mutar.error != null && <p className="mb-2 rounded-lg bg-error-suave px-3 py-2 text-xs text-error">{mensaje(mutar.error)}</p>}
      <div className={TABLA.contenedorPagina}>
        <table className="text-sm">
          <thead className={TABLA.cabecera}>
            <tr className={TABLA.filaCabecera}>
              <th className="px-3 py-2.5">Fecha</th>
              <th className="px-3 py-2.5">Caja</th>
              <th className="px-3 py-2.5">Categoría</th>
              <th className="px-3 py-2.5">Detalle</th>
              <th className="px-3 py-2.5 text-right">Entró</th>
              <th className="px-3 py-2.5 text-right">Salió</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {lista.map((m) => (
              <tr key={m.id} className={TABLA.fila}>
                <td className="px-3 py-1.5 whitespace-nowrap text-gray-600">{fechaCorta(m.fecha)}</td>
                <td className="px-3 py-1.5 whitespace-nowrap">
                  {esAutomatico(m.origen) ? (
                    <select
                      value={m.caja}
                      title="Cambiá la caja si se pagó o cobró por la otra"
                      onChange={(e) => mutar.mutate({ tipo: 'cambiarCaja', origen: m.origen as OrigenCaja, id: m.origenId, caja: e.target.value as Caja })}
                      className="rounded border border-gray-200 bg-white px-1 py-0.5 text-xs"
                    >
                      {CAJAS.map((c) => (
                        <option key={c} value={c}>
                          {ETIQUETA_CAJA[c]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs">{ETIQUETA_CAJA[m.caja]}</span>
                  )}
                </td>
                <td className="px-3 py-1.5 whitespace-nowrap">{m.categoria?.nombre ?? <span className="text-gray-400">—</span>}</td>
                <td className="max-w-[340px] px-3 py-1.5">
                  {m.descripcion}
                  <span className="ml-1 text-[11px] text-gray-400">· {ORIGEN[m.origen]}</span>
                </td>
                <td className="mono px-3 py-1.5 text-right whitespace-nowrap text-ok">{m.tipo === 'ingreso' ? bs(m.monto) : ''}</td>
                <td className="mono px-3 py-1.5 text-right whitespace-nowrap text-error">{m.tipo === 'egreso' ? bs(m.monto) : ''}</td>
                <td className="px-3 py-1.5 text-right text-[13px] font-medium">
                  {(m.origen === 'manual' || m.origen === 'transferencia' || m.origen === 'arqueo') &&
                    !m.id.endsWith(':entra') && (
                      <button onClick={() => quitar(m)} className="text-error hover:underline">
                        Quitar
                      </button>
                    )}
                </td>
              </tr>
            ))}
            {lista.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-gray-500">
                  No hay movimientos{filtroCaja || filtroCat ? ' con ese filtro' : ' este mes'}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Pie({ onCerrar, onGuardar, texto, error, pendiente }: { onCerrar: () => void; onGuardar: () => void; texto: string; error: string | null; pendiente: boolean }) {
  return (
    <>
      {error && <p className="mt-3 rounded-lg bg-error-suave px-3 py-2 text-xs text-error">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onCerrar} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
          Cancelar
        </button>
        <button onClick={onGuardar} disabled={pendiente} className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-[#265dc2] disabled:opacity-60">
          {texto}
        </button>
      </div>
    </>
  );
}

function ModalMovimiento({
  clase,
  categorias,
  onCerrar,
}: {
  clase: 'ingreso' | 'egreso' | 'transferencia';
  categorias: CategoriaCajaDTO[];
  onCerrar: () => void;
}) {
  const mutar = useMutacionCaja();
  const transferencia = clase === 'transferencia';
  const [v, setV] = useState({
    caja: 'efectivo' as Caja,
    cajaDestino: 'banco' as Caja,
    fecha: hoyLocalISO(),
    monto: '',
    categoriaId: '',
    descripcion: transferencia ? 'Depósito al banco' : '',
  });
  const [error, setError] = useState<string | null>(null);
  const opciones = categorias.filter((c) => c.tipo === clase && c.activo);
  const onGuardar = async () => {
    setError(null);
    if (!PATRON_BS.test(v.monto.trim()) || aCent(v.monto) <= 0) return setError('Monto inválido (ej. 1250)');
    if (!transferencia && !v.categoriaId) return setError('Elegí la categoría');
    if (!v.descripcion.trim()) return setError('Describí el movimiento');
    try {
      await mutar.mutateAsync({
        tipo: 'movimiento',
        input: {
          tipo: clase,
          caja: v.caja,
          ...(transferencia ? { cajaDestino: v.cajaDestino } : { categoriaId: v.categoriaId }),
          fecha: v.fecha,
          monto: aCent(v.monto),
          descripcion: v.descripcion,
        },
      });
      onCerrar();
    } catch (e) {
      setError(mensaje(e));
    }
  };
  const titulo = { ingreso: 'Anotar ingreso', egreso: 'Anotar gasto', transferencia: 'Transferir entre cajas' }[clase];
  return (
    <Modal onCerrar={onCerrar}>
      <h2 className="text-lg font-semibold">{titulo}</h2>
      {!transferencia && (
        <p className="mt-1 text-xs text-gray-500">
          Cobros, compras de insumos, pagos a proveedores, comida, cuota del banco, anticipos y el cierre de mes entran
          solos: no los anotes acá.
        </p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <SelectorCaja
          etiqueta={transferencia ? 'Sale de' : clase === 'ingreso' ? 'Entra a' : 'Sale de'}
          valor={v.caja}
          onCambiar={(caja) => setV({ ...v, caja, cajaDestino: caja === 'efectivo' ? 'banco' : 'efectivo' })}
        />
        {transferencia ? (
          <SelectorCaja etiqueta="Entra a" valor={v.cajaDestino} onCambiar={(cajaDestino) => setV({ ...v, cajaDestino })} />
        ) : (
          <div>
            <label className="mb-1 block text-sm font-medium">Categoría</label>
            <select value={v.categoriaId} onChange={(e) => setV({ ...v, categoriaId: e.target.value })} className={claseInput}>
              <option value="">Elegir…</option>
              {opciones.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium">Fecha</label>
          <input type="date" value={v.fecha} onChange={(e) => setV({ ...v, fecha: e.target.value })} className={claseInput} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Monto (Bs)</label>
          <input value={v.monto} onChange={(e) => setV({ ...v, monto: e.target.value })} inputMode="decimal" className={`mono ${claseInput}`} />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">Detalle</label>
          <input
            value={v.descripcion}
            onChange={(e) => setV({ ...v, descripcion: e.target.value })}
            placeholder={clase === 'egreso' ? 'ej. Luz CRE de octubre' : 'ej. aporte de la familia'}
            className={claseInput}
          />
        </div>
      </div>
      <Pie onCerrar={onCerrar} onGuardar={() => void onGuardar()} texto="Guardar" error={error} pendiente={mutar.isPending} />
    </Modal>
  );
}

function ModalArqueo({ caja, saldo, onCerrar }: { caja: Caja; saldo: number; onCerrar: () => void }) {
  const mutar = useMutacionCaja();
  const [fecha, setFecha] = useState(hoyLocalISO());
  const [contado, setContado] = useState('');
  const [nota, setNota] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ sistema: number; diferencia: number } | null>(null);
  const onGuardar = async () => {
    setError(null);
    if (!/^\d+([.,]\d{1,2})?$/.test(contado.trim())) return setError('Indicá cuánto contaste (ej. 1520.50)');
    try {
      const r = (await mutar.mutateAsync({ tipo: 'arqueo', input: { caja, fecha, contado: aCent(contado), nota } })) as {
        sistema: number;
        diferencia: number;
      };
      setResultado(r);
    } catch (e) {
      setError(mensaje(e));
    }
  };
  return (
    <Modal onCerrar={onCerrar}>
      <h2 className="text-lg font-semibold">Arqueo · {ETIQUETA_CAJA[caja]}</h2>
      {resultado ? (
        <>
          <p className="mt-3 text-sm text-gray-700">
            El sistema decía <span className="mono font-semibold">{bs(resultado.sistema)}</span>.{' '}
            {resultado.diferencia === 0 ? (
              <strong className="text-ok">¡Cuadró exacto!</strong>
            ) : (
              <>
                Quedó anotado un <strong className={resultado.diferencia > 0 ? 'text-ok' : 'text-error'}>
                  {resultado.diferencia > 0 ? 'sobrante' : 'faltante'} de {bs(Math.abs(resultado.diferencia))}
                </strong>
                . Si encontrás el motivo (un gasto sin anotar, algo en la caja equivocada), corregilo y quitá el arqueo.
              </>
            )}
          </p>
          <div className="mt-5 flex justify-end">
            <button onClick={onCerrar} className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white">
              Listo
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-xs text-gray-500">
            Contá la plata de la caja y escribí cuánto hay. Hoy el sistema dice {bs(saldo)} al fin del mes que estás viendo.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Fecha</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={claseInput} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Contaste (Bs)</label>
              <input value={contado} onChange={(e) => setContado(e.target.value)} inputMode="decimal" className={`mono ${claseInput}`} />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium">Nota</label>
              <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="opcional" className={claseInput} />
            </div>
          </div>
          <Pie onCerrar={onCerrar} onGuardar={() => void onGuardar()} texto="Guardar arqueo" error={error} pendiente={mutar.isPending} />
        </>
      )}
    </Modal>
  );
}

function ModalInicio({ caja, actual, onCerrar }: { caja: Caja; actual: ResumenCajaDTO; onCerrar: () => void }) {
  const mutar = useMutacionCaja();
  const [desde, setDesde] = useState(actual.desde ?? hoyLocalISO());
  const [saldo, setSaldo] = useState(actual.configurada ? formatBs(actual.saldoInicial).replace(/ /g, '') : '');
  const [error, setError] = useState<string | null>(null);
  const onGuardar = async () => {
    setError(null);
    if (!PATRON_BS.test(saldo.trim())) return setError('Indicá con cuánto empezás (ej. 2500)');
    try {
      await mutar.mutateAsync({ tipo: 'inicio', caja, input: { desde, saldoInicial: aCent(saldo) } });
      onCerrar();
    } catch (e) {
      setError(mensaje(e));
    }
  };
  return (
    <Modal onCerrar={onCerrar}>
      <h2 className="text-lg font-semibold">Inicio de la caja · {ETIQUETA_CAJA[caja]}</h2>
      <p className="mt-1 text-xs text-gray-500">
        Desde esta fecha la caja cuenta todo lo que entra y sale. Lo anterior no se cuenta (el sistema tiene anticipos y
        compras de antes de llevar caja). Lo ideal: el día que contás la plata por primera vez.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={claseInput} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Saldo inicial (Bs)</label>
          <input value={saldo} onChange={(e) => setSaldo(e.target.value)} inputMode="decimal" className={`mono ${claseInput}`} />
        </div>
      </div>
      <Pie onCerrar={onCerrar} onGuardar={() => void onGuardar()} texto="Guardar" error={error} pendiente={mutar.isPending} />
    </Modal>
  );
}

function ModalCategorias({ categorias, onCerrar }: { categorias: CategoriaCajaDTO[]; onCerrar: () => void }) {
  const mutar = useMutacionCaja();
  const [nueva, setNueva] = useState({ nombre: '', tipo: 'egreso' as 'ingreso' | 'egreso' });
  const [editando, setEditando] = useState<{ id: string; nombre: string } | null>(null);
  const error = mutar.error != null ? mensaje(mutar.error) : null;
  const grupo = (tipo: 'ingreso' | 'egreso', titulo: string) => (
    <div>
      <div className="mb-1 text-xs font-semibold tracking-wider text-gray-500 uppercase">{titulo}</div>
      {categorias
        .filter((c) => c.tipo === tipo)
        .map((c) => (
          <div key={c.id} className={`flex items-center justify-between gap-2 border-b border-gray-100 py-1.5 text-sm ${c.activo ? '' : 'opacity-50'}`}>
            {editando?.id === c.id ? (
              <input
                autoFocus
                value={editando.nombre}
                onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') mutar.mutate({ tipo: 'editarCategoria', id: c.id, input: { nombre: editando.nombre } }, { onSuccess: () => setEditando(null) });
                }}
                className="rounded border border-gray-300 px-2 py-0.5"
              />
            ) : (
              <span>
                {c.nombre}
                {c.clave && <span className="ml-1 text-[10px] text-gray-400">(la usa el sistema)</span>}
              </span>
            )}
            <span className="flex gap-3 text-xs font-medium">
              {editando?.id === c.id ? (
                <button onClick={() => mutar.mutate({ tipo: 'editarCategoria', id: c.id, input: { nombre: editando.nombre } }, { onSuccess: () => setEditando(null) })} className="text-acento">
                  Guardar
                </button>
              ) : (
                <button onClick={() => setEditando({ id: c.id, nombre: c.nombre })} className="text-acento hover:underline">
                  Renombrar
                </button>
              )}
              {!c.clave && (
                <button onClick={() => mutar.mutate({ tipo: 'editarCategoria', id: c.id, input: { activo: !c.activo } })} className="text-gray-600 hover:underline">
                  {c.activo ? 'Desactivar' : 'Activar'}
                </button>
              )}
            </span>
          </div>
        ))}
    </div>
  );
  return (
    <Modal onCerrar={onCerrar} ancho="max-w-lg">
      <h2 className="text-lg font-semibold">Categorías de la caja</h2>
      <div className="mt-3 max-h-[55vh] space-y-4 overflow-y-auto pr-1">
        {grupo('egreso', 'Gastos')}
        {grupo('ingreso', 'Ingresos')}
      </div>
      <div className="mt-4 flex gap-2">
        <input value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} placeholder="Nueva categoría" className={claseInput} />
        <select value={nueva.tipo} onChange={(e) => setNueva({ ...nueva, tipo: e.target.value as 'ingreso' | 'egreso' })} className="rounded-lg border border-gray-300 px-2 text-sm">
          <option value="egreso">gasto</option>
          <option value="ingreso">ingreso</option>
        </select>
        <button
          onClick={() => nueva.nombre.trim() && mutar.mutate({ tipo: 'crearCategoria', input: nueva }, { onSuccess: () => setNueva({ ...nueva, nombre: '' }) })}
          className="rounded-lg bg-acento px-3 text-sm font-semibold whitespace-nowrap text-white"
        >
          Agregar
        </button>
      </div>
      {error && <p className="mt-3 rounded-lg bg-error-suave px-3 py-2 text-xs text-error">{error}</p>}
      <div className="mt-4 flex justify-end">
        <button onClick={onCerrar} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
          Cerrar
        </button>
      </div>
    </Modal>
  );
}
