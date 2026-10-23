// HTTP puro: lee lo validado, llama al service, responde { data } (ARQUITECTURA §2.1).
import type { Request, Response } from 'express';
import {
  cajaSchema,
  ORIGENES_CAJA,
  type ArqueoInput,
  type CategoriaCajaInput,
  type EditarCategoriaCajaInput,
  type InicioCajaInput,
  type MovimientoCajaInput,
  type OrigenCaja,
} from '@taller/shared';
import { AppError } from '../../middleware/errors.js';
import { cajaService } from './service.js';

const id = (req: Request) => String(req.params.id);
const eliminado = (res: Response) => res.json({ data: { eliminado: true } });

export const cajaController = {
  async mes(_req: Request, res: Response) {
    const { anio, mes } = res.locals.query as { anio: number; mes: number };
    res.json({ data: await cajaService.mes(anio, mes) });
  },
  async guardarInicio(req: Request, res: Response) {
    const caja = cajaSchema.safeParse(req.params.caja);
    if (!caja.success) throw new AppError('VALIDACION', 'Caja inválida', 400);
    await cajaService.guardarInicio(caja.data, req.body as InicioCajaInput);
    res.json({ data: { guardado: true } });
  },

  async crearMovimiento(req: Request, res: Response) {
    await cajaService.crearMovimiento(req.body as MovimientoCajaInput);
    res.status(201).json({ data: { guardado: true } });
  },
  async eliminarMovimiento(req: Request, res: Response) {
    await cajaService.eliminarMovimiento(id(req));
    eliminado(res);
  },
  /** Cambiar de caja algo que entró solo (se cambia en su registro de origen). */
  async cambiarCaja(req: Request, res: Response) {
    const origen = String(req.params.origen) as OrigenCaja;
    if (!ORIGENES_CAJA.includes(origen)) throw new AppError('VALIDACION', 'Origen inválido', 400);
    await cajaService.cambiarCaja(origen, id(req), (req.body as { caja: 'efectivo' | 'banco' }).caja);
    res.json({ data: { guardado: true } });
  },

  async crearArqueo(req: Request, res: Response) {
    res.status(201).json({ data: await cajaService.crearArqueo(req.body as ArqueoInput) });
  },
  async eliminarArqueo(req: Request, res: Response) {
    await cajaService.eliminarArqueo(id(req));
    eliminado(res);
  },

  async crearCategoria(req: Request, res: Response) {
    res.status(201).json({ data: await cajaService.crearCategoria(req.body as CategoriaCajaInput) });
  },
  async editarCategoria(req: Request, res: Response) {
    res.json({ data: await cajaService.editarCategoria(id(req), req.body as EditarCategoriaCajaInput) });
  },
};
