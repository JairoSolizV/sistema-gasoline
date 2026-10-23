import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  formatBs,
  type CatalogoFichaInput,
  type FotoFichaDTO,
  type ProductoCatalogoDTO,
} from '@taller/shared';
import { api, ErrorApi } from '../../api/client';
import { Modal } from '../../components/Modal';
import { BotonImprimir } from '../../components/Imprimir';

// Catálogo de productos: las fichas de costo con foto, tallas, colores y precio
// por docena (Bs y $us). Con "mostrar costos" apagado se le puede mostrar o
// imprimir al cliente.

const claseInput =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-acento';

const useCatalogo = () =>
  useQuery({ queryKey: ['costos', 'catalogo'], queryFn: () => api<ProductoCatalogoDTO[]>('/costos/catalogo') });

/** La foto se baja aparte (con el token) y se cachea por versión. */
function useFoto(p: ProductoCatalogoDTO) {
  return useQuery({
    queryKey: ['costos', 'foto', p.id, p.fotoVersion],
    queryFn: () => api<FotoFichaDTO>(`/costos/fichas/${p.id}/foto`),
    enabled: p.tieneFoto,
    staleTime: Infinity,
  });
}

/** Achica la imagen a ≤1000 px de lado y la pasa a JPEG (pesa mucho menos). */
async function achicar(archivo: File): Promise<FotoFichaDTO> {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, mal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => mal(new Error('No se pudo leer la imagen'));
      i.src = url;
    });
    const escala = Math.min(1, 1000 / Math.max(img.width, img.height));
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(img.width * escala);
    lienzo.height = Math.round(img.height * escala);
    lienzo.getContext('2d')!.drawImage(img, 0, 0, lienzo.width, lienzo.height);
    const dataUrl = lienzo.toDataURL('image/jpeg', 0.82);
    return { mime: 'image/jpeg', base64: dataUrl.slice(dataUrl.indexOf(',') + 1) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function CatalogoProductosPage() {
  const { data: productos, isLoading } = useCatalogo();
  const [costos, setCostos] = useState(false);
  const [buscar, setBuscar] = useState('');
  const [editar, setEditar] = useState<ProductoCatalogoDTO | null>(null);
  const q = buscar.trim().toLowerCase();
  const lista = (productos ?? []).filter(
    (p) => !q || `${p.codigo ?? ''} ${p.nombre} ${p.colores ?? ''}`.toLowerCase().includes(q),
  );

  return (
    <div className="p-8 print:p-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Catálogo de productos</h1>
          <p className="mt-1 text-sm text-gray-500 print:hidden">
            Tus modelos con foto, tallas, colores y precio por docena. Salen de las fichas de costo: un producto nuevo se
            crea como ficha en Costos de producción.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar…" className="w-44 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" />
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={costos} onChange={(e) => setCostos(e.target.checked)} /> Mostrar costos
          </label>
          <BotonImprimir texto="Imprimir" />
        </div>
      </div>
      {isLoading && <div className="mt-6 text-sm text-gray-500">Cargando…</div>}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 print:grid-cols-3">
        {lista.map((p) => (
          <Tarjeta key={p.id} p={p} costos={costos} onEditar={() => setEditar(p)} />
        ))}
      </div>
      {!isLoading && lista.length === 0 && <div className="mt-6 text-sm text-gray-500">No hay productos{q ? ' con esa búsqueda' : ''}.</div>}
      {editar && <ModalProducto p={editar} onCerrar={() => setEditar(null)} />}
    </div>
  );
}

function Foto({ p, clase }: { p: ProductoCatalogoDTO; clase: string }) {
  const { data } = useFoto(p);
  return data ? (
    <img src={`data:${data.mime};base64,${data.base64}`} alt={p.nombre} className={`${clase} object-cover`} />
  ) : (
    <div className={`${clase} flex items-center justify-center bg-gray-100 text-xs text-gray-400`}>sin foto</div>
  );
}

function Tarjeta({ p, costos, onEditar }: { p: ProductoCatalogoDTO; costos: boolean; onEditar: () => void }) {
  return (
    <div className="flex break-inside-avoid flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <Foto p={p} clase="aspect-[4/3] w-full" />
      <div className="flex flex-1 flex-col p-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-semibold">{p.nombre}</span>
          {p.codigo && <span className="mono text-xs text-gray-500">COD {p.codigo}</span>}
        </div>
        {p.descripcion && <p className="mt-0.5 text-xs text-gray-600">{p.descripcion}</p>}
        <dl className="mt-2 space-y-0.5 text-xs text-gray-600">
          <div>
            <span className="text-gray-400">Tallas:</span> {p.tallas ?? '—'}
          </div>
          <div>
            <span className="text-gray-400">Colores:</span> {p.colores ?? '—'}
          </div>
        </dl>
        <div className="mt-auto pt-3">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-gray-500">Docena</span>
            <span className="mono text-lg font-semibold text-ok">Bs {formatBs(p.precioDocena)}</span>
          </div>
          <div className="flex items-baseline justify-between text-xs text-gray-500">
            <span>Bs {formatBs(p.precioPrenda)} la prenda</span>
            <span className="mono">$us {formatBs(p.ventaDocenaUsd)}</span>
          </div>
          {costos && (
            <div className="mt-1 border-t border-gray-100 pt-1 text-xs text-gray-500">
              Costo: Bs {formatBs(p.costoPrenda)} la prenda · $us {formatBs(p.costoDocenaUsd)} la docena
              {p.incompleto && <span className="ml-1 text-amber-700">(incompleto)</span>}
            </div>
          )}
          <div className="mt-2 flex gap-3 text-[13px] font-medium print:hidden">
            <button onClick={onEditar} className="text-acento hover:underline">
              Editar
            </button>
            <Link to={`/costos/fichas/${p.id}`} className="text-gray-600 hover:underline">
              Ficha de costo
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalProducto({ p, onCerrar }: { p: ProductoCatalogoDTO; onCerrar: () => void }) {
  const qc = useQueryClient();
  const [v, setV] = useState({ tallas: p.tallas ?? '', colores: p.colores ?? '', descripcion: p.descripcion ?? '' });
  const [error, setError] = useState<string | null>(null);
  const refrescar = () => qc.invalidateQueries({ queryKey: ['costos', 'catalogo'] });
  const guardar = useMutation({
    mutationFn: (input: CatalogoFichaInput) => api(`/costos/fichas/${p.id}/catalogo`, { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: refrescar,
  });
  const foto = useMutation({
    mutationFn: async (archivo: File | null) =>
      archivo
        ? api(`/costos/fichas/${p.id}/foto`, { method: 'PUT', body: JSON.stringify(await achicar(archivo)) })
        : api(`/costos/fichas/${p.id}/foto`, { method: 'DELETE' }),
    onSuccess: refrescar,
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo subir la foto'),
  });
  const onGuardar = () =>
    guardar.mutate(v, { onSuccess: onCerrar, onError: (e) => setError(e instanceof ErrorApi ? e.message : 'Error al guardar') });

  return (
    <Modal onCerrar={onCerrar} ancho="max-w-lg">
      <h2 className="text-lg font-semibold">{p.nombre}</h2>
      <div className="mt-3 flex items-start gap-3">
        <Foto p={p} clase="h-28 w-36 flex-none rounded-lg" />
        <div className="space-y-2 text-sm">
          <label className="inline-block cursor-pointer rounded-lg border border-gray-300 px-3 py-1.5 font-medium hover:bg-gray-50">
            {foto.isPending ? 'Subiendo…' : p.tieneFoto ? 'Cambiar foto' : 'Subir foto'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) foto.mutate(f);
              }}
            />
          </label>
          {p.tieneFoto && (
            <button onClick={() => foto.mutate(null)} className="block text-xs text-error hover:underline">
              Quitar foto
            </button>
          )}
          <p className="text-xs text-gray-500">Se achica sola antes de subir. Podés sacarla con el celular.</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Tallas</label>
          <input value={v.tallas} onChange={(e) => setV({ ...v, tallas: e.target.value })} placeholder="ej. 28 al 38" className={claseInput} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Colores</label>
          <input value={v.colores} onChange={(e) => setV({ ...v, colores: e.target.value })} placeholder="ej. azul, negro, celeste" className={claseInput} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Descripción</label>
          <textarea value={v.descripcion} onChange={(e) => setV({ ...v, descripcion: e.target.value })} rows={2} className={claseInput} />
        </div>
      </div>
      {error && <p className="mt-3 rounded-lg bg-error-suave px-3 py-2 text-xs text-error">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onCerrar} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
          Cancelar
        </button>
        <button onClick={onGuardar} disabled={guardar.isPending} className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-[#265dc2] disabled:opacity-60">
          Guardar
        </button>
      </div>
    </Modal>
  );
}
