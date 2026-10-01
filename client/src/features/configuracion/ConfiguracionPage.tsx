import { useEffect, useState } from 'react';
import {
  aCentavos,
  CLAVES_TARIFA_CORTE,
  formatBs,
  type ClaveTarifaCorte,
  type ConfiguracionDTO,
} from '@taller/shared';
import { useConfiguracion, useEditarConfiguracion } from '../../api/configuracion';
import { ErrorApi } from '../../api/client';

const PATRON_BS = /^\d+(\.\d{1,2})?$/;
const claseInput =
  'w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-acento focus:ring-2 focus:ring-acento/20';

const aTexto = (centavos: number) => formatBs(centavos).replace(/ /g, '');

// Tarifas del servicio de corte interno (docs/PLAN_SERVICIO_CORTE.md), en el
// orden del proceso. "unidad" aclara cómo se aplica cada una.
const TARIFAS: { clave: ClaveTarifaCorte; etiqueta: string; unidad: string; ayuda: string }[] = [
  {
    clave: 'tarifaBusqueda',
    etiqueta: 'Búsqueda del modelo',
    unidad: 'por prenda',
    ayuda: 'La cobra quien encontró el modelo, en cada corte que se produce de ese modelo.',
  },
  {
    clave: 'tarifaMoldeNuevo',
    etiqueta: 'Moldes / patronaje — modelo nuevo',
    unidad: 'monto fijo',
    ayuda: 'Una sola vez, al crear un modelo con moldes hechos en el taller.',
  },
  {
    clave: 'tarifaMoldeModificacion',
    etiqueta: 'Moldes / patronaje — modificación',
    unidad: 'monto fijo',
    ayuda: 'Al crear una versión nueva en la que se modificaron los moldes.',
  },
  {
    clave: 'tarifaTrazado',
    etiqueta: 'Trazado',
    unidad: 'por prenda',
    ayuda: 'Un trazador por corte; se paga aunque se reutilice el trazado.',
  },
  {
    clave: 'tarifaDobladoHoja',
    etiqueta: 'Doblado por hoja / cara',
    unidad: 'por prenda (total)',
    ayuda: 'Se reparte mitad y mitad entre los 2 dobladores (ej. 0.15 → 0.075 cada uno).',
  },
  {
    clave: 'tarifaDobladoPares',
    etiqueta: 'Doblado por pares',
    unidad: 'por prenda (total)',
    ayuda: 'Se reparte mitad y mitad entre los 2 dobladores (ej. 0.10 → 0.05 cada uno).',
  },
  {
    clave: 'tarifaCorteRespaldo',
    etiqueta: 'Corte — tarifa de respaldo',
    unidad: 'por prenda y persona',
    ayuda: 'Solo para el cortador que no tiene tarifa propia en su ficha de operario.',
  },
  {
    clave: 'tarifaClasificacionRespaldo',
    etiqueta: 'Clasificación y codificación — respaldo',
    unidad: 'por prenda y persona',
    ayuda: 'Solo para el clasificador que no tiene tarifa propia en su ficha de operario.',
  },
];

type TextosTarifa = Record<ClaveTarifaCorte, string>;

function textosDesde(data: ConfiguracionDTO): TextosTarifa {
  return Object.fromEntries(CLAVES_TARIFA_CORTE.map((k) => [k, aTexto(data[k])])) as TextosTarifa;
}

