import { formatDuracion, type CorteDetalleDTO } from '@taller/shared';

// Cuánto tarda el corte según los tiempos del catálogo (congelados al abrir):
// todos cosen en paralelo, así que termina cuando termina el más cargado.
// Solo estimado: no afecta pagos.
export function DuracionEstimada({ corte }: { corte: CorteDetalleDTO }) {
  const { duracionSeg, operarioMasCargado, operacionesSinTiempo, operacionesSinAsignar } =
    corte.estimado;
  const total = corte.operaciones.length;
  const ningunaConTiempo = total > 0 && operacionesSinTiempo.length === total;

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
      <div className="mb-1 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
        Duración estimada
      </div>
      {ningunaConTiempo ? (
        <p className="max-w-56 text-xs text-gray-500">
          Sin tiempos: este corte se abrió cuando el catálogo todavía no tenía los segundos de sus
          operaciones.
        </p>
      ) : duracionSeg == null ? (
        <p className="max-w-56 text-xs text-gray-500">Asigná operaciones para estimar.</p>
      ) : (
        <>
          <div className="mono text-lg font-semibold">{formatDuracion(duracionSeg)}</div>
          {operarioMasCargado && (
            <div className="max-w-56 text-[11px] text-gray-500">
              lo que tarda <strong>{operarioMasCargado.nombre}</strong>, el más cargado (cosen en
              paralelo)
            </div>
          )}
        </>
      )}
      {!ningunaConTiempo && operacionesSinTiempo.length > 0 && (
        <div
          className="mt-1 max-w-56 text-[11px] text-amber-700"
          title={operacionesSinTiempo.join('\n')}
        >
          ⚠ {operacionesSinTiempo.length} operación(es) sin tiempo en el catálogo: no cuentan
        </div>
      )}
      {corte.estado === 'abierto' && duracionSeg != null && operacionesSinAsignar > 0 && (
        <div className="mt-1 max-w-56 text-[11px] text-gray-500">
          Faltan asignar {operacionesSinAsignar} operación(es): el estimado puede subir
        </div>
      )}
    </div>
  );
}
