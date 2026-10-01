import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatBs, type PlantillaResumenDTO } from '@taller/shared';
import {
  useBorrarPlantilla,
  useCrearPlantilla,
  useDuplicarPlantilla,
  usePlantillas,
} from '../../api/plantillas';
import { ErrorApi } from '../../api/client';
import { Modal } from '../../components/Modal';

// Plantillas = recetas de operaciones para armar un modelo nuevo sin escribir
// las 36 filas a mano. Cada operación trae un CT de referencia que precarga el
// modelo nuevo; ahí se confirma o se cambia.

const claseInput =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-acento focus:ring-2 focus:ring-acento/20';

function ModalNombre({
  titulo,
  ayuda,
  valorInicial,
  textoBoton,
  onConfirmar,
  onCerrar,
  error,
}: {
  titulo: string;
  ayuda?: string;
  valorInicial: string;
  textoBoton: string;
  onConfirmar: (nombre: string) => void;
  onCerrar: () => void;
  error: unknown;
}) {
  const [nombre, setNombre] = useState(valorInicial);
  const entrada = useRef<HTMLInputElement>(null);

  // el nombre propuesto viene seleccionado: escribir lo reemplaza de una
  useEffect(() => {
    entrada.current?.select();
  }, []);

  return (
    <Modal onCerrar={onCerrar}>
      <h2 className="text-lg font-semibold">{titulo}</h2>
      {ayuda && <p className="mt-1 text-sm text-gray-500">{ayuda}</p>}
      <input
        ref={entrada}
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && nombre.trim() !== '' && onConfirmar(nombre.trim())}
        autoFocus
        placeholder="ej. Pantalón clásico con pinzas"
        className={`${claseInput} mt-4`}
      />
      {error != null && (
        <p className="mt-2 rounded-lg bg-error-suave px-3 py-2 text-xs text-error">
          {error instanceof ErrorApi ? error.message : 'No se pudo guardar'}
        </p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCerrar}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={nombre.trim() === ''}
          onClick={() => onConfirmar(nombre.trim())}
          className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-[#265dc2] disabled:opacity-50"
        >
          {textoBoton}
        </button>
      </div>
    </Modal>
  );
}

export function PlantillasPage() {
  const navigate = useNavigate();
  const { data: plantillas, isLoading } = usePlantillas();
  const duplicar = useDuplicarPlantilla();
  const crear = useCrearPlantilla();
  const borrar = useBorrarPlantilla();

  const [duplicando, setDuplicando] = useState<PlantillaResumenDTO | null>(null);
  const [creando, setCreando] = useState(false);

  const error = [duplicar.error, crear.error, borrar.error].find((e) => e != null);

  return (
    <div className="p-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Plantillas</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            La receta de operaciones de una prenda, para no cargarlas a mano en cada modelo nuevo.
            Cada operación trae un CT de referencia que precarga el modelo nuevo; ahí lo confirmás
            o lo cambiás, porque la misma operación vale distinto según la prenda.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreando(true)}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          + Plantilla vacía
        </button>
      </div>

      {error != null && (
        <p className="mt-4 rounded-lg bg-error-suave px-3 py-2 text-sm text-error">
          {error instanceof ErrorApi ? error.message : 'Error al guardar'}
        </p>
      )}

      {isLoading ? (
        <p className="mt-6 text-sm text-gray-500">Cargando plantillas…</p>
      ) : (
        <div className="mt-6 space-y-3">
          {(plantillas ?? []).map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    to={`/plantillas/${p.id}`}
                    className="text-[15px] font-semibold hover:underline"
                  >
                    {p.nombre}
                  </Link>
                  {p.protegida && (
                    <span
                      className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-gray-500 uppercase"
                      title="Se puede editar, no eliminar. Duplicala para armar una variante."
                    >
                      fija
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[13px] text-gray-500">
                  {p.cantidadOperaciones} operaciones · {p.grupos.join(' · ') || 'sin grupos'}
                </div>
                <div className="mt-0.5 text-[13px] text-gray-500">
                  {p.operacionesConReferencia === 0 ? (
                    'Sin CT de referencia'
                  ) : (
                    <>
                      Referencia <span className="mono">Bs {formatBs(p.costoReferencia)}</span> /
                      prenda
                      {p.operacionesConReferencia < p.cantidadOperaciones &&
                        ` · ${p.cantidadOperaciones - p.operacionesConReferencia} sin referencia`}
                    </>
                  )}
                </div>
                {p.notas && <div className="mt-1 text-xs text-gray-400 italic">{p.notas}</div>}
              </div>

              <div className="flex flex-none gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/modelos/nuevo?plantilla=${p.id}`)}
                  className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-[#265dc2]"
                >
                  Crear modelo
                </button>
                <Link
                  to={`/plantillas/${p.id}`}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50"
                >
                  Editar
                </Link>
                <button
                  type="button"
                  onClick={() => setDuplicando(p)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50"
                >
                  Duplicar
                </button>
                {!p.protegida && (
                  <button
                    type="button"
                    onClick={() => borrar.mutate(p.id)}
                    title="Eliminar plantilla"
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-500 hover:bg-error-suave hover:text-error"
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          ))}
          {(plantillas ?? []).length === 0 && (
            <p className="text-sm text-gray-400">Todavía no hay plantillas.</p>
          )}
        </div>
      )}

      {duplicando && (
        <ModalNombre
          titulo={`Duplicar "${duplicando.nombre}"`}
          ayuda="La copia trae las mismas operaciones y se puede editar libremente. El original no se toca."
          valorInicial={`${duplicando.nombre} (copia)`}
          textoBoton="Duplicar"
          error={duplicar.error}
          onCerrar={() => setDuplicando(null)}
          onConfirmar={async (nombre) => {
            const copia = await duplicar.mutateAsync({ id: duplicando.id, nombre });
            setDuplicando(null);
            navigate(`/plantillas/${copia.id}`);
          }}
        />
      )}

      {creando && (
        <ModalNombre
          titulo="Nueva plantilla"
          ayuda="Se crea vacía y le vas agregando las operaciones."
          valorInicial=""
          textoBoton="Crear"
          error={crear.error}
          onCerrar={() => setCreando(false)}
          onConfirmar={async (nombre) => {
            const nueva = await crear.mutateAsync({ nombre, notas: null, operaciones: [] });
            setCreando(false);
            navigate(`/plantillas/${nueva.id}`);
          }}
        />
      )}
    </div>
  );
}
