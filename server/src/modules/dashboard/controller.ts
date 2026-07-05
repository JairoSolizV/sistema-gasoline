import type { Request, Response } from 'express';
import { dashboardService } from './service.js';

export const dashboardController = {
  async panorama(_req: Request, res: Response) {
    const { anio, mes } = res.locals.query as { anio: number; mes: number };
    res.json({ data: await dashboardService.panorama(anio, mes) });
  },
};