export function ConfiguracionPage() {
  const { data, isLoading } = useConfiguracion();
  const editar = useEditarConfiguracion();
  const [nombre, setNombre] = useState('');
  const [topeBs, setTopeBs] = useState('');
  const [difBs, setDifBs] = useState('');
  const [tarifas, setTarifas] = useState<TextosTarifa | null>(null);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    if (data) {
      setNombre(data.nombreTaller ?? '');
      setTopeBs(aTexto(data.topeAnticipoAdvertencia));
      setDifBs(aTexto(data.diferencialMaestroExterno));
      setTarifas(textosDesde(data));
    }
  }, [data]);

  const topeValido = PATRON_BS.test(topeBs);
  const difValido = PATRON_BS.test(difBs);
  const tarifaValida = (k: ClaveTarifaCorte) => tarifas != null && PATRON_BS.test(tarifas[k]);
  const todoValido = topeValido && difValido && CLAVES_TARIFA_CORTE.every(tarifaValida);

  const onGuardar = async () => {
    if (!todoValido || !tarifas) return;
    await editar.mutateAsync({
      nombreTaller: nombre.trim() === '' ? null : nombre.trim(),
      topeAnticipoAdvertencia: aCentavos(topeBs),
      diferencialMaestroExterno: aCentavos(difBs),
      ...Object.fromEntries(CLAVES_TARIFA_CORTE.map((k) => [k, aCentavos(tarifas[k])])),
    });
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2500);
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Configuración</h1>
      <p className="mt-1 text-sm text-gray-500">Parámetros del taller</p>

      {isLoading && <div className="mt-6 text-sm text-gray-500">Cargando…</div>}

      {data && tarifas && (
        <div className="mt-6 max-w-2xl space-y-5">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <label className="mb-1 block text-sm font-medium">Nombre del taller</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="ej. Taller de confección"
              className={claseInput}
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <label className="mb-1 block text-sm font-medium">Tope de anticipo (advertencia)</label>
            <p className="mb-2 text-xs text-gray-500">
              Si un anticipo supera este monto, el sistema <strong>avisa</strong> pero permite
              guardarlo igual.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Bs</span>
              <input
                value={topeBs}
                onChange={(e) => setTopeBs(e.target.value)}
                inputMode="decimal"
                className={`${claseInput} mono`}
              />
            </div>
            {!topeValido && <p className="mt-1 text-xs text-error">Monto inválido (ej. 2000.00)</p>}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <label className="mb-1 block text-sm font-medium">
              Diferencial de maestro externo (por pieza)
            </label>
            <p className="mb-2 text-xs text-gray-500">
              Se suma a la tarifa base cuando una asignación de <strong>costura</strong> es de un
              maestro externo. Cambiarlo afecta <strong>solo asignaciones nuevas</strong>; las ya
              guardadas conservan su tarifa.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Bs</span>
              <input
                value={difBs}
                onChange={(e) => setDifBs(e.target.value)}
                inputMode="decimal"
                className={`${claseInput} mono`}
              />
            </div>
            {!difValido && <p className="mt-1 text-xs text-error">Monto inválido (ej. 0.10)</p>}
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 bg-gray-50 px-5 py-3">
              <div className="text-sm font-semibold">Tarifas del servicio de corte interno</div>
              <p className="mt-0.5 text-xs text-gray-500">
                Son los valores <strong>predeterminados</strong>: al crear un corte se copian a ese
                corte y ahí se pueden cambiar. Modificarlos acá <strong>no altera</strong> los cortes
                ya creados.
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              {TARIFAS.map((t) => (
                <div key={t.clave} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
                  <div className="min-w-[220px] flex-1">
                    <div className="text-sm font-medium">{t.etiqueta}</div>
                    <div className="text-xs text-gray-500">{t.ayuda}</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">Bs</span>
                      <input
                        value={tarifas[t.clave]}
                        onChange={(e) => setTarifas({ ...tarifas, [t.clave]: e.target.value })}
                        inputMode="decimal"
                        aria-label={t.etiqueta}
                        className="mono w-28 rounded-lg border border-gray-300 px-3 py-1.5 text-right text-sm outline-none focus:border-acento"
                      />
                      <span className="w-36 text-xs text-gray-500">{t.unidad}</span>
                    </div>
                    {!tarifaValida(t.clave) && (
                      <p className="mt-1 text-xs text-error">Monto inválido (ej. 0.30)</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {editar.error != null && (
            <p className="rounded-lg bg-error-suave px-3 py-2 text-sm text-error">
              {editar.error instanceof ErrorApi ? editar.error.message : 'Error al guardar'}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={onGuardar}
              disabled={editar.isPending || !todoValido}
              className="rounded-lg bg-acento px-5 py-2 text-sm font-semibold text-white hover:bg-[#265dc2] disabled:opacity-60"
            >
              Guardar cambios
            </button>
            {guardado && <span className="text-sm font-medium text-ok">✓ Guardado</span>}
          </div>
        </div>
      )}
    </div>
  );
}
