import { useState } from 'react';
import type { CatalogoNodoDTO } from '@taller/shared';
import {
  rutasCatalogo,
  useBorrarNodo,
  useCatalogo,
  useCrearNodo,
  useEditarNodo,
  useFusionarNodo,
  type CambiosNodo,
} from '../../api/catalogo';
import { ErrorApi } from '../../api/client';

// Administración del catálogo que alimenta el alta de modelos.
//
// Dos cosas distintas, y por eso se muestran en dos bloques separados:
//  - GRUPOS: los bloques en los que se ordenan las operaciones de un modelo
//    (TRASEROS, DELANTEROS…). Envuelven a las operaciones; NO condicionan qué
//    máquina, proceso o pieza se puede usar.
//  - JERARQUÍA Máquina → Proceso → Pieza: la máquina manda sobre el proceso y el
//    proceso sobre la pieza. Es la misma lista para todos los grupos.
//
// Reglas visibles acá: baja lógica siempre; borrado físico solo si usos = 0 (C-4).

const claseInput =
  'w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-acento';

const claseBotonMini = 'text-[11px] text-gray-400 hover:text-acento';

/** Alta por texto, compartida por las columnas y por el panel de grupos. */
function CampoAlta({
  placeholder,
  onCrear,
  ancho = 'w-full',
}: {
  placeholder: string;
  onCrear: (nombre: string) => void;
  ancho?: string;
}) {
  const [nuevo, setNuevo] = useState('');
  const confirmar = () => {
    if (nuevo.trim() === '') return;
    onCrear(nuevo.trim());
    setNuevo('');
  };

  return (
    <div className={`flex gap-2 ${ancho}`}>
      <input
        value={nuevo}
        onChange={(e) => setNuevo(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && confirmar()}
        placeholder={placeholder}
        className={claseInput}
      />
      <button
        type="button"
        onClick={confirmar}
        className="rounded-md bg-acento px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#265dc2]"
      >
        +
      </button>
    </div>
  );
}

/** Elegir con qué otra entrada de la MISMA rama se une esta. Lo tipeado en el
 *  catálogo se reescribe en las operaciones de los modelos; los cortes ya
 *  creados conservan su snapshot. */
function ElegirDestinoFusion({
  item,
  hermanos,
  onConfirmar,
  onCancelar,
}: {
  item: CatalogoNodoDTO;
  hermanos: CatalogoNodoDTO[];
  onConfirmar: (destinoId: string) => void;
  onCancelar: () => void;
}) {
  const candidatos = hermanos.filter((h) => h.id !== item.id);
  const [destino, setDestino] = useState('');

  return (
    <div className="flex flex-1 flex-wrap items-center gap-1.5">
      <span className="text-[11px] whitespace-nowrap text-gray-500">
        unir «{item.nombre}» con
      </span>
      <select
        value={destino}
        onChange={(e) => setDestino(e.target.value)}
        autoFocus
        className="min-w-0 flex-1 rounded-md border border-gray-300 px-1.5 py-1 text-xs outline-none focus:border-acento"
      >
        <option value="">elegí…</option>
        {candidatos.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={destino === ''}
        onClick={() => onConfirmar(destino)}
        className="text-[11px] font-medium text-acento disabled:opacity-40"
      >
        unir
      </button>
      <button type="button" onClick={onCancelar} className="text-[11px] text-gray-400">
        cancelar
      </button>
    </div>
  );
}

/** Los grupos van arriba y a lo ancho: contienen a las operaciones, no son un
 *  cuarto nivel de la jerarquía. */
function PanelGrupos({
  grupos,
  onCrear,
  onEditar,
  onBorrar,
  onFusionar,
}: {
  grupos: CatalogoNodoDTO[];
  onCrear: (nombre: string) => void;
  onEditar: (id: string, cambios: CambiosNodo) => void;
  onBorrar: (id: string) => void;
  onFusionar: (origenId: string, destinoId: string) => void;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const [uniendo, setUniendo] = useState<string | null>(null);
  const [borrador, setBorrador] = useState('');

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-baseline justify-between border-b border-gray-200 bg-gray-50 px-4 py-2.5">
        <div>
          <span className="text-sm font-semibold">Grupos</span>
          <span className="ml-2 text-[11px] text-gray-500">
            los bloques en los que se ordenan las operaciones de un modelo
          </span>
        </div>
        <span className="text-[11px] text-gray-500">{grupos.length}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 p-3">
        {grupos.map((g) =>
          uniendo === g.id ? (
            <div
              key={g.id}
              className="flex min-w-[20rem] items-center rounded-full border border-acento/40 bg-acento/5 px-3 py-1"
            >
              <ElegirDestinoFusion
                item={g}
                hermanos={grupos}
                onConfirmar={(destinoId) => {
                  onFusionar(g.id, destinoId);
                  setUniendo(null);
                }}
                onCancelar={() => setUniendo(null)}
              />
            </div>
          ) : editando === g.id ? (
            <div key={g.id} className="flex items-center gap-1">
              <input
                value={borrador}
                onChange={(e) => setBorrador(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onEditar(g.id, { nombre: borrador });
                    setEditando(null);
                  }
                  if (e.key === 'Escape') setEditando(null);
                }}
                autoFocus
                className="w-40 rounded-full border border-gray-300 px-3 py-1 text-sm outline-none focus:border-acento"
              />
              <button
                type="button"
                onClick={() => {
                  onEditar(g.id, { nombre: borrador });
                  setEditando(null);
                }}
                className="text-xs font-medium text-acento"
              >
                ok
              </button>
            </div>
          ) : (
            <div
              key={g.id}
              className={`group flex items-center gap-2 rounded-full border px-3 py-1 ${
                g.activo ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50'
              }`}
            >
              <span className={`text-sm ${g.activo ? '' : 'text-gray-400 line-through'}`}>
                {g.nombre}
              </span>
              <span
                className="rounded-full bg-gray-100 px-1.5 text-[10px] text-gray-500"
                title={`Usado en ${g.usos} operación(es)`}
              >
                {g.usos}
              </span>
              <span className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => {
                    setEditando(g.id);
                    setBorrador(g.nombre);
                  }}
                  className={claseBotonMini}
                >
                  editar
                </button>
                <button
                  type="button"
                  onClick={() => setUniendo(g.id)}
                  title="Unir con otro grupo"
                  className={claseBotonMini}
                >
                  unir
                </button>
                <button
                  type="button"
                  onClick={() => onEditar(g.id, { activo: !g.activo })}
                  className={claseBotonMini}
                >
                  {g.activo ? 'baja' : 'alta'}
                </button>
                {g.usos === 0 && (
                  <button
                    type="button"
                    onClick={() => onBorrar(g.id)}
                    className="text-[11px] text-gray-400 hover:text-error"
                  >
                    borrar
                  </button>
                )}
              </span>
            </div>
          ),
        )}

        <CampoAlta placeholder="nuevo grupo" onCrear={onCrear} ancho="w-56" />
      </div>
    </div>
  );
}

