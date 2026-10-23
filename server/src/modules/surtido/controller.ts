// HTTP puro: lee lo validado, llama al service, responde { data } (ARQUITECTURA §2.1).
import type { Request, Response } from 'express';
import type {
  CrearColorLavadoInput,
  EditarColorLavadoInput,
  EnviarSurtidoInput,
  GuardarSurtidoInput,
} from '@taller/shared';
import { surtidoService } from './service.js';

const id = (req: Request) => String(req.params.id);

export const surtidoController = {
  async listarColores(_req: Request, res: Response) {
    res.json({ data: await surtidoService.listarColores() });
  },

  async crearColor(req: Request, res: Response) {
    res.status(201).json({ data: await surtidoService.crearColor(req.body as CrearColorLavadoInput) });
  },

  async editarColor(req: Request, res: Response) {
    res.json({ data: await surtidoService.editarColor(id(req), req.body as EditarColorLavadoInput) });
  },

  async borrarColor(req: Request, res: Response) {
    res.json({ data: await surtidoService.borrarColor(id(req)) });
  },

  async guardar(req: Request, res: Response) {
    res.json({ data: await surtidoService.guardar(id(req), req.body as GuardarSurtidoInput) });
  },

  async enviar(req: Request, res: Response) {
    res.status(201).json({ data: await surtidoService.enviar(id(req), req.body as EnviarSurtidoInput) });
  },
};
