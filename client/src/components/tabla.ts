// Estilo común de las tablas de listas (como Operarios): ancho ajustado al
// contenido, cabecera que queda fija al deslizar y filas en franjas alternas
// para seguir cada fila con la vista.
//
// La cabecera solo queda fija si el contenedor es el que se desliza: por eso
// tiene un alto máximo (al imprimir se suelta).
export const TABLA = {
  contenedor:
    'w-fit max-w-full max-h-[calc(100vh-14rem)] overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm print:max-h-none print:overflow-visible',
  // para una tabla que va debajo de otras cosas (Liquidación): se desliza la
  // página entera y la cabecera queda fija arriba. overflow-clip recorta las
  // esquinas sin volverse contenedor de desplazamiento (overflow-hidden sí lo
  // haría y la cabecera dejaría de quedar fija).
  contenedorPagina:
    'w-fit max-w-full overflow-clip rounded-xl border border-gray-200 bg-white shadow-sm',
  cabecera: 'sticky top-0 z-10',
  filaCabecera:
    'bg-gray-50 text-left text-[11px] font-semibold tracking-wider text-gray-500 uppercase shadow-[inset_0_-1px_0_#e5e7eb]',
  fila: 'border-b border-gray-200/70 last:border-0 even:bg-slate-100 hover:bg-blue-50',
};
