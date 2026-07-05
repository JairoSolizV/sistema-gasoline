import type { Request, Response } from 'express';
import type { EditarConfiguracionInput } from '@taller/shared';
import { configuracionService } from './service.js';

export const configuracionController = {
  async obtener(_req: Request, res: Response) {
    res.json({ data: await configuracionService.obtener() });
  },

  async editar(req: Request, res: Response) {
    const dto = await configuracionService.editar(req.body as EditarConfiguracionInput);
    res.json({ data: dto });
  },
};
