import type { Request, Response } from 'express';
import type {
  AsignarGrupoInput,
  CerrarCorteInput,
  CrearCorteInput,
  EditarCodigoInput,
  EditarOperacionInput,
  EditarServicioInput,
  EditarTendidoInput,
  OperacionInput,
  ProcesoCorte,
  ReemplazarAsignacionesInput,
  RegistrarProcesoInput,
  ReordenarOperacionesInput,
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

  async siguienteCodigo(_req: Request, res: Response) {
    res.json({ data: await cortesService.siguienteCodigo() });
  },

  async editarCodigo(req: Request, res: Response) {
    const dto = await cortesService.editarCodigo(
      String(req.params.id),
      req.body as EditarCodigoInput,
    );
    res.json({ data: dto });
  },

  async abrir(req: Request, res: Response) {
    res.json({ data: await cortesService.abrir(String(req.params.id)) });
  },

  async editarTendido(req: Request, res: Response) {
    const dto = await cortesService.editarTendido(
      String(req.params.id),
      req.body as EditarTendidoInput,
    );
    res.json({ data: dto });
  },

  async editarServicio(req: Request, res: Response) {
    const dto = await cortesService.editarServicio(
      String(req.params.id),
      req.body as EditarServicioInput,
    );
    res.json({ data: dto });
  },

  async registrarProceso(req: Request, res: Response) {
    const { id, proceso } = res.locals.params as { id: string; proceso: ProcesoCorte };
    const dto = await cortesService.registrarProceso(id, proceso, req.body as RegistrarProcesoInput);
    res.json({ data: dto });
  },

  async quitarProceso(req: Request, res: Response) {
    const { id, proceso } = res.locals.params as { id: string; proceso: ProcesoCorte };
    res.json({ data: await cortesService.quitarProceso(id, proceso) });
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

  async reordenarOperaciones(req: Request, res: Response) {
    const dto = await cortesService.reordenarOperaciones(
      String(req.params.id),
      req.body as ReordenarOperacionesInput,
    );
    res.json({ data: dto });
  },

  async agregarOperacion(req: Request, res: Response) {
    const dto = await cortesService.agregarOperacion(String(req.params.id), req.body as OperacionInput);
    res.status(201).json({ data: dto });
  },

  async editarOperacion(req: Request, res: Response) {
    const dto = await cortesService.editarOperacion(
      String(req.params.id),
      String(req.params.opId),
      req.body as EditarOperacionInput,
    );
    res.json({ data: dto });
  },

  async quitarOperacion(req: Request, res: Response) {
    const dto = await cortesService.quitarOperacion(String(req.params.id), String(req.params.opId));
    res.json({ data: dto });
  },

  async cerrar(req: Request, res: Response) {
    const dto = await cortesService.cerrar(String(req.params.id), req.body as CerrarCorteInput);
    res.json({ data: dto });
  },
};
