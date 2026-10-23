import { useEffect, useRef, useState } from 'react';

// Impresión en las hojas que tiene el taller (docs/PLAN_DIDACTICO_REPORTES.md §3):
// oficio y medio oficio, vertical u horizontal. Se elige el tamaño, se pone el
// @page de ese tamaño solo mientras dura la impresión y, en medio oficio, la
// página se achica para que entre igual.

export const TAMANOS = [
  { clave: 'oficio-v', etiqueta: 'Oficio vertical', ancho: '21.5cm', alto: '33cm', zoom: 1 },
  { clave: 'oficio-h', etiqueta: 'Oficio horizontal', ancho: '33cm', alto: '21.5cm', zoom: 1 },
  { clave: 'medio-v', etiqueta: 'Medio oficio vertical', ancho: '16.5cm', alto: '21.5cm', zoom: 0.72 },
  { clave: 'medio-h', etiqueta: 'Medio oficio horizontal', ancho: '21.5cm', alto: '16.5cm', zoom: 0.8 },
] as const;
export type Tamano = (typeof TAMANOS)[number]['clave'];

const CLAVE_GUARDADA = 'taller_tamano_impresion';

/** Imprime la página en el tamaño elegido. */
export function imprimir(clave: Tamano) {
  const t = TAMANOS.find((x) => x.clave === clave)!;
  const estilo = document.createElement('style');
  // va al final del documento: gana sobre el @page de index.css y de HojaOficio
  estilo.textContent = `@page { size: ${t.ancho} ${t.alto}; margin: 1cm; }
@media print { body { zoom: ${t.zoom}; } }`;
  document.body.appendChild(estilo);
  try {
    localStorage.setItem(CLAVE_GUARDADA, clave);
  } catch {
    // sin almacenamiento: no se recuerda el tamaño, no pasa nada
  }
  const limpiar = () => {
    estilo.remove();
    window.removeEventListener('afterprint', limpiar);
  };
  window.addEventListener('afterprint', limpiar);
  window.print();
}

function ultimoTamano(): Tamano {
  try {
    const v = localStorage.getItem(CLAVE_GUARDADA);
    if (TAMANOS.some((t) => t.clave === v)) return v as Tamano;
  } catch {
    // sin almacenamiento
  }
  return 'oficio-v';
}

/** Botón "Imprimir" con la lista de tamaños (recuerda el último usado).
 *  Con `alElegir`, en vez de imprimir la página entera llama a esa función
 *  (ej. para montar una hoja propia antes de imprimir). */
export function BotonImprimir({
  texto = 'Imprimir',
  className = '',
  alElegir,
}: {
  texto?: string;
  className?: string;
  alElegir?: (clave: Tamano) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const ultimo = ultimoTamano();
  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, [abierto]);

  return (
    <div ref={caja} className={`relative inline-block print:hidden ${className}`}>
      <button
        onClick={() => setAbierto(!abierto)}
        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50"
      >
        🖨 {texto} ▾
      </button>
      {abierto && (
        <div className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-lg border border-gray-200 bg-white text-sm shadow-lg">
          <div className="border-b border-gray-100 px-3 py-1.5 text-[11px] text-gray-500">¿En qué hoja?</div>
          {TAMANOS.map((t) => (
            <button
              key={t.clave}
              onClick={() => {
                setAbierto(false);
                // deja cerrar el menú antes de abrir la ventana de impresión
                setTimeout(() => (alElegir ? alElegir(t.clave) : imprimir(t.clave)), 50);
              }}
              className={`flex w-full items-center justify-between px-3 py-2 text-left hover:bg-blue-50 ${t.clave === ultimo ? 'font-semibold' : ''}`}
            >
              {t.etiqueta}
              <span className="text-[11px] text-gray-400">
                {t.ancho} × {t.alto}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
