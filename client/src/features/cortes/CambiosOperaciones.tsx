// Operaciones del corte por grupo + cambios de último momento (reordenar,
// editar, agregar, quitar). Estos cambios son SOLO del corte: el modelo no se
// toca, y cada uno queda en el historial que se muestra al final.
import {
  formatBs,
  type CampoOperacion,
  type CorteCambioDTO,
  type CorteDetalleDTO,
  type CorteOperacionDTO,
  type OperarioDTO,
} from '@taller/shared';
import {
  useAgregarOperacionCorte,
  useEditarOperacionCorte,
  useQuitarOperacionCorte,
} from '../../api/cortes';
import { ErrorApi } from '../../api/client';
import { Modal } from '../../components/Modal';
import { claseIndicador, useArrastrarOrden } from '../../lib/useArrastrarOrden';
import { OperacionFormModal } from '../modelos/OperacionFormModal';
import { etiquetaGrupo } from './estados';
import { OperacionFila } from './OperacionFila';

export type ModalOperacion =
  | { tipo: 'agregar'; grupo?: string }
  | { tipo: 'editar'; operacion: CorteOperacionDTO }
  | { tipo: 'quitar'; operacion: CorteOperacionDTO };

/** Un grupo de operaciones del corte. Con el corte abierto se reordena
 *  arrastrando la manija ⠿ (solo dentro del grupo). */
