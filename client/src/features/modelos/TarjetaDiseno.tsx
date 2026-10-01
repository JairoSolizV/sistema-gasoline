import { useEffect, useState } from 'react';
import { formatBs, type ModeloVersionDetalleDTO } from '@taller/shared';
import { useEditarBuscador, useEliminarMolde, useGuardarMolde } from '../../api/modelos';
import { useOperarios } from '../../api/operarios';
import { useConfiguracion } from '../../api/configuracion';
import { ErrorApi } from '../../api/client';
import { Modal } from '../../components/Modal';
import { aFechaInput } from '../../lib/fechas';
import {
  buscadorDesde,
  CamposBuscador,
  CamposMolde,
  datosBuscador,
  moldeVacio,
  validarMolde,
  type MoldeForm,
} from './CamposDiseno';

// Diseño del modelo en el detalle de una versión: buscador (del modelo) y moldes
// (de esta versión). docs/PLAN_SERVICIO_CORTE.md §2.8-2.9.

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-BO');

function MensajeError({ error }: { error: unknown }) {
  if (error == null) return null;
  return (
    <p className="mt-4 rounded-lg bg-error-suave px-3 py-2 text-sm text-error">
      {typeof error === 'string' ? error : error instanceof ErrorApi ? error.message : 'Error al guardar'}
    </p>
  );
}

function Botones({
  onCancelar,
  onGuardar,
  ocupado,
  texto = 'Guardar',
}: {
  onCancelar: () => void;
  onGuardar: () => void;
  ocupado: boolean;
  texto?: string;
}) {
  return (
    <div className="mt-5 flex justify-end gap-2">
      <button
        onClick={onCancelar}
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
      >
        Cancelar
      </button>
      <button
        onClick={onGuardar}
        disabled={ocupado}
        className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-[#265dc2] disabled:opacity-60"
      >
        {texto}
      </button>
    </div>
  );
}

function ModalBuscador({ detalle, onCerrar }: { detalle: ModeloVersionDetalleDTO; onCerrar: () => void }) {
  const { data: buscadores } = useOperarios('activos', 'buscador');
  const editar = useEditarBuscador();
  const [valor, setValor] = useState(() => buscadorDesde(detalle));
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    const datos = datosBuscador(valor);
    if (!datos) return setError('Elegí quién buscó el modelo');
    await editar.mutateAsync({ modeloId: detalle.modeloId, ...datos });
    onCerrar();
  };

  return (
    <Modal onCerrar={onCerrar}>
      <h2 className="text-lg font-semibold">Búsqueda de {detalle.modeloNombre}</h2>
      <p className="mt-1 text-sm text-gray-500">Vale para todas las versiones del modelo.</p>
      <div className="mt-4">
        <CamposBuscador
          valor={valor}
          onChange={setValor}
          buscadores={buscadores}
          actual={detalle.buscador}
        />
      </div>
      <MensajeError error={error ?? editar.error} />
      <Botones onCancelar={onCerrar} onGuardar={guardar} ocupado={editar.isPending} />
    </Modal>
  );
}

function ModalMolde({ detalle, onCerrar }: { detalle: ModeloVersionDetalleDTO; onCerrar: () => void }) {
  const { data: moldistas } = useOperarios('activos', 'moldista');
  const { data: config } = useConfiguracion();
  const guardarMolde = useGuardarMolde();
  const esNuevo = detalle.numeroVersion === 1;
  const predeterminado = esNuevo ? config?.tarifaMoldeNuevo : config?.tarifaMoldeModificacion;
  const [valor, setValor] = useState<MoldeForm>(() =>
    detalle.molde
      ? {
          activo: true,
          moldistaId: detalle.molde.operario.id,
          fecha: aFechaInput(detalle.molde.fecha),
          montoBs: formatBs(detalle.molde.monto).replace(/ /g, ''),
        }
      : { ...moldeVacio(predeterminado), activo: true },
  );
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    // la configuración puede llegar después de abrir el modal
    if (!detalle.molde && valor.montoBs === '' && predeterminado != null) {
      setValor((v) => ({ ...v, montoBs: formatBs(predeterminado).replace(/ /g, '') }));
    }
  }, [detalle.molde, valor.montoBs, predeterminado]);
  // el que ya figura puede estar de baja o sin el rol: se mantiene en la lista
  const opciones = [
    ...(moldistas ?? []),
    ...(detalle.molde && !moldistas?.some((m) => m.id === detalle.molde!.operario.id)
      ? [detalle.molde.operario]
      : []),
  ];

  const guardar = async () => {
    const m = validarMolde(valor);
    if (!m.ok) return setError(m.error);
    await guardarMolde.mutateAsync({ versionId: detalle.id, input: m.datos! });
    onCerrar();
  };

  return (
    <Modal onCerrar={onCerrar} ancho="max-w-2xl">
      <h2 className="text-lg font-semibold">
        Moldes de la v{detalle.numeroVersion} · {esNuevo ? 'modelo nuevo' : 'modificación'}
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        Se paga una sola vez, en la semana de la fecha indicada
        {predeterminado != null && ` (predeterminado Bs ${formatBs(predeterminado)})`}.
      </p>
      <div className="mt-4">
        <CamposMolde
          valor={valor}
          onChange={setValor}
          moldistas={opciones}
          etiqueta=""
          ayuda=""
          sinCasilla
        />
      </div>
      <MensajeError error={error ?? guardarMolde.error} />
      <Botones onCancelar={onCerrar} onGuardar={guardar} ocupado={guardarMolde.isPending} />
    </Modal>
  );
}

