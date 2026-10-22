import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  dateADia,
  diaADate,
  formatBs,
  MINUTOS_JORNADA,
  minutosPagados,
  sueldoDelPeriodo,
  type AsistenciaAyudanteDTO,
  type AsistenciaDiaDTO,
  type EstadoAsistencia,
} from '@taller/shared';
import {
  useDesmarcarAsistencia,
  useMarcarPresentes,
  useRegistrarAsistencia,
  useSemanaAsistencia,
} from '../../api/asistencia';
import { ErrorApi } from '../../api/client';
import { Modal } from '../../components/Modal';
import { hoyLocalISO } from '../../lib/fechas';

// Asistencia diaria de los ayudantes (docs/PLAN_AYUDANTES.md): grilla semanal
// lunes–sábado. Cada día: trabajó / faltó / feriado, minutos de atraso o salida
// temprana, y horas de horario dedicadas a operaciones (esas no cobran sueldo:
// se pagan las operaciones). El sueldo de la semana se calcula en vivo.

const DIA_MS = 86_400_000;
const NOMBRE_DIA = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

function lunesDe(dia: string): string {
  const d = diaADate(dia);
  return dateADia(new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DIA_MS));
}
const sumarDias = (dia: string, n: number) => dateADia(new Date(diaADate(dia).getTime() + n * DIA_MS));
const diaCorto = (dia: string) => `${Number(dia.slice(8))}/${Number(dia.slice(5, 7))}`;

/** "1 h 20 min" a partir de minutos. */
function horas(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h > 0 && `${h} h`, m > 0 && `${m} min`].filter(Boolean).join(' ') || '0 min';
}

function mensaje(e: unknown) {
  return e instanceof ErrorApi ? e.message : 'Error al guardar';
}

// ── Celda de un día ─────────────────────────────────────────────────────────

const ESTILO_ESTADO: Record<EstadoAsistencia, { texto: string; clase: string }> = {
  trabajo: { texto: '✓', clase: 'bg-ok-suave text-ok border-[#bfe3cd]' },
  falta: { texto: 'Faltó', clase: 'bg-error-suave text-error border-[#f2c9c5]' },
  feriado: { texto: 'Feriado', clase: 'bg-[rgba(47,111,224,0.08)] text-acento border-[#c9d8f5]' },
};

function Celda({ d, onEditar }: { d: AsistenciaDiaDTO; onEditar: () => void }) {
  if (!d.habil && d.estado == null) {
    return <span className="text-xs text-gray-300">—</span>;
  }
  if (d.estado == null) {
    return (
      <button
        onClick={onEditar}
        disabled={d.bloqueado}
        className="w-full rounded-md border border-dashed border-amber-300 bg-amber-50 px-2 py-2 text-[11px] font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
      >
        sin marcar
      </button>
    );
  }
  const e = ESTILO_ESTADO[d.estado];
  return (
    <button
      onClick={onEditar}
      disabled={d.bloqueado}
      title={d.nota ?? undefined}
      className={`w-full rounded-md border px-2 py-1.5 text-left hover:brightness-95 disabled:cursor-not-allowed ${e.clase}`}
    >
      <div className="text-xs font-semibold">{e.texto}</div>
      {d.minutosDescontados > 0 && (
        <div className="text-[10px]">−{horas(d.minutosDescontados)} atraso</div>
      )}
      {d.minutosOperaciones > 0 && (
        <div className="text-[10px]">{horas(d.minutosOperaciones)} en operaciones</div>
      )}
      <div className="mono text-[10px] opacity-80">{formatBs(d.monto)}</div>
    </button>
  );
}

// ── Modal para marcar / corregir un día ─────────────────────────────────────

