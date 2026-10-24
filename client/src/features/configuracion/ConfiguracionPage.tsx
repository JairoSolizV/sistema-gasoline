import { useEffect, useState } from 'react';
import {
  aCentavos,
  CLAVES_TARIFA_CORTE,
  formatBs,
  MAQUINAS_HILO_DEFECTO,
  TITULOS_HILO,
  type ClaveTarifaCorte,
  type ConfiguracionDTO,
  type MaquinaHilos,
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
  const [margenPct, setMargenPct] = useState('');
  const [prendasMes, setPrendasMes] = useState('');
  const [tasaUsd, setTasaUsd] = useState('');
  const [tarifas, setTarifas] = useState<TextosTarifa | null>(null);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    if (data) {
      setNombre(data.nombreTaller ?? '');
      setTopeBs(aTexto(data.topeAnticipoAdvertencia));
      setDifBs(aTexto(data.diferencialMaestroExterno));
      setMargenPct(String(data.margenVenta / 100));
      setPrendasMes(String(data.prendasMesCostoFijo));
      setTasaUsd(String(data.tasaCambioUsd / 10_000));
      setTarifas(textosDesde(data));
    }
  }, [data]);

  const topeValido = PATRON_BS.test(topeBs);
  const difValido = PATRON_BS.test(difBs);
  const margenValido = /^\d+([.,]\d{1,2})?$/.test(margenPct.trim());
  const prendasValidas = Number(prendasMes) >= 1;
  const tasaValida = /^\d+([.,]\d{1,4})?$/.test(tasaUsd.trim()) && Number(tasaUsd.trim().replace(',', '.')) > 0;
  const tarifaValida = (k: ClaveTarifaCorte) => tarifas != null && PATRON_BS.test(tarifas[k]);
  const todoValido =
    topeValido &&
    difValido &&
    margenValido &&
    prendasValidas &&
    tasaValida &&
    CLAVES_TARIFA_CORTE.every(tarifaValida);

  const onGuardar = async () => {
    if (!todoValido || !tarifas) return;
    await editar.mutateAsync({
      nombreTaller: nombre.trim() === '' ? null : nombre.trim(),
      topeAnticipoAdvertencia: aCentavos(topeBs),
      diferencialMaestroExterno: aCentavos(difBs),
      margenVenta: Math.round(Number(margenPct.trim().replace(',', '.')) * 100),
      prendasMesCostoFijo: Number(prendasMes),
      tasaCambioUsd: Math.round(Number(tasaUsd.trim().replace(',', '.')) * 10_000),
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

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <label className="mb-1 block text-sm font-medium">Margen de venta (costos)</label>
            <p className="mb-2 text-xs text-gray-500">
              Precio de venta = costo por prenda + este porcentaje. Se usa en las fichas de costo
              que no tienen un margen propio. No afecta ningún pago.
            </p>
            <div className="flex items-center gap-2">
              <input
                value={margenPct}
                onChange={(e) => setMargenPct(e.target.value)}
                inputMode="decimal"
                className={`${claseInput} mono max-w-32`}
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
            {!margenValido && <p className="mt-1 text-xs text-error">Porcentaje inválido (ej. 30)</p>}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <label className="mb-1 block text-sm font-medium">Prendas por mes para los costos fijos</label>
            <p className="mb-2 text-xs text-gray-500">
              Los costos fijos del taller del mes se dividen por estas prendas y se suman a cada ficha
              de costo. Conviene el mínimo que producen (precio seguro aunque un mes salga poco).
            </p>
            <div className="flex items-center gap-2">
              <input
                value={prendasMes}
                onChange={(e) => setPrendasMes(e.target.value.replace(/\D/g, ''))}
                inputMode="numeric"
                className={`${claseInput} mono max-w-32`}
              />
              <span className="text-sm text-gray-500">prendas</span>
            </div>
            {!prendasValidas && <p className="mt-1 text-xs text-error">Indicá cuántas prendas (ej. 1500)</p>}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <label className="mb-1 block text-sm font-medium">Último tipo de cambio del dólar</label>
            <p className="mb-2 text-xs text-gray-500">
              Bs por cada $us. Cada despacho, cobro, compra y cambio de dólares guarda el de su día; el
              último que escribiste queda acá y se propone en el siguiente. También pasa a Bs los precios
              de la docena en dólares de las fichas y lo que te deben.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Bs</span>
              <input
                value={tasaUsd}
                onChange={(e) => setTasaUsd(e.target.value)}
                inputMode="decimal"
                className={`${claseInput} mono max-w-32`}
              />
              <span className="text-sm text-gray-500">por $us</span>
            </div>
            {!tasaValida && <p className="mt-1 text-xs text-error">Tipo de cambio inválido (ej. 11.85)</p>}
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

          <HilosMaquinas guardadas={data.hilosMaquinas} />
        </div>
      )}
    </div>
  );
}

