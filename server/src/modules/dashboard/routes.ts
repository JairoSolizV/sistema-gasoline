import { Router } from 'express';
import { z } from 'zod';
import { validar } from '../../middleware/validate.js';
import { dashboardController } from './controller.js';

// anio/mes opcionales: por defecto el mes en curso.
const ahora = () => new Date();
const dashboardQuerySchema = z.object({
  anio: z.coerce.number().int().min(2000).max(2100).default(() => ahora().getFullYear()),
  mes: z.coerce.number().int().min(1).max(12).default(() => ahora().getMonth() + 1),
});

export const dashboardRouter = Router();

dashboardRouter.get('/', validar(dashboardQuerySchema, 'query'), dashboardController.panorama);
