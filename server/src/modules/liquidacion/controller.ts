import type { Request, Response } from 'express';
import type { CerrarMesInput } from '@taller/shared';
import { liquidacionService } from './service.js';

export const liquidacionController = {
  async consolidado(_req: Request, res: Response) {
    const { anio, mes } = res.locals.query as { anio: number; mes: number };
    res.json({ data: await liquidacionService.consolidado(anio, mes) });
  },

  async cerrarMes(req: Request, res: Response) {
    const dto = await liquidacionService.cerrarMes(req.body as CerrarMesInput);
    res.json({ data: dto });
  },
};
