import type { Request, Response } from 'express';
import { rendicionService } from './service.js';

export const rendicionController = {
  async rendir(req: Request, res: Response) {
    const { anio, mes } = res.locals.query as { anio: number; mes: number };
    res.json({ data: await rendicionService.rendir(String(req.params.operarioId), anio, mes) });
  },
};
