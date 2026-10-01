import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import { LoginPage } from './features/auth/LoginPage';
import { InicioPage } from './features/inicio/InicioPage';
import { OperariosPage } from './features/operarios/OperariosPage';
import { ModelosPage } from './features/modelos/ModelosPage';
import { NuevoModeloPage } from './features/modelos/NuevoModeloPage';
import { VersionDetallePage } from './features/modelos/VersionDetallePage';
import { CatalogoPage } from './features/catalogo/CatalogoPage';
import { PlantillasPage } from './features/plantillas/PlantillasPage';
import { PlantillaDetallePage } from './features/plantillas/PlantillaDetallePage';
import { CortesPage } from './features/cortes/CortesPage';
import { NuevoCortePage } from './features/cortes/NuevoCortePage';
import { CorteDetallePage } from './features/cortes/CorteDetallePage';
import { AnticiposPage } from './features/anticipos/AnticiposPage';
import { LiquidacionPage } from './features/liquidacion/LiquidacionPage';
import { RendicionPage } from './features/rendicion/RendicionPage';
import { ConfiguracionPage } from './features/configuracion/ConfiguracionPage';
import { PantallaError } from './components/PantallaError';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage />, errorElement: <PantallaError /> },
  {
    element: (
      <RequireAuth>
        <Layout />
      </RequireAuth>
    ),
    errorElement: <PantallaError />,
    children: [
      {
        // si falla una página, el error se muestra dentro del Layout (queda el menú)
        errorElement: <PantallaError />,
        children: [
          { path: '/', element: <InicioPage /> },
          { path: '/operarios', element: <OperariosPage /> },
          { path: '/modelos', element: <ModelosPage /> },
          { path: '/modelos/nuevo', element: <NuevoModeloPage /> },
          { path: '/modelos/versiones/:versionId', element: <VersionDetallePage /> },
          { path: '/plantillas', element: <PlantillasPage /> },
          { path: '/plantillas/:plantillaId', element: <PlantillaDetallePage /> },
          { path: '/catalogo', element: <CatalogoPage /> },
          { path: '/cortes', element: <CortesPage /> },
          { path: '/cortes/nuevo', element: <NuevoCortePage /> },
          { path: '/cortes/:corteId', element: <CorteDetallePage /> },
          { path: '/anticipos', element: <AnticiposPage /> },
          { path: '/liquidacion', element: <LiquidacionPage /> },
          { path: '/rendicion', element: <RendicionPage /> },
          { path: '/configuracion', element: <ConfiguracionPage /> },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
]);
