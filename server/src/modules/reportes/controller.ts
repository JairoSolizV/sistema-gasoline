// HTTP puro: lee lo validado, llama al service, responde { data } (ARQUITECTURA §2.1).
import type { Request, Response } from 'express';
import type { RangoReporte } from '@taller/shared';
import { reportesService } from './service.js';

const rango = (res: Response) => res.locals.query as RangoReporte;

export const reportesController = {
  async ventas(_req: Request, res: Response) {
    res.json({ data: await reportesService.ventas(rango(res)) });
  },
  async produccion(_req: Request, res: Response) {
    res.json({ data: await reportesService.produccion(rango(res)) });
  },
  async compras(_req: Request, res: Response) {
    res.json({ data: await reportesService.compras(rango(res)) });
  },
  async ganancia(_req: Request, res: Response) {
    res.json({ data: await reportesService.ganancia(rango(res)) });
  },
};
