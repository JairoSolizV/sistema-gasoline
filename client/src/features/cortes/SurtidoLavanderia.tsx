import { useMemo, useState } from 'react';
import {
  calcularSurtido,
  formatBs,
  MAX_COLORES_SURTIDO,
  TARIFA_SERVICIO,
  type CorteDetalleDTO,
  type Surtido,
  type SurtidoGrupo,
} from '@taller/shared';
import {
  useBorrarColorLavado,
  useColoresLavado,
  useCrearColorLavado,
  useEnviarSurtido,
  useGuardarSurtido,
} from '../../api/surtido';
import { useOperarios } from '../../api/operarios';
import { Modal } from '../../components/Modal';
import { BotonImprimir, type Tamano } from '../../components/Imprimir';
import { HojaOficio } from '../../components/HojaOficio';
import { hoyLocalISO } from '../../lib/fechas';
import { aCent, aTexto, claseInput, enviadas, mensaje, PATRON_BS } from './EnviosServicio';

// Surtido por colores para la lavandería (docs/PLAN_SURTIDO.md): cómo se
// reparten las prendas del corte entre los colores de lavado, talla por talla,
// y cuántas docenas salen de cada color. Se imprime para la lavandería y se
// puede registrar un envío por color. No toca ningún pago.

/** "12 doc" o "12 doc + 6". */
export function textoDocenas(docenas: number, sueltas: number) {
  return sueltas === 0 ? `${docenas} doc` : `${docenas} doc + ${sueltas}`;
}

function surtidoDe(corte: CorteDetalleDTO, colores: string[], especiales: number[]): Surtido {
  return calcularSurtido({
    tallas: corte.tallas,
    cortePorTalla: corte.cortePorTalla,
    plusPorTalla: corte.plusPorTalla,
    colores,
    tallasEspeciales: especiales,
  });
}

export function SurtidoLavanderia({
  corte,
  onImprimir,
}: {
  corte: CorteDetalleDTO;
  onImprimir: (tamano: Tamano) => void;
}) {
  const guardado = corte.surtidoColores;
  const [editando, setEditando] = useState(guardado.length === 0);
  const [colores, setColores] = useState<string[]>(guardado);
  const [especiales, setEspeciales] = useState<number[]>(corte.tallasEspeciales);
  const [modalEnvio, setModalEnvio] = useState(false);
  const guardar = useGuardarSurtido();

  // mientras se edita, la tabla muestra cómo quedaría (vista previa)
  const surtido = useMemo(
    () =>
      editando
        ? surtidoDe(corte, colores, especiales)
        : surtidoDe(corte, guardado, corte.tallasEspeciales),
    [corte, editando, colores, especiales, guardado],
  );

  if (corte.estado === 'borrador') return null; // todavía no hay prendas cortadas

  const yaEnviadasLavanderia = enviadas(corte, 'lavanderia');
  const cancelar = () => {
    setColores(guardado);
    setEspeciales(corte.tallasEspeciales);
    setEditando(guardado.length === 0);
  };

  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 px-5 py-3">
        <div>
          <div className="text-sm font-semibold">Surtido para lavandería</div>
          <div className="text-xs text-gray-500">
            Cómo se reparten las prendas entre los colores de lavado, talla por talla · no toca
            pagos
          </div>
        </div>
        {!editando && guardado.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setEditando(true)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cambiar colores
            </button>
            <BotonImprimir texto="Imprimir hoja" alElegir={onImprimir} />
            {yaEnviadasLavanderia === 0 && (
              <button
                onClick={() => setModalEnvio(true)}
                className="rounded-lg bg-acento px-3 py-2 text-sm font-semibold text-white hover:bg-[#265dc2]"
              >
                Registrar envío a lavandería
              </button>
            )}
          </div>
        )}
      </div>

      {editando && (
        <EditorSurtido
          corte={corte}
          colores={colores}
          setColores={setColores}
          especiales={especiales}
          setEspeciales={setEspeciales}
          guardando={guardar.isPending}
          error={guardar.error}
          puedeCancelar={guardado.length > 0}
          onCancelar={cancelar}
          onGuardar={async () => {
            await guardar.mutateAsync({
              corteId: corte.id,
              input: { colores, tallasEspeciales: especiales },
            });
            setEditando(false);
          }}
        />
      )}

      {editando && <CompararColores corte={corte} especiales={especiales} />}

      {surtido.grupos.length > 0 ? (
        <div className="space-y-5 px-5 py-4">
          {editando && (
            <div className="text-[11px] font-semibold tracking-wider text-amber-700 uppercase">
              Vista previa — todavía no está guardado
            </div>
          )}
          {surtido.grupos.map((g) => (
            <TablaGrupo key={g.nombre} grupo={g} />
          ))}
          <ResumenPorColor surtido={surtido} />
          {!editando && yaEnviadasLavanderia > 0 && (
            <p className="text-xs text-gray-500">
              Ya hay {yaEnviadasLavanderia} prendas enviadas a lavandería (abajo, en Servicios
              externos).
            </p>
          )}
        </div>
      ) : (
        !editando && (
          <p className="px-5 py-4 text-sm text-gray-500">Elegí los colores para surtir.</p>
        )
      )}

      {modalEnvio && (
        <ModalEnvioSurtido corte={corte} surtido={surtido} onCerrar={() => setModalEnvio(false)} />
      )}
    </div>
  );
}

