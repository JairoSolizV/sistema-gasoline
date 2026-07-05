import express from 'express';
import { errorHandler, noEncontrado } from './middleware/errors.js';
import { operariosRouter } from './modules/operarios/routes.js';
import { modelosRouter } from './modules/modelos/routes.js';
import { cortesRouter } from './modules/cortes/routes.js';
import { anticiposRouter } from './modules/anticipos/routes.js';
import { liquidacionRouter } from './modules/liquidacion/routes.js';

export function crearApp() {
  const app = express();
  app.use(express.json());

  app.get('/api/v1/health', (_req, res) => {
    res.json({ data: { status: 'ok' } });
  });

  app.use('/api/v1/operarios', operariosRouter);
  app.use('/api/v1/cortes', cortesRouter);
  app.use('/api/v1/anticipos', anticiposRouter);
  app.use('/api/v1/liquidacion', liquidacionRouter);
  app.use('/api/v1', modelosRouter);

  // Las rutas de los módulos se montan aquí, rebanada por rebanada.

  app.use(noEncontrado);
  app.use(errorHandler);
  return app;
}
