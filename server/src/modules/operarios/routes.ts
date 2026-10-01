import { Router } from 'express';
import {
  crearOperarioSchema,
  editarOperarioSchema,
  listarOperariosQuerySchema,
} from '@taller/shared';
import { validar } from '../../middleware/validate.js';
import { operariosController } from './controller.js';

// La baja es lógica (PATCH activo=false, CA-8.2). DELETE solo acepta operarios
// de baja sin historial de pagos (ver operariosService.eliminar).
export const operariosRouter = Router();

operariosRouter.get('/', validar(listarOperariosQuerySchema, 'query'), operariosController.listar);
operariosRouter.post('/', validar(crearOperarioSchema), operariosController.crear);
operariosRouter.get('/:id', operariosController.obtener);
operariosRouter.patch('/:id', validar(editarOperarioSchema), operariosController.editar);
operariosRouter.delete('/:id', operariosController.eliminar);