function ModalDia({
  ayudante,
  dia,
  onCerrar,
}: {
  ayudante: AsistenciaAyudanteDTO;
  dia: AsistenciaDiaDTO;
  onCerrar: () => void;
}) {
  const registrar = useRegistrarAsistencia();
  const desmarcar = useDesmarcarAsistencia();
  const [estado, setEstado] = useState<EstadoAsistencia>(dia.estado ?? 'trabajo');
  const [atraso, setAtraso] = useState(String(dia.minutosDescontados || ''));
  const [operaciones, setOperaciones] = useState(dia.minutosOperaciones);
  const [nota, setNota] = useState(dia.nota ?? '');
  const [error, setError] = useState<string | null>(null);

  const minAtraso = estado === 'trabajo' ? Number(atraso || 0) : 0;
  const minOps = estado === 'trabajo' ? operaciones : 0;
  const pagados = minutosPagados({ estado, minutosDescontados: minAtraso, minutosOperaciones: minOps });
  const valorDia = sueldoDelPeriodo([{ montoSemanal: dia.sueldoSemanal ?? 0, minutosPagados: MINUTOS_JORNADA }]);
  const pagaDia = sueldoDelPeriodo([{ montoSemanal: dia.sueldoSemanal ?? 0, minutosPagados: pagados }]);
  const fecha = diaADate(dia.fecha);
  const esSabado = fecha.getUTCDay() === 6;

  const guardar = async () => {
    setError(null);
    if (!Number.isInteger(minAtraso) || minAtraso < 0) return setError('Minutos de atraso inválidos');
    if (minAtraso + minOps > MINUTOS_JORNADA) {
      return setError('Atraso + operaciones no pueden pasar la jornada de 9 h');
    }
    await registrar.mutateAsync({
      operarioId: ayudante.operarioId,
      fecha: dia.fecha,
      estado,
      minutosDescontados: minAtraso,
      minutosOperaciones: minOps,
      nota: nota.trim() === '' ? null : nota.trim(),
    });
    onCerrar();
  };

  const opcion = (valor: EstadoAsistencia, texto: string) => (
    <button
      type="button"
      onClick={() => setEstado(valor)}
      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${
        estado === valor ? ESTILO_ESTADO[valor].clase : 'border-gray-300 text-gray-500 hover:bg-gray-50'
      }`}
    >
      {texto}
    </button>
  );

  const fallo = error ?? (registrar.error || desmarcar.error ? mensaje(registrar.error ?? desmarcar.error) : null);

  return (
    <Modal onCerrar={onCerrar}>
      <h2 className="text-lg font-semibold">{ayudante.nombre}</h2>
      <p className="mt-0.5 text-sm text-gray-500 capitalize">
        {fecha.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}
        {esSabado && ' · medio día, se paga completo'}
      </p>

      <div className="mt-4 flex gap-2">
        {opcion('trabajo', 'Trabajó')}
        {opcion('falta', 'Faltó')}
        {opcion('feriado', 'Feriado')}
      </div>

      {estado === 'trabajo' && (
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Atraso o salida antes de hora{' '}
              <span className="font-normal text-gray-400">(minutos, se descuentan exactos)</span>
            </label>
            <input
              value={atraso}
              onChange={(e) => setAtraso(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              placeholder="0"
              className="mono w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-acento"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Horas de horario en operaciones{' '}
              <span className="font-normal text-gray-400">(no cobra sueldo; cobra las operaciones)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                [0, 'Ninguna'],
                [240, 'Mañana (4 h)'],
                [300, 'Tarde (5 h)'],
                [540, 'Día entero (9 h)'],
              ].map(([min, texto]) => (
                <button
                  key={min}
                  type="button"
                  onClick={() => setOperaciones(min as number)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    operaciones === min
                      ? 'border-acento bg-acento text-white'
                      : 'border-gray-300 text-gray-600 hover:border-acento'
                  }`}
                >
                  {texto}
                </button>
              ))}
            </div>
            {![0, 240, 300, 540].includes(operaciones) && (
              <p className="mt-1 text-xs text-gray-500">{horas(operaciones)} cargadas</p>
            )}
          </div>
        </div>
      )}

      <div className="mt-3">
        <label className="mb-1 block text-sm font-medium">
          Nota <span className="font-normal text-gray-400">(opcional)</span>
        </label>
        <input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          maxLength={120}
          placeholder="ej. tarde: embolsado del corte 23"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-acento"
        />
      </div>

      <div className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-sm">
        Sueldo de este día:{' '}
        <span className="mono font-semibold">Bs {formatBs(pagaDia)}</span>{' '}
        <span className="text-gray-500">
          de Bs {formatBs(valorDia)} ({horas(pagados)} pagadas de 9 h)
        </span>
      </div>

      {fallo && <p className="mt-3 rounded-lg bg-error-suave px-3 py-2 text-sm text-error">{fallo}</p>}

      <div className="mt-5 flex justify-between gap-2">
        <div>
          {dia.estado != null && (
            <button
              onClick={async () => {
                await desmarcar.mutateAsync({ operarioId: ayudante.operarioId, fecha: dia.fecha });
                onCerrar();
              }}
              disabled={desmarcar.isPending}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-error"
            >
              Desmarcar
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCerrar}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={registrar.isPending}
            className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-[#265dc2] disabled:opacity-60"
          >
            Guardar
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Página ──────────────────────────────────────────────────────────────────

export function AsistenciaPage() {
  const [lunes, setLunes] = useState(() => lunesDe(hoyLocalISO()));
  const { data, isLoading, error } = useSemanaAsistencia(lunes);
  const presentes = useMarcarPresentes();
  const [editando, setEditando] = useState<{ ayudante: AsistenciaAyudanteDTO; dia: AsistenciaDiaDTO } | null>(
    null,
  );
  const dias = Array.from({ length: 6 }, (_, i) => sumarDias(lunes, i));
  const hoy = hoyLocalISO();
  const total = data?.ayudantes.reduce((a, x) => a + x.totalSemana, 0) ?? 0;

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Asistencia</h1>
          <p className="mt-1 text-sm text-gray-500">
            Ayudantes con sueldo semanal · lunes a sábado (el sábado es medio día y se paga completo)
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-right shadow-sm">
          <div className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
            Sueldos de la semana
          </div>
          <div className="mono text-2xl font-semibold">Bs {formatBs(total)}</div>
          <div className="text-[11px] text-gray-400">solo días marcados</div>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={() => setLunes(sumarDias(lunes, -7))}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          ‹
        </button>
        <div className="min-w-44 text-center text-lg font-semibold">
          {diaCorto(dias[0])} al {diaCorto(dias[5])}/{dias[5].slice(0, 4)}
        </div>
        <button
          onClick={() => setLunes(sumarDias(lunes, 7))}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          ›
        </button>
        {lunes !== lunesDe(hoy) && (
          <button onClick={() => setLunes(lunesDe(hoy))} className="text-sm text-acento hover:underline">
            Esta semana
          </button>
        )}
      </div>

      {isLoading && <div className="mt-6 text-sm text-gray-500">Cargando…</div>}
      {error && <div className="mt-6 text-sm text-error">No se pudo cargar ({String(error)})</div>}
      {presentes.error != null && (
        <p className="mt-4 rounded-lg bg-error-suave px-3 py-2 text-sm text-error">{mensaje(presentes.error)}</p>
      )}

      {data && data.ayudantes.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          No hay ayudantes en esta semana. Asigná el rol <strong>Ayudante</strong> y su sueldo en{' '}
          <Link to="/operarios" className="text-acento hover:underline">
            Operarios
          </Link>
          .
        </div>
      )}

      {data && data.ayudantes.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                <th className="px-4 py-2">Ayudante</th>
                {dias.map((d, i) => {
                  const bloqueado = data.ayudantes[0]?.dias[i]?.bloqueado ?? false;
                  return (
                    <th key={d} className={`w-28 px-2 py-2 ${d === hoy ? 'text-acento' : ''}`}>
                      <div>
                        {NOMBRE_DIA[i]} {diaCorto(d)}
                      </div>
                      <button
                        onClick={() => presentes.mutate(d)}
                        disabled={bloqueado || presentes.isPending || d > hoy}
                        title="Marca 'trabajó' a todos los que no tienen el día marcado"
                        className="mt-0.5 text-[10px] font-medium tracking-normal text-acento normal-case hover:underline disabled:text-gray-300 disabled:no-underline"
                      >
                        ✓ todos presentes
                      </button>
                    </th>
                  );
                })}
                <th className="px-4 py-2 text-right">Semana</th>
              </tr>
            </thead>
            <tbody>
              {data.ayudantes.map((a) => (
                <tr key={a.operarioId} className="border-b border-gray-100 align-top last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{a.nombre}</div>
                    {!a.activo && <div className="text-[10px] text-gray-400">(de baja)</div>}
                  </td>
                  {a.dias.map((d) => (
                    <td key={d.fecha} className="px-2 py-2">
                      <Celda d={d} onEditar={() => setEditando({ ayudante: a, dia: d })} />
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right">
                    <div className="mono font-semibold">Bs {formatBs(a.totalSemana)}</div>
                    {a.diasSinMarcar > 0 && (
                      <div className="text-[11px] text-amber-700">
                        {a.diasSinMarcar} día{a.diasSinMarcar > 1 ? 's' : ''} sin marcar
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <ModalDia
          ayudante={editando.ayudante}
          dia={editando.dia}
          onCerrar={() => setEditando(null)}
        />
      )}
    </div>
  );
}
