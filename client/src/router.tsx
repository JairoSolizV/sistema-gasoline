import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { EnConstruccion } from './components/EnConstruccion';
import { OperariosPage } from './features/operarios/OperariosPage';

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <EnConstruccion titulo="Inicio" nota="El dashboard llega en la Rebanada 8" /> },
      { path: '/operarios', element: <OperariosPage /> },
      { path: '/modelos', element: <EnConstruccion titulo="Modelos" nota="Catálogo y versiones — Rebanada 3" /> },
      { path: '/cortes', element: <EnConstruccion titulo="Cortes" nota="Producción y asignación — Rebanada 4" /> },
      { path: '/anticipos', element: <EnConstruccion titulo="Anticipos" nota="Rebanada 5" /> },
      { path: '/liquidacion', element: <EnConstruccion titulo="Liquidación" nota="Consolidado y cierre de mes — Rebanada 6" /> },
      { path: '/rendicion', element: <EnConstruccion titulo="Rendición de cuentas" nota="Vista por operario — Rebanada 7" /> },
      { path: '/configuracion', element: <EnConstruccion titulo="Configuración" nota="Rebanada 8" /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
