import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';

// Página con título y pestañas (la pestaña activa va en ?tab=, así un enlace
// puede abrir una pestaña directo). Con una sola pestaña no se muestran.
export interface Pestana {
  clave: string;
  etiqueta: string;
  contenido: () => ReactNode;
  /** la pestaña imprime su propia hoja: el título y las pestañas no salen */
  imprimeSola?: boolean;
}

export function PaginaPestanas({
  titulo,
  descripcion,
  pestanas,
}: {
  titulo: string;
  descripcion: ReactNode;
  pestanas: Pestana[];
}) {
  const [parametros, setParametros] = useSearchParams();
  const activa = pestanas.find((p) => p.clave === parametros.get('tab')) ?? pestanas[0];
  const oculto = activa.imprimeSola ? 'print:hidden' : '';

  return (
    <div className="p-8 print:p-0">
      <h1 className={`text-2xl font-semibold ${oculto}`}>{titulo}</h1>
      <p className={`mt-1 text-sm text-gray-500 ${oculto}`}>{descripcion}</p>
      {pestanas.length > 1 && (
        <div className={`mt-5 flex flex-wrap gap-1 border-b border-gray-200 ${oculto}`}>
          {pestanas.map((p) => (
            <button
              key={p.clave}
              onClick={() => setParametros({ tab: p.clave }, { replace: true })}
              className={`-mb-px rounded-t-lg border px-4 py-2 text-sm ${
                p.clave === activa.clave
                  ? 'border-gray-200 border-b-white bg-white font-semibold'
                  : 'border-transparent text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>
      )}
      <div className="mt-4 print:mt-0">{activa.contenido()}</div>
    </div>
  );
}
