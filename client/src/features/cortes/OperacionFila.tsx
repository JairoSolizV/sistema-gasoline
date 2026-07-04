import { useEffect, useMemo, useState } from 'react';
import {
  aCentavos,
  formatBs,
  type CorteOperacionDTO,
  type OperarioDTO,
} from '@taller/shared';
import { useReemplazarAsignaciones } from '../../api/cortes';
import { ErrorApi } from '../../api/client';
import { etiquetaOperacion } from './estados';

// Diferencial por defecto SOLO para el feedback en vivo; el que vale lo pone el
// server desde Configuración al guardar (CA-4.1/4.3).
const DIF_DEFECTO = 10;

interface FilaEditor {
  operarioId: string;
  cantidad: string;
  maestro: boolean;
  difBs: string; // vacío = usar el de configuración
}

const entero = (s: string) => (/^\d+$/.test(s.trim()) ? parseInt(s, 10) : 0);
const PATRON_BS = /^\d+(\.\d{1,2})?$/;

function desdeDTO(op: CorteOperacionDTO): FilaEditor[] {
  return op.asignaciones.map((a) => ({
    operarioId: a.operarioId,
    cantidad: String(a.cantidad),
    maestro: a.esMaestroExterno,
    difBs: a.esMaestroExterno ? formatBs(a.diferencial).replace(/ /g, '') : '',
  }));
}