function Columna({
  titulo,
  ayuda,
  items,
  seleccionadoId,
  onSeleccionar,
  onCrear,
  onEditar,
  onBorrar,
  onFusionar,
  bloqueadaPor,
  placeholder,
}: {
  titulo: string;
  ayuda: string;
  items: CatalogoNodoDTO[];
  seleccionadoId?: string | null;
  onSeleccionar?: (id: string) => void;
  onCrear: (nombre: string) => void;
  onEditar: (id: string, cambios: CambiosNodo) => void;
  onBorrar: (id: string) => void;
  onFusionar: (origenId: string, destinoId: string) => void;
  /** Texto a mostrar cuando falta elegir el nivel de arriba. */
  bloqueadaPor?: string;
  placeholder: string;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const [uniendo, setUniendo] = useState<string | null>(null);
  const [borrador, setBorrador] = useState('');

  return (
    <div className="flex min-h-[26rem] flex-1 flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-2.5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold">{titulo}</span>
          <span className="text-[11px] text-gray-500">{items.length}</span>
        </div>
        <div className="text-[11px] text-gray-500">{ayuda}</div>
      </div>

      {bloqueadaPor ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-gray-400">
          {bloqueadaPor}
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto">
          {items.map((item) => {
            const enEdicion = editando === item.id;
            return (
              <li
                key={item.id}
                className={`group flex items-center gap-2 border-b border-gray-100 px-3 py-1.5 ${
                  seleccionadoId === item.id ? 'bg-acento/10' : ''
                }`}
              >
                {uniendo === item.id ? (
                  <ElegirDestinoFusion
                    item={item}
                    hermanos={items}
                    onConfirmar={(destinoId) => {
                      onFusionar(item.id, destinoId);
                      setUniendo(null);
                    }}
                    onCancelar={() => setUniendo(null)}
                  />
                ) : enEdicion ? (
                  <>
                    <input
                      value={borrador}
                      onChange={(e) => setBorrador(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          onEditar(item.id, { nombre: borrador });
                          setEditando(null);
                        }
                        if (e.key === 'Escape') setEditando(null);
                      }}
                      autoFocus
                      className={claseInput}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        onEditar(item.id, { nombre: borrador });
                        setEditando(null);
                      }}
                      className="text-xs font-medium text-acento"
                    >
                      ok
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onSeleccionar?.(item.id)}
                      className={`flex-1 truncate text-left text-sm ${
                        item.activo ? '' : 'text-gray-400 line-through'
                      } ${onSeleccionar ? '' : 'cursor-default'}`}
                      title={item.nombre}
                    >
                      {item.nombre}
                    </button>

                    <span
                      className="rounded-full bg-gray-100 px-1.5 text-[10px] text-gray-500"
                      title={`Usada en ${item.usos} operación(es)`}
                    >
                      {item.usos}
                    </span>

                    <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        title="Renombrar"
                        onClick={() => {
                          setEditando(item.id);
                          setBorrador(item.nombre);
                        }}
                        className={claseBotonMini}
                      >
                        editar
                      </button>
                      <button
                        type="button"
                        title="Unir con otra entrada de esta misma rama"
                        onClick={() => setUniendo(item.id)}
                        className={claseBotonMini}
                      >
                        unir
                      </button>
                      <button
                        type="button"
                        title={item.activo ? 'Desactivar' : 'Reactivar'}
                        onClick={() => onEditar(item.id, { activo: !item.activo })}
                        className={claseBotonMini}
                      >
                        {item.activo ? 'baja' : 'alta'}
                      </button>
                      {item.usos === 0 && (
                        <button
                          type="button"
                          title="Eliminar (no está en uso)"
                          onClick={() => onBorrar(item.id)}
                          className="text-[11px] text-gray-400 hover:text-error"
                        >
                          borrar
                        </button>
                      )}
                    </div>
                  </>
                )}
              </li>
            );
          })}
          {items.length === 0 && (
            <li className="px-3 py-3 text-sm text-gray-400">Todavía no hay nada acá</li>
          )}
        </ul>
      )}

      {!bloqueadaPor && (
        <div className="border-t border-gray-200 p-2">
          <CampoAlta placeholder={placeholder} onCrear={onCrear} />
        </div>
      )}
    </div>
  );
}

