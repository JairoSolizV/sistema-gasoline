import { useState } from 'react';
import { CATEGORIAS_INSUMO, type CategoriaInsumo, type InsumoDTO, type InsumoInput } from '@taller/shared';
import { useCrearConteo, useEliminarInsumo, useGuardarInsumo, useInsumos } from '../../api/costos';
import { hoyLocalISO } from '../../lib/fechas';
import { ErrorApi } from '../../api/client';
import { Modal } from '../../components/Modal';
import { TABLA } from '../../components/tabla';
import {
  aMilesimas,
  bsUnitario,
  deMilesimas,
  ETIQUETA_CATEGORIA,
  fechaCorta,
  PATRON_DECIMAL,
  UNIDAD_SUGERIDA,
} from './formato';

const claseInput =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-acento';
const mensaje = (e: unknown) => (e instanceof ErrorApi ? e.message : 'Error al guardar');

/** Detalle corto de un insumo según su categoría (20/3 · 2930, 18 cm · YKK…). */
export function detalleInsumo(i: InsumoDTO): string {
  return [
    i.titulo,
    i.color,
    i.codigo && `cód. ${i.codigo}`,
    i.anchoCm && `${i.anchoCm} cm de ancho`,
    i.medidaCm && `${i.medidaCm} cm`,
    i.marca,
    i.numeroLlave && `llave ${i.numeroLlave}`,
    i.rendimiento && `rinde ${i.rendimiento} prendas/cono`,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function InsumosTab() {
  const { data: insumos, isLoading } = useInsumos();
  const eliminar = useEliminarInsumo();
  const [modal, setModal] = useState<InsumoDTO | 'nuevo' | null>(null);
  const [contar, setContar] = useState<InsumoDTO | null>(null);
  const [filtro, setFiltro] = useState<CategoriaInsumo | ''>('');
  const lista = (insumos ?? []).filter((i) => !filtro || i.categoria === filtro);

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as CategoriaInsumo | '')}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Todas las categorías</option>
          {CATEGORIAS_INSUMO.map((c) => (
            <option key={c} value={c}>
              {ETIQUETA_CATEGORIA[c]}
            </option>
          ))}
        </select>
        <button
          onClick={() => setModal('nuevo')}
          className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-[#265dc2]"
        >
          + Nuevo insumo
        </button>
      </div>
      {eliminar.error != null && (
        <p className="mb-3 rounded-lg bg-error-suave px-3 py-2 text-xs text-error">{mensaje(eliminar.error)}</p>
      )}
      <div className={TABLA.contenedor}>
        <table className="text-sm">
          <thead className={TABLA.cabecera}>
            <tr className={TABLA.filaCabecera}>
              <th className="px-3 py-2.5">Insumo</th>
              <th className="px-3 py-2.5">Categoría</th>
              <th className="px-3 py-2.5 text-right">Precio actual</th>
              <th className="px-3 py-2.5">Última compra</th>
              <th className="px-3 py-2.5">Comprado para</th>
              <th className="px-3 py-2.5 text-right">Stock</th>
              <th className="px-3 py-2.5 text-right">Acciones</th>
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
            {lista.map((i) => (
              <tr key={i.id} className={`${TABLA.fila} ${i.activo ? '' : 'opacity-50'}`}>
                <td className="max-w-[240px] px-3 py-2">
                  <div className="font-medium">{i.nombre}</div>
                  <div className="text-xs text-gray-500">{detalleInsumo(i)}</div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-gray-600">{ETIQUETA_CATEGORIA[i.categoria]}</td>
                <td className="mono px-3 py-2 text-right whitespace-nowrap">
                  {i.precioUnitarioBs != null ? (
                    <>
                      {bsUnitario(i.precioUnitarioBs)}
                      <span className="text-xs text-gray-500"> / {i.unidad}</span>
                    </>
                  ) : (
                    <span className="text-xs text-amber-700">sin compras</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs whitespace-nowrap text-gray-500">
                  {i.ultimaCompra ? (
                    <>
                      {fechaCorta(i.ultimaCompra.fecha)}
                      <div className="text-[11px] text-gray-400">{i.ultimaCompra.tienda}</div>
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="max-w-[140px] px-3 py-2 text-xs text-gray-600">
                  {i.codigosCorte.length > 0 ? (
                    <span title="Códigos de corte de sus compras, el más reciente primero">
                      COD {i.codigosCorte.join(', ')}
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="mono px-3 py-2 text-right whitespace-nowrap">
                  <span className={i.stock.stock < 0 ? 'text-error' : ''}>
                    {deMilesimas(i.stock.stock)} {i.unidad}
                  </span>
                  <div className="text-[11px] font-normal text-gray-400">
                    {i.stock.conteo ? `contado el ${fechaCorta(i.stock.conteo.fecha)}` : 'sin conteo'}
                  </div>
                </td>
                <td className="px-3 py-2 text-right text-[13px] font-medium whitespace-nowrap">
                  <button onClick={() => setContar(i)} className="mr-3 text-acento hover:underline">
                    Contar
                  </button>
                  <button onClick={() => setModal(i)} className="text-acento hover:underline">
                    Editar
                  </button>
                  {i.compras === 0 && i.usadoEnFichas === 0 && (
                    <button
                      onClick={() => eliminar.mutate(i.id)}
                      className="ml-3 text-error hover:underline"
                    >
                      Eliminar
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!isLoading && lista.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-gray-500">
                  No hay insumos {filtro ? 'en esta categoría' : 'cargados'}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {modal && <ModalInsumo insumo={modal === 'nuevo' ? null : modal} onCerrar={() => setModal(null)} />}
      {contar && <ModalConteo insumo={contar} onCerrar={() => setContar(null)} />}
    </>
  );
}

function ModalInsumo({ insumo, onCerrar }: { insumo: InsumoDTO | null; onCerrar: () => void }) {
  const guardar = useGuardarInsumo();
  const [v, setV] = useState({
    nombre: insumo?.nombre ?? '',
    categoria: insumo?.categoria ?? ('tela' as CategoriaInsumo),
    unidad: insumo?.unidad ?? 'metro',
    color: insumo?.color ?? '',
    codigo: insumo?.codigo ?? '',
    titulo: insumo?.titulo ?? '',
    anchoCm: insumo?.anchoCm?.toString() ?? '',
    marca: insumo?.marca ?? '',
    numeroLlave: insumo?.numeroLlave ?? '',
    medidaCm: insumo?.medidaCm?.toString() ?? '',
    rendimiento: insumo?.rendimiento?.toString() ?? '',
    notas: insumo?.notas ?? '',
    activo: insumo?.activo ?? true,
  });
  const [error, setError] = useState<string | null>(null);
  const cambiar = (k: keyof typeof v, valor: string | boolean) => setV((x) => ({ ...x, [k]: valor }));
  const entero = (s: string) => (s.trim() === '' ? null : Number(s));

  const onGuardar = async () => {
    setError(null);
    for (const [k, etiqueta] of [
      ['anchoCm', 'El ancho'],
      ['medidaCm', 'La medida'],
      ['rendimiento', 'El rendimiento'],
    ] as const) {
      const n = entero(v[k]);
      if (n != null && (!Number.isInteger(n) || n < 1)) return setError(`${etiqueta} debe ser un número entero`);
    }
    const input: InsumoInput = {
      nombre: v.nombre,
      categoria: v.categoria,
      unidad: v.unidad,
      color: v.color,
      codigo: v.codigo,
      titulo: v.titulo,
      anchoCm: entero(v.anchoCm),
      marca: v.marca,
      numeroLlave: v.numeroLlave,
      medidaCm: entero(v.medidaCm),
      rendimiento: entero(v.rendimiento),
      notas: v.notas,
    };
    await guardar.mutateAsync({ id: insumo?.id ?? null, input: insumo ? { ...input, activo: v.activo } : input });
    onCerrar();
  };

  const campo = (k: keyof typeof v, etiqueta: string, placeholder = '') => (
    <div>
      <label className="mb-1 block text-sm font-medium">{etiqueta}</label>
      <input
        value={String(v[k])}
        onChange={(e) => cambiar(k, e.target.value)}
        placeholder={placeholder}
        className={claseInput}
      />
    </div>
  );

  return (
    <Modal onCerrar={onCerrar} ancho="max-w-lg">
      <h2 className="text-lg font-semibold">{insumo ? 'Editar insumo' : 'Nuevo insumo'}</h2>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="col-span-2">{campo('nombre', 'Nombre', 'ej. Tela MR 11-1, Hilo 20/3, Cierre 18 cm')}</div>
        <div>
          <label className="mb-1 block text-sm font-medium">Categoría</label>
          <select
            value={v.categoria}
            onChange={(e) => {
              const c = e.target.value as CategoriaInsumo;
              setV((x) => ({ ...x, categoria: c, unidad: insumo ? x.unidad : UNIDAD_SUGERIDA[c] }));
            }}
            className={claseInput}
          >
            {CATEGORIAS_INSUMO.map((c) => (
              <option key={c} value={c}>
                {ETIQUETA_CATEGORIA[c]}
              </option>
            ))}
          </select>
        </div>
        {campo('unidad', 'Unidad', 'metro, cono, unidad…')}
        {v.categoria === 'hilo' && (
          <>
            {campo('titulo', 'Título', 'ej. 20/3')}
            {campo('rendimiento', 'Prendas que rinde un cono', 'ej. 100')}
          </>
        )}
        {v.categoria === 'tela' && campo('anchoCm', 'Ancho (cm)', 'ej. 190')}
        {v.categoria === 'cierre' && (
          <>
            {campo('marca', 'Marca', 'ej. YKK')}
            {campo('numeroLlave', 'N° de llave', 'ej. 4.5')}
            {campo('medidaCm', 'Medida (cm)', 'ej. 18')}
          </>
        )}
        {campo('color', 'Color')}
        {campo('codigo', 'Código')}
        <div className="col-span-2">{campo('notas', 'Notas')}</div>
        {insumo && (
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={v.activo} onChange={(e) => cambiar('activo', e.target.checked)} />
            Activo (desactivalo si ya no se compra)
          </label>
        )}
      </div>
      {(error || guardar.error != null) && (
        <p className="mt-3 rounded-lg bg-error-suave px-3 py-2 text-xs text-error">{error ?? mensaje(guardar.error)}</p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onCerrar} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
          Cancelar
        </button>
        <button
          onClick={() => void onGuardar().catch(() => undefined)}
          disabled={guardar.isPending}
          className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-[#265dc2] disabled:opacity-60"
        >
          Guardar
        </button>
      </div>
    </Modal>
  );
}

/** Conteo físico: lo que hay hoy en el depósito. Desde acá el stock suma las
 *  compras y resta el consumo de los cortes posteriores (PLAN_COSTOS §7b). */
function ModalConteo({ insumo, onCerrar }: { insumo: InsumoDTO; onCerrar: () => void }) {
  const crear = useCrearConteo();
  const [fecha, setFecha] = useState(hoyLocalISO());
  const [cantidad, setCantidad] = useState('');
  const [error, setError] = useState<string | null>(null);
  const onGuardar = async () => {
    setError(null);
    if (!PATRON_DECIMAL.test(cantidad.trim())) return setError('Cantidad inválida (ej. 350 o 12.5)');
    await crear.mutateAsync({ insumoId: insumo.id, fecha, cantidad: aMilesimas(cantidad) });
    onCerrar();
  };
  return (
    <Modal onCerrar={onCerrar}>
      <h2 className="text-lg font-semibold">Contar {insumo.nombre}</h2>
      <p className="mt-2 text-sm text-gray-600">
        El sistema calcula hoy <span className="mono font-semibold">{deMilesimas(insumo.stock.stock)} {insumo.unidad}</span>.
        Anotá lo que hay de verdad: desde esa fecha el stock suma las compras y resta lo que gasten los
        cortes.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Fecha del conteo</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={claseInput} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Cantidad ({insumo.unidad})</label>
          <input value={cantidad} onChange={(e) => setCantidad(e.target.value)} inputMode="decimal" className={`mono ${claseInput}`} />
        </div>
      </div>
      {(error || crear.error != null) && (
        <p className="mt-3 rounded-lg bg-error-suave px-3 py-2 text-xs text-error">{error ?? mensaje(crear.error)}</p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onCerrar} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
          Cancelar
        </button>
        <button
          onClick={() => void onGuardar().catch(() => undefined)}
          disabled={crear.isPending}
          className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-[#265dc2] disabled:opacity-60"
        >
          Guardar conteo
        </button>
      </div>
    </Modal>
  );
}
