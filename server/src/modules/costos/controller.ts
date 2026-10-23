// HTTP puro: lee lo validado, llama al service, responde { data } (ARQUITECTURA §2.1).
import type { Request, Response } from 'express';
import type {
  CompraGastoInput,
  CompraInput,
  ConteoInput,
  CatalogoFichaInput,
  EditarCompraInput,
  FotoFichaInput,
  EditarGastoFijoInput,
  EditarInsumoInput,
  EditarPrestamoInput,
  FichaCostoInput,
  GastoFijoInput,
  InsumoInput,
  MontoGastoInput,
  PagoPrestamoInput,
  PlanInput,
  PrestamoInput,
} from '@taller/shared';
import { fijosService } from './fijos.js';
import { costosService } from './service.js';

const id = (req: Request) => String(req.params.id);

export const costosController = {
  async listarInsumos(_req: Request, res: Response) {
    res.json({ data: await costosService.listarInsumos() });
  },
  async catalogo(_req: Request, res: Response) {
    res.json({ data: await costosService.catalogo() });
  },
  async editarCatalogo(req: Request, res: Response) {
    await costosService.editarCatalogo(id(req), req.body as CatalogoFichaInput);
    res.json({ data: { guardado: true } });
  },
  async obtenerFoto(req: Request, res: Response) {
    res.json({ data: await costosService.obtenerFoto(id(req)) });
  },
  async guardarFoto(req: Request, res: Response) {
    await costosService.guardarFoto(id(req), req.body as FotoFichaInput);
    res.json({ data: { guardado: true } });
  },
  async quitarFoto(req: Request, res: Response) {
    await costosService.quitarFoto(id(req));
    res.json({ data: { eliminado: true } });
  },
  async kardex(req: Request, res: Response) {
    res.json({ data: await costosService.kardex(id(req)) });
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
  async editarCompra(req: Request, res: Response) {
    res.json({ data: await costosService.editarCompra(id(req), req.body as EditarCompraInput) });
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

  async listarConteos(_req: Request, res: Response) {
    const { insumoId } = res.locals.query as { insumoId?: string };
    res.json({ data: await costosService.listarConteos(insumoId) });
  },
  async crearConteo(req: Request, res: Response) {
    res.status(201).json({ data: await costosService.crearConteo(req.body as ConteoInput) });
  },
  async eliminarConteo(req: Request, res: Response) {
    await costosService.eliminarConteo(id(req));
    res.json({ data: { eliminado: true } });
  },

  async listarCostosCortes(_req: Request, res: Response) {
    res.json({ data: await costosService.listarCostosCortes() });
  },
  async costoCorte(req: Request, res: Response) {
    res.json({ data: await costosService.costoCorte(id(req)) });
  },

  async proyeccion(_req: Request, res: Response) {
    const { anio, mes } = res.locals.query as { anio: number; mes: number };
    res.json({ data: await costosService.proyeccion(anio, mes) });
  },
  async guardarPlan(req: Request, res: Response) {
    res.json({ data: await costosService.guardarPlan(req.body as PlanInput) });
  },

  // ── etapa 5: costos fijos del taller ──
  async costosFijosMes(_req: Request, res: Response) {
    const { anio, mes } = res.locals.query as { anio: number; mes: number };
    res.json({ data: await fijosService.mes(anio, mes) });
  },
  async crearGastoFijo(req: Request, res: Response) {
    await fijosService.crearGasto(req.body as GastoFijoInput);
    res.status(201).json({ data: { ok: true } });
  },
  async editarGastoFijo(req: Request, res: Response) {
    await fijosService.editarGasto(id(req), req.body as EditarGastoFijoInput);
    res.json({ data: { ok: true } });
  },
  async eliminarGastoFijo(req: Request, res: Response) {
    await fijosService.eliminarGasto(id(req));
    res.json({ data: { eliminado: true } });
  },
  async guardarMontoGasto(req: Request, res: Response) {
    await fijosService.guardarMonto(id(req), req.body as MontoGastoInput);
    res.json({ data: { ok: true } });
  },
  async eliminarMontoGasto(req: Request, res: Response) {
    await fijosService.eliminarMonto(id(req), String(req.params.montoId));
    res.json({ data: { eliminado: true } });
  },
  async crearCompraGasto(req: Request, res: Response) {
    await fijosService.crearCompra(id(req), req.body as CompraGastoInput);
    res.status(201).json({ data: { ok: true } });
  },
  async eliminarCompraGasto(req: Request, res: Response) {
    await fijosService.eliminarCompra(id(req));
    res.json({ data: { eliminado: true } });
  },
  async crearPrestamo(req: Request, res: Response) {
    await fijosService.crearPrestamo(req.body as PrestamoInput);
    res.status(201).json({ data: { ok: true } });
  },
  async editarPrestamo(req: Request, res: Response) {
    await fijosService.editarPrestamo(id(req), req.body as EditarPrestamoInput);
    res.json({ data: { ok: true } });
  },
  async eliminarPrestamo(req: Request, res: Response) {
    await fijosService.eliminarPrestamo(id(req));
    res.json({ data: { eliminado: true } });
  },
  async pagarCuota(req: Request, res: Response) {
    await fijosService.pagarCuota(id(req), req.body as PagoPrestamoInput);
    res.json({ data: { ok: true } });
  },
  async quitarPagoCuota(req: Request, res: Response) {
    const { anio, mes } = res.locals.query as { anio: number; mes: number };
    await fijosService.quitarPago(id(req), anio, mes);
    res.json({ data: { eliminado: true } });
  },
};