export function CatalogoPage() {
  // incluye inactivos: acá se administran, no se eligen
  const { data, isLoading } = useCatalogo(false);
  const crear = useCrearNodo();
  const editar = useEditarNodo();
  const borrar = useBorrarNodo();
  const fusionar = useFusionarNodo();

  const [maquinaId, setMaquinaId] = useState<string | null>(null);
  const [procesoId, setProcesoId] = useState<string | null>(null);

  const maquinas = data?.maquinas ?? [];
  const maquina = maquinas.find((m) => m.id === maquinaId) ?? null;
  const procesos = maquina?.procesos ?? [];
  const proceso = procesos.find((p) => p.id === procesoId) ?? null;
  const piezas = proceso?.piezas ?? [];

  const error = [crear.error, editar.error, borrar.error, fusionar.error].find((e) => e != null);

  const acciones = (ruta: (id: string) => string) => ({
    onEditar: (id: string, cambios: CambiosNodo) => editar.mutate({ ruta: ruta(id), cambios }),
    onBorrar: (id: string) => borrar.mutate({ ruta: ruta(id) }),
    onFusionar: (origenId: string, destinoId: string) =>
      fusionar.mutate({ ruta: ruta(origenId), destinoId }),
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Catálogo</h1>
      <p className="mt-1 max-w-4xl text-sm text-gray-500">
        Lo que se puede elegir al cargar las operaciones de un modelo. Renombrar o unir acá{' '}
        <strong>actualiza los modelos</strong> que usaban ese nombre; los <strong>cortes</strong> ya
        creados no cambian, porque su detalle queda congelado al abrirlos.
      </p>

      {error != null && (
        <p className="mt-4 rounded-lg bg-error-suave px-3 py-2 text-sm text-error">
          {error instanceof ErrorApi ? error.message : 'Error al guardar el catálogo'}
        </p>
      )}

      {fusionar.data && (
        <p className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
          «{fusionar.data.nombreAbsorbido}» se unió a «{fusionar.data.destino.nombre}»:{' '}
          {fusionar.data.operacionesActualizadas} operación(es) actualizadas entre modelos y
          plantillas. Los cortes ya creados conservan lo que decían.
        </p>
      )}

      {isLoading ? (
        <p className="mt-6 text-sm text-gray-500">Cargando catálogo…</p>
      ) : (
        <div className="mt-6 space-y-5">
          <PanelGrupos
            grupos={data?.grupos ?? []}
            onCrear={(nombre) => crear.mutate({ ruta: rutasCatalogo.grupos, nombre })}
            {...acciones(rutasCatalogo.grupo)}
          />

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3">
              <div className="text-sm font-semibold">
                Dentro de cada operación: máquina → proceso → pieza
              </div>
              <p className="mt-0.5 max-w-4xl text-[12px] text-gray-500">
                Acá sí hay dependencia: al elegir <em>recta</em> solo aparecen sus procesos, y al
                elegir un proceso solo sus piezas. Esta lista es <strong>la misma para todos los
                grupos</strong>: el grupo ordena las operaciones del modelo, no limita qué máquina o
                pieza se puede usar.
              </p>
            </div>

            <div className="flex gap-4">
              <Columna
                titulo="Máquinas"
                ayuda="nivel 1"
                items={maquinas}
                seleccionadoId={maquinaId}
                onSeleccionar={(id) => {
                  setMaquinaId(id);
                  setProcesoId(null);
                }}
                onCrear={(nombre) => crear.mutate({ ruta: rutasCatalogo.maquinas, nombre })}
                placeholder="nueva máquina"
                {...acciones(rutasCatalogo.maquina)}
              />

              <Columna
                titulo="Procesos"
                ayuda={maquina ? `de "${maquina.nombre}"` : 'nivel 2'}
                items={procesos}
                seleccionadoId={procesoId}
                onSeleccionar={setProcesoId}
                onCrear={(nombre) =>
                  maquina && crear.mutate({ ruta: rutasCatalogo.procesosDe(maquina.id), nombre })
                }
                bloqueadaPor={maquina ? undefined : 'Elegí una máquina'}
                placeholder="nuevo proceso"
                {...acciones(rutasCatalogo.proceso)}
              />

              <Columna
                titulo="Piezas"
                ayuda={proceso ? `de "${maquina?.nombre} / ${proceso.nombre}"` : 'nivel 3'}
                items={piezas}
                onCrear={(nombre) =>
                  proceso && crear.mutate({ ruta: rutasCatalogo.piezasDe(proceso.id), nombre })
                }
                bloqueadaPor={proceso ? undefined : 'Elegí un proceso'}
                placeholder="nueva pieza"
                {...acciones(rutasCatalogo.pieza)}
              />
            </div>
          </div>

          <p className="text-xs text-gray-500">
            El número gris es en cuántas operaciones se usa cada entrada. Lo que está en uso no se
            puede eliminar: se le da de baja, queda tachado y desaparece de los formularios, sin tocar
            los modelos existentes. <strong>Renombrar</strong> y <strong>unir</strong>, en cambio, sí
            reescriben los modelos: las operaciones que decían el nombre viejo pasan a decir el nuevo,
            así que el contador de uso se mantiene.
          </p>
        </div>
      )}
    </div>
  );
}
