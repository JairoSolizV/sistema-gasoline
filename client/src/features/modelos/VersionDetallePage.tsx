import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatBs, type ModeloVersionDetalleDTO, type OperacionDTO } from '@taller/shared';
import {
  useAgregarOperacion,
  useCrearVersion,
  useEditarOperacionModelo,
  useEliminarOperacionModelo,
  useModelos,
  useReordenarOperacionesModelo,
  useVersion,
} from '../../api/modelos';
import { claseIndicador, useArrastrarOrden } from '../../lib/useArrastrarOrden';
import { useConfiguracion } from '../../api/configuracion';
import { useOperarios } from '../../api/operarios';
import { ErrorApi } from '../../api/client';
import { Modal } from '../../components/Modal';
import { MarcaEmpaque } from '../../components/MarcaEmpaque';
import { OperacionFormModal } from './OperacionFormModal';
import { HojaOperacionesImprimible } from './HojaOperacionesImprimible';
import { CamposMolde, moldeVacio, validarMolde, type MoldeForm } from './CamposDiseno';
import { TarjetaDiseno } from './TarjetaDiseno';
import { AgregarBloqueModal } from './AgregarBloqueModal';

type ModalAbierto =
  | { tipo: 'agregar'; grupo?: string }
  | { tipo: 'editar'; operacion: OperacionDTO }
  | { tipo: 'eliminar'; operacion: OperacionDTO }
  | { tipo: 'nueva-version' }
  | { tipo: 'bloque' }
  | null;