/** Requerimiento de insumos (docs/PLAN_REQUERIMIENTO.md): las máquinas del
 *  taller y cuántos conos de cada hilo lleva cargados cada una. Son conos fijos
 *  por corte: no crecen con la cantidad de prendas. */
function HilosMaquinas({ guardadas }: { guardadas: MaquinaHilos[] }) {
  const editar = useEditarConfiguracion();
  const [filas, setFilas] = useState<MaquinaHilos[]>(guardadas);
  const [guardado, setGuardado] = useState(false);
  useEffect(() => setFilas(guardadas), [guardadas]);

  const cambiar = (i: number, cambio: Partial<MaquinaHilos>) => {
    setFilas(filas.map((f, k) => (k === i ? { ...f, ...cambio } : f)));
    setGuardado(false);
  };
  const totales = TITULOS_HILO.map((t) => filas.reduce((a, f) => a + (f.conos[t] || 0), 0));
  const valido = filas.every((f) => f.maquina.trim() !== '');

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 bg-gray-50 px-5 py-3">
        <div className="text-sm font-semibold">Hilos por máquina</div>
        <p className="mt-0.5 text-xs text-gray-500">
          Para el requerimiento de insumos de cada corte: conos de cada hilo que lleva cargada cada
          máquina. Son fijos por corte, no dependen de la cantidad de prendas.
        </p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
            <th className="px-5 py-2">Máquina</th>
            {TITULOS_HILO.map((t) => (
              <th key={t} className="px-2 py-2 text-right">
                {t}
              </th>
            ))}
            <th />
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} className="border-t border-gray-100">
              <td className="px-5 py-1">
                <input
                  value={f.maquina}
                  onChange={(e) => cambiar(i, { maquina: e.target.value.toUpperCase() })}
                  className="w-40 rounded-md border border-gray-300 px-2 py-1 text-sm outline-none focus:border-acento"
                />
              </td>
              {TITULOS_HILO.map((t) => (
                <td key={t} className="px-2 py-1 text-right">
                  <input
                    value={f.conos[t] || ''}
                    onChange={(e) =>
                      cambiar(i, { conos: { ...f.conos, [t]: parseInt(e.target.value.replace(/\D/g, '') || '0', 10) } })
                    }
                    inputMode="numeric"
                    placeholder="0"
                    className="mono w-14 rounded-md border border-gray-300 px-2 py-1 text-right text-sm outline-none focus:border-acento"
                  />
                </td>
              ))}
              <td className="px-3 text-center">
                <button
                  onClick={() => setFilas(filas.filter((_, k) => k !== i))}
                  title="Quitar máquina"
                  className="text-gray-400 hover:text-error"
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-300 font-semibold">
            <td className="px-5 py-2">Total conos</td>
            {totales.map((n, i) => (
              <td key={i} className="mono px-4 py-2 text-right">
                {n}
              </td>
            ))}
            <td />
          </tr>
        </tfoot>
      </table>
      <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 px-5 py-3">
        <button
          onClick={() =>
            setFilas([...filas, { maquina: '', conos: { '20/3': 0, '20/2': 0, '40/2': 0, Over: 0 } }])
          }
          className="text-[13px] font-medium text-acento hover:underline"
        >
          + Máquina
        </button>
        <button
          onClick={() => setFilas(MAQUINAS_HILO_DEFECTO)}
          className="text-[13px] font-medium text-gray-500 hover:underline"
        >
          Volver a la lista de la hoja
        </button>
        <span className="flex-1" />
        {editar.error != null && (
          <span className="text-xs text-error">
            {editar.error instanceof ErrorApi ? editar.error.message : 'Error al guardar'}
          </span>
        )}
        {guardado && <span className="text-sm font-medium text-ok">✓ Guardado</span>}
        <button
          onClick={async () => {
            await editar.mutateAsync({ hilosMaquinas: filas });
            setGuardado(true);
          }}
          disabled={editar.isPending || !valido}
          className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-[#265dc2] disabled:opacity-60"
        >
          Guardar máquinas
        </button>
      </div>
    </div>
  );
}
