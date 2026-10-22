// HTTP puro: lee lo validado, llama al service, responde { data } (ARQUITECTURA §2.1).
import type { Request, Response } from 'express';
import type { MarcarPresentesInput, RegistrarAsistenciaInput } from '@taller/shared';
import { asistenciaService } from './service.js';

export const asistenciaController = {
  async semana(_req: Request, res: Response) {
    const { lunes } = res.locals.query as { lunes: string };
    res.json({ data: await asistenciaService.semana(lunes) });
  },

  async registrar(req: Request, res: Response) {
    res.json({ data: await asistenciaService.registrar(req.body as RegistrarAsistenciaInput) });
  },

  async borrar(_req: Request, res: Response) {
    const { operarioId, fecha } = res.locals.query as { operarioId: string; fecha: string };
    res.json({ data: await asistenciaService.borrar(operarioId, fecha) });
  },

  async marcarPresentes(req: Request, res: Response) {
    res.json({ data: await asistenciaService.marcarPresentes(req.body as MarcarPresentesInput) });
  },
};