// Nueva versión = copia de esta. Si en la versión nueva se modificaron los
// moldes, se registra quién y se paga la modificación (Bs 50 predeterminado).
function ModalNuevaVersion({
  detalle,
  numeroNueva,
  onCerrar,
  onCreada,
}: {
  detalle: ModeloVersionDetalleDTO;
  numeroNueva: number;
  onCerrar: () => void;
  onCreada: (versionId: string) => void;
}) {
  const crearVersion = useCrearVersion();
  const { data: config } = useConfiguracion();
  const { data: moldistas } = useOperarios('activos', 'moldista');
  const [notas, setNotas] = useState('');
  const [molde, setMolde] = useState<MoldeForm>(() => moldeVacio(undefined));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (config && molde.montoBs === '') setMolde(moldeVacio(config.tarifaMoldeModificacion));
  }, [config, molde.montoBs]);

  const crear = async () => {
    setError(null);
    const m = validarMolde(molde);
    if (!m.ok) return setError(m.error);
    const nueva = await crearVersion.mutateAsync({
      modeloId: detalle.modeloId,
      desdeVersionId: detalle.id,
      notas: notas.trim() === '' ? null : notas.trim(),
      molde: m.datos,
    });
    onCreada(nueva.id);
  };

  return (
    <Modal onCerrar={onCerrar} ancho="max-w-2xl">
      <h2 className="text-lg font-semibold">Crear nueva versión</h2>
      <p className="mt-2 text-sm text-gray-600">
        Se creará la <strong>v{numeroNueva}</strong> como copia exacta de la v
        {detalle.numeroVersion}. La versión actual queda <strong>intacta</strong> (histórico
        conservado); después podés quitar o editar las operaciones optimizadas.
      </p>
      <label className="mt-4 mb-1 block text-sm font-medium">
        Notas <span className="font-normal text-gray-400">(opcional)</span>
      </label>
      <input
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
        placeholder='ej. "optimizado: se quitó doble despunte"'
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-acento"
      />
      <div className="mt-4">
        <CamposMolde
          valor={molde}
          onChange={setMolde}
          moldistas={moldistas}
          etiqueta="¿Se modificaron los moldes?"
          ayuda={`Si solo cambian tarifas u operaciones, dejala sin marcar: no se paga${
            config ? ` (modificación predeterminada Bs ${formatBs(config.tarifaMoldeModificacion)})` : ''
          }.`}
        />
      </div>
      {(error || crearVersion.error) && (
        <p className="mt-4 rounded-lg bg-error-suave px-3 py-2 text-sm text-error">
          {error ??
            (crearVersion.error instanceof ErrorApi
              ? crearVersion.error.message
              : 'Error al crear la versión')}
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
          onClick={crear}
          disabled={crearVersion.isPending}
          className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-[#265dc2] disabled:opacity-60"
        >
          Crear versión
        </button>
      </div>
    </Modal>
  );
}

// Un grupo de operaciones de la versión. Se reordena arrastrando la manija ⠿,
// solo dentro del grupo (para cambiar de grupo se usa Editar).
function GrupoModelo({
  grupo,
  ops,
  onReordenar,
  onEditar,
  onEliminar,
  onAgregar,
  onMarcarEmpaque,
  marcando,
}: {
  grupo: string;
  ops: OperacionDTO[];
  onReordenar: (idsGrupo: string[]) => void;
  onEditar: (op: OperacionDTO) => void;
  onEliminar: (op: OperacionDTO) => void;
  onAgregar: () => void;
  onMarcarEmpaque: (esEmpaque: boolean) => void; // todo el grupo de una vez
  marcando: boolean;
}) {
  const { arrastrado, manija, fila, indicador } = useArrastrarOrden(
    ops.map((o) => o.id),
    onReordenar,
  );
  const todoEmpaque = ops.every((o) => o.esEmpaque);
  return (
    <div className="max-w-[820px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-100 px-5 py-2.5">
        <div className="flex items-baseline gap-3">
          <span className="text-sm font-semibold">{grupo}</span>
          <span className="text-xs text-gray-500">{ops.length} operaciones</span>
          <button
            onClick={() => onMarcarEmpaque(!todoEmpaque)}
            disabled={marcando}
            title="Las operaciones de empaque se pagan por prenda, con su costo aparte de la costura"
            className="text-xs font-medium text-violet-700 hover:underline disabled:opacity-50"
          >
            {todoEmpaque ? 'Quitar marca de empaque' : 'Marcar grupo como empaque'}
          </button>
        </div>
        <span className="mono text-sm font-semibold text-gray-600">
          Bs {formatBs(ops.reduce((a, o) => a + o.ct, 0))}
        </span>
      </div>
      <table className="w-full table-fixed text-sm">
        <tbody>
          {ops.map((op) => (
            <tr
              key={op.id}
              {...fila(op.id)}
              className={`border-b border-gray-200/70 last:border-0 even:bg-slate-100 hover:bg-blue-50 ${
                arrastrado === op.id ? 'opacity-40' : ''
              } ${claseIndicador(indicador(op.id))}`}
            >
              <td
                {...manija(op.id)}
                className="w-7 cursor-grab pl-3 text-gray-300 select-none hover:text-gray-500 active:cursor-grabbing"
              >
                ⠿
              </td>
              <td className="w-12 px-2 py-1.5 text-gray-400">{op.n ?? '—'}</td>
              <td className="w-28 truncate px-3 py-1.5 text-gray-600">{op.equipo}</td>
              <td className="w-52 px-3 py-1.5 font-medium">
                {op.proceso}
                {op.esEmpaque && <MarcaEmpaque />}
              </td>
              <td className="w-44 px-3 py-1.5 text-gray-600">{op.pieza ?? '—'}</td>
              <td className="w-24 px-3 py-1.5 text-right whitespace-nowrap">
                <span className="mono font-semibold">Bs {formatBs(op.ct)}</span>
              </td>
              <td className="w-36 px-3 py-1.5">
                <div className="flex justify-end gap-3 text-[13px] font-medium">
                  <button onClick={() => onEditar(op)} className="text-acento hover:underline">
                    Editar
                  </button>
                  <button onClick={() => onEliminar(op)} className="text-error hover:underline">
                    Eliminar
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-gray-100 px-5 py-2">
        <button onClick={onAgregar} className="text-[13px] font-medium text-acento hover:underline">
          + Agregar operación a {grupo}
        </button>
      </div>
    </div>
  );
}

export function VersionDetallePage() {
  const { versionId } = useParams();
  const navigate = useNavigate();
  const { data: detalle, isLoading, error } = useVersion(versionId);
  const { data: modelos } = useModelos();
  const agregar = useAgregarOperacion();
  const editar = useEditarOperacionModelo();
  const eliminar = useEliminarOperacionModelo();
  const reordenar = useReordenarOperacionesModelo();
  const [modal, setModal] = useState<ModalAbierto>(null);

  // Marcar/desmarcar un grupo entero como empaque: un PATCH por operación que
  // cambia (el último deja la versión actualizada en la caché).
  const [marcando, setMarcando] = useState(false);
  const [errorMarca, setErrorMarca] = useState<unknown>(null);
  const marcarGrupo = async (ops: OperacionDTO[], esEmpaque: boolean) => {
    setMarcando(true);
    setErrorMarca(null);
    try {
      for (const o of ops.filter((op) => op.esEmpaque !== esEmpaque)) {
        await editar.mutateAsync({ operacionId: o.id, cambios: { esEmpaque } });
      }
    } catch (e) {
      setErrorMarca(e);
    } finally {
      setMarcando(false);
    }
  };

  const grupos = useMemo(() => {
    if (!detalle) return [];
    const mapa = new Map<string, OperacionDTO[]>();
    for (const op of detalle.operaciones) {
      const lista = mapa.get(op.grupo);
      if (lista) lista.push(op);
      else mapa.set(op.grupo, [op]);
    }
    return [...mapa.entries()];
  }, [detalle]);

  if (isLoading) return <div className="p-8 text-sm text-gray-500">Cargando versión…</div>;
  if (error || !detalle)
    return <div className="p-8 text-sm text-error">No se encontró la versión ({String(error)})</div>;

  const versionesDelModelo =
    modelos?.find((m) => m.id === detalle.modeloId)?.versiones ?? [];

  return (
    <>
      <HojaOperacionesImprimible detalle={detalle} />
      <div className="p-8 print:hidden">
        <div className="text-xs text-gray-500">
          <Link to="/modelos" className="hover:underline">
            Modelos
          </Link>{' '}
          / {detalle.modeloNombre}
        </div>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">
              {detalle.modeloNombre}{' '}
              <span className="rounded-full bg-[rgba(47,111,224,0.1)] px-2 py-0.5 align-middle text-sm font-semibold text-acento">
                v{detalle.numeroVersion}
              </span>
            </h1>
            {detalle.notas && <p className="mt-1 text-sm text-gray-500">{detalle.notas}</p>}
            <div className="mt-2 flex gap-1">
              {versionesDelModelo.map((v) => (
                <button
                  key={v.id}
                  onClick={() => navigate(`/modelos/versiones/${v.id}`)}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    v.id === detalle.id
                      ? 'bg-lateral text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  v{v.numeroVersion}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-right shadow-sm">
              <div className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                Mano de obra / prenda
              </div>
              <div className="mono text-2xl font-semibold">
                Bs {formatBs(detalle.costoManoObraPrenda)}
              </div>
              <div className="text-[11px] text-gray-400">
                {detalle.operaciones.length} operaciones
                {detalle.costoEmpaquePrenda > 0 && (
                  <>
                    {' · '}costura Bs {formatBs(detalle.costoManoObraPrenda - detalle.costoEmpaquePrenda)}
                    {' · '}
                    <span className="text-violet-700">empaque Bs {formatBs(detalle.costoEmpaquePrenda)}</span>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={() => window.print()}
              title="Hoja oficio vertical (21.5 × 33 cm)"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Imprimir operaciones
            </button>
            <button
              onClick={() => setModal({ tipo: 'nueva-version' })}
              className="rounded-lg border border-acento px-4 py-2 text-sm font-semibold text-acento hover:bg-[rgba(47,111,224,0.06)]"
            >
              Crear nueva versión
            </button>
          </div>
        </div>

        <TarjetaDiseno detalle={detalle} />

        <div className="mt-6 space-y-4">
          {grupos.map(([grupo, ops]) => (
            <GrupoModelo
              key={grupo}
              grupo={grupo}
              ops={ops}
              // arrastrar dentro del grupo: se manda el orden completo de la versión
              onReordenar={(idsGrupo) =>
                reordenar.mutate({
                  versionId: detalle.id,
                  operacionIds: grupos.flatMap(([g, os]) =>
                    g === grupo ? idsGrupo : os.map((o) => o.id),
                  ),
                })
              }
              onEditar={(op) => setModal({ tipo: 'editar', operacion: op })}
              onEliminar={(op) => setModal({ tipo: 'eliminar', operacion: op })}
              onAgregar={() => setModal({ tipo: 'agregar', grupo })}
              marcando={marcando}
              onMarcarEmpaque={(esEmpaque) => marcarGrupo(ops, esEmpaque)}
            />
          ))}
          {reordenar.error != null && (
            <p className="rounded-lg bg-error-suave px-3 py-2 text-sm text-error">
              {reordenar.error instanceof ErrorApi
                ? reordenar.error.message
                : 'No se pudo guardar el nuevo orden'}
            </p>
          )}
          {errorMarca != null && (
            <p className="rounded-lg bg-error-suave px-3 py-2 text-sm text-error">
              {errorMarca instanceof ErrorApi ? errorMarca.message : 'No se pudo guardar la marca de empaque'}
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={() => setModal({ tipo: 'agregar' })}
            className="rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:border-acento hover:text-acento"
          >
            + Agregar operación (nuevo grupo)
          </button>
          <button
            onClick={() => setModal({ tipo: 'bloque' })}
            title="Agrega todas las operaciones estándar de un grupo (Catálogo → Grupos)"
            className="rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:border-acento hover:text-acento"
          >
            + Agregar grupo del catálogo
          </button>
        </div>
        {modal?.tipo === 'bloque' && (
          <AgregarBloqueModal detalle={detalle} onCerrar={() => setModal(null)} />
        )}

        {modal?.tipo === 'agregar' && (
          <OperacionFormModal
            titulo="Agregar operación"
            operacion={null}
            grupoSugerido={modal.grupo}
            errorGuardar={agregar.error}
            onGuardar={(input) => agregar.mutateAsync({ versionId: detalle.id, input })}
            onCerrar={() => setModal(null)}
          />
        )}
        {modal?.tipo === 'editar' && (
          <OperacionFormModal
            titulo="Editar operación"
            operacion={modal.operacion}
            errorGuardar={editar.error}
            onGuardar={(input) =>
              editar.mutateAsync({ operacionId: modal.operacion.id, cambios: input })
            }
            onCerrar={() => setModal(null)}
          />
        )}
        {modal?.tipo === 'eliminar' && (
          <Modal onCerrar={() => setModal(null)}>
            <h2 className="text-lg font-semibold">Eliminar operación</h2>
            <p className="mt-2 text-sm text-gray-600">
              Se quitará <strong>{modal.operacion.proceso}</strong> ({modal.operacion.grupo}, Bs{' '}
              {formatBs(modal.operacion.ct)}) de la v{detalle.numeroVersion} y el costo por prenda se
              recalculará. Los cortes ya creados no cambian (usan su propio snapshot).
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setModal(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  await eliminar.mutateAsync({ operacionId: modal.operacion.id });
                  setModal(null);
                }}
                disabled={eliminar.isPending}
                className="rounded-lg bg-error px-4 py-2 text-sm font-semibold text-white hover:bg-[#a52d24] disabled:opacity-60"
              >
                Eliminar
              </button>
            </div>
          </Modal>
        )}
        {modal?.tipo === 'nueva-version' && (
          <ModalNuevaVersion
            detalle={detalle}
            numeroNueva={Math.max(...versionesDelModelo.map((v) => v.numeroVersion)) + 1}
            onCerrar={() => setModal(null)}
            onCreada={(id) => {
              setModal(null);
              navigate(`/modelos/versiones/${id}`);
            }}
          />
        )}
      </div>
    </>
  );
}
