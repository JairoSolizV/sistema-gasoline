import { Router, type Request, type Response } from 'express';
import { elegirHilosSchema, type ElegirHilosInput } from '@taller/shared';
import { validar } from '../../middleware/validate.js';
import { requerimientoService } from './service.js';

// Requerimiento de insumos de un corte (docs/PLAN_REQUERIMIENTO.md).
// Se monta en /api/v1. HTTP puro: responde { data } (ARQUITECTURA §2.1).
export const requerimientoRouter = Router();

requerimientoRouter.get('/cortes/:id/requerimiento', async (req: Request, res: Response) => {
  res.json({ data: await requerimientoService.obtener(String(req.params.id)) });
});

requerimientoRouter.put(
  '/cortes/:id/requerimiento/hilos',
  validar(elegirHilosSchema),
  async (req: Request, res: Response) => {
    const dto = await requerimientoService.elegirHilos(String(req.params.id), req.body as ElegirHilosInput);
    res.json({ data: dto });
  },
);
