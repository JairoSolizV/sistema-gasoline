import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  aCentavos,
  bsAUsd,
  formatBs,
  totalPorDocena,
  usdABs,
  type CajaBs,
  type ClienteDTO,
  type EstadoPedido,
  type Moneda,
  type PedidoDTO,
} from '@taller/shared';
import {
  useClientes,
  useCobros,
  useDeposito,
  useDespachos,
  useMutacionDinero,
  usePedidos,
} from '../../api/dinero';
import { useFichasCosto } from '../../api/costos';
import { useCortes } from '../../api/cortes';
import { ErrorApi } from '../../api/client';
import { Modal } from '../../components/Modal';
import { SelectorCaja } from '../../components/SelectorCaja';
import { TABLA } from '../../components/tabla';
import { hoyLocalISO } from '../../lib/fechas';
import { CampoTasa, tasaTexto, useTasa } from '../../components/CampoTasa';
import { enDocenas, fechaCorta } from '../costos/formato';

// Ventas (docs/PLAN_TABLERO_DINERO.md): pedidos de clientes (modelos en puerta),
// despachos desde el depósito, cobros y clientes. Se vende por docena en $us; cada
// despacho y cobro guarda el tipo de cambio del día (docs/PLAN_DOLARES.md). No
// toca ningún pago.

const PESTANAS = [
  { clave: 'pedidos', etiqueta: 'Pedidos' },
  { clave: 'despachos', etiqueta: 'Despachos' },
  { clave: 'cobros', etiqueta: 'Cobros' },
  { clave: 'clientes', etiqueta: 'Clientes' },
] as const;
type Pestana = (typeof PESTANAS)[number]['clave'];

const PATRON_BS = /^\d+([.,]\d{1,2})?$/;
const bs = (c: number) => `Bs ${formatBs(c)}`;
const usd = (c: number) => `$us ${formatBs(c)}`;
const aCent = (s: string) => aCentavos(s.trim().replace(',', '.'));
const claseInput =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-acento';
const mensaje = (e: unknown) => (e instanceof ErrorApi ? e.message : 'Error al guardar');
/** 'aaaa-mm-dd' + n días. */
const masDias = (dia: string, n: number) => {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const botonPrincipal = 'rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-[#265dc2] disabled:opacity-60';
const botonSecundario = 'rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50';

const ESTADO: Record<EstadoPedido, { texto: string; clase: string }> = {
  pendiente: { texto: 'en puerta', clase: 'bg-amber-50 text-amber-700' },
  en_produccion: { texto: 'en producción', clase: 'bg-[rgba(47,111,224,0.1)] text-acento' },
  entregado: { texto: 'entregado', clase: 'bg-ok-suave text-ok' },
  cancelado: { texto: 'cancelado', clase: 'bg-gray-100 text-gray-500' },
};

export function VentasPage() {
  const [parametros, setParametros] = useSearchParams();
  const pedida = parametros.get('tab') as Pestana | null;
  const activa: Pestana = PESTANAS.some((p) => p.clave === pedida) ? pedida! : 'pedidos';
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Ventas</h1>
      <p className="mt-1 text-sm text-gray-500">
        Pedidos de tus clientes, lo que despachás, lo que te pagan y cuánto te debe cada uno.
      </p>
      <div className="mt-5 flex gap-1 border-b border-gray-200">
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
      <div className="mt-4">
        {activa === 'pedidos' && <PedidosTab />}
        {activa === 'despachos' && <DespachosTab />}
        {activa === 'cobros' && <CobrosTab />}
        {activa === 'clientes' && <ClientesTab />}
      </div>
    </div>
  );
}

function SelectorCliente({ valor, onCambiar }: { valor: string; onCambiar: (id: string) => void }) {
  const { data: clientes } = useClientes();
  return (
    <select value={valor} onChange={(e) => onCambiar(e.target.value)} className={claseInput}>
      <option value="">Elegir cliente…</option>
      {clientes
        ?.filter((c) => c.activo)
        .map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
            {c.porCobrarUsd > 0 ? ` (debe ${usd(c.porCobrarUsd)})` : ''}
          </option>
        ))}
    </select>
  );
}

function PieModal({
  onCerrar,
  onGuardar,
  texto,
  error,
  pendiente,
}: {
  onCerrar: () => void;
  onGuardar: () => void;
  texto: string;
  error: string | null;
  pendiente: boolean;
}) {
  return (
    <>
      {error && <p className="mt-3 rounded-lg bg-error-suave px-3 py-2 text-xs text-error">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onCerrar} className={botonSecundario}>
          Cancelar
        </button>
        <button onClick={onGuardar} disabled={pendiente} className={botonPrincipal}>
          {texto}
        </button>
      </div>
    </>
  );
}

