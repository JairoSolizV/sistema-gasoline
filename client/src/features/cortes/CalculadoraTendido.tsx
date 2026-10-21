import { useMemo, useState } from 'react';
import {
  calcularTendido,
  formatMetros,
  metrosACm,
  type CorteDetalleDTO,
  type PiezaTendido,
} from '@taller/shared';
import { useEditarRollos } from '../../api/cortes';
import { ErrorApi } from '../../api/client';

// Calculadora de tendido: con los metros de cada rollo, el trazado, el traslape
// de cada empalme y el retazo mínimo útil, calcula las hojas enteras, las hojas
// extra empalmando retazos (hasta 3 pedazos) y lo que sobra. Informativa: no
// afecta pagos. El cálculo es el mismo de shared/src/tendido.ts.

const TRASLAPE_DEFECTO = '0.50';
const MINIMO_DEFECTO = '0.50';

/** "68.80 70,15\n65.5" → [6880, 7015, 6550]; los que no son números van a `malos`. */
function leerRollos(texto: string) {
  const partes = texto.split(/[\s;]+/).filter((p) => p !== '');
  const cms: number[] = [];
  const malos: string[] = [];
  for (const p of partes) {
    const cm = metrosACm(p);
    if (cm && cm > 0) cms.push(cm);
    else malos.push(p);
  }
  return { cms, malos };
}

const m = (cm: number) => `${formatMetros(cm)} m`;
const pieza = (p: PiezaTendido) => `R${p.rollo}${p.resto ? ' (resto)' : ''} ${formatMetros(p.cm)}`;

function Dato({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <div className="text-[10px] font-semibold tracking-wider text-gray-500 uppercase">{titulo}</div>
      <div className="mono text-base font-semibold whitespace-nowrap">{valor}</div>
      {detalle && <div className="text-[11px] text-gray-500">{detalle}</div>}
    </div>
  );
}

