import express from 'express';
import { errorHandler, noEncontrado } from './middleware/errors.js';
import { operariosRouter } from './modules/operarios/routes.js';

export function crearApp() {
  const app = express();
  app.use(express.json());

  app.get('/api/v1/health', (_req, res) => {
    res.json({ data: { status: 'ok' } });
  });

  app.use('/api/v1/operarios', operariosRouter);

  // Las rutas de los módulos se montan aquí, rebanada por rebanada.

  app.use(noEncontrado);
  app.use(errorHandler);
  return app;
}
