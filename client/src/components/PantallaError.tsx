import { Link, useRouteError } from 'react-router-dom';

// Reemplaza la pantalla técnica de React Router cuando una página falla. El
// caso más común es una pestaña abierta desde antes de una actualización: el
// código viejo del navegador no entiende los datos nuevos de la API, y recargar
// trae la versión vigente.
export function PantallaError() {
  const error = useRouteError();
  const detalle = error instanceof Error ? error.message : String(error ?? '');

  return (
    <div className="p-8">
      <div className="max-w-xl rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold">Algo salió mal al mostrar esta pantalla</h1>
        <p className="mt-2 text-sm text-gray-600">
          Lo más probable es que el sistema se haya actualizado mientras esta pestaña estaba
          abierta. Recargá la página para traer la versión nueva; tus datos no se pierden.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-[#265dc2]"
          >
            Recargar
          </button>
          <Link
            to="/"
            reloadDocument
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Ir al inicio
          </Link>
        </div>
        {detalle && (
          <details className="mt-5 text-xs text-gray-400">
            <summary className="cursor-pointer">Detalle técnico</summary>
            <pre className="mt-2 whitespace-pre-wrap">{detalle}</pre>
          </details>
        )}
      </div>
    </div>
  );
}
