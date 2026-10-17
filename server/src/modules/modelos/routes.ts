import { Router } from 'express';
import {
  agregarOperacionesLoteSchema,
  crearModeloSchema,
  crearVersionSchema,
  editarBuscadorSchema,
  editarOperacionSchema,
  moldeInputSchema,
  operacionInputSchema,
  reordenarOperacionesSchema,
} from '@taller/shared';
import { validar } from '../../middleware/validate.js';
import { modelosController } from './controller.js';

// Se monta en /api/v1 (cubre /modelos, /versiones y /operaciones del catálogo).
export const modelosRouter = Router();

modelosRouter.get('/modelos', modelosController.listar);
modelosRouter.post('/modelos', validar(crearModeloSchema), modelosController.crearModelo);
// solo sin historial (sin cortes ni moldes); con historial → 409
modelosRouter.delete('/modelos/:id', modelosController.eliminarModelo);
modelosRouter.post(
  '/modelos/:id/versiones',
  validar(crearVersionSchema),
  modelosController.crearVersion,
);
modelosRouter.patch(
  '/modelos/:id/buscador',
  validar(editarBuscadorSchema),
  modelosController.editarBuscador,
);
modelosRouter.get('/versiones/:id', modelosController.obtenerVersion);
modelosRouter.put('/versiones/:id/molde', validar(moldeInputSchema), modelosController.guardarMolde);
modelosRouter.delete('/versiones/:id/molde', modelosController.eliminarMolde);
modelosRouter.post(
  '/versiones/:id/operaciones',
  validar(operacionInputSchema),
  modelosController.agregarOperacion,
);
modelosRouter.post(
  '/versiones/:id/operaciones/lote',
  validar(agregarOperacionesLoteSchema),
  modelosController.agregarOperacionesLote,
);
modelosRouter.put(
  '/versiones/:id/operaciones/orden',
  validar(reordenarOperacionesSchema),
  modelosController.reordenarOperaciones,
);
modelosRouter.patch(
  '/operaciones/:opId',
  validar(editarOperacionSchema),
  modelosController.editarOperacion,
);
modelosRouter.delete('/operaciones/:opId', modelosController.eliminarOperacion);
