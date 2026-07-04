import type { Request, Response } from 'express';
import type {
  AsignarGrupoInput,
  CerrarCorteInput,
  CrearCorteInput,
  ReemplazarAsignacionesInput,
} from '@taller/shared';
import { cortesService } from './service.js';

export const cortesController = {
  async listar(_req: Request, res: Response) {
    const filtro = res.locals.query as {
      estado?: 'borrador' | 'abierto' | 'cerrado';
      modeloId?: string;
    };
    res.json({ data: await cortesService.listar(filtro) });
  },

  async obtener(req: Request, res: Response) {
    res.json({ data: await cortesService.obtener(String(req.params.id)) });
  },

  async crear(req: Request, res: Response) {
    const dto = await cortesService.crear(req.body as CrearCorteInput);
    res.status(201).json({ data: dto });
  },

  async abrir(req: Request, res: Response) {
    res.json({ data: await cortesService.abrir(String(req.params.id)) });
  },

  async reemplazarAsignaciones(req: Request, res: Response) {
    const dto = await cortesService.reemplazarAsignaciones(
      String(req.params.id),
      String(req.params.opId),
      req.body as ReemplazarAsignacionesInput,
    );
    res.json({ data: dto });
  },

  async asignarGrupo(req: Request, res: Response) {
    const dto = await cortesService.asignarGrupo(
      String(req.params.id),
      req.body as AsignarGrupoInput,
    );
    res.json({ data: dto });
  },

  async cerrar(req: Request, res: Response) {
    const dto = await cortesService.cerrar(String(req.params.id), req.body as CerrarCorteInput);
    res.json({ data: dto });
  },
};
