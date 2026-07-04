import type { Request, Response } from 'express';
import type {
  CrearModeloInput,
  CrearVersionInput,
  EditarOperacionInput,
  OperacionInput,
} from '@taller/shared';
import { modelosService } from './service.js';

export const modelosController = {
  async listar(_req: Request, res: Response) {
    res.json({ data: await modelosService.listar() });
  },

  async crearModelo(req: Request, res: Response) {
    const dto = await modelosService.crearModelo(req.body as CrearModeloInput);
    res.status(201).json({ data: dto });
  },

  async crearVersion(req: Request, res: Response) {
    const dto = await modelosService.crearVersion(
      String(req.params.id),
      req.body as CrearVersionInput,
    );
    res.status(201).json({ data: dto });
  },

  async obtenerVersion(req: Request, res: Response) {
    res.json({ data: await modelosService.obtenerVersion(String(req.params.id)) });
  },

  async agregarOperacion(req: Request, res: Response) {
    const dto = await modelosService.agregarOperacion(
      String(req.params.id),
      req.body as OperacionInput,
    );
    res.status(201).json({ data: dto });
  },

  async editarOperacion(req: Request, res: Response) {
    const dto = await modelosService.editarOperacion(
      String(req.params.opId),
      req.body as EditarOperacionInput,
    );
    res.json({ data: dto });
  },

  async eliminarOperacion(req: Request, res: Response) {
    const dto = await modelosService.eliminarOperacion(String(req.params.opId));
    res.json({ data: dto });
  },
};
