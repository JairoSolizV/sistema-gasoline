import express from 'express';
import { errorHandler, noEncontrado } from './middleware/errors.js';
import { requireAuth } from './middleware/auth.js';
import { authRouter } from './modules/auth/routes.js';
import { operariosRouter } from './modules/operarios/routes.js';
import { modelosRouter } from './modules/modelos/routes.js';
import { catalogoRouter } from './modules/catalogo/routes.js';
import { plantillasRouter } from './modules/plantillas/routes.js';
import { cortesRouter } from './modules/cortes/routes.js';
import { anticiposRouter } from './modules/anticipos/routes.js';
import { liquidacionRouter } from './modules/liquidacion/routes.js';
import { rendicionRouter } from './modules/rendicion/routes.js';
import { configuracionRouter } from './modules/configuracion/routes.js';
import { dashboardRouter } from './modules/dashboard/routes.js';

// authObligatoria: el server real (server.ts) lo activa; los tests de módulos
// llaman crearApp() sin auth (la prueban aparte en auth.test.ts con tokens).
export function crearApp({ authObligatoria = false } = {}) {
  const app = express();
  app.use(express.json());

  // Rutas públicas (sin token): salud y login.
  app.get('/api/v1/health', (_req, res) => {
    res.json({ data: { status: 'ok' } });
  });
  app.use('/api/v1/auth', authRouter);

  // A partir de acá, todo /api/v1 requiere token cuando la auth está activa.
  if (authObligatoria) app.use('/api/v1', requireAuth);

  app.use('/api/v1/operarios', operariosRouter);
  app.use('/api/v1/catalogo', catalogoRouter);
  app.use('/api/v1/cortes', cortesRouter);
  app.use('/api/v1/anticipos', anticiposRouter);
  app.use('/api/v1/liquidacion', liquidacionRouter);
  app.use('/api/v1/rendicion', rendicionRouter);
  app.use('/api/v1/configuracion', configuracionRouter);
  app.use('/api/v1/dashboard', dashboardRouter);
  app.use('/api/v1', modelosRouter);
  app.use('/api/v1', plantillasRouter);

  app.use(noEncontrado);
  app.use(errorHandler);
  return app;
}
