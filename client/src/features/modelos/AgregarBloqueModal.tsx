import { useState } from 'react';
import { aCentavos, formatBs, type BloqueGrupoDTO, type ModeloVersionDetalleDTO } from '@taller/shared';
import { obtenerBloqueGrupo, useCatalogo } from '../../api/catalogo';
import { useAgregarOperacionesLote } from '../../api/modelos';
import { ErrorApi } from '../../api/client';
import { Modal } from '../../components/Modal';
import { MarcaEmpaque } from '../../components/MarcaEmpaque';
import { PATRON_BS } from './OperacionFormModal';

// Agregar a una versión ya creada TODAS las operaciones del bloque de un grupo
// del catálogo (ej. ACABADO). En el modelo el CT es obligatorio: se precarga el
// de referencia y acá se confirma o completa antes de agregar.
export function AgregarBloqueModal({
  detalle,
  onCerrar,
}: {
  detalle: ModeloVersionDetalleDTO;
  onCerrar: () => void;
}) {
  const { data: catalogo } = useCatalogo(true);
  const agregar = useAgregarOperacionesLote();
  const grupos = (catalogo?.grupos ?? []).filter((g) => g.operacionesBloque > 0);

  const [bloque, setBloque] = useState<BloqueGrupoDTO | null>(null);
  const [cts, setCts] = useState<string[]>([]);
  const [cargando, setCargando] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  const elegir = async (grupoId: string) => {
    setErrorLocal(null);
    setCargando(true);
    try {
      const b = await obtenerBloqueGrupo(grupoId);
      setBloque(b);
      setCts(b.operaciones.map((o) => (o.ctReferencia == null ? '' : formatBs(o.ctReferencia))));
    } catch (e) {
      setErrorLocal(e instanceof ErrorApi ? e.message : 'No se pudo cargar el bloque');
    } finally {
      setCargando(false);
    }
  };

  const yaTiene =
    bloque != null &&
    detalle.operaciones.some((o) => o.grupo.toUpperCase() === bloque.grupo.nombre.toUpperCase());
  const validos = cts.map((v) => PATRON_BS.test(v.trim()) && aCentavos(v.trim()) >= 1);
  const total = cts.reduce((a, v, i) => (validos[i] ? a + aCentavos(v.trim()) : a), 0);

  const confirmar = async () => {
    if (!bloque) return;
    if (validos.some((v) => !v)) return setErrorLocal('Completá un CT válido (ej. 0.15) en cada operación');
    await agregar.mutateAsync({
      versionId: detalle.id,
      operaciones: bloque.operaciones.map((o, i) => ({
        grupo: bloque.grupo.nombre,
        n: o.n,
        equipo: o.equipo,
        proceso: o.proceso,
        pieza: o.pieza,
        ct: aCentavos(cts[i].trim()),
        esEmpaque: o.esEmpaque,
      })),
    });
    onCerrar();
  };

  return (
    <Modal onCerrar={onCerrar} ancho="max-w-2xl">
      <h2 className="text-lg font-semibold">Agregar grupo del catálogo</h2>
      <p className="mt-1 text-sm text-gray-500">
        Se agregan todas las operaciones del bloque al final de la v{detalle.numeroVersion}. El CT
        viene de la referencia; confirmalo o cambialo acá (después se puede editar como cualquier
        operación).
      </p>

      <select
        value={bloque?.grupo.id ?? ''}
        onChange={(e) => e.target.value && void elegir(e.target.value)}
        className="mt-4 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-acento"
      >
        <option value="">Elegí un grupo…</option>
        {grupos.map((g) => (
          <option key={g.id} value={g.id}>
            {g.nombre} ({g.operacionesBloque} operaciones)
          </option>
        ))}
      </select>
      {grupos.length === 0 && (
        <p className="mt-2 text-xs text-gray-500">
          Ningún grupo tiene bloque todavía. Cargalo en Catálogo → Grupos (clic en el grupo).
        </p>
      )}

      {cargando && <p className="mt-3 text-sm text-gray-500">Cargando…</p>}
      {bloque && (
        <>
          {yaTiene && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Este modelo ya tiene operaciones en {bloque.grupo.nombre}: las del bloque se suman igual
              (revisá que no queden repetidas).
            </p>
          )}
          <div className="mt-3 max-h-80 overflow-y-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <tbody>
                {bloque.operaciones.map((o, i) => (
                  <tr key={o.id} className="border-b border-gray-100 last:border-0">
                    <td className="w-10 px-3 py-1.5 text-gray-400">{o.n ?? '—'}</td>
                    <td className="px-2 py-1.5 text-gray-600">{o.equipo}</td>
                    <td className="px-2 py-1.5 font-medium">
                      {o.proceso}
                      {o.esEmpaque && <MarcaEmpaque />}
                    </td>
                    <td className="px-2 py-1.5 text-gray-600">{o.pieza ?? '—'}</td>
                    <td className="w-28 px-3 py-1.5">
                      <input
                        value={cts[i] ?? ''}
                        onChange={(e) =>
                          setCts((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))
                        }
                        placeholder="CT Bs"
                        inputMode="decimal"
                        className={`mono w-full rounded-md border px-2 py-1 text-sm outline-none focus:border-acento ${
                          validos[i] ? 'border-gray-300' : 'border-error'
                        }`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-right text-xs text-gray-500">
            suma <span className="mono font-semibold">Bs {formatBs(total)}</span> por prenda
          </p>
        </>
      )}

      {(errorLocal || agregar.error != null) && (
        <p className="mt-3 rounded-lg bg-error-suave px-3 py-2 text-xs text-error">
          {errorLocal ??
            (agregar.error instanceof ErrorApi ? agregar.error.message : 'Error al agregar')}
        </p>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onCerrar}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          onClick={confirmar}
          disabled={!bloque || agregar.isPending}
          className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-[#265dc2] disabled:opacity-60"
        >
          Agregar {bloque ? `${bloque.operaciones.length} operaciones` : ''}
        </button>
      </div>
    </Modal>
  );
}