// ── Pedidos ──

function PedidosTab() {
  const { data: pedidos, isLoading } = usePedidos();
  const mutar = useMutacionDinero();
  const [nuevo, setNuevo] = useState(false);
  const [vincular, setVincular] = useState<PedidoDTO | null>(null);
  const [verTodos, setVerTodos] = useState(false);
  const lista = (pedidos ?? []).filter((p) => verTodos || p.estado === 'pendiente' || p.estado === 'en_produccion');
  const estado = (p: PedidoDTO, e: EstadoPedido) => mutar.mutate({ tipo: 'editarPedido', id: p.id, input: { estado: e } });

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={verTodos} onChange={(e) => setVerTodos(e.target.checked)} /> Ver también
          entregados y cancelados
        </label>
        <button onClick={() => setNuevo(true)} className={botonPrincipal}>
          + Nuevo pedido
        </button>
      </div>
      {mutar.error != null && <p className="mb-3 rounded-lg bg-error-suave px-3 py-2 text-xs text-error">{mensaje(mutar.error)}</p>}
      <div className={TABLA.contenedor}>
        <table className="text-sm">
          <thead className={TABLA.cabecera}>
            <tr className={TABLA.filaCabecera}>
              <th className="px-3 py-2.5">Entrega</th>
              <th className="px-3 py-2.5">Cliente</th>
              <th className="px-3 py-2.5">Modelo</th>
              <th className="px-3 py-2.5 text-right">Prendas</th>
              <th className="px-3 py-2.5 text-right">Docena $us</th>
              <th className="px-3 py-2.5 text-right">Vale $us</th>
              <th className="px-3 py-2.5 text-right">Costo Bs</th>
              <th className="px-3 py-2.5">Estado</th>
              <th className="px-3 py-2.5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={9} className="px-5 py-8 text-center text-gray-500">
                  Cargando…
                </td>
              </tr>
            )}
            {lista.map((p) => (
              <tr key={p.id} className={TABLA.fila}>
                <td className="px-3 py-2 whitespace-nowrap text-gray-600">{p.fechaEntrega ? fechaCorta(p.fechaEntrega) : '—'}</td>
                <td className="max-w-[180px] px-3 py-2 font-medium">{p.cliente.nombre}</td>
                <td className="max-w-[240px] px-3 py-2">
                  {p.ficha.nombre}
                  {p.notas && <div className="text-xs text-gray-500">{p.notas}</div>}
                </td>
                <td className="mono px-3 py-2 text-right">{p.prendas}</td>
                <td className="mono px-3 py-2 text-right whitespace-nowrap">{usd(p.precioDocenaUsd)}</td>
                <td className="mono px-3 py-2 text-right font-semibold whitespace-nowrap text-ok">{usd(p.ventaUsd)}</td>
                <td className="mono px-3 py-2 text-right whitespace-nowrap text-gray-600">{bs(p.costo)}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ESTADO[p.estado].clase}`}>
                    {ESTADO[p.estado].texto}
                  </span>
                  {p.corte && <span className="ml-1 text-xs text-gray-500">COD {p.corte.codigo}</span>}
                </td>
                <td className="px-3 py-2 text-right text-[13px] font-medium whitespace-nowrap">
                  {p.estado === 'pendiente' && (
                    <button onClick={() => setVincular(p)} className="mr-3 text-acento hover:underline">
                      Empezar corte
                    </button>
                  )}
                  {p.estado === 'en_produccion' && (
                    <button onClick={() => estado(p, 'entregado')} className="mr-3 text-ok hover:underline">
                      Entregado
                    </button>
                  )}
                  {(p.estado === 'pendiente' || p.estado === 'en_produccion') && (
                    <button onClick={() => estado(p, 'cancelado')} className="mr-3 text-gray-600 hover:underline">
                      Cancelar
                    </button>
                  )}
                  <button onClick={() => mutar.mutate({ tipo: 'quitarPedido', id: p.id })} className="text-error hover:underline">
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
            {!isLoading && lista.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-10 text-center text-gray-500">
                  No hay pedidos. Cargá lo que te encargan tus clientes para verlo en el tablero.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {nuevo && <ModalPedido onCerrar={() => setNuevo(false)} />}
      {vincular && <ModalVincular pedido={vincular} onCerrar={() => setVincular(null)} />}
    </>
  );
}

function ModalPedido({ onCerrar }: { onCerrar: () => void }) {
  const { data: fichas } = useFichasCosto();
  const mutar = useMutacionDinero();
  const [v, setV] = useState({ clienteId: '', fichaId: '', prendas: '', precio: '', fechaEntrega: '', notas: '' });
  const [error, setError] = useState<string | null>(null);
  const cambiar = (k: keyof typeof v, valor: string) => setV((x) => ({ ...x, [k]: valor }));
  const ficha = fichas?.find((f) => f.id === v.fichaId);

  const onGuardar = async () => {
    setError(null);
    if (!v.clienteId) return setError('Elegí el cliente');
    if (!v.fichaId) return setError('Elegí el modelo');
    if (!(Number(v.prendas) > 0)) return setError('Indicá cuántas prendas');
    if (v.precio.trim() && !PATRON_BS.test(v.precio.trim())) return setError('Precio de la docena inválido (ej. 85.50)');
    try {
      await mutar.mutateAsync({
        tipo: 'crearPedido',
        input: {
          clienteId: v.clienteId,
          fichaId: v.fichaId,
          prendas: Number(v.prendas),
          ...(v.precio.trim() ? { precioDocenaUsd: aCent(v.precio) } : {}),
          ...(v.fechaEntrega ? { fechaEntrega: v.fechaEntrega } : {}),
          notas: v.notas,
        },
      });
      onCerrar();
    } catch (e) {
      setError(mensaje(e));
    }
  };

  return (
    <Modal onCerrar={onCerrar} ancho="max-w-lg">
      <h2 className="text-lg font-semibold">Nuevo pedido</h2>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">Cliente</label>
          <SelectorCliente valor={v.clienteId} onCambiar={(id) => cambiar('clienteId', id)} />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">Modelo (ficha de costo)</label>
          <select value={v.fichaId} onChange={(e) => cambiar('fichaId', e.target.value)} className={claseInput}>
            <option value="">Elegir modelo…</option>
            {fichas?.map((f) => (
              <option key={f.id} value={f.id}>
                {f.codigo ? `${f.codigo} · ` : ''}
                {f.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Prendas</label>
          <input value={v.prendas} onChange={(e) => cambiar('prendas', e.target.value.replace(/\D/g, ''))} inputMode="numeric" className={`mono ${claseInput}`} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Precio de la docena ($us)</label>
          <input
            value={v.precio}
            onChange={(e) => cambiar('precio', e.target.value)}
            inputMode="decimal"
            placeholder={ficha ? formatBs(ficha.ventaDocenaUsd) : 'el de la ficha'}
            className={`mono ${claseInput}`}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Fecha de entrega</label>
          <input type="date" value={v.fechaEntrega} onChange={(e) => cambiar('fechaEntrega', e.target.value)} className={claseInput} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Notas</label>
          <input value={v.notas} onChange={(e) => cambiar('notas', e.target.value)} className={claseInput} />
        </div>
      </div>
      {ficha && Number(v.prendas) > 0 && (
        <p className="mt-3 text-sm text-gray-600">
          Vale{' '}
          <span className="mono font-semibold text-ok">
            {usd(
              totalPorDocena(
                Number(v.prendas),
                v.precio.trim() && PATRON_BS.test(v.precio.trim()) ? aCent(v.precio) : ficha.ventaDocenaUsd,
              ),
            )}
          </span>
        </p>
      )}
      <PieModal onCerrar={onCerrar} onGuardar={() => void onGuardar()} texto="Guardar pedido" error={error} pendiente={mutar.isPending} />
    </Modal>
  );
}

function ModalVincular({ pedido, onCerrar }: { pedido: PedidoDTO; onCerrar: () => void }) {
  const { data: cortes } = useCortes('abierto');
  const mutar = useMutacionDinero();
  const [corteId, setCorteId] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal onCerrar={onCerrar}>
      <h2 className="text-lg font-semibold">Empezar corte</h2>
      <p className="mt-2 text-sm text-gray-600">
        Elegí el corte con el que se produce el pedido de {pedido.cliente.nombre} ({pedido.prendas} × {pedido.ficha.nombre}). El
        pedido pasa a producción y el corte se valora a su precio.
      </p>
      <select value={corteId} onChange={(e) => setCorteId(e.target.value)} className={`mt-3 ${claseInput}`}>
        <option value="">Elegir corte abierto…</option>
        {cortes?.map((c) => (
          <option key={c.id} value={c.id}>
            COD {c.codigo} · {c.modeloNombre} ({c.cantidadTotal} prendas)
          </option>
        ))}
      </select>
      <PieModal
        onCerrar={onCerrar}
        texto="Vincular"
        error={error}
        pendiente={mutar.isPending}
        onGuardar={() =>
          corteId
            ? mutar.mutate(
                { tipo: 'editarPedido', id: pedido.id, input: { corteId } },
                { onSuccess: onCerrar, onError: (e) => setError(mensaje(e)) },
              )
            : setError('Elegí el corte')
        }
      />
    </Modal>
  );
}

// ── Despachos ──

function DespachosTab() {
  const { data: despachos, isLoading } = useDespachos();
  const mutar = useMutacionDinero();
  const [nuevo, setNuevo] = useState(false);
  return (
    <>
      <div className="mb-3 flex justify-end">
        <button onClick={() => setNuevo(true)} className={botonPrincipal}>
          + Registrar despacho
        </button>
      </div>
      <div className={TABLA.contenedor}>
        <table className="text-sm">
          <thead className={TABLA.cabecera}>
            <tr className={TABLA.filaCabecera}>
              <th className="px-3 py-2.5">Fecha</th>
              <th className="px-3 py-2.5">Cliente</th>
              <th className="px-3 py-2.5">Qué se despachó</th>
              <th className="px-3 py-2.5 text-right">Prendas</th>
              <th className="px-3 py-2.5 text-right">Venta $us</th>
              <th className="px-3 py-2.5 text-right">Venta Bs</th>
              <th className="px-3 py-2.5 text-right">Costo Bs</th>
              <th className="px-3 py-2.5 text-right">Ganancia Bs</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={9} className="px-5 py-8 text-center text-gray-500">
                  Cargando…
                </td>
              </tr>
            )}
            {despachos?.map((d) => (
              <tr key={d.id} className={TABLA.fila}>
                <td className="px-3 py-2 whitespace-nowrap text-gray-600">{fechaCorta(d.fecha)}</td>
                <td className="max-w-[180px] px-3 py-2 font-medium">{d.cliente.nombre}</td>
                <td className="max-w-[300px] px-3 py-2 text-xs text-gray-600">
                  {d.lineas.map((l) => (
                    <div key={l.id}>
                      {enDocenas(l.prendas)} · {l.descripcion} a {usd(l.precioDocenaUsd)} la docena
                      {l.detalle && <span className="text-gray-400"> · {l.detalle}</span>}
                    </div>
                  ))}
                </td>
                <td className="mono px-3 py-2 text-right whitespace-nowrap">{enDocenas(d.prendas)}</td>
                <td className="mono px-3 py-2 text-right font-semibold whitespace-nowrap">{usd(d.totalUsd)}</td>
                <td className="mono px-3 py-2 text-right whitespace-nowrap">
                  {bs(d.totalBs)}
                  <div className="text-[11px] text-gray-400">a {tasaTexto(d.tasaCambio)}</div>
                </td>
                <td className="mono px-3 py-2 text-right whitespace-nowrap text-gray-600">{bs(d.costo)}</td>
                <td className={`mono px-3 py-2 text-right whitespace-nowrap ${d.totalBs - d.costo < 0 ? 'text-error' : 'text-ok'}`}>
                  {bs(d.totalBs - d.costo)}
                </td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => mutar.mutate({ tipo: 'quitarDespacho', id: d.id })} className="text-[13px] font-medium text-error hover:underline">
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
            {despachos?.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-10 text-center text-gray-500">
                  Todavía no hay despachos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {nuevo && <ModalDespacho onCerrar={() => setNuevo(false)} />}
    </>
  );
}

// se despacha en docenas surtidas; las sueltas y la talla/color, si no va surtido
type LineaForm = {
  clave: string;
  corteId?: string;
  fichaId?: string;
  docenas: string;
  sueltas: string;
  precio: string;
  detalle: string;
};
const prendasDe = (l: LineaForm) => (Number(l.docenas) || 0) * 12 + (Number(l.sueltas) || 0);

function ModalDespacho({ onCerrar }: { onCerrar: () => void }) {
  const { data: deposito } = useDeposito();
  const { data: fichas } = useFichasCosto();
  const mutar = useMutacionDinero();
  const { data: clientes } = useClientes();
  const [clienteId, setClienteId] = useState('');
  const [fecha, setFecha] = useState(hoyLocalISO());
  const [vence, setVence] = useState(''); // vacío = fecha + plazo del cliente
  const [notas, setNotas] = useState('');
  const plazo = clientes?.find((c) => c.id === clienteId)?.plazoDias ?? 30;
  const venceVivo = vence || masDias(fecha, plazo);
  const [lineas, setLineas] = useState<LineaForm[]>([]);
  const [error, setError] = useState<string | null>(null);
  const tasa = useTasa();
  const cambiar = (clave: string, k: 'docenas' | 'sueltas' | 'precio' | 'detalle', valor: string) =>
    setLineas((ls) => ls.map((l) => (l.clave === clave ? { ...l, [k]: valor } : l)));
  const agregar = (valor: string) => {
    if (!valor) return;
    const [tipo, id] = valor.split(':');
    setLineas((ls) => [...ls, { clave: crypto.randomUUID(), ...(tipo === 'corte' ? { corteId: id } : { fichaId: id }), docenas: '', sueltas: '', precio: '', detalle: '' }]);
  };
  const info = (l: LineaForm) => {
    if (l.corteId) {
      const c = deposito?.find((x) => x.corteId === l.corteId);
      return { nombre: c ? `COD ${c.codigo} · ${c.modeloNombre}` : 'corte', precio: c?.precioDocenaUsd ?? null, max: c?.disponibles };
    }
    const f = fichas?.find((x) => x.id === l.fichaId);
    return { nombre: f?.nombre ?? 'ficha', precio: f?.ventaDocenaUsd ?? null, max: undefined };
  };
  // precio de la docena en $us: el escrito o el del pedido/ficha
  const precioDe = (l: LineaForm) => (l.precio.trim() && PATRON_BS.test(l.precio.trim()) ? aCent(l.precio) : info(l).precio ?? 0);
  const total = lineas.reduce((a, l) => a + totalPorDocena(prendasDe(l), precioDe(l)), 0);

  const onGuardar = async () => {
    setError(null);
    if (!clienteId) return setError('Elegí el cliente');
    if (lineas.length === 0) return setError('Agregá al menos un corte o modelo');
    if (lineas.some((l) => prendasDe(l) <= 0)) return setError('Indicá las docenas (o sueltas) de cada línea');
    if (lineas.some((l) => l.precio.trim() && !PATRON_BS.test(l.precio.trim()))) return setError('Hay un precio inválido');
    if (tasa.tasa == null) return setError('Tipo de cambio inválido (ej. 6.96)');
    try {
      await mutar.mutateAsync({
        tipo: 'crearDespacho',
        input: {
          clienteId,
          fecha,
          vence: venceVivo,
          tasaCambio: tasa.tasa,
          notas,
          lineas: lineas.map((l) => ({
            ...(l.corteId ? { corteId: l.corteId } : { fichaId: l.fichaId }),
            prendas: prendasDe(l),
            ...(l.precio.trim() ? { precioDocenaUsd: aCent(l.precio) } : {}),
            ...(l.detalle.trim() ? { detalle: l.detalle } : {}),
          })),
        },
      });
      onCerrar();
    } catch (e) {
      setError(mensaje(e));
    }
  };

  return (
    <Modal onCerrar={onCerrar} ancho="max-w-2xl">
      <h2 className="text-lg font-semibold">Registrar despacho</h2>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Cliente</label>
          <SelectorCliente valor={clienteId} onCambiar={setClienteId} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Fecha</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={claseInput} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Te lo paga el</label>
          <input type="date" value={venceVivo} onChange={(e) => setVence(e.target.value)} className={claseInput} />
          <p className="mt-0.5 text-[11px] text-gray-400">plazo del cliente: {plazo} días</p>
        </div>
      </div>
      <label className="mt-4 mb-1 block text-sm font-medium">Agregar del depósito o de un modelo</label>
      <select value="" onChange={(e) => agregar(e.target.value)} className={claseInput}>
        <option value="">Elegir…</option>
        <optgroup label="Cortes terminados (depósito)">
          {deposito?.map((c) => (
            <option key={c.corteId} value={`corte:${c.corteId}`}>
              COD {c.codigo} · {c.modeloNombre} — quedan {c.disponibles}
              {c.etapa === 'servicios' ? ' (con prendas en servicios)' : ''}
            </option>
          ))}
        </optgroup>
        <optgroup label="Modelo sin corte en el sistema">
          {fichas?.map((f) => (
            <option key={f.id} value={`ficha:${f.id}`}>
              {f.nombre}
            </option>
          ))}
        </optgroup>
      </select>
      {lineas.length > 0 && (
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
              <th className="py-1">Qué</th>
              <th className="py-1 text-right">Docenas</th>
              <th className="py-1 text-right">Sueltas</th>
              <th className="py-1 text-right">Docena $us</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lineas.map((l) => {
              const i = info(l);
              return (
                <tr key={l.clave} className="border-t border-gray-100">
                  <td className="py-1.5 pr-2">
                    {i.nombre}
                    {i.max != null && <span className="text-xs text-gray-400"> · quedan {enDocenas(i.max)}</span>}
                    <input
                      value={l.detalle}
                      onChange={(e) => cambiar(l.clave, 'detalle', e.target.value)}
                      placeholder="surtido · o talla y color (ej. 12 de la 30 negro)"
                      className="mt-1 block w-full rounded border border-gray-200 px-2 py-0.5 text-xs"
                    />
                  </td>
                  <td className="py-1.5 text-right align-top">
                    <input value={l.docenas} onChange={(e) => cambiar(l.clave, 'docenas', e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="mono w-16 rounded-lg border border-gray-300 px-2 py-1 text-right" />
                  </td>
                  <td className="py-1.5 text-right align-top">
                    <input value={l.sueltas} onChange={(e) => cambiar(l.clave, 'sueltas', e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="mono w-14 rounded-lg border border-gray-300 px-2 py-1 text-right" />
                  </td>
                  <td className="py-1.5 text-right align-top">
                    <input
                      value={l.precio}
                      onChange={(e) => cambiar(l.clave, 'precio', e.target.value)}
                      inputMode="decimal"
                      placeholder={i.precio != null ? formatBs(i.precio) : 'precio'}
                      className="mono w-24 rounded-lg border border-gray-300 px-2 py-1 text-right"
                    />
                  </td>
                  <td className="py-1.5 pl-2 text-right align-top">
                    <button onClick={() => setLineas((ls) => ls.filter((x) => x.clave !== l.clave))} className="text-error">
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <CampoTasa valor={tasa.valor} onCambiar={tasa.setTexto} />
        <div>
          <label className="mb-1 block text-sm font-medium">Notas</label>
          <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="opcional" className={claseInput} />
        </div>
      </div>
      {total > 0 && (
        <p className="mt-3 text-sm text-gray-600">
          Total del despacho <span className="mono font-semibold">{usd(total)}</span>
          {tasa.tasa != null && <span className="mono text-gray-500"> (= {bs(usdABs(total, tasa.tasa))})</span>} · queda por
          cobrar al cliente
        </p>
      )}
      <PieModal onCerrar={onCerrar} onGuardar={() => void onGuardar()} texto="Registrar despacho" error={error} pendiente={mutar.isPending} />
    </Modal>
  );
}

// ── Cobros ──

function CobrosTab() {
  const { data: cobros, isLoading } = useCobros();
  const mutar = useMutacionDinero();
  const [nuevo, setNuevo] = useState(false);
  return (
    <>
      <div className="mb-3 flex justify-end">
        <button onClick={() => setNuevo(true)} className={botonPrincipal}>
          + Registrar cobro
        </button>
      </div>
      <div className={TABLA.contenedor}>
        <table className="text-sm">
          <thead className={TABLA.cabecera}>
            <tr className={TABLA.filaCabecera}>
              <th className="px-3 py-2.5">Fecha</th>
              <th className="px-3 py-2.5">Cliente</th>
              <th className="px-3 py-2.5 text-right">Cobrado</th>
              <th className="px-3 py-2.5 text-right">Equivale a</th>
              <th className="px-3 py-2.5">Nota</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-gray-500">
                  Cargando…
                </td>
              </tr>
            )}
            {cobros?.map((c) => (
              <tr key={c.id} className={TABLA.fila}>
                <td className="px-3 py-2 whitespace-nowrap text-gray-600">{fechaCorta(c.fecha)}</td>
                <td className="max-w-[200px] px-3 py-2 font-medium">{c.cliente.nombre}</td>
                <td className="mono px-3 py-2 text-right font-semibold whitespace-nowrap text-ok">
                  {c.moneda === 'USD' ? usd(c.monto) : bs(c.monto)}
                </td>
                <td className="mono px-3 py-2 text-right whitespace-nowrap text-gray-500">
                  {c.moneda === 'USD' ? bs(c.bs) : usd(c.usd)}
                  <div className="text-[11px] text-gray-400">a {tasaTexto(c.tasaCambio)}</div>
                </td>
                <td className="max-w-[260px] px-3 py-2 text-xs text-gray-600">{c.nota ?? '—'}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => mutar.mutate({ tipo: 'quitarCobro', id: c.id })} className="text-[13px] font-medium text-error hover:underline">
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
            {cobros?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-gray-500">
                  Todavía no hay cobros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {nuevo && <ModalCobro onCerrar={() => setNuevo(false)} />}
    </>
  );
}

export function ModalCobro({ onCerrar, clienteId = '' }: { onCerrar: () => void; clienteId?: string }) {
  const { data: clientes } = useClientes();
  const mutar = useMutacionDinero();
  const [v, setV] = useState({
    clienteId,
    fecha: hoyLocalISO(),
    moneda: 'USD' as Moneda,
    monto: '',
    nota: '',
    caja: 'efectivo' as CajaBs,
  });
  const [error, setError] = useState<string | null>(null);
  const tasa = useTasa();
  const cliente = clientes?.find((c) => c.id === v.clienteId);
  const enUsd = v.moneda === 'USD';
  const monto = PATRON_BS.test(v.monto.trim()) ? aCent(v.monto) : null;
  const onGuardar = async () => {
    setError(null);
    if (!v.clienteId) return setError('Elegí el cliente');
    if (monto == null || monto <= 0) return setError('Monto inválido (ej. 1500)');
    if (tasa.tasa == null) return setError('Tipo de cambio inválido (ej. 6.96)');
    try {
      await mutar.mutateAsync({
        tipo: 'crearCobro',
        input: { clienteId: v.clienteId, fecha: v.fecha, moneda: v.moneda, monto, tasaCambio: tasa.tasa, nota: v.nota, caja: v.caja },
      });
      onCerrar();
    } catch (e) {
      setError(mensaje(e));
    }
  };
  return (
    <Modal onCerrar={onCerrar}>
      <h2 className="text-lg font-semibold">Registrar cobro</h2>
      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Cliente</label>
          <SelectorCliente valor={v.clienteId} onCambiar={(id) => setV({ ...v, clienteId: id })} />
          {cliente && <p className="mt-1 text-xs text-gray-500">Te debe {usd(cliente.porCobrarUsd)}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">¿En qué te pagó?</label>
          <div className="flex gap-2">
            {(['USD', 'BOB'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setV({ ...v, moneda: m })}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                  v.moneda === m ? 'border-acento bg-[rgba(47,111,224,0.08)] font-semibold text-acento' : 'border-gray-300'
                }`}
              >
                {m === 'USD' ? '💵 Dólares ($us)' : 'Bolivianos (Bs)'}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Fecha</label>
            <input type="date" value={v.fecha} onChange={(e) => setV({ ...v, fecha: e.target.value })} className={claseInput} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Monto ({enUsd ? '$us' : 'Bs'})</label>
            <input value={v.monto} onChange={(e) => setV({ ...v, monto: e.target.value })} inputMode="decimal" className={`mono ${claseInput}`} />
          </div>
        </div>
        <CampoTasa valor={tasa.valor} onCambiar={tasa.setTexto} />
        {monto != null && monto > 0 && tasa.tasa != null && (
          <p className="text-sm text-gray-600">
            Equivale a{' '}
            <span className="mono font-semibold">{enUsd ? bs(usdABs(monto, tasa.tasa)) : usd(bsAUsd(monto, tasa.tasa))}</span>
            {!enUsd && <span> · se descuenta eso de lo que te debe</span>}
          </p>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium">Nota</label>
          <input value={v.nota} onChange={(e) => setV({ ...v, nota: e.target.value })} placeholder="opcional" className={claseInput} />
        </div>
        {enUsd ? (
          <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">Entra a la caja de dólares.</p>
        ) : (
          <SelectorCaja valor={v.caja} onCambiar={(caja) => setV({ ...v, caja })} etiqueta="Entró a" />
        )}
      </div>
      <PieModal onCerrar={onCerrar} onGuardar={() => void onGuardar()} texto="Registrar cobro" error={error} pendiente={mutar.isPending} />
    </Modal>
  );
}

// ── Clientes ──

function ClientesTab() {
  const { data: clientes, isLoading } = useClientes();
  const mutar = useMutacionDinero();
  const [modal, setModal] = useState<ClienteDTO | 'nuevo' | null>(null);
  return (
    <>
      <div className="mb-3 flex justify-end">
        <button onClick={() => setModal('nuevo')} className={botonPrincipal}>
          + Nuevo cliente
        </button>
      </div>
      {mutar.error != null && <p className="mb-3 rounded-lg bg-error-suave px-3 py-2 text-xs text-error">{mensaje(mutar.error)}</p>}
      <div className={TABLA.contenedor}>
        <table className="text-sm">
          <thead className={TABLA.cabecera}>
            <tr className={TABLA.filaCabecera}>
              <th className="px-3 py-2.5">Cliente</th>
              <th className="px-3 py-2.5">Celular</th>
              <th className="px-3 py-2.5 text-right">Plazo</th>
              <th className="px-3 py-2.5 text-right">Despachado $us</th>
              <th className="px-3 py-2.5 text-right">Cobrado $us</th>
              <th className="px-3 py-2.5 text-right">Te debe $us</th>
              <th className="px-3 py-2.5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-gray-500">
                  Cargando…
                </td>
              </tr>
            )}
            {clientes?.map((c) => (
              <tr key={c.id} className={`${TABLA.fila} ${c.activo ? '' : 'opacity-50'}`}>
                <td className="max-w-[220px] px-3 py-2">
                  <div className="font-medium">{c.nombre}</div>
                  {c.notas && <div className="text-xs text-gray-500">{c.notas}</div>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-gray-600">{c.celular ?? '—'}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap text-gray-600">
                  {c.plazoDias === 0 ? 'contado' : `${c.plazoDias} días`}
                </td>
                <td className="mono px-3 py-2 text-right whitespace-nowrap">{usd(c.despachadoUsd)}</td>
                <td className="mono px-3 py-2 text-right whitespace-nowrap text-gray-600">{usd(c.cobradoUsd)}</td>
                <td className={`mono px-3 py-2 text-right font-semibold whitespace-nowrap ${c.porCobrarUsd > 0 ? 'text-acento' : 'text-gray-400'}`}>
                  {usd(c.porCobrarUsd)}
                </td>
                <td className="px-3 py-2 text-right text-[13px] font-medium whitespace-nowrap">
                  <button onClick={() => setModal(c)} className="mr-3 text-acento hover:underline">
                    Editar
                  </button>
                  {c.tieneMovimientos ? (
                    <button
                      onClick={() => mutar.mutate({ tipo: 'editarCliente', id: c.id, input: { activo: !c.activo } })}
                      className="text-gray-600 hover:underline"
                    >
                      {c.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  ) : (
                    <button onClick={() => mutar.mutate({ tipo: 'quitarCliente', id: c.id })} className="text-error hover:underline">
                      Eliminar
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {clientes?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-gray-500">
                  Todavía no hay clientes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {modal && <ModalCliente cliente={modal === 'nuevo' ? null : modal} onCerrar={() => setModal(null)} />}
    </>
  );
}

function ModalCliente({ cliente, onCerrar }: { cliente: ClienteDTO | null; onCerrar: () => void }) {
  const mutar = useMutacionDinero();
  const [v, setV] = useState({
    nombre: cliente?.nombre ?? '',
    celular: cliente?.celular ?? '',
    notas: cliente?.notas ?? '',
    plazo: String(cliente?.plazoDias ?? 30),
  });
  const [error, setError] = useState<string | null>(null);
  const onGuardar = async () => {
    setError(null);
    if (!v.nombre.trim()) return setError('El nombre es obligatorio');
    if (!/^\d{1,3}$/.test(v.plazo)) return setError('Plazo inválido (días, 0 = al contado)');
    const input = { nombre: v.nombre, celular: v.celular, notas: v.notas, plazoDias: Number(v.plazo) };
    try {
      await mutar.mutateAsync(
        cliente ? { tipo: 'editarCliente', id: cliente.id, input } : { tipo: 'crearCliente', input },
      );
      onCerrar();
    } catch (e) {
      setError(mensaje(e));
    }
  };
  return (
    <Modal onCerrar={onCerrar}>
      <h2 className="text-lg font-semibold">{cliente ? 'Editar cliente' : 'Nuevo cliente'}</h2>
      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Nombre</label>
          <input value={v.nombre} onChange={(e) => setV({ ...v, nombre: e.target.value })} className={claseInput} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Celular</label>
          <input value={v.celular} onChange={(e) => setV({ ...v, celular: e.target.value })} placeholder="opcional" className={claseInput} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Notas</label>
          <input value={v.notas} onChange={(e) => setV({ ...v, notas: e.target.value })} placeholder="ej. tienda, feria, mayorista" className={claseInput} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Plazo para pagar (días)</label>
          <input
            value={v.plazo}
            onChange={(e) => setV({ ...v, plazo: e.target.value.replace(/\D/g, '') })}
            inputMode="numeric"
            className={`mono w-28 ${claseInput}`}
          />
          <p className="mt-0.5 text-[11px] text-gray-400">0 = paga al contado. Cada despacho se puede cambiar.</p>
        </div>
      </div>
      <PieModal onCerrar={onCerrar} onGuardar={() => void onGuardar()} texto="Guardar" error={error} pendiente={mutar.isPending} />
    </Modal>
  );
}
