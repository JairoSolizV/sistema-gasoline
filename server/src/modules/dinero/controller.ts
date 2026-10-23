// HTTP puro: lee lo validado, llama al service, responde { data } (ARQUITECTURA §2.1).
import type { Request, Response } from 'express';
import type {
  ClienteInput,
  CobroInput,
  DespachoInput,
  EditarClienteInput,
  EditarPedidoInput,
  PagoProveedorInput,
  PedidoInput,
} from '@taller/shared';
import { dineroService } from './service.js';

const id = (req: Request) => String(req.params.id);
const eliminado = (res: Response) => res.json({ data: { eliminado: true } });

export const dineroController = {
  async tablero(_req: Request, res: Response) {
    res.json({ data: await dineroService.tablero() });
  },
  async cuentasPorCobrar(_req: Request, res: Response) {
    res.json({ data: await dineroService.cuentasPorCobrar() });
  },
  async cuentasPorPagar(_req: Request, res: Response) {
    res.json({ data: await dineroService.cuentasPorPagar() });
  },
  async deposito(_req: Request, res: Response) {
    res.json({ data: await dineroService.deposito() });
  },

  async listarClientes(_req: Request, res: Response) {
    res.json({ data: await dineroService.listarClientes() });
  },
  async crearCliente(req: Request, res: Response) {
    res.status(201).json({ data: await dineroService.crearCliente(req.body as ClienteInput) });
  },
  async editarCliente(req: Request, res: Response) {
    res.json({ data: await dineroService.editarCliente(id(req), req.body as EditarClienteInput) });
  },
  async eliminarCliente(req: Request, res: Response) {
    await dineroService.eliminarCliente(id(req));
    eliminado(res);
  },

  async listarPedidos(_req: Request, res: Response) {
    res.json({ data: await dineroService.listarPedidos() });
  },
  async crearPedido(req: Request, res: Response) {
    res.status(201).json({ data: await dineroService.crearPedido(req.body as PedidoInput) });
  },
  async editarPedido(req: Request, res: Response) {
    res.json({ data: await dineroService.editarPedido(id(req), req.body as EditarPedidoInput) });
  },
  async eliminarPedido(req: Request, res: Response) {
    await dineroService.eliminarPedido(id(req));
    eliminado(res);
  },

  async listarDespachos(_req: Request, res: Response) {
    res.json({ data: await dineroService.listarDespachos() });
  },
  async crearDespacho(req: Request, res: Response) {
    res.status(201).json({ data: await dineroService.crearDespacho(req.body as DespachoInput) });
  },
  async eliminarDespacho(req: Request, res: Response) {
    await dineroService.eliminarDespacho(id(req));
    eliminado(res);
  },

  async listarCobros(_req: Request, res: Response) {
    res.json({ data: await dineroService.listarCobros() });
  },
  async crearCobro(req: Request, res: Response) {
    res.status(201).json({ data: await dineroService.crearCobro(req.body as CobroInput) });
  },
  async eliminarCobro(req: Request, res: Response) {
    await dineroService.eliminarCobro(id(req));
    eliminado(res);
  },

  async proveedores(_req: Request, res: Response) {
    res.json({ data: await dineroService.proveedores() });
  },
  async crearPagoProveedor(req: Request, res: Response) {
    res.status(201).json({ data: await dineroService.crearPagoProveedor(req.body as PagoProveedorInput) });
  },
  async eliminarPagoProveedor(req: Request, res: Response) {
    await dineroService.eliminarPagoProveedor(id(req));
    eliminado(res);
  },
};
