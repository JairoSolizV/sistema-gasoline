import { Router } from 'express';
import {
  clienteInputSchema,
  cobroInputSchema,
  despachoInputSchema,
  editarClienteSchema,
  editarPedidoSchema,
  pagoProveedorInputSchema,
  pedidoInputSchema,
} from '@taller/shared';
import { validar } from '../../middleware/validate.js';
import { dineroController } from './controller.js';

// Tablero de dinero (docs/PLAN_TABLERO_DINERO.md). No toca ningún pago.
export const dineroRouter = Router();

dineroRouter.get('/tablero', dineroController.tablero);
dineroRouter.get('/deposito', dineroController.deposito);
dineroRouter.get('/cuentas-por-pagar', dineroController.cuentasPorPagar);

dineroRouter.get('/clientes', dineroController.listarClientes);
dineroRouter.post('/clientes', validar(clienteInputSchema), dineroController.crearCliente);
dineroRouter.patch('/clientes/:id', validar(editarClienteSchema), dineroController.editarCliente);
dineroRouter.delete('/clientes/:id', dineroController.eliminarCliente);

dineroRouter.get('/pedidos', dineroController.listarPedidos);
dineroRouter.post('/pedidos', validar(pedidoInputSchema), dineroController.crearPedido);
dineroRouter.patch('/pedidos/:id', validar(editarPedidoSchema), dineroController.editarPedido);
dineroRouter.delete('/pedidos/:id', dineroController.eliminarPedido);

dineroRouter.get('/despachos', dineroController.listarDespachos);
dineroRouter.post('/despachos', validar(despachoInputSchema), dineroController.crearDespacho);
dineroRouter.delete('/despachos/:id', dineroController.eliminarDespacho);

dineroRouter.get('/cobros', dineroController.listarCobros);
dineroRouter.post('/cobros', validar(cobroInputSchema), dineroController.crearCobro);
dineroRouter.delete('/cobros/:id', dineroController.eliminarCobro);

dineroRouter.get('/proveedores', dineroController.proveedores);
dineroRouter.post('/proveedores/pagos', validar(pagoProveedorInputSchema), dineroController.crearPagoProveedor);
dineroRouter.delete('/proveedores/pagos/:id', dineroController.eliminarPagoProveedor);
