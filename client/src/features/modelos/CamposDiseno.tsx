import { aCentavos, formatBs, type MoldeInput, type PersonaDTO } from '@taller/shared';
import { deFechaInput, hoyLocalISO } from '../../lib/fechas';

// Búsqueda del diseño y moldes / patronaje (docs/PLAN_SERVICIO_CORTE.md §2.8-2.9).
// Mismos campos en el alta del modelo, en la versión nueva y en el detalle.

const claseInput =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-acento';
const PATRON_BS = /^\d+([.,]\d{1,2})?$/;

// ── Buscador ────────────────────────────────────────────────────────────────

export type ModoBuscador = 'pendiente' | 'buscador' | 'sin';

export interface BuscadorForm {
  modo: ModoBuscador;
  buscadorId: string;
}

export function buscadorDesde(b: { buscador: PersonaDTO | null; sinBuscador: boolean }): BuscadorForm {
  if (b.buscador) return { modo: 'buscador', buscadorId: b.buscador.id };
  return { modo: b.sinBuscador ? 'sin' : 'pendiente', buscadorId: '' };
}

/** null = falta elegir a la persona. */
export function datosBuscador(
  f: BuscadorForm,
): { buscadorId: string | null; sinBuscador: boolean } | null {
  if (f.modo === 'buscador') return f.buscadorId ? { buscadorId: f.buscadorId, sinBuscador: false } : null;
  return { buscadorId: null, sinBuscador: f.modo === 'sin' };
}

export function CamposBuscador({
  valor,
  onChange,
  buscadores,
  actual,
}: {
  valor: BuscadorForm;
  onChange: (v: BuscadorForm) => void;
  buscadores: PersonaDTO[] | undefined; // activos con rol buscador
  actual?: PersonaDTO | null; // el ya asignado (puede estar de baja o sin el rol)
}) {
  const opciones = [
    ...(buscadores ?? []),
    ...(actual && !buscadores?.some((b) => b.id === actual.id) ? [actual] : []),
  ];
  const radio = (modo: ModoBuscador, texto: string, ayuda: string) => (
    <label className="flex cursor-pointer items-start gap-2 text-sm">
      <input
        type="radio"
        checked={valor.modo === modo}
        onChange={() => onChange({ ...valor, modo })}
        className="mt-1"
      />
      <span>
        {texto}
        <span className="block text-xs text-gray-500">{ayuda}</span>
      </span>
    </label>
  );
  return (
    <div className="space-y-2">
      {radio('buscador', 'Lo buscó alguien del taller', 'Cobra la búsqueda por prenda en cada corte interno de este modelo.')}
      {valor.modo === 'buscador' && (
        <div className="pl-6">
          <select
            value={valor.buscadorId}
            onChange={(e) => onChange({ ...valor, buscadorId: e.target.value })}
            className={`${claseInput} max-w-xs`}
          >
            <option value="">
              {opciones.length > 0
                ? 'Elegir buscador…'
                : 'Nadie tiene el rol Buscador de diseño (asignalo en Operarios)'}
            </option>
            {opciones.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </select>
        </div>
      )}
      {radio('sin', 'Sin buscador', 'Modelo del cliente o anterior al módulo: no se paga búsqueda.')}
      {radio(
        'pendiente',
        'Decidir después',
        'Queda pendiente: un corte interno de este modelo no se podrá cerrar hasta definirlo.',
      )}
    </div>
  );
}

// ── Moldes ──────────────────────────────────────────────────────────────────

export interface MoldeForm {
  activo: boolean; // casilla "moldes hechos en el taller" / "se modificaron los moldes"
  moldistaId: string;
  fecha: string; // yyyy-mm-dd local
  montoBs: string;
}

export function moldeVacio(montoPredeterminado: number | undefined): MoldeForm {
  return {
    activo: false,
    moldistaId: '',
    fecha: hoyLocalISO(),
    montoBs: montoPredeterminado != null ? formatBs(montoPredeterminado).replace(/ /g, '') : '',
  };
}

/** Valida y arma el payload; `datos: null` si la casilla no está marcada. */
export function validarMolde(
  f: MoldeForm,
): { ok: true; datos: MoldeInput | null } | { ok: false; error: string } {
  if (!f.activo) return { ok: true, datos: null };
  if (!f.moldistaId) return { ok: false, error: 'Elegí quién hizo los moldes' };
  if (!f.fecha) return { ok: false, error: 'Ingresá la fecha de los moldes' };
  if (f.fecha > hoyLocalISO()) return { ok: false, error: 'La fecha de los moldes no puede ser futura' };
  const monto = f.montoBs.trim().replace(',', '.');
  if (!PATRON_BS.test(monto)) return { ok: false, error: 'Monto de moldes inválido (ej. 200.00)' };
  return {
    ok: true,
    datos: { moldistaId: f.moldistaId, fecha: deFechaInput(f.fecha), monto: aCentavos(monto) },
  };
}

export function CamposMolde({
  valor,
  onChange,
  moldistas,
  etiqueta,
  ayuda,
  sinCasilla = false,
}: {
  valor: MoldeForm;
  onChange: (v: MoldeForm) => void;
  moldistas: PersonaDTO[] | undefined; // activos con rol creador de moldes
  etiqueta: string; // texto de la casilla
  ayuda: string;
  sinCasilla?: boolean; // en el detalle de versión ya se sabe que hay moldes
}) {
  const set = <K extends keyof MoldeForm>(k: K, v: MoldeForm[K]) => onChange({ ...valor, [k]: v });
  return (
    <div className="space-y-3">
      {!sinCasilla && (
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={valor.activo}
            onChange={(e) => set('activo', e.target.checked)}
            className="mt-1"
          />
          <span>
            {etiqueta}
            <span className="block text-xs text-gray-500">{ayuda}</span>
          </span>
        </label>
      )}
      {(valor.activo || sinCasilla) && (
        <div className={`grid grid-cols-1 gap-3 sm:grid-cols-3 ${sinCasilla ? '' : 'pl-6'}`}>
          <div>
            <label className="mb-1 block text-xs font-medium">Creador de moldes</label>
            <select
              value={valor.moldistaId}
              onChange={(e) => set('moldistaId', e.target.value)}
              className={claseInput}
            >
              <option value="">
                {(moldistas?.length ?? 0) > 0
                  ? 'Elegir…'
                  : 'Nadie tiene el rol Creador de moldes'}
              </option>
              {moldistas?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Fecha (cuándo se paga)</label>
            <input
              type="date"
              value={valor.fecha}
              max={hoyLocalISO()}
              onChange={(e) => set('fecha', e.target.value)}
              className={claseInput}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Monto (Bs)</label>
            <input
              value={valor.montoBs}
              onChange={(e) => set('montoBs', e.target.value.replace(/[^\d.,]/g, ''))}
              inputMode="decimal"
              className={`mono ${claseInput}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
