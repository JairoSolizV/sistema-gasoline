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
import { asistenciaRouter } from './modules/asistencia/routes.js';
import { liquidacionRouter } from './modules/liquidacion/routes.js';
import { rendicionRouter } from './modules/rendicion/routes.js';
import { configuracionRouter } from './modules/configuracion/routes.js';
import { dashboardRouter } from './modules/dashboard/routes.js';
import { costosRouter } from './modules/costos/routes.js';
import { dineroRouter } from './modules/dinero/routes.js';
import { cajaRouter } from './modules/caja/routes.js';
import { reportesRouter } from './modules/reportes/routes.js';
import { surtidoRouter } from './modules/surtido/routes.js';
import { requerimientoRouter } from './modules/requerimiento/routes.js';

// authObligatoria: el server real (server.ts) lo activa; los tests de módulos
// llaman crearApp() sin auth (la prueban aparte en auth.test.ts con tokens).
export function crearApp({ authObligatoria = false } = {}) {
  const app = express();
  app.use(express.json({ limit: '3mb' })); // fotos del catálogo (ya achicadas por el panel)

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
  app.use('/api/v1/asistencia', asistenciaRouter);
  app.use('/api/v1/liquidacion', liquidacionRouter);
  app.use('/api/v1/rendicion', rendicionRouter);
  app.use('/api/v1/configuracion', configuracionRouter);
  app.use('/api/v1/dashboard', dashboardRouter);
  app.use('/api/v1/costos', costosRouter);
  app.use('/api/v1/dinero', dineroRouter);
  app.use('/api/v1/caja', cajaRouter);
  app.use('/api/v1/reportes', reportesRouter);
  app.use('/api/v1', modelosRouter);
  app.use('/api/v1', plantillasRouter);
  app.use('/api/v1', surtidoRouter);
  app.use('/api/v1', requerimientoRouter);

  app.use(noEncontrado);
  app.use(errorHandler);
  return app;
}
