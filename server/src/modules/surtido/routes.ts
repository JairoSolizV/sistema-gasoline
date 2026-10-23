import { Router } from 'express';
import {
  crearColorLavadoSchema,
  editarColorLavadoSchema,
  enviarSurtidoSchema,
  guardarSurtidoSchema,
} from '@taller/shared';
import { validar } from '../../middleware/validate.js';
import { surtidoController } from './controller.js';

// Surtido por colores para la lavandería (docs/PLAN_SURTIDO.md).
// Se monta en /api/v1 (cubre /colores-lavado y /cortes/:id/surtido).
export const surtidoRouter = Router();

surtidoRouter.get('/colores-lavado', surtidoController.listarColores);
surtidoRouter.post('/colores-lavado', validar(crearColorLavadoSchema), surtidoController.crearColor);
surtidoRouter.patch(
  '/colores-lavado/:id',
  validar(editarColorLavadoSchema),
  surtidoController.editarColor,
);
surtidoRouter.delete('/colores-lavado/:id', surtidoController.borrarColor);

surtidoRouter.put('/cortes/:id/surtido', validar(guardarSurtidoSchema), surtidoController.guardar);
surtidoRouter.post(
  '/cortes/:id/surtido/envios',
  validar(enviarSurtidoSchema),
  surtidoController.enviar,
);
