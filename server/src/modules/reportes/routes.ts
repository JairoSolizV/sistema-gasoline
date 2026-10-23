import { Router } from 'express';
import { rangoReporteSchema } from '@taller/shared';
import { validar } from '../../middleware/validate.js';
import { reportesController } from './controller.js';

// Reportes (docs/PLAN_DIDACTICO_REPORTES.md). Solo lectura.
export const reportesRouter = Router();

reportesRouter.get('/ventas', validar(rangoReporteSchema, 'query'), reportesController.ventas);
reportesRouter.get('/produccion', validar(rangoReporteSchema, 'query'), reportesController.produccion);
reportesRouter.get('/compras', validar(rangoReporteSchema, 'query'), reportesController.compras);
reportesRouter.get('/ganancia', validar(rangoReporteSchema, 'query'), reportesController.ganancia);
