import { useMutation, useQueryClient } from '@tanstack/react-query';
import { INFO_PASO, PASOS_CORTE, semaforoPaso, type PasoCorte } from '@taller/shared';
import { api } from '../api/client';

// Pasos de un corte (docs/PLAN_DIDACTICO_REPORTES.md): los 5 dibujos, cuál es
// el actual y un botón grande para avanzar. Tocar otro dibujo también lo cambia
// (por si se marcó mal). No toca pagos.

export const COLOR_SEMAFORO = {
  ok: { punto: '#3B6D11', fondo: '#EAF3DE', texto: 'va bien' },
  atencion: { punto: '#BA7517', fondo: '#FAEEDA', texto: 'está tardando' },
  demora: { punto: '#C0362C', fondo: '#FBECEB', texto: 'está muy demorado' },
} as const;

export function useCambiarPaso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ corteId, paso }: { corteId: string; paso: PasoCorte }) =>
      api(`/dinero/cortes/${corteId}/paso`, { method: 'PATCH', body: JSON.stringify({ paso }) }),
    onSuccess: () =>
      Promise.all([qc.invalidateQueries({ queryKey: ['dinero'] }), qc.invalidateQueries({ queryKey: ['cortes'] })]),
  });
}

export const diasDesde = (iso: string) => Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86_400_000));

/** Barra de pasos. `compacta` = solo dibujos (para listas). */
export function PasosCorte({
  corteId,
  paso,
  pasoDesde,
  compacta = false,
}: {
  corteId: string;
  paso: PasoCorte;
  pasoDesde: string;
  compacta?: boolean;
}) {
  const cambiar = useCambiarPaso();
  const i = PASOS_CORTE.indexOf(paso);
  const siguiente = PASOS_CORTE[i + 1];
  const dias = diasDesde(pasoDesde);
  const sem = COLOR_SEMAFORO[semaforoPaso(paso, dias)];
  const marcar = (p: PasoCorte) => p !== paso && cambiar.mutate({ corteId, paso: p });

  return (
    <div className={compacta ? '' : 'rounded-xl border border-gray-200 bg-white p-4 shadow-sm'}>
      {!compacta && (
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-sm font-semibold">¿Dónde está este corte?</div>
          <div className="flex items-center gap-1.5 text-xs" style={{ color: sem.punto }}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: sem.punto }} />
            {INFO_PASO[paso].nombre.toLowerCase()} hace {dias} día(s) · {sem.texto}
          </div>
        </div>
      )}
      <div className="flex items-center gap-1">
        {PASOS_CORTE.map((p, k) => {
          const actual = p === paso;
          const pasado = k < i;
          return (
            <div key={p} className="flex items-center gap-1">
              <button
                onClick={() => marcar(p)}
                title={`${INFO_PASO[p].nombre}: ${INFO_PASO[p].que}`}
                className={`imprime flex flex-col items-center rounded-lg px-2 py-1 ${compacta ? 'text-lg' : 'min-w-16 text-2xl'} ${
                  actual ? 'bg-[rgba(47,111,224,0.12)] ring-2 ring-acento' : pasado ? 'opacity-60' : 'opacity-30 hover:opacity-70'
                }`}
              >
                <span aria-hidden="true">{INFO_PASO[p].icono}</span>
                {!compacta && <span className={`mt-0.5 text-[11px] ${actual ? 'font-semibold text-acento' : 'text-gray-600'}`}>{INFO_PASO[p].nombre}</span>}
              </button>
              {k < PASOS_CORTE.length - 1 && <span className={`text-gray-300 ${compacta ? 'text-xs' : ''}`}>›</span>}
            </div>
          );
        })}
      </div>
      {!compacta && siguiente && (
        <button
          onClick={() => marcar(siguiente)}
          disabled={cambiar.isPending}
          className="mt-3 rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-[#265dc2] disabled:opacity-60"
        >
          {INFO_PASO[siguiente].icono} Pasó a {INFO_PASO[siguiente].nombre.toLowerCase().replace('en ', '')}
        </button>
      )}
      {!compacta && <p className="mt-2 text-xs text-gray-500">{INFO_PASO[paso].que}. Solo sirve para saber dónde está: no cambia ningún pago.</p>}
    </div>
  );
}