export function CalculadoraTendido({ corte }: { corte: CorteDetalleDTO }) {
  const guardar = useEditarRollos();
  const editable = corte.estado !== 'cerrado';
  const guardado = corte.rollos;

  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState(() =>
    guardado ? guardado.rollosCm.map(formatMetros).join(' ') : '',
  );
  const [traslape, setTraslape] = useState(() =>
    guardado ? formatMetros(guardado.traslapeCm) : TRASLAPE_DEFECTO,
  );
  const [minimo, setMinimo] = useState(() =>
    guardado ? formatMetros(guardado.retazoMinimoCm) : MINIMO_DEFECTO,
  );

  // mientras se edita se calcula con lo tipeado; si no, con lo guardado
  const entrada = useMemo(() => {
    if (!abierto) return guardado ? { ...guardado, malos: [] as string[] } : null;
    const { cms, malos } = leerRollos(texto);
    return {
      rollosCm: cms,
      traslapeCm: metrosACm(traslape) ?? 0,
      retazoMinimoCm: metrosACm(minimo) ?? 0,
      malos,
    };
  }, [abierto, guardado, texto, traslape, minimo]);

  const resultado = useMemo(
    () =>
      entrada && corte.trazadoCm && entrada.rollosCm.length > 0
        ? calcularTendido({ ...entrada, trazadoCm: corte.trazadoCm })
        : null,
    [entrada, corte.trazadoCm],
  );

  const onGuardar = async () => {
    if (!entrada || entrada.rollosCm.length === 0 || entrada.malos.length > 0) return;
    await guardar.mutateAsync({
      corteId: corte.id,
      input: {
        rollosCm: entrada.rollosCm,
        traslapeCm: entrada.traslapeCm,
        retazoMinimoCm: entrada.retazoMinimoCm,
      },
    });
    setAbierto(false);
  };

  const claseInput =
    'mono rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-acento';

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-5 py-2.5">
        <div>
          <span className="text-sm font-semibold">Rollos y hojas</span>
          <span className="ml-2 text-[11px] text-gray-500">
            calculadora de tendido
            {corte.trazadoCm ? ` · trazado ${m(corte.trazadoCm)}` : ''} · informativo, no afecta pagos
          </span>
        </div>
        {editable && corte.trazadoCm != null && !abierto && (
          <button
            onClick={() => setAbierto(true)}
            className="text-xs font-medium text-acento hover:underline"
          >
            {guardado ? 'Editar rollos' : 'Cargar rollos'}
          </button>
        )}
      </div>

      <div className="p-5">
        {corte.trazadoCm == null ? (
          <p className="text-sm text-gray-500">Cargá primero el largo del trazado en el tendido.</p>
        ) : !abierto && !guardado ? (
          <p className="text-sm text-gray-500">
            Cargá los metros de cada rollo para saber cuántas hojas salen, cuántas más se pueden
            armar empalmando retazos y cuánta tela sobra.
          </p>
        ) : null}

        {abierto && (
          <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto_auto]">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Metros de cada rollo{' '}
                <span className="font-normal text-gray-400">(en orden, separados por espacio)</span>
              </label>
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={2}
                placeholder="ej. 68.80 70.15 65.50 72.00"
                className={`${claseInput} w-full`}
              />
              {entrada && entrada.malos.length > 0 && (
                <p className="mt-1 text-xs text-error">
                  No se entiende: {entrada.malos.join(', ')} (usá metros, ej. 68.80)
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Traslape <span className="font-normal text-gray-400">(m)</span>
              </label>
              <input
                value={traslape}
                onChange={(e) => setTraslape(e.target.value.replace(/[^\d.,]/g, ''))}
                inputMode="decimal"
                title="Lo que se enciman los pedazos en cada empalme"
                className={`${claseInput} w-24`}
              />
              <p className="mt-1 text-[11px] text-gray-400">se enciman al empalmar</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Retazo mínimo <span className="font-normal text-gray-400">(m)</span>
              </label>
              <input
                value={minimo}
                onChange={(e) => setMinimo(e.target.value.replace(/[^\d.,]/g, ''))}
                inputMode="decimal"
                title="Retazos más cortos no se usan para empalmar"
                className={`${claseInput} w-24`}
              />
              <p className="mt-1 text-[11px] text-gray-400">más corto no se empalma</p>
            </div>
          </div>
        )}

        {resultado && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Dato
                titulo="Tela"
                valor={m(resultado.totalCm)}
                detalle={`${resultado.rollos.length} rollo(s)`}
              />
              <Dato titulo="Hojas enteras" valor={String(resultado.hojasEnteras)} detalle="sin empalmar" />
              <Dato
                titulo="Empalmando"
                valor={`+${resultado.empalmes.length}`}
                detalle="hojas con retazos"
              />
              <Dato
                titulo="Hojas totales"
                valor={String(resultado.hojasTotales)}
                detalle={`máx. teórico ${resultado.maximoTeoricoHojas}`}
              />
              <Dato
                titulo="Sobra útil"
                valor={m(resultado.sobranteUtilCm)}
                detalle={`${resultado.sobrantesUtiles.length} retazo(s)`}
              />
              <Dato
                titulo="Descarte"
                valor={m(resultado.descartadoCm)}
                detalle="retazos muy cortos"
              />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <div className="mb-1 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                  Por rollo
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="py-1">Rollo</th>
                      <th className="py-1 text-right">Metros</th>
                      <th className="py-1 text-right">Hojas</th>
                      <th className="py-1 text-right">Retazo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.rollos.map((r) => (
                      <tr key={r.rollo} className="border-b border-gray-100 last:border-0">
                        <td className="py-1">R{r.rollo}</td>
                        <td className="mono py-1 text-right">{formatMetros(r.cm)}</td>
                        <td className="mono py-1 text-right">{r.hojas}</td>
                        <td className="mono py-1 text-right">{formatMetros(r.retazoCm)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="mb-1 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                    Hojas empalmadas
                  </div>
                  {resultado.empalmes.length === 0 ? (
                    <p className="text-xs text-gray-500">
                      Los retazos no alcanzan para armar una hoja (necesitan sumar al menos{' '}
                      {m((corte.trazadoCm ?? 0) + (entrada?.traslapeCm ?? 0))} de a dos).
                    </p>
                  ) : (
                    <ol className="space-y-1 text-xs">
                      {resultado.empalmes.map((e, i) => (
                        <li key={i} className="mono">
                          <span className="text-gray-400">{i + 1}.</span>{' '}
                          {e.piezas.map(pieza).join(' + ')}{' '}
                          <span className="text-gray-500">
                            (necesita {formatMetros(e.necesarioCm)}, sobra {formatMetros(e.sobranteCm)})
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
                <div>
                  <div className="mb-1 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                    Retazos que sobran
                  </div>
                  {resultado.sobrantesUtiles.length + resultado.sobrantesDescartados.length === 0 ? (
                    <p className="text-xs text-gray-500">No sobra nada.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {resultado.sobrantesUtiles.map((p, i) => (
                        <span
                          key={`u${i}`}
                          className="mono rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px]"
                        >
                          {pieza(p)}
                        </span>
                      ))}
                      {resultado.sobrantesDescartados.map((p, i) => (
                        <span
                          key={`d${i}`}
                          title="Más corto que el retazo mínimo"
                          className="mono rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-[11px] text-gray-400"
                        >
                          {pieza(p)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {abierto && (
          <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
            {guardar.error != null && (
              <span className="text-xs text-error">
                {guardar.error instanceof ErrorApi ? guardar.error.message : 'Error al guardar'}
              </span>
            )}
            <button
              onClick={() => setAbierto(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={onGuardar}
              disabled={
                guardar.isPending || !entrada || entrada.rollosCm.length === 0 || entrada.malos.length > 0
              }
              className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-[#265dc2] disabled:opacity-50"
            >
              Guardar rollos
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
