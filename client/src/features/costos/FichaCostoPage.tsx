import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  aCentavos,
  costoFicha,
  docenaEnDolares,
  formatBs,
  medidaCierrePorDefecto,
  prendaBsDeDocenaUsd,
  precioUnitario,
  type CategoriaInsumo,
  type CierrePorTalla,
  type FichaCostoDetalleDTO,
  type FichaCostoInput,
  type InsumoDTO,
  type LineaCostoDTO,
  type LineaCostoInput,
  type LineaParaCosto,
} from '@taller/shared';
import {
  useCostosFijos,
  useEliminarFichaCosto,
  useFichaCosto,
  useGuardarFichaCosto,
  useInsumos,
} from '../../api/costos';
import { useConfiguracion } from '../../api/configuracion';
import { useModelos } from '../../api/modelos';
import { ErrorApi } from '../../api/client';
import { Modal } from '../../components/Modal';
import { detalleInsumo } from './InsumosTab';
import {
  aCentesimasPct,
  aMilesimas,
  bsUnitario,
  deMilesimas,
  ETIQUETA_TIPO_LINEA,
  PATRON_BS,
  PATRON_DECIMAL,
  pct,
} from './formato';

// Ficha de costo por prenda (docs/PLAN_COSTOS.md §4 etapa 2). El cálculo en
// vivo usa las mismas funciones que la API (shared/costos.ts); lo guardado lo
// vuelve a calcular el server con los precios de la última compra.

type Tipo = LineaCostoDTO['tipo'];
interface Fila {
  tipo: Tipo;
  concepto: string;
  insumoId: string;
  cantidad: string; // por prenda (unidades)
  largoM: string; // tizado (metros)
  prendasPorCapa: string;
  rendimiento: string; // vacío = el del insumo
  montoBs: string;
  prendas: string;
  precioBs: string;
}

const FILA_VACIA: Omit<Fila, 'tipo'> = {
  concepto: '',
  insumoId: '',
  cantidad: '1',
  largoM: '',
  prendasPorCapa: '',
  rendimiento: '',
  montoBs: '',
  prendas: '',
  precioBs: '',
};
const CATEGORIA_DE: Partial<Record<Tipo, CategoriaInsumo>> = { tela_tizado: 'tela', hilo: 'hilo' };
const bs = (s: string) => aCentavos(s.trim().replace(',', '.'));
const entero = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s) : NaN);
const claseInput =
  'w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-acento';
const mensaje = (e: unknown) => (e instanceof ErrorApi ? e.message : 'Error al guardar');

function aFila(l: LineaCostoDTO): Fila {
  return {
    tipo: l.tipo,
    concepto: l.concepto,
    insumoId: l.insumo?.id ?? '',
    cantidad: l.cantidad != null ? deMilesimas(l.cantidad) : '1',
    largoM: l.largoMm != null ? deMilesimas(l.largoMm) : '',
    prendasPorCapa: l.prendasPorCapa?.toString() ?? '',
    rendimiento: l.rendimiento?.toString() ?? '',
    montoBs: l.monto != null ? (l.monto / 100).toFixed(2) : '',
    prendas: l.prendas?.toString() ?? '',
    precioBs: l.precio != null ? (l.precio / 100).toFixed(2) : '',
  };
}

