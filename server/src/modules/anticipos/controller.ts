import type { Request, Response } from 'express';
import type { CrearAnticipoInput, EditarAnticipoInput } from '@taller/shared';
import { anticiposService } from './service.js';

export const anticiposController = {
  async listar(_req: Request, res: Response) {
    const filtro = res.locals.query as { operarioId?: string; desde?: Date; hasta?: Date };
    res.json({ data: await anticiposService.listar(filtro) });
  },

  async crear(req: Request, res: Response) {
    const dto = await anticiposService.crear(req.body as CrearAnticipoInput);
    res.status(201).json({ data: dto });
  },

  async editar(req: Request, res: Response) {
    const dto = await anticiposService.editar(
      String(req.params.id),
      req.body as EditarAnticipoInput,
    );
    res.json({ data: dto });
  },

  async eliminar(req: Request, res: Response) {
    await anticiposService.eliminar(String(req.params.id));
    res.json({ data: { eliminado: true } });
  },
};