function ModalQuitarMolde({
  detalle,
  onCerrar,
}: {
  detalle: ModeloVersionDetalleDTO;
  onCerrar: () => void;
}) {
  const eliminar = useEliminarMolde();
  return (
    <Modal onCerrar={onCerrar}>
      <h2 className="text-lg font-semibold">Quitar los moldes de la v{detalle.numeroVersion}</h2>
      <p className="mt-2 text-sm text-gray-600">
        Se borra el pago de Bs {formatBs(detalle.molde!.monto)} a{' '}
        <strong>{detalle.molde!.operario.nombre}</strong>. No se puede si esa fecha ya está en un
        mes liquidado.
      </p>
      <MensajeError error={eliminar.error} />
      <Botones
        onCancelar={onCerrar}
        onGuardar={async () => {
          await eliminar.mutateAsync(detalle.id);
          onCerrar();
        }}
        ocupado={eliminar.isPending}
        texto="Quitar moldes"
      />
    </Modal>
  );
}

export function TarjetaDiseno({ detalle }: { detalle: ModeloVersionDetalleDTO }) {
  const [modal, setModal] = useState<'buscador' | 'molde' | 'quitar' | null>(null);
  const cerrar = () => setModal(null);

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
            Búsqueda del modelo
          </span>
          <button onClick={() => setModal('buscador')} className="text-xs font-medium text-acento hover:underline">
            Cambiar
          </button>
        </div>
        <div className="mt-1 text-sm">
          {detalle.buscador ? (
            <>
              <strong>{detalle.buscador.nombre}</strong>
              <span className="text-gray-500"> · cobra por prenda en cada corte interno</span>
            </>
          ) : detalle.sinBuscador ? (
            <span className="text-gray-600">Sin buscador (no se paga búsqueda)</span>
          ) : (
            <span className="font-medium text-amber-700">
              ⚠ Pendiente: definilo antes de cerrar un corte interno de este modelo
            </span>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
            Moldes de la v{detalle.numeroVersion}
          </span>
          <div className="flex gap-3 text-xs font-medium">
            <button onClick={() => setModal('molde')} className="text-acento hover:underline">
              {detalle.molde ? 'Editar' : 'Registrar moldes'}
            </button>
            {detalle.molde && (
              <button onClick={() => setModal('quitar')} className="text-error hover:underline">
                Quitar
              </button>
            )}
          </div>
        </div>
        <div className="mt-1 text-sm">
          {detalle.molde ? (
            <>
              <strong>{detalle.molde.operario.nombre}</strong>
              <span className="text-gray-500">
                {' '}
                · {detalle.molde.tipo === 'nuevo' ? 'modelo nuevo' : 'modificación'} ·{' '}
              </span>
              <span className="mono font-semibold">Bs {formatBs(detalle.molde.monto)}</span>
              <span className="text-gray-500"> · {fecha(detalle.molde.fecha)}</span>
            </>
          ) : (
            <span className="text-gray-500">Sin moldes registrados en esta versión</span>
          )}
        </div>
      </div>

      {modal === 'buscador' && <ModalBuscador detalle={detalle} onCerrar={cerrar} />}
      {modal === 'molde' && <ModalMolde detalle={detalle} onCerrar={cerrar} />}
      {modal === 'quitar' && detalle.molde && <ModalQuitarMolde detalle={detalle} onCerrar={cerrar} />}
    </div>
  );
}
