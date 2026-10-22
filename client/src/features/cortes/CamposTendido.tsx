import {
  formatMetros,
  metrosACm,
  type CorteDetalleDTO,
  type EditarTendidoInput,
} from '@taller/shared';

// Datos del tendido (tela y medidas). Informativos: no afectan pagos. Quién
// cortó, dobló, etc. ahora son procesos pagados del servicio de corte
// (ServicioCorte.tsx). Mismo formulario al crear el corte y al corregirlo.

export interface TendidoForm {
  tela: string;
  ancho: string; // metros, como se tipea
  trazado: string;
  prendasPorCapa: string; // opcional (costos: tela real)
}

export function tendidoVacio(): TendidoForm {
  return { tela: '', ancho: '', trazado: '', prendasPorCapa: '' };
}

export function tendidoDesdeCorte(c: CorteDetalleDTO): TendidoForm {
  return {
    tela: c.tela ?? '',
    ancho: c.anchoCm != null ? formatMetros(c.anchoCm) : '',
    trazado: c.trazadoCm != null ? formatMetros(c.trazadoCm) : '',
    prendasPorCapa: c.prendasPorCapa != null ? String(c.prendasPorCapa) : '',
  };
}

/** Valida y convierte al payload de la API; devuelve el primer error si hay. */
export function validarTendido(
  v: TendidoForm,
): { ok: true; datos: EditarTendidoInput } | { ok: false; error: string } {
  const anchoCm = metrosACm(v.ancho);
  const trazadoCm = metrosACm(v.trazado);
  if (v.tela.trim() === '') return { ok: false, error: 'Ingresá el nombre de la tela' };
  if (!anchoCm) return { ok: false, error: 'Ancho de tela inválido (en metros, ej. 1.60)' };
  if (!trazadoCm) return { ok: false, error: 'Largo de trazado inválido (en metros, ej. 5.25)' };
  const prendasPorCapa = v.prendasPorCapa.trim() === '' ? null : Number(v.prendasPorCapa);
  if (prendasPorCapa != null && !(prendasPorCapa >= 1)) {
    return { ok: false, error: 'Prendas por capa inválidas (ej. 10)' };
  }
  return { ok: true, datos: { tela: v.tela.trim(), anchoCm, trazadoCm, prendasPorCapa } };
}

const claseInput =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-acento';

export function CamposTendido({
  valor,
  onChange,
}: {
  valor: TendidoForm;
  onChange: (v: TendidoForm) => void;
}) {
  const set = <K extends keyof TendidoForm>(campo: K, v: TendidoForm[K]) =>
    onChange({ ...valor, [campo]: v });
  const soloMetros = (s: string) => s.replace(/[^\d.,]/g, '');

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Tela</label>
        <input
          value={valor.tela}
          onChange={(e) => set('tela', e.target.value)}
          maxLength={60}
          placeholder="ej. DENIM 14 OZ AZUL"
          className={claseInput}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">
          Ancho <span className="font-normal text-gray-400">(m)</span>
        </label>
        <input
          value={valor.ancho}
          onChange={(e) => set('ancho', soloMetros(e.target.value))}
          inputMode="decimal"
          placeholder="ej. 1.60"
          className={`mono ${claseInput}`}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">
          Trazado <span className="font-normal text-gray-400">(largo, m)</span>
        </label>
        <input
          value={valor.trazado}
          onChange={(e) => set('trazado', soloMetros(e.target.value))}
          inputMode="decimal"
          placeholder="ej. 5.25"
          className={`mono ${claseInput}`}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">
          Prendas por capa <span className="font-normal text-gray-400">(opcional)</span>
        </label>
        <input
          value={valor.prendasPorCapa}
          onChange={(e) => set('prendasPorCapa', e.target.value.replace(/\D/g, ''))}
          inputMode="numeric"
          placeholder="ej. 10"
          title="Para el costo real de la tela: largo del trazado × capas"
          className={`mono ${claseInput}`}
        />
      </div>
    </div>
  );
}
