import { useEffect, useState } from 'react';
import { aCentavos, formatBs } from '@taller/shared';
import { useConfiguracion, useEditarConfiguracion } from '../../api/configuracion';
import { ErrorApi } from '../../api/client';

const PATRON_BS = /^\d+(\.\d{1,2})?$/;
const claseInput =
  'w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-acento focus:ring-2 focus:ring-acento/20';

export function ConfiguracionPage() {
  const { data, isLoading } = useConfiguracion();
  const editar = useEditarConfiguracion();
  const [nombre, setNombre] = useState('');
  const [topeBs, setTopeBs] = useState('');
  const [difBs, setDifBs] = useState('');
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    if (data) {
      setNombre(data.nombreTaller ?? '');
      setTopeBs(formatBs(data.topeAnticipoAdvertencia).replace(/ /g, ''));
      setDifBs(formatBs(data.diferencialMaestroExterno).replace(/ /g, ''));
    }
  }, [data]);

  const topeValido = PATRON_BS.test(topeBs);
  const difValido = PATRON_BS.test(difBs);

  const onGuardar = async () => {
    if (!topeValido || !difValido) return;
    await editar.mutateAsync({
      nombreTaller: nombre.trim() === '' ? null : nombre.trim(),
      topeAnticipoAdvertencia: aCentavos(topeBs),
      diferencialMaestroExterno: aCentavos(difBs),
    });
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2500);
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Configuración</h1>
      <p className="mt-1 text-sm text-gray-500">Parámetros del taller</p>

      {isLoading && <div className="mt-6 text-sm text-gray-500">Cargando…</div>}

      {data && (
        <div className="mt-6 max-w-xl space-y-5">
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
              Se suma a la tarifa base cuando una asignación es de un maestro externo. Cambiarlo
              afecta <strong>solo asignaciones nuevas</strong>; las ya guardadas conservan su tarifa.
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

          {editar.error != null && (
            <p className="rounded-lg bg-error-suave px-3 py-2 text-sm text-error">
              {editar.error instanceof ErrorApi ? editar.error.message : 'Error al guardar'}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={onGuardar}
              disabled={editar.isPending || !topeValido || !difValido}
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
