// HTTP puro: lee lo validado, llama al service, responde { data } (ARQUITECTURA §2.1).
import type { Request, Response } from 'express';
import type { CompraInput, EditarInsumoInput, FichaCostoInput, InsumoInput } from '@taller/shared';
import { costosService } from './service.js';

const id = (req: Request) => String(req.params.id);

export const costosController = {
  async listarInsumos(_req: Request, res: Response) {
    res.json({ data: await costosService.listarInsumos() });
  },
  async crearInsumo(req: Request, res: Response) {
    res.status(201).json({ data: await costosService.crearInsumo(req.body as InsumoInput) });
  },
  async editarInsumo(req: Request, res: Response) {
    res.json({ data: await costosService.editarInsumo(id(req), req.body as EditarInsumoInput) });
  },
  async eliminarInsumo(req: Request, res: Response) {
    await costosService.eliminarInsumo(id(req));
    res.json({ data: { eliminado: true } });
  },

  async listarCompras(_req: Request, res: Response) {
    const { insumoId } = res.locals.query as { insumoId?: string };
    res.json({ data: await costosService.listarCompras(insumoId) });
  },
  async crearCompra(req: Request, res: Response) {
    res.status(201).json({ data: await costosService.crearCompra(req.body as CompraInput) });
  },
  async eliminarCompra(req: Request, res: Response) {
    await costosService.eliminarCompra(id(req));
    res.json({ data: { eliminado: true } });
  },

  async listarFichas(_req: Request, res: Response) {
    res.json({ data: await costosService.listarFichas() });
  },
  async obtenerFicha(req: Request, res: Response) {
    res.json({ data: await costosService.obtenerFicha(id(req)) });
  },
  async crearFicha(req: Request, res: Response) {
    res.status(201).json({ data: await costosService.crearFicha(req.body as FichaCostoInput) });
  },
  async reemplazarFicha(req: Request, res: Response) {
    res.json({ data: await costosService.reemplazarFicha(id(req), req.body as FichaCostoInput) });
  },
  async eliminarFicha(req: Request, res: Response) {
    await costosService.eliminarFicha(id(req));
    res.json({ data: { eliminado: true } });
  },
};
