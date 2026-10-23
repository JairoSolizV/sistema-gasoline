import { Router } from 'express';
import {
  arqueoInputSchema,
  cambiarCajaSchema,
  categoriaCajaInputSchema,
  editarCategoriaCajaSchema,
  inicioCajaSchema,
  mesQuerySchema,
  movimientoCajaInputSchema,
} from '@taller/shared';
import { validar } from '../../middleware/validate.js';
import { cajaController } from './controller.js';

// Caja (docs/PLAN_CAJA.md). No toca ningún pago.
export const cajaRouter = Router();

cajaRouter.get('/', validar(mesQuerySchema, 'query'), cajaController.mes);
cajaRouter.put('/inicio/:caja', validar(inicioCajaSchema), cajaController.guardarInicio);

cajaRouter.post('/movimientos', validar(movimientoCajaInputSchema), cajaController.crearMovimiento);
cajaRouter.delete('/movimientos/:id', cajaController.eliminarMovimiento);
cajaRouter.patch('/origen/:origen/:id', validar(cambiarCajaSchema), cajaController.cambiarCaja);

cajaRouter.post('/arqueos', validar(arqueoInputSchema), cajaController.crearArqueo);
cajaRouter.delete('/arqueos/:id', cajaController.eliminarArqueo);

cajaRouter.post('/categorias', validar(categoriaCajaInputSchema), cajaController.crearCategoria);
cajaRouter.patch('/categorias/:id', validar(editarCategoriaCajaSchema), cajaController.editarCategoria);
