// HTTP puro: lee lo validado, llama al service, responde { data } (ARQUITECTURA §2.1).
import type { Request, Response } from 'express';
import type { CrearOperarioInput, EditarOperarioInput, RolOperario } from '@taller/shared';
import { operariosService } from './service.js';

export const operariosController = {
  async listar(_req: Request, res: Response) {
    const { estado, rol } = res.locals.query as {
      estado: 'activos' | 'todos';
      rol?: RolOperario;
    };
    res.json({ data: await operariosService.listar(estado, rol) });
  },

  async obtener(req: Request, res: Response) {
    res.json({ data: await operariosService.obtener(String(req.params.id)) });
  },

  async crear(req: Request, res: Response) {
    const dto = await operariosService.crear(req.body as CrearOperarioInput);
    res.status(201).json({ data: dto });
  },

  async editar(req: Request, res: Response) {
    const dto = await operariosService.editar(
      String(req.params.id),
      req.body as EditarOperarioInput,
    );
    res.json({ data: dto });
  },

  async eliminar(req: Request, res: Response) {
    await operariosService.eliminar(String(req.params.id));
    res.json({ data: { eliminado: true } });
  },
};