export function GrupoCorte({
  corte,
  grupo,
  ops,
  operarios,
  editable,
  plegado,
  onPlegar,
  onAsignarGrupo,
  onReordenar,
  onEditar,
  onQuitar,
  onAgregar,
}: {
  corte: CorteDetalleDTO;
  grupo: string;
  ops: CorteOperacionDTO[];
  operarios: OperarioDTO[];
  editable: boolean;
  plegado: boolean;
  onPlegar: () => void;
  onAsignarGrupo: (operarioId: string) => void;
  onReordenar: (idsGrupo: string[]) => void;
  onEditar: (op: CorteOperacionDTO) => void;
  onQuitar: (op: CorteOperacionDTO) => void;
  onAgregar: () => void;
}) {
  const g = etiquetaGrupo(ops);
  const { arrastrado, manija, fila, indicador } = useArrastrarOrden(
    ops.map((o) => o.id),
    onReordenar,
  );

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-gray-200 bg-gray-50 px-5 py-2.5">
        <button onClick={onPlegar} className="flex items-center gap-2 text-sm font-semibold">
          <span
            className="inline-block text-gray-400 transition-transform"
            style={{ transform: plegado ? 'rotate(0deg)' : 'rotate(90deg)' }}
          >
            ▸
          </span>
          {grupo}
        </button>
        <span
          className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
          style={{ color: g.color, background: g.bg, borderColor: g.border }}
        >
          {g.texto}
        </span>
        <span className="text-xs text-gray-500">
          {g.ok}/{ops.length}
        </span>
        <span className="mono ml-auto text-xs text-gray-500">
          Σ CT Bs {formatBs(ops.reduce((a, o) => a + o.ct, 0))}
        </span>
        {editable && (
          <select
            value=""
            onChange={(e) => {
              const operarioId = e.target.value;
              if (!operarioId) return;
              const nombre = operarios.find((o) => o.id === operarioId)?.nombre;
              if (
                window.confirm(
                  `Asignar TODO el grupo ${grupo} a ${nombre} (${corte.cantidadTotal} piezas por operación)? Se reemplazan las asignaciones actuales del grupo.`,
                )
              ) {
                onAsignarGrupo(operarioId);
              }
              e.target.value = '';
            }}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs outline-none focus:border-acento"
          >
            <option value="">Asignar grupo completo a…</option>
            {operarios.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
              </option>
            ))}
          </select>
        )}
      </div>
      {!plegado && (
        <div>
          {ops.map((op) => (
            <div
              key={op.id}
              {...(editable ? fila(op.id) : {})}
              className={`${arrastrado === op.id ? 'opacity-40' : ''} ${claseIndicador(indicador(op.id))}`}
            >
              <OperacionFila
                corteId={corte.id}
                op={op}
                operarios={operarios}
                editable={editable}
                manija={editable ? manija(op.id) : undefined}
                onEditar={editable ? () => onEditar(op) : undefined}
                onQuitar={editable ? () => onQuitar(op) : undefined}
              />
            </div>
          ))}
          {editable && (
            <div className="border-t border-gray-100 px-5 py-2">
              <button
                onClick={onAgregar}
                className="text-[13px] font-medium text-acento hover:underline"
              >
                + Agregar operación a {grupo} (solo este corte)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Editar / agregar / quitar una operación del corte. */
export function ModalOperacionCorte({
  corte,
  modal,
  onCerrar,
}: {
  corte: CorteDetalleDTO;
  modal: ModalOperacion;
  onCerrar: () => void;
}) {
  const editar = useEditarOperacionCorte();
  const agregar = useAgregarOperacionCorte();
  const quitar = useQuitarOperacionCorte();

  if (modal.tipo === 'editar') {
    const op = modal.operacion;
    return (
      <OperacionFormModal
        titulo="Editar operación del corte"
        aviso={
          <>
            Cambia <strong>solo este corte</strong> (el modelo no se toca) y queda en el historial.
            {op.asignaciones.length > 0 &&
              ' Si cambiás el CT, se recalcula lo que ganan los operarios ya asignados.'}
          </>
        }
        operacion={op}
        errorGuardar={editar.error}
        onGuardar={(input) =>
          editar.mutateAsync({ corteId: corte.id, corteOperacionId: op.id, cambios: input })
        }
        onCerrar={onCerrar}
      />
    );
  }

  if (modal.tipo === 'agregar') {
    return (
      <OperacionFormModal
        titulo="Agregar operación al corte"
        aviso={
          <>
            Se agrega <strong>solo a este corte</strong> (el modelo no se toca). Empieza sin asignar:
            hay que asignarla para poder cerrar el corte.
          </>
        }
        operacion={null}
        grupoSugerido={modal.grupo}
        errorGuardar={agregar.error}
        onGuardar={(input) => agregar.mutateAsync({ corteId: corte.id, input })}
        onCerrar={onCerrar}
      />
    );
  }

  const op = modal.operacion;
  return (
    <Modal onCerrar={onCerrar}>
      <h2 className="text-lg font-semibold">Quitar operación del corte</h2>
      <p className="mt-2 text-sm text-gray-600">
        Se quitará <strong>{op.proceso}</strong>
        {op.pieza ? ` · ${op.pieza}` : ''} ({op.grupo}, Bs {formatBs(op.ct)}) <strong>solo de este
        corte</strong>. El modelo no cambia y queda registrado en el historial.
      </p>
      {quitar.error != null && (
        <p className="mt-3 rounded-lg bg-error-suave px-3 py-2 text-xs text-error">
          {quitar.error instanceof ErrorApi ? quitar.error.message : 'Error al quitar'}
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
          onClick={async () => {
            await quitar.mutateAsync({ corteId: corte.id, corteOperacionId: op.id });
            onCerrar();
          }}
          disabled={quitar.isPending}
          className="rounded-lg bg-error px-4 py-2 text-sm font-semibold text-white hover:bg-[#a52d24] disabled:opacity-60"
        >
          Quitar
        </button>
      </div>
    </Modal>
  );
}

const NOMBRE_CAMPO: Record<CampoOperacion, string> = {
  grupo: 'Grupo',
  n: 'N',
  equipo: 'Máquina',
  proceso: 'Proceso',
  pieza: 'Pieza',
  ct: 'CT',
};

function valorCampo(campo: CampoOperacion, v: string | number | null): string {
  if (v == null || v === '') return '—';
  return campo === 'ct' ? `Bs ${formatBs(Number(v))}` : String(v);
}

const ESTILO_TIPO: Record<CorteCambioDTO['detalle']['tipo'], { texto: string; clase: string }> = {
  reordenar: { texto: 'Orden', clase: 'border-gray-300 bg-gray-50 text-gray-600' },
  editar: { texto: 'Modificada', clase: 'border-amber-300 bg-amber-50 text-amber-700' },
  agregar: { texto: 'Agregada', clase: 'border-[#b9dcc6] bg-[#eef8f1] text-[#2f8a55]' },
  quitar: { texto: 'Quitada', clase: 'border-[#f0c4c0] bg-[#fdf1f0] text-error' },
};

function DescripcionCambio({ cambio }: { cambio: CorteCambioDTO }) {
  const d = cambio.detalle;
  switch (d.tipo) {
    case 'editar':
      return (
        <span>
          {d.campos.map((c, i) => (
            <span key={c.campo}>
              {i > 0 && ' · '}
              {NOMBRE_CAMPO[c.campo]}: <span className="text-gray-400 line-through">{valorCampo(c.campo, c.antes)}</span>{' '}
              → <strong>{valorCampo(c.campo, c.despues)}</strong>
            </span>
          ))}
        </span>
      );
    case 'agregar':
    case 'quitar':
      return (
        <span>
          {d.operacion.equipo} · <span className="mono">Bs {formatBs(d.operacion.ct)}</span>
          {d.tipo === 'agregar' ? ' — no está en el modelo' : ' — no se hace en este corte'}
        </span>
      );
    case 'reordenar':
      return (
        <span title={`Antes: ${d.antes.join(' → ')}`}>
          Nuevo orden del grupo: {d.despues.join(' → ')}
        </span>
      );
  }
}

/** Historial de lo que se modificó del modelo original, solo en este corte. */
export function HistorialCambios({ cambios }: { cambios: CorteCambioDTO[] }) {
  if (cambios.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-2.5">
        <span className="text-sm font-semibold">
          Cambios respecto al modelo{' '}
          <span className="font-normal text-gray-500">({cambios.length})</span>
        </span>
        <span className="text-xs text-gray-500">solo en este corte · el modelo no cambió</span>
      </div>
      <ul className="divide-y divide-gray-100">
        {cambios.map((c) => {
          const estilo = ESTILO_TIPO[c.detalle.tipo];
          return (
            <li key={c.id} className="flex items-start gap-3 px-5 py-2 text-[13px]">
              <span className="mono w-28 flex-none pt-px text-[11px] whitespace-nowrap text-gray-400">
                {new Date(c.fecha).toLocaleString('es-BO', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <span
                className={`w-20 flex-none rounded-full border px-1.5 py-px text-center text-[10px] font-semibold ${estilo.clase}`}
              >
                {estilo.texto}
              </span>
              <span className="flex-1 text-gray-700">
                <span className="font-medium text-gray-900">{c.etiqueta}</span>
                {c.etiqueta !== c.grupo && <span className="text-gray-400"> ({c.grupo})</span>} —{' '}
                <DescripcionCambio cambio={c} />
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