function EditorSurtido({
  corte,
  colores,
  setColores,
  especiales,
  setEspeciales,
  guardando,
  error,
  puedeCancelar,
  onCancelar,
  onGuardar,
}: {
  corte: CorteDetalleDTO;
  colores: string[];
  setColores: (c: string[]) => void;
  especiales: number[];
  setEspeciales: (t: number[]) => void;
  guardando: boolean;
  error: unknown;
  puedeCancelar: boolean;
  onCancelar: () => void;
  onGuardar: () => void;
}) {
  const { data: lista } = useColoresLavado();
  const crear = useCrearColorLavado();
  const borrar = useBorrarColorLavado();
  const [nuevo, setNuevo] = useState('');
  const [editarLista, setEditarLista] = useState(false);

  const disponibles = (lista ?? []).filter((c) => c.activo && !colores.includes(c.nombre));
  const lleno = colores.length >= MAX_COLORES_SURTIDO;

  const mover = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= colores.length) return;
    const copia = [...colores];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    setColores(copia);
  };

  const agregarNuevo = async () => {
    const nombre = nuevo.trim().toUpperCase();
    if (!nombre) return;
    if (!(lista ?? []).some((c) => c.nombre === nombre)) await crear.mutateAsync(nombre);
    if (!colores.includes(nombre) && !lleno) setColores([...colores, nombre]);
    setNuevo('');
  };

  return (
    <div className="space-y-4 border-b border-gray-200 bg-gray-50/60 px-5 py-4">
      <div>
        <div className="mb-1.5 text-sm font-medium">
          Colores del corte{' '}
          <span className="font-normal text-gray-500">
            · en orden: si no divide exacto, lo que sobra va de a 1 a los primeros
          </span>
        </div>
        {colores.length === 0 ? (
          <p className="text-xs text-gray-400">Tocá los colores de abajo para agregarlos.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {colores.map((c, i) => (
              <span
                key={c}
                className="flex items-center gap-1.5 rounded-lg border border-acento bg-white py-1 pr-1.5 pl-2 text-sm font-semibold"
              >
                <span className="mono text-xs text-acento">{i + 1}</span>
                {c}
                <button
                  onClick={() => mover(i, -1)}
                  disabled={i === 0}
                  title="Antes"
                  className="px-0.5 text-gray-400 hover:text-acento disabled:opacity-20"
                >
                  ◂
                </button>
                <button
                  onClick={() => mover(i, 1)}
                  disabled={i === colores.length - 1}
                  title="Después"
                  className="px-0.5 text-gray-400 hover:text-acento disabled:opacity-20"
                >
                  ▸
                </button>
                <button
                  onClick={() => setColores(colores.filter((x) => x !== c))}
                  title="Quitar del corte"
                  className="px-0.5 text-gray-400 hover:text-error"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-1.5 flex items-center gap-3 text-xs text-gray-500">
          <span>Lista de colores de lavado</span>
          <button onClick={() => setEditarLista(!editarLista)} className="text-acento hover:underline">
            {editarLista ? 'listo' : 'editar lista'}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {disponibles.map((c) => (
            <span key={c.id} className="flex items-center">
              <button
                onClick={() => setColores([...colores, c.nombre])}
                disabled={lleno || editarLista}
                className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-sm hover:border-acento hover:text-acento disabled:opacity-60"
              >
                + {c.nombre}
              </button>
              {editarLista && (
                <button
                  onClick={() => {
                    if (window.confirm(`¿Quitar ${c.nombre} de la lista? Los cortes ya surtidos no cambian.`)) {
                      borrar.mutate(c.id);
                    }
                  }}
                  title="Quitar de la lista"
                  className="ml-1 text-gray-400 hover:text-error"
                >
                  ✕
                </button>
              )}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <input
              value={nuevo}
              onChange={(e) => setNuevo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && agregarNuevo()}
              placeholder="color nuevo"
              className="w-32 rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm uppercase outline-none focus:border-acento"
            />
            <button
              onClick={agregarNuevo}
              disabled={!nuevo.trim() || crear.isPending}
              className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              Agregar
            </button>
          </span>
        </div>
        {crear.error != null && <p className="mt-1 text-xs text-error">{mensaje(crear.error)}</p>}
      </div>

      <div>
        <div className="mb-1.5 text-sm font-medium">
          Tallas ESPECIAL{' '}
          <span className="font-normal text-gray-500">
            · se surten aparte de las NORMAL (por defecto, desde la 48)
          </span>
        </div>
        <div className="flex flex-wrap gap-3">
          {corte.tallas.map((t) => (
            <label key={t} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={especiales.includes(t)}
                onChange={(e) =>
                  setEspeciales(
                    e.target.checked ? [...especiales, t].sort((a, b) => a - b) : especiales.filter((x) => x !== t),
                  )
                }
              />
              <span className="mono">{t}</span>
            </label>
          ))}
        </div>
      </div>

      {error != null && (
        <p className="rounded-lg bg-error-suave px-3 py-2 text-xs text-error">{mensaje(error)}</p>
      )}
      <div className="flex justify-end gap-2">
        {puedeCancelar && (
          <button
            onClick={onCancelar}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Cancelar
          </button>
        )}
        <button
          onClick={onGuardar}
          disabled={colores.length === 0 || guardando}
          className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-[#265dc2] disabled:opacity-50"
        >
          Guardar surtido
        </button>
      </div>
    </div>
  );
}

/** Una tabla como la hoja del taller: filas = tallas, columnas = colores. */
function TablaGrupo({ grupo }: { grupo: SurtidoGrupo }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline gap-3">
        <span className="text-sm font-bold tracking-wide">{grupo.nombre}</span>
        <span className="text-xs text-gray-500">{grupo.total} prendas</span>
      </div>
      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
              <th className="py-1.5 pr-4 text-left">Talla</th>
              <th className="px-3 py-1.5 text-right">Corte</th>
              {grupo.colores.map((c) => (
                <th key={c.color} className="bg-sky-50 px-3 py-1.5 text-right text-sky-800">
                  {c.color}
                </th>
              ))}
              {grupo.surtidoDocena && (
                <th className="px-3 py-1.5 text-right" title="Prendas de cada talla en una docena">
                  Surtido / doc
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {grupo.tallas.map((t, i) => (
              <tr key={t} className="border-b border-gray-100">
                <td className="mono py-1 pr-4 font-semibold">{t}</td>
                <td className="mono px-3 py-1 text-right text-gray-500">{grupo.cantidades[i]}</td>
                {grupo.colores.map((c) => (
                  <td key={c.color} className="mono px-3 py-1 text-right">
                    {c.piezas[i]}
                  </td>
                ))}
                {grupo.surtidoDocena && (
                  <td className="mono px-3 py-1 text-right text-gray-500">{grupo.surtidoDocena[i]}</td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 font-semibold">
              <td className="py-1 pr-4 text-xs text-gray-500 uppercase">Prendas</td>
              <td className="mono px-3 py-1 text-right">{grupo.total}</td>
              {grupo.colores.map((c) => (
                <td key={c.color} className="mono px-3 py-1 text-right">
                  {c.total}
                </td>
              ))}
              {grupo.surtidoDocena && <td className="mono px-3 py-1 text-right text-gray-500">12</td>}
            </tr>
            <tr className="font-semibold text-acento">
              <td className="py-1 pr-4 text-xs uppercase">Docenas</td>
              <td />
              {grupo.colores.map((c) => (
                <td key={c.color} className="mono px-3 py-1 text-right whitespace-nowrap">
                  {textoDocenas(c.docenas, c.sueltas)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/** Lo que va en cada envío: el total de cada color sumando NORMAL y ESPECIAL. */
function ResumenPorColor({ surtido }: { surtido: Surtido }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold tracking-wider text-gray-500 uppercase">
        Total por color · {surtido.total} prendas
      </div>
      <div className="flex flex-wrap gap-2">
        {surtido.porColor.map((c) => (
          <div key={c.color} className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm">
            <span className="font-semibold text-sky-800">{c.color}</span>{' '}
            <span className="mono">{c.total}</span>{' '}
            <span className="text-xs text-gray-500">({textoDocenas(c.docenas, c.sueltas)})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Un envío a lavandería por cada color, con sus prendas. */
function ModalEnvioSurtido({
  corte,
  surtido,
  onCerrar,
}: {
  corte: CorteDetalleDTO;
  surtido: Surtido;
  onCerrar: () => void;
}) {
  const enviar = useEnviarSurtido();
  const { data: proveedores } = useOperarios('activos', 'lavanderia');
  const [operarioId, setOperarioId] = useState('');
  const [precioBs, setPrecioBs] = useState('');
  const [fechaEnvio, setFechaEnvio] = useState(hoyLocalISO());
  const [error, setError] = useState<string | null>(null);

  const elegirProveedor = (id: string) => {
    setOperarioId(id);
    const precio = proveedores?.find((o) => o.id === id)?.[TARIFA_SERVICIO.lavanderia];
    if (precio != null) setPrecioBs(aTexto(precio));
  };

  const precioValido = PATRON_BS.test(precioBs.trim());
  const confirmar = async () => {
    setError(null);
    if (!operarioId) return setError('Elegí la lavandería');
    if (!precioValido) return setError('Precio por prenda inválido (ej. 1.50)');
    await enviar.mutateAsync({
      corteId: corte.id,
      input: { operarioId, precioPrenda: aCent(precioBs), fechaEnvio },
    });
    onCerrar();
  };

  return (
    <Modal onCerrar={onCerrar}>
      <h2 className="text-lg font-semibold">Registrar envío a lavandería por color</h2>
      <p className="mt-1 text-sm text-gray-500">
        Se registra un envío por cada color. Se pagan al devolver, como cualquier envío.
      </p>
      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Lavandería</label>
          <select value={operarioId} onChange={(e) => elegirProveedor(e.target.value)} className={claseInput}>
            <option value="">Elegir lavandería…</option>
            {proveedores?.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
              </option>
            ))}
          </select>
          {proveedores?.length === 0 && (
            <p className="mt-1 text-xs text-amber-700">
              No hay lavanderías: registralas en Operarios con tipo "Proveedor externo".
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Precio por prenda (Bs)</label>
            <input
              value={precioBs}
              onChange={(e) => setPrecioBs(e.target.value)}
              inputMode="decimal"
              placeholder="ej. 1.50"
              className={`mono ${claseInput}`}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Fecha de envío</label>
            <input type="date" value={fechaEnvio} onChange={(e) => setFechaEnvio(e.target.value)} className={claseInput} />
          </div>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {surtido.porColor.map((c) => (
              <tr key={c.color} className="border-t border-gray-100">
                <td className="py-1 font-medium">{c.color}</td>
                <td className="mono py-1 text-right">{c.total} prendas</td>
                <td className="mono py-1 text-right text-gray-500">
                  {precioValido ? `Bs ${formatBs(c.total * aCent(precioBs))}` : '—'}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-gray-300 font-semibold">
              <td className="py-1">Total</td>
              <td className="mono py-1 text-right">{surtido.total} prendas</td>
              <td className="mono py-1 text-right">
                {precioValido ? `Bs ${formatBs(surtido.total * aCent(precioBs))}` : '—'}
              </td>
            </tr>
          </tbody>
        </table>
        {(error || enviar.error != null) && (
          <p className="rounded-lg bg-error-suave px-3 py-2 text-xs text-error">
            {error ?? mensaje(enviar.error)}
          </p>
        )}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onCerrar} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
          Cancelar
        </button>
        <button
          onClick={confirmar}
          disabled={enviar.isPending}
          className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-[#265dc2] disabled:opacity-60"
        >
          Registrar {surtido.porColor.length} envíos
        </button>
      </div>
    </Modal>
  );
}

/** Hoja para la lavandería (solo se ve al imprimir). */
export function HojaSurtido({ corte }: { corte: CorteDetalleDTO }) {
  const surtido = surtidoDe(corte, corte.surtidoColores, corte.tallasEspeciales);
  return (
    <HojaOficio
      titulo={`Surtido para lavandería · COD ${corte.codigo}`}
      detalle={`${corte.modeloNombre}${corte.tela ? ` · tela ${corte.tela}` : ''}`}
      resumen={`${surtido.total} prendas · ${surtido.porColor.length} colores`}
      tamanoLetra="11pt"
    >
      {surtido.grupos.map((g) => (
        <table key={g.nombre} style={{ marginTop: '14pt' }}>
          <thead>
            <tr>
              <th>{g.nombre}</th>
              <th className="num">Corte</th>
              {g.colores.map((c) => (
                <th key={c.color} className="num">
                  {c.color}
                </th>
              ))}
              {g.surtidoDocena && <th className="num">Surtido/doc</th>}
            </tr>
          </thead>
          <tbody>
            {g.tallas.map((t, i) => (
              <tr key={t}>
                <td className="num" style={{ fontWeight: 700 }}>
                  {t}
                </td>
                <td className="num tenue">{g.cantidades[i]}</td>
                {g.colores.map((c) => (
                  <td key={c.color} className="num">
                    {c.piezas[i]}
                  </td>
                ))}
                {g.surtidoDocena && <td className="num tenue">{g.surtidoDocena[i]}</td>}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Prendas</td>
              <td className="num">{g.total}</td>
              {g.colores.map((c) => (
                <td key={c.color} className="num">
                  {c.total}
                </td>
              ))}
              {g.surtidoDocena && <td className="num">12</td>}
            </tr>
            <tr>
              <td>Docenas</td>
              <td />
              {g.colores.map((c) => (
                <td key={c.color} className="num">
                  {textoDocenas(c.docenas, c.sueltas)}
                </td>
              ))}
              {g.surtidoDocena && <td />}
            </tr>
          </tfoot>
        </table>
      ))}
      <table style={{ marginTop: '16pt' }}>
        <thead>
          <tr>
            <th>Total por color</th>
            <th className="num">Prendas</th>
            <th className="num">Docenas</th>
          </tr>
        </thead>
        <tbody>
          {surtido.porColor.map((c) => (
            <tr key={c.color}>
              <td style={{ fontWeight: 700 }}>{c.color}</td>
              <td className="num">{c.total}</td>
              <td className="num">{textoDocenas(c.docenas, c.sueltas)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td className="num">{surtido.total}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </HojaOficio>
  );
}

/** Cuántas docenas salen con 7, 6, 5 y 4 colores (como la hoja del dueño), para
 *  decidir cuántos colores mandar a la lavandería. */
function CompararColores({ corte, especiales }: { corte: CorteDetalleDTO; especiales: number[] }) {
  const opciones = [7, 6, 5, 4].map((n) =>
    surtidoDe(
      corte,
      Array.from({ length: n }, (_, i) => `C${i + 1}`),
      especiales,
    ),
  );
  // "1 de 12 doc + 6 · 6 de 12 doc": cuántos colores salen con cada cantidad
  const resumen = (colores: { docenas: number; sueltas: number }[]) => {
    const cuenta = new Map<string, number>();
    for (const c of colores) {
      const k = textoDocenas(c.docenas, c.sueltas);
      cuenta.set(k, (cuenta.get(k) ?? 0) + 1);
    }
    return [...cuenta].map(([k, n]) => `${n} de ${k}`).join(' · ');
  };
  const grupos = opciones[0].grupos.map((g) => g.nombre);

  return (
    <div className="border-b border-gray-200 px-5 py-4">
      <div className="mb-1.5 text-sm font-medium">
        ¿Cuántos colores?{' '}
        <span className="font-normal text-gray-500">· docenas por color según cuántos colores se manden</span>
      </div>
      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
              <th className="py-1.5 pr-4">Colores</th>
              {grupos.map((g) => (
                <th key={g} className="px-3 py-1.5">
                  {g}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {opciones.map((s, i) => {
              const n = 7 - i;
              return (
                <tr key={n} className="border-b border-gray-100">
                  <td className="mono py-1 pr-4 font-semibold">{n}</td>
                  {s.grupos.map((g) => (
                    <td key={g.nombre} className="mono px-3 py-1 text-xs">
                      {resumen(g.colores)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
