// HTTP puro: lee lo validado, llama al service, responde { data } (ARQUITECTURA §2.1).
import type { Request, Response } from 'express';
import type {
  CrearPlantillaInput,
  DuplicarPlantillaInput,
  EditarPlantillaInput,
  EditarPlantillaOperacionInput,
  PlantillaOperacionInput,
  ReemplazarOperacionesInput,
} from '@taller/shared';
import { plantillasService } from './service.js';

const id = (req: Request) => String(req.params.id);

export const plantillasController = {
  async listar(_req: Request, res: Response) {
    res.json({ data: await plantillasService.listar() });
  },

  async obtener(req: Request, res: Response) {
    res.json({ data: await plantillasService.obtener(id(req)) });
  },

  async crear(req: Request, res: Response) {
    const dto = await plantillasService.crear(req.body as CrearPlantillaInput);
    res.status(201).json({ data: dto });
  },

  async duplicar(req: Request, res: Response) {
    const dto = await plantillasService.duplicar(id(req), req.body as DuplicarPlantillaInput);
    res.status(201).json({ data: dto });
  },

  async editar(req: Request, res: Response) {
    res.json({ data: await plantillasService.editar(id(req), req.body as EditarPlantillaInput) });
  },

  async borrar(req: Request, res: Response) {
    await plantillasService.borrar(id(req));
    res.json({ data: { eliminada: true } });
  },

  async agregarOperacion(req: Request, res: Response) {
    const dto = await plantillasService.agregarOperacion(
      id(req),
      req.body as PlantillaOperacionInput,
    );
    res.status(201).json({ data: dto });
  },

  async reemplazarOperaciones(req: Request, res: Response) {
    const dto = await plantillasService.reemplazarOperaciones(
      id(req),
      req.body as ReemplazarOperacionesInput,
    );
    res.json({ data: dto });
  },

  async editarOperacion(req: Request, res: Response) {
    const dto = await plantillasService.editarOperacion(
      String(req.params.opId),
      req.body as EditarPlantillaOperacionInput,
    );
    res.json({ data: dto });
  },

  async eliminarOperacion(req: Request, res: Response) {
    res.json({ data: await plantillasService.eliminarOperacion(String(req.params.opId)) });
  },
};