/** Línea para la API, o un mensaje si le falta algo. */
function aLineaInput(f: Fila, i: number): LineaCostoInput | string {
  const n = `Línea ${i + 1}`;
  const concepto = f.concepto.trim() || ETIQUETA_TIPO_LINEA[f.tipo];
  switch (f.tipo) {
    case 'tela_tizado':
      if (!f.insumoId) return `${n}: elegí la tela`;
      if (!PATRON_DECIMAL.test(f.largoM.trim()) || !(entero(f.prendasPorCapa) > 0)) {
        return `${n}: indicá el largo del tizado (m) y las prendas por capa`;
      }
      return {
        tipo: 'tela_tizado',
        concepto,
        insumoId: f.insumoId,
        largoMm: aMilesimas(f.largoM),
        prendasPorCapa: entero(f.prendasPorCapa),
      };
    case 'hilo':
      if (!f.insumoId) return `${n}: elegí el hilo`;
      if (f.rendimiento.trim() && !(entero(f.rendimiento) > 0)) return `${n}: rendimiento inválido`;
      return {
        tipo: 'hilo',
        concepto,
        insumoId: f.insumoId,
        rendimiento: f.rendimiento.trim() ? entero(f.rendimiento) : null,
      };
    case 'por_prenda':
      if (!f.insumoId) return `${n}: elegí el insumo`;
      if (!PATRON_DECIMAL.test(f.cantidad.trim()) || aMilesimas(f.cantidad) < 1) return `${n}: cantidad inválida`;
      return { tipo: 'por_prenda', concepto, insumoId: f.insumoId, cantidad: aMilesimas(f.cantidad) };
    case 'precio_prenda':
      if (!PATRON_BS.test(f.precioBs.trim())) return `${n}: indicá el precio por prenda`;
      return { tipo: 'precio_prenda', concepto, precio: bs(f.precioBs) };
    case 'prorrateo':
      if (!PATRON_BS.test(f.montoBs.trim()) || !(entero(f.prendas) > 0)) {
        return `${n}: indicá el monto y entre cuántas prendas se reparte`;
      }
      return { tipo: 'prorrateo', concepto, monto: bs(f.montoBs), prendas: entero(f.prendas) };
  }
}

/** Costo en vivo de una fila con los precios de la última compra (null = no calculable). */
function aLineaCalculo(f: Fila, insumos: Map<string, InsumoDTO>): LineaParaCosto | null {
  const ins = insumos.get(f.insumoId);
  const precio = ins?.ultimaCompra ? precioUnitario(ins.ultimaCompra) : null;
  const l = aLineaInput(f, 0);
  if (typeof l === 'string') return null;
  switch (l.tipo) {
    case 'tela_tizado':
      return { tipo: 'tela_tizado', largoMm: l.largoMm, prendasPorCapa: l.prendasPorCapa, precio };
    case 'hilo': {
      const r = l.rendimiento ?? ins?.rendimiento ?? null;
      return { tipo: 'hilo', rendimiento: r ?? 1, precio: r ? precio : null };
    }
    case 'por_prenda':
      return { tipo: 'por_prenda', cantidad: l.cantidad, precio };
    case 'precio_prenda':
      return { tipo: 'precio_prenda', precio: l.precio };
    case 'prorrateo':
      return { tipo: 'prorrateo', monto: l.monto, prendas: l.prendas };
  }
}

export function FichaCostoPage() {
  const { fichaId } = useParams();
  const esNueva = fichaId === 'nueva';
  const { data: ficha, isLoading } = useFichaCosto(esNueva ? undefined : fichaId);
  if (!esNueva && (isLoading || !ficha)) return <div className="p-8 text-sm text-gray-500">Cargando…</div>;
  return <Editor key={ficha?.id ?? 'nueva'} ficha={esNueva ? null : ficha!} />;
}