export function OperacionFila({
  corteId,
  op,
  operarios,
  editable,
}: {
  corteId: string;
  op: CorteOperacionDTO;
  operarios: OperarioDTO[];
  editable: boolean;
}) {
  const guardar = useReemplazarAsignaciones();
  const [filas, setFilas] = useState<FilaEditor[]>(() => desdeDTO(op));
  const [sucio, setSucio] = useState(false);

  useEffect(() => {
    setFilas(desdeDTO(op));
    setSucio(false);
  }, [op]);

  const cambiar = (i: number, cambio: Partial<FilaEditor>) => {
    setFilas((fs) => fs.map((f, j) => (j === i ? { ...f, ...cambio } : f)));
    setSucio(true);
  };

  // feedback EN VIVO (verde/rojo instantáneo); la verdad la confirma el backend
  const vivo = useMemo(() => {
    const asignado = filas.reduce((a, f) => a + entero(f.cantidad), 0);
    const diferencia = op.cantidadObjetivo - asignado;
    const estado = filas.length === 0 ? 'sin_asignar' : diferencia === 0 ? 'asignada' : 'parcial';
    return { estado, asignado, diferencia };
  }, [filas, op.cantidadObjetivo]);

  const badge = etiquetaOperacion(vivo);

  const difCentavos = (f: FilaEditor) =>
    f.maestro ? (PATRON_BS.test(f.difBs) ? aCentavos(f.difBs) : DIF_DEFECTO) : 0;

  const filasValidas = filas.every((f) => f.operarioId !== '' && entero(f.cantidad) >= 1);

  const onGuardar = async () => {
    await guardar.mutateAsync({
      corteId,
      corteOperacionId: op.id,
      input: {
        asignaciones: filas.map((f) => ({
          operarioId: f.operarioId,
          cantidad: entero(f.cantidad),
          esMaestroExterno: f.maestro,
          ...(f.maestro && PATRON_BS.test(f.difBs) ? { diferencial: aCentavos(f.difBs) } : {}),
        })),
      },
    });
  };

  return (
    <div className="border-b border-gray-100 px-5 py-3 last:border-0" style={{ background: vivo.estado === 'parcial' ? '#fffafa' : undefined }}>
      <div className="flex items-center gap-3">
        <span className="mono w-8 flex-none text-xs text-gray-400">{op.n ?? '—'}</span>
        <span className="w-24 flex-none text-xs text-gray-500">{op.equipo}</span>
        <span className="flex-1 text-sm font-medium">
          {op.proceso}
          {op.pieza && <span className="font-normal text-gray-500"> · {op.pieza}</span>}
        </span>
        <span className="mono w-20 flex-none text-right text-sm">Bs {formatBs(op.ct)}</span>
        <span
          className="w-28 flex-none rounded-full border px-2 py-0.5 text-center text-[11px] font-semibold"
          style={{ color: badge.color, background: badge.bg, borderColor: badge.border }}
        >
          {badge.texto}
        </span>
        <span className="mono w-24 flex-none text-right text-sm font-semibold">
          Bs {formatBs(op.totalOperacion)}
        </span>
      </div>

      <div className="mt-2 space-y-1.5 pl-11">
        {filas.map((f, i) =>
          editable ? (
            <div key={i} className="flex items-center gap-2">
              <select
                value={f.operarioId}
                onChange={(e) => cambiar(i, { operarioId: e.target.value })}
                className="w-44 rounded-md border border-gray-300 bg-white px-2 py-1 text-[13px] outline-none focus:border-acento"
              >
                <option value="">Operario…</option>
                {operarios.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre}
                  </option>
                ))}
                {f.operarioId !== '' && !operarios.some((o) => o.id === f.operarioId) && (
                  <option value={f.operarioId}>(operario de baja)</option>
                )}
              </select>
              <input
                value={f.cantidad}
                onChange={(e) => cambiar(i, { cantidad: e.target.value.replace(/\D/g, '') })}
                placeholder="piezas"
                inputMode="numeric"
                className="mono w-20 rounded-md border border-gray-300 px-2 py-1 text-[13px] outline-none focus:border-acento"
              />
              <button
                onClick={() => cambiar(i, { maestro: !f.maestro })}
                title="Maestro externo (+diferencial por pieza)"
                className="rounded-md border px-2 py-1 text-[11px] font-semibold"
                style={
                  f.maestro
                    ? { color: '#2f6fe0', borderColor: '#2f6fe0', background: 'rgba(47,111,224,0.1)' }
                    : { color: '#98a0ac', borderColor: '#d7dbe2', background: '#fff' }
                }
              >
                maestro
              </button>
              {f.maestro && (
                <input
                  value={f.difBs}
                  onChange={(e) => cambiar(i, { difBs: e.target.value })}
                  placeholder="0.10"
                  title="Diferencial Bs/pieza (vacío = el de configuración)"
                  inputMode="decimal"
                  className="mono w-16 rounded-md border border-gray-300 px-2 py-1 text-[13px] outline-none focus:border-acento"
                />
              )}
              <span className="mono w-24 text-right text-[13px] text-gray-600">
                Bs {formatBs(entero(f.cantidad) * (op.ct + difCentavos(f)))}
              </span>
              <button
                onClick={() => {
                  setFilas((fs) => fs.filter((_, j) => j !== i));
                  setSucio(true);
                }}
                className="text-gray-400 hover:text-error"
                title="Quitar operario"
              >
                ✕
              </button>
            </div>
          ) : (
            <div key={i} className="flex items-center gap-2 text-[13px] text-gray-600">
              <span className="w-44 font-medium text-gray-800">
                {op.asignaciones[i]?.operarioNombre}
              </span>
              <span className="mono">{f.cantidad} pzas</span>
              {f.maestro && (
                <span className="rounded-full bg-[rgba(47,111,224,0.1)] px-1.5 text-[10px] font-semibold text-acento">
                  maestro +{f.difBs || '0.10'}
                </span>
              )}
              <span className="mono ml-auto">
                Bs {formatBs(op.asignaciones[i]?.total ?? 0)}
              </span>
            </div>
          ),
        )}

        {editable && (
          <div className="flex items-center gap-3 pt-0.5">
            {filas.length < 3 && (
              <button
                onClick={() => {
                  setFilas((fs) => [...fs, { operarioId: '', cantidad: '', maestro: false, difBs: '' }]);
                  setSucio(true);
                }}
                className="text-[12px] font-medium text-acento hover:underline"
              >
                + operario {filas.length > 0 ? `(${filas.length}/3)` : ''}
              </button>
            )}
            {sucio && (
              <>
                <button
                  onClick={onGuardar}
                  disabled={!filasValidas || guardar.isPending}
                  className="rounded-md bg-acento px-3 py-1 text-[12px] font-semibold text-white hover:bg-[#265dc2] disabled:opacity-50"
                >
                  Guardar asignación
                </button>
                {!filasValidas && (
                  <span className="text-[11px] text-gray-400">
                    elegí operario y cantidad (&gt;0) en cada fila
                  </span>
                )}
              </>
            )}
            {guardar.error != null && sucio && (
              <span className="text-[11px] text-error">
                {guardar.error instanceof ErrorApi ? guardar.error.message : 'Error al guardar'}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
