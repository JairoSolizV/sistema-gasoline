import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatBs } from '@taller/shared';
import { useModelos } from '../../api/modelos';
import { useAbrirCorte, useCrearCorte } from '../../api/cortes';
import { ErrorApi } from '../../api/client';
import { CamposTendido, tendidoVacio, validarTendido } from './CamposTendido';

interface FilaTalla {
  talla: string;
  corte: string;
  plus: string;
}

const TALLAS_INICIALES: FilaTalla[] = [28, 30, 32, 34, 36, 38].map((t) => ({
  talla: String(t),
  corte: '',
  plus: '',
}));

const entero = (s: string) => (/^\d+$/.test(s.trim()) ? parseInt(s, 10) : 0);

export function NuevoCortePage() {
  const navigate = useNavigate();
  const { data: modelos } = useModelos();
  const crear = useCrearCorte();
  const abrir = useAbrirCorte();

  const [modeloId, setModeloId] = useState('');
  const [versionId, setVersionId] = useState('');
  const [codigo, setCodigo] = useState('');
  const [filas, setFilas] = useState<FilaTalla[]>(TALLAS_INICIALES);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  // tendido (informativo; no afecta pagos) y servicio de corte interno
  const [tendido, setTendido] = useState(tendidoVacio);
  const [esInterno, setEsInterno] = useState(true);

  const modelo = modelos?.find((m) => m.id === modeloId);
  const version = modelo?.versiones.find((v) => v.id === versionId);

  const totalCorte = useMemo(() => filas.reduce((a, f) => a + entero(f.corte), 0), [filas]);
  const totalPlus = useMemo(() => filas.reduce((a, f) => a + entero(f.plus), 0), [filas]);
  const cantidadTotal = totalCorte + totalPlus; // feedback visual; el server recalcula

  const actualizarFila = (i: number, campo: keyof FilaTalla, valor: string) => {
    setFilas((fs) => fs.map((f, j) => (j === i ? { ...f, [campo]: valor } : f)));
  };

  const onCrear = async () => {
    setErrorLocal(null);
    const usadas = filas.filter((f) => f.talla.trim() !== '');
    if (!version) return setErrorLocal('Elegí modelo y versión');
    if (usadas.length === 0) return setErrorLocal('Ingresá al menos una talla');
    if (cantidadTotal < 1) return setErrorLocal('El corte debe tener al menos una prenda');
    const t = validarTendido(tendido);
    if (!t.ok) return setErrorLocal(t.error);

    const detalle = await crear.mutateAsync({
      modeloVersionId: version.id,
      codigo: codigo.trim() === '' ? null : codigo.trim(),
      tallas: usadas.map((f) => entero(f.talla)),
      cortePorTalla: usadas.map((f) => entero(f.corte)),
      plusPorTalla: usadas.map((f) => entero(f.plus)),
      ...t.datos,
      esInterno,
    });
    const abierto = await abrir.mutateAsync(detalle.id);
    navigate(`/cortes/${abierto.id}`);
  };

  const errorApi = crear.error ?? abrir.error;

  return (
    <div className="p-8">
      <div className="text-xs text-gray-500">
        <Link to="/cortes" className="hover:underline">
          Cortes
        </Link>{' '}
        / Nuevo corte
      </div>

      <div className="mt-2 flex items-start justify-between">
        <h1 className="text-2xl font-semibold">Nuevo corte</h1>
        <div className="flex gap-3">
          <div className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-right shadow-sm">
            <div className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
              Cantidad total
            </div>
            <div className="mono text-2xl font-semibold">{cantidadTotal}</div>
            <div className="text-[11px] text-gray-400">
              corte {totalCorte} + plus {totalPlus}
            </div>
          </div>
          {version && (
            <div className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-right shadow-sm">
              <div className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                Costo estimado
              </div>
              <div className="mono text-2xl font-semibold">
                Bs {formatBs(cantidadTotal * version.costoManoObraPrenda)}
              </div>
              <div className="text-[11px] text-gray-400">
                {cantidadTotal} × Bs {formatBs(version.costoManoObraPrenda)}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 grid max-w-3xl gap-5">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Modelo</label>
              <select
                value={modeloId}
                onChange={(e) => {
                  setModeloId(e.target.value);
                  const m = modelos?.find((x) => x.id === e.target.value);
                  setVersionId(m?.versiones[0]?.id ?? '');
                }}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-acento"
              >
                <option value="">Elegir modelo…</option>
                {modelos?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Versión</label>
              <select
                value={versionId}
                onChange={(e) => setVersionId(e.target.value)}
                disabled={!modelo}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-acento disabled:bg-gray-50"
              >
                {modelo?.versiones.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.numeroVersion} · Bs {formatBs(v.costoManoObraPrenda)} ({v.cantidadOperaciones} ops)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Código <span className="font-normal text-gray-400">(opcional)</span>
              </label>
              <input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="ej. C-0144"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-acento"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-2.5">
            <span className="text-sm font-semibold">Datos del tendido</span>
            <span className="text-xs text-gray-500">informativo · no afecta los pagos</span>
          </div>
          <div className="p-5">
            <CamposTendido valor={tendido} onChange={setTendido} />
            <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                checked={esInterno}
                onChange={(e) => setEsInterno(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <strong>Corte interno</strong>: el taller hace trazado, doblado, corte y
                clasificación, y se pagan.
                <span className="block text-xs text-gray-500">
                  Desmarcalo solo si el corte llegó cortado de afuera. Las personas de cada proceso
                  se cargan en el detalle del corte a medida que se terminan.
                </span>
              </span>
            </label>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-2.5">
            <span className="text-sm font-semibold">Desglose por talla</span>
            <span className="text-xs text-gray-500">
              referencia de producción · el PLUS también se paga
            </span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                <th className="px-5 py-2">Talla</th>
                <th className="px-5 py-2">Corte</th>
                <th className="px-5 py-2">Plus</th>
                <th className="w-12 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0">
                  {(['talla', 'corte', 'plus'] as const).map((campo) => (
                    <td key={campo} className="px-4 py-1.5">
                      <input
                        value={f[campo]}
                        onChange={(e) => actualizarFila(i, campo, e.target.value.replace(/\D/g, ''))}
                        placeholder={campo === 'plus' ? '0' : ''}
                        inputMode="numeric"
                        className="mono w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-acento"
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-center">
                    <button
                      onClick={() => setFilas((fs) => fs.filter((_, j) => j !== i))}
                      disabled={filas.length === 1}
                      className="text-gray-400 hover:text-error disabled:opacity-30"
                      title="Quitar talla"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-gray-100 px-5 py-2">
            <button
              onClick={() => setFilas((fs) => [...fs, { talla: '', corte: '', plus: '' }])}
              className="text-[13px] font-medium text-acento hover:underline"
            >
              + Agregar talla
            </button>
          </div>
        </div>

        {(errorLocal || errorApi) && (
          <p className="rounded-lg bg-error-suave px-3 py-2 text-sm text-error">
            {errorLocal ??
              (errorApi instanceof ErrorApi ? errorApi.message : 'Error al crear el corte')}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={() => navigate('/cortes')}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={onCrear}
            disabled={crear.isPending || abrir.isPending}
            className="rounded-lg bg-acento px-5 py-2 text-sm font-semibold text-white hover:bg-[#265dc2] disabled:opacity-60"
          >
            Crear y abrir corte
          </button>
        </div>
      </div>
    </div>
  );
}
