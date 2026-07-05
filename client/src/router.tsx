import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { EnConstruccion } from './components/EnConstruccion';
import { OperariosPage } from './features/operarios/OperariosPage';
import { ModelosPage } from './features/modelos/ModelosPage';
import { NuevoModeloPage } from './features/modelos/NuevoModeloPage';
import { VersionDetallePage } from './features/modelos/VersionDetallePage';
import { CortesPage } from './features/cortes/CortesPage';
import { NuevoCortePage } from './features/cortes/NuevoCortePage';
import { CorteDetallePage } from './features/cortes/CorteDetallePage';
import { AnticiposPage } from './features/anticipos/AnticiposPage';
import { LiquidacionPage } from './features/liquidacion/LiquidacionPage';
import { RendicionPage } from './features/rendicion/RendicionPage';

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <EnConstruccion titulo="Inicio" nota="El dashboard llega en la Rebanada 8" /> },
      { path: '/operarios', element: <OperariosPage /> },
      { path: '/modelos', element: <ModelosPage /> },
      { path: '/modelos/nuevo', element: <NuevoModeloPage /> },
      { path: '/modelos/versiones/:versionId', element: <VersionDetallePage /> },
      { path: '/cortes', element: <CortesPage /> },
      { path: '/cortes/nuevo', element: <NuevoCortePage /> },
      { path: '/cortes/:corteId', element: <CorteDetallePage /> },
      { path: '/anticipos', element: <AnticiposPage /> },
      { path: '/liquidacion', element: <LiquidacionPage /> },
      { path: '/rendicion', element: <RendicionPage /> },
      { path: '/configuracion', element: <EnConstruccion titulo="Configuración" nota="Rebanada 8" /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