function Editor({ ficha }: { ficha: FichaCostoDetalleDTO | null }) {
  const navigate = useNavigate();
  const { data: insumos } = useInsumos();
  const { data: modelos } = useModelos();
  const { data: config } = useConfiguracion();
  const ahora = new Date();
  const { data: fijos } = useCostosFijos(ahora.getFullYear(), ahora.getMonth() + 1);
  const guardar = useGuardarFichaCosto();
  const eliminar = useEliminarFichaCosto();

  const [codigo, setCodigo] = useState(ficha?.codigo ?? '');
  const [nombre, setNombre] = useState(ficha?.nombre ?? '');
  const [modeloId, setModeloId] = useState(ficha?.modelo?.id ?? '');
  const [manoBs, setManoBs] = useState(ficha?.manoDeObraManual != null ? (ficha.manoDeObraManual / 100).toFixed(2) : '');
  const [empaqueBs, setEmpaqueBs] = useState(ficha?.empaqueManual != null ? (ficha.empaqueManual / 100).toFixed(2) : '');
  const [servicio, setServicio] = useState(ficha?.servicioCorteInterno ?? true);
  const [margenPct, setMargenPct] = useState(ficha?.margenPropio != null ? String(ficha.margenPropio / 100) : '');
  // precio fijo de la docena en $us (docs/PLAN_DOLARES.md); vacío = costo + margen
  const [docenaUsd, setDocenaUsd] = useState(ficha?.precioDocenaFijo ? (ficha.ventaDocenaUsd / 100).toFixed(2) : '');
  const [notas, setNotas] = useState(ficha?.notas ?? '');
  const [filas, setFilas] = useState<Fila[]>(ficha?.lineas.map(aFila) ?? []);
  // requerimiento de insumos: medida del cierre de cada talla ([] = regla por defecto)
  const [cierres, setCierres] = useState<CierrePorTalla[]>(ficha?.cierresPorTalla ?? []);
  const [error, setError] = useState<string | null>(null);
  const [sucio, setSucio] = useState(false);
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);
  useEffect(() => setSucio(true), [codigo, nombre, modeloId, manoBs, empaqueBs, servicio, margenPct, docenaUsd, notas, filas, cierres]);
  useEffect(() => setSucio(false), []); // recién cargada: sin cambios

  const porId = useMemo(() => new Map((insumos ?? []).map((i) => [i.id, i])), [insumos]);
  const cambiarFila = (i: number, cambio: Partial<Fila>) =>
    setFilas((fs) => fs.map((f, k) => (k === i ? { ...f, ...cambio } : f)));
  const agregar = (tipo: Tipo, concepto = '') => setFilas((fs) => [...fs, { ...FILA_VACIA, tipo, concepto }]);

  // ── cálculo en vivo (mismas funciones que la API) ──
  const vinculado = Boolean(modeloId);
  const mismoModelo = ficha?.modelo?.id === modeloId;
  const manoDeObra = vinculado ? (mismoModelo ? ficha!.manoDeObra : null) : PATRON_BS.test(manoBs.trim()) ? bs(manoBs) : 0;
  const empaque = vinculado ? (mismoModelo ? ficha!.empaque : null) : PATRON_BS.test(empaqueBs.trim()) ? bs(empaqueBs) : 0;
  const servicioCorte =
    servicio && config
      ? config.tarifaBusqueda +
        config.tarifaTrazado +
        config.tarifaDobladoHoja +
        config.tarifaCorteRespaldo +
        config.tarifaClasificacionRespaldo
      : 0;
  const margen = margenPct.trim() ? aCentesimasPct(margenPct) : (config?.margenVenta ?? 0);
  const calculo = costoFicha({
    lineas: filas.map(
      (f) => aLineaCalculo(f, porId) ?? { tipo: 'por_prenda', cantidad: 0, precio: null },
    ),
    manoDeObra: manoDeObra ?? 0,
    empaque: empaque ?? 0,
    servicioCorte,
    // costos fijos del taller ÷ prendas de referencia (vista previa; lo guardado lo
    // calcula el server con el presupuesto exacto)
    costoFijo: fijos
      ? { num: BigInt(fijos.presupuestoMensual), den: BigInt(fijos.prendasReferencia) }
      : undefined,
    margen,
  });
  const docenaFija = docenaUsd.trim() && PATRON_BS.test(docenaUsd.trim()) ? bs(docenaUsd) : null;
  const precioFijo = docenaFija != null && config ? { docena: docenaFija, tasa: config.tasaCambioUsd } : null;

  const onGuardar = async () => {
    setError(null);
    if (!nombre.trim()) return setError('Falta el nombre de la ficha');
    const lineas: LineaCostoInput[] = [];
    for (const [i, f] of filas.entries()) {
      const l = aLineaInput(f, i);
      if (typeof l === 'string') return setError(l);
      lineas.push(l);
    }
    if (!vinculado && manoBs.trim() && !PATRON_BS.test(manoBs.trim())) return setError('Mano de obra inválida');
    if (margenPct.trim() && !PATRON_DECIMAL.test(margenPct.trim())) return setError('Margen inválido (ej. 30)');
    if (docenaUsd.trim() && docenaFija == null) return setError('Precio de la docena inválido (ej. 85.50)');
    if (cierres.some((c) => !Number.isInteger(c.talla))) return setError('Talla inválida en los cierres');
    if (new Set(cierres.map((c) => c.talla)).size !== cierres.length) return setError('Hay una talla repetida en los cierres');
    const input: FichaCostoInput = {
      codigo,
      nombre,
      modeloId: modeloId || null,
      manoDeObra: !vinculado && manoBs.trim() ? bs(manoBs) : null,
      empaque: !vinculado && empaqueBs.trim() ? bs(empaqueBs) : null,
      servicioCorteInterno: servicio,
      margen: margenPct.trim() ? aCentesimasPct(margenPct) : null,
      precioDocenaUsd: docenaFija,
      notas,
      cierresPorTalla: cierres.length ? [...cierres].sort((a, b) => a.talla - b.talla) : null,
      lineas,
    };
    const guardada = await guardar.mutateAsync({ id: ficha?.id ?? null, input });
    setSucio(false);
    if (!ficha) navigate(`/costos/fichas/${guardada.id}`, { replace: true });
  };

  const opcionesInsumo = (tipo: Tipo) =>
    (insumos ?? []).filter((i) => (i.activo || filas.some((f) => f.insumoId === i.id)) && (!CATEGORIA_DE[tipo] || i.categoria === CATEGORIA_DE[tipo]));

  return (
    <div className="p-8">
      <div className="text-xs text-gray-500">
        <Link to="/costos" className="hover:underline">
          Costos
        </Link>{' '}
        / {ficha?.nombre ?? 'Nueva ficha'}
      </div>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div className="grid flex-1 grid-cols-[6rem_1fr] gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Código</label>
            <input value={codigo} onChange={(e) => setCodigo(e.target.value)} className={claseInput} placeholder="31" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Modelo</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={`${claseInput} text-base font-semibold`}
              placeholder="ej. CLASICO GSLN FRONT"
            />
          </div>
        </div>
        <ResumenCosto calculo={calculo} margen={margen} precioFijo={precioFijo} incompletoMO={manoDeObra == null} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold">Mano de obra y empaque</div>
          <label className="mt-3 mb-1 block text-xs font-medium text-gray-500">Vinculada a un modelo de Taller · Pagos</label>
          <select value={modeloId} onChange={(e) => setModeloId(e.target.value)} className={claseInput}>
            <option value="">Sin vincular (escribir a mano)</option>
            {modelos?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
          {vinculado ? (
            <p className="mt-2 text-xs text-gray-500">
              {manoDeObra != null
                ? `Costura Bs ${formatBs(manoDeObra)} · empaque Bs ${formatBs(empaque ?? 0)} (Σ CT de la última versión)`
                : 'Se toma de los CT del modelo al guardar.'}
            </p>
          ) : (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Costura (Bs/prenda)</label>
                <input value={manoBs} onChange={(e) => setManoBs(e.target.value)} inputMode="decimal" className={`mono ${claseInput}`} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Empaque (Bs/prenda)</label>
                <input value={empaqueBs} onChange={(e) => setEmpaqueBs(e.target.value)} inputMode="decimal" className={`mono ${claseInput}`} />
              </div>
            </div>
          )}
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold">Servicio de corte</div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={servicio} onChange={(e) => setServicio(e.target.checked)} />
            Corte interno (suma las tarifas de Configuración)
          </label>
          <p className="mt-2 text-xs text-gray-500">
            {servicio ? `Bs ${formatBs(servicioCorte)} por prenda: búsqueda, trazado, doblado, corte y clasificación` : 'Corte externo: no suma'}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold">Precio de venta</div>
          <label className="mt-3 mb-1 block text-xs font-medium text-gray-500">Precio fijo de la docena ($us)</label>
          <input
            value={docenaUsd}
            onChange={(e) => setDocenaUsd(e.target.value)}
            inputMode="decimal"
            placeholder={config ? `calculado: ${formatBs(docenaEnDolares(calculo.precioVenta, config.tasaCambioUsd))}` : ''}
            className={`mono ${claseInput} max-w-40`}
          />
          {precioFijo ? (
            <p className="mt-2 text-xs text-gray-500">
              = Bs {formatBs(prendaBsDeDocenaUsd(precioFijo.docena, precioFijo.tasa))} por prenda al último tipo de cambio (
              {precioFijo.tasa / 10_000}). Con precio fijo el margen no se usa.
            </p>
          ) : (
            <>
              <label className="mt-3 mb-1 block text-xs font-medium text-gray-500">Margen sobre el costo (%)</label>
              <input
                value={margenPct}
                onChange={(e) => setMargenPct(e.target.value)}
                inputMode="decimal"
                placeholder={config ? `general: ${config.margenVenta / 100}` : ''}
                className={`mono ${claseInput} max-w-32`}
              />
              <p className="mt-2 text-xs text-gray-500">
                Sin precio fijo: costo + margen. Vacío = el margen general de Configuración (
                {config ? pct(config.margenVenta) : '…'}).
              </p>
            </>
          )}
        </div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2.5">
          <span className="text-sm font-semibold">Materiales y servicios por prenda</span>
          <div className="flex flex-wrap gap-3 text-[13px] font-medium text-acento">
            <button onClick={() => agregar('tela_tizado', 'Tela')} className="hover:underline">+ Tela</button>
            <button onClick={() => agregar('hilo', 'Hilo')} className="hover:underline">+ Hilo</button>
            <button onClick={() => agregar('por_prenda')} className="hover:underline">+ Insumo</button>
            <button onClick={() => agregar('precio_prenda', 'Lavandería')} className="hover:underline">+ Lavandería / bordado</button>
            <button onClick={() => agregar('prorrateo', 'Flete')} className="hover:underline">+ Logística</button>
          </div>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {filas.map((f, i) => (
              <FilaEditor
                key={i}
                f={f}
                insumo={porId.get(f.insumoId)}
                opciones={opcionesInsumo(f.tipo)}
                costo={calculo.lineas[i]}
                onCambiar={(c) => cambiarFila(i, c)}
                onQuitar={() => setFilas((fs) => fs.filter((_, k) => k !== i))}
              />
            ))}
            {filas.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-gray-500">Agregá la tela, los hilos y los insumos del modelo.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <CierresPorTalla
        cierres={cierres}
        setCierres={setCierres}
        medidas={[
          ...new Set(
            (insumos ?? []).filter((i) => i.categoria === 'cierre' && i.medidaCm).map((i) => i.medidaCm!),
          ),
        ].sort((a, b) => a - b)}
      />

      <div className="mt-4">
        <label className="mb-1 block text-sm font-medium">Notas</label>
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} className={claseInput} />
      </div>

      {(error || guardar.error != null) && (
        <p className="mt-3 rounded-lg bg-error-suave px-3 py-2 text-sm text-error">{error ?? mensaje(guardar.error)}</p>
      )}
      <div className="mt-4 flex items-center justify-between gap-3">
        {ficha ? (
          <button onClick={() => setConfirmarBorrar(true)} className="text-sm font-medium text-error hover:underline">
            Eliminar ficha
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-3">
          {ficha && !sucio && <span className="text-sm text-gray-500">Guardada</span>}
          <button
            onClick={() => void onGuardar().catch(() => undefined)}
            disabled={guardar.isPending}
            className="rounded-lg bg-acento px-5 py-2 text-sm font-semibold text-white hover:bg-[#265dc2] disabled:opacity-60"
          >
            {ficha ? 'Guardar cambios' : 'Crear ficha'}
          </button>
        </div>
      </div>

      {confirmarBorrar && ficha && (
        <Modal onCerrar={() => setConfirmarBorrar(false)}>
          <h2 className="text-lg font-semibold">Eliminar ficha de costo</h2>
          <p className="mt-2 text-sm text-gray-600">
            Se elimina la ficha de <strong>{ficha.nombre}</strong>. Los insumos y compras quedan.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setConfirmarBorrar(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
              Cancelar
            </button>
            <button
              onClick={() => eliminar.mutate(ficha.id, { onSuccess: () => navigate('/costos') })}
              className="rounded-lg bg-error px-4 py-2 text-sm font-semibold text-white"
            >
              Eliminar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ResumenCosto({
  calculo,
  margen,
  precioFijo,
  incompletoMO,
}: {
  calculo: ReturnType<typeof costoFicha>;
  margen: number;
  precioFijo: { docena: number; tasa: number } | null;
  incompletoMO: boolean;
}) {
  const venta = precioFijo ? prendaBsDeDocenaUsd(precioFijo.docena, precioFijo.tasa) : calculo.precioVenta;
  const fila = (t: string, v: number) => (
    <div className="flex justify-between gap-6">
      <span className="text-gray-500">{t}</span>
      <span className="mono">Bs {formatBs(v)}</span>
    </div>
  );
  return (
    <div className="min-w-64 rounded-xl border border-gray-300 bg-white p-4 text-sm shadow-sm">
      {fila('Materiales y servicios', calculo.materiales)}
      {fila('Costura', calculo.manoDeObra)}
      {fila('Empaque', calculo.empaque)}
      {fila('Servicio de corte', calculo.servicioCorte)}
      {fila('Costos fijos del taller', calculo.costoFijo)}
      <div className="mt-2 flex justify-between gap-6 border-t border-gray-200 pt-2">
        <span className="font-semibold">Costo por prenda</span>
        <span className="mono text-lg font-semibold">Bs {formatBs(calculo.total)}</span>
      </div>
      <div className="flex justify-between gap-6">
        <span className="text-gray-500">
          {precioFijo ? `Venta ($us ${formatBs(precioFijo.docena)} la docena)` : `Venta (+${pct(margen)})`}
        </span>
        <span className="mono font-semibold text-ok">Bs {formatBs(venta)}</span>
      </div>
      {precioFijo && (
        <div className="flex justify-between gap-6">
          <span className="text-gray-500">Te deja por prenda</span>
          <span className={`mono font-semibold ${venta - calculo.total < 0 ? 'text-error' : 'text-ok'}`}>
            Bs {formatBs(venta - calculo.total)}
          </span>
        </div>
      )}
      {(calculo.incompleto || incompletoMO) && (
        <p className="mt-2 text-xs text-amber-700">
          {calculo.incompleto ? 'Hay insumos sin precio (registrá una compra): el costo es parcial.' : 'La mano de obra del modelo se calcula al guardar.'}
        </p>
      )}
    </div>
  );
}

function FilaEditor({
  f,
  insumo,
  opciones,
  costo,
  onCambiar,
  onQuitar,
}: {
  f: Fila;
  insumo: InsumoDTO | undefined;
  opciones: InsumoDTO[];
  costo: number | null;
  onCambiar: (c: Partial<Fila>) => void;
  onQuitar: () => void;
}) {
  const conInsumo = f.tipo === 'tela_tizado' || f.tipo === 'hilo' || f.tipo === 'por_prenda';
  const consumo =
    f.tipo === 'tela_tizado' && PATRON_DECIMAL.test(f.largoM.trim()) && entero(f.prendasPorCapa) > 0
      ? Number(f.largoM.replace(',', '.')) / entero(f.prendasPorCapa)
      : null;
  return (
    <tr className="border-b border-gray-200/70 even:bg-slate-100 align-top last:border-0">
      <td className="w-44 px-4 py-2">
        <input value={f.concepto} onChange={(e) => onCambiar({ concepto: e.target.value })} className={claseInput} />
        <div className="mt-0.5 text-[11px] text-gray-400">{ETIQUETA_TIPO_LINEA[f.tipo]}</div>
      </td>
      <td className="px-2 py-2">
        {conInsumo ? (
          <>
            <select
              value={f.insumoId}
              onChange={(e) => {
                const ins = opciones.find((o) => o.id === e.target.value);
                onCambiar({ insumoId: e.target.value, ...(ins && f.tipo === 'por_prenda' ? { concepto: ins.nombre } : {}) });
              }}
              className={claseInput}
            >
              <option value="">Elegir…</option>
              {opciones.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </select>
            {insumo && (
              <div className="mt-0.5 text-[11px] text-gray-500">
                {detalleInsumo(insumo) || insumo.unidad} ·{' '}
                {insumo.precioUnitarioBs != null ? (
                  `${bsUnitario(insumo.precioUnitarioBs)}/${insumo.unidad}`
                ) : (
                  <span className="text-amber-700">sin compras</span>
                )}
              </div>
            )}
          </>
        ) : f.tipo === 'precio_prenda' ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Bs/prenda</span>
            <input value={f.precioBs} onChange={(e) => onCambiar({ precioBs: e.target.value })} inputMode="decimal" className={`mono ${claseInput} max-w-28`} />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Bs</span>
            <input value={f.montoBs} onChange={(e) => onCambiar({ montoBs: e.target.value })} inputMode="decimal" className={`mono ${claseInput} max-w-28`} />
            <span className="text-xs text-gray-500">entre</span>
            <input value={f.prendas} onChange={(e) => onCambiar({ prendas: e.target.value })} inputMode="numeric" className={`mono ${claseInput} max-w-24`} />
            <span className="text-xs text-gray-500">prendas</span>
          </div>
        )}
      </td>
      <td className="w-64 px-2 py-2">
        {f.tipo === 'tela_tizado' && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <input value={f.largoM} onChange={(e) => onCambiar({ largoM: e.target.value })} placeholder="largo m" inputMode="decimal" className={`mono ${claseInput} max-w-20`} />
            ÷
            <input value={f.prendasPorCapa} onChange={(e) => onCambiar({ prendasPorCapa: e.target.value })} placeholder="prendas" inputMode="numeric" className={`mono ${claseInput} max-w-20`} />
            {consumo != null && <span className="mono whitespace-nowrap">= {consumo.toFixed(3)} m</span>}
          </div>
        )}
        {f.tipo === 'hilo' && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            rinde
            <input
              value={f.rendimiento}
              onChange={(e) => onCambiar({ rendimiento: e.target.value })}
              placeholder={insumo?.rendimiento?.toString() ?? '—'}
              inputMode="numeric"
              className={`mono ${claseInput} max-w-20`}
            />
            prendas/cono
          </div>
        )}
        {f.tipo === 'por_prenda' && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <input value={f.cantidad} onChange={(e) => onCambiar({ cantidad: e.target.value })} inputMode="decimal" className={`mono ${claseInput} max-w-20`} />
            {insumo?.unidad ?? 'u.'} por prenda
          </div>
        )}
      </td>
      <td className="mono w-28 px-2 py-2 pt-3.5 text-right font-semibold">
        {costo != null ? `Bs ${formatBs(costo)}` : <span className="text-xs font-normal text-amber-700">sin precio</span>}
      </td>
      <td className="w-10 px-2 py-2 pt-3 text-center">
        <button onClick={onQuitar} title="Quitar línea" className="text-gray-400 hover:text-error">
          ✕
        </button>
      </td>
    </tr>
  );
}

/** Requerimiento de insumos: qué cierre lleva cada talla de este modelo
 *  (docs/PLAN_REQUERIMIENTO.md). Sin filas, se usa la regla por defecto. */
function CierresPorTalla({
  cierres,
  setCierres,
  medidas,
}: {
  cierres: CierrePorTalla[];
  setCierres: (c: CierrePorTalla[]) => void;
  medidas: number[];
}) {
  const opciones = medidas.length ? medidas : [12, 15, 18];
  const cambiar = (i: number, c: Partial<CierrePorTalla>) =>
    setCierres(cierres.map((x, k) => (k === i ? { ...x, ...c } : x)));
  const siguiente = () => {
    const ultima = cierres.length ? Math.max(...cierres.map((c) => c.talla)) + 2 : 40;
    setCierres([...cierres, { talla: ultima, medidaCm: medidaCierrePorDefecto(ultima) }]);
  };
  const porDefecto = () =>
    setCierres([40, 42, 44, 46, 48, 50, 52, 54].map((talla) => ({ talla, medidaCm: medidaCierrePorDefecto(talla) })));

  return (
    <div className="mt-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">Cierre por talla</div>
          <div className="text-xs text-gray-500">
            Para el requerimiento de insumos de los cortes de este modelo.
            {cierres.length === 0 && ' Sin filas usa la regla general: hasta la 44 → 12 cm, 46–48 → 15 cm, desde la 50 → 18 cm.'}
          </div>
        </div>
        <div className="flex gap-3 text-[13px] font-medium text-acento">
          {cierres.length === 0 && (
            <button onClick={porDefecto} className="hover:underline">
              Cargar 40 a 54 con la regla general
            </button>
          )}
          <button onClick={siguiente} className="hover:underline">
            + Talla
          </button>
        </div>
      </div>
      {cierres.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {cierres.map((c, i) => (
            <span key={i} className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2 py-1 text-sm">
              <input
                value={Number.isNaN(c.talla) ? '' : c.talla}
                onChange={(e) => cambiar(i, { talla: parseInt(e.target.value, 10) })}
                inputMode="numeric"
                className="mono w-12 rounded border border-gray-300 px-1 py-0.5 text-center outline-none focus:border-acento"
              />
              <span className="text-gray-400">→</span>
              <select
                value={c.medidaCm}
                onChange={(e) => cambiar(i, { medidaCm: Number(e.target.value) })}
                className="rounded border border-gray-300 px-1 py-0.5 outline-none focus:border-acento"
              >
                {[...new Set([...opciones, c.medidaCm])].sort((a, b) => a - b).map((m) => (
                  <option key={m} value={m}>
                    {m} cm
                  </option>
                ))}
              </select>
              <button
                onClick={() => setCierres(cierres.filter((_, k) => k !== i))}
                title="Quitar talla"
                className="text-gray-400 hover:text-error"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
