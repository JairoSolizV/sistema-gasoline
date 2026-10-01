// HTTP puro: lee lo validado, llama al service, responde { data } (ARQUITECTURA §2.1).
import type { Request, Response } from 'express';
import type {
  CrearNodoCatalogoInput,
  EditarNodoCatalogoInput,
  FusionarInput,
} from '@taller/shared';
import { catalogoService } from './service.js';

const id = (req: Request) => String(req.params.id);
const cuerpoAlta = (req: Request) => req.body as CrearNodoCatalogoInput;
const cuerpoEdicion = (req: Request) => req.body as EditarNodoCatalogoInput;

type Nivel = 'maquinas' | 'procesos' | 'piezas' | 'grupos';

const fusionar = (nivel: Nivel) => async (req: Request, res: Response) => {
  const { destinoId } = req.body as FusionarInput;
  res.json({ data: await catalogoService.fusionar(nivel, id(req), destinoId) });
};

export const catalogoController = {
  fusionarMaquina: fusionar('maquinas'),
  fusionarProceso: fusionar('procesos'),
  fusionarPieza: fusionar('piezas'),
  fusionarGrupo: fusionar('grupos'),

  async arbol(_req: Request, res: Response) {
    const { soloActivos } = res.locals.query as { soloActivos: boolean };
    res.json({ data: await catalogoService.arbol(soloActivos) });
  },

  async crearMaquina(req: Request, res: Response) {
    res.status(201).json({ data: await catalogoService.crearMaquina(cuerpoAlta(req)) });
  },

  async crearProceso(req: Request, res: Response) {
    res.status(201).json({ data: await catalogoService.crearProceso(id(req), cuerpoAlta(req)) });
  },

  async crearPieza(req: Request, res: Response) {
    res.status(201).json({ data: await catalogoService.crearPieza(id(req), cuerpoAlta(req)) });
  },

  async crearGrupo(req: Request, res: Response) {
    res.status(201).json({ data: await catalogoService.crearGrupo(cuerpoAlta(req)) });
  },

  async editarMaquina(req: Request, res: Response) {
    res.json({ data: await catalogoService.editarMaquina(id(req), cuerpoEdicion(req)) });
  },

  async editarProceso(req: Request, res: Response) {
    res.json({ data: await catalogoService.editarProceso(id(req), cuerpoEdicion(req)) });
  },

  async editarPieza(req: Request, res: Response) {
    res.json({ data: await catalogoService.editarPieza(id(req), cuerpoEdicion(req)) });
  },

  async editarGrupo(req: Request, res: Response) {
    res.json({ data: await catalogoService.editarGrupo(id(req), cuerpoEdicion(req)) });
  },

  async borrarMaquina(req: Request, res: Response) {
    await catalogoService.borrarMaquina(id(req));
    res.json({ data: { eliminado: true } });
  },

  async borrarProceso(req: Request, res: Response) {
    await catalogoService.borrarProceso(id(req));
    res.json({ data: { eliminado: true } });
  },

  async borrarPieza(req: Request, res: Response) {
    await catalogoService.borrarPieza(id(req));
    res.json({ data: { eliminado: true } });
  },

  async borrarGrupo(req: Request, res: Response) {
    await catalogoService.borrarGrupo(id(req));
    res.json({ data: { eliminado: true } });
  },
};
