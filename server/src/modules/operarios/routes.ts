import { Router } from 'express';
import {
  crearOperarioSchema,
  editarOperarioSchema,
  listarOperariosQuerySchema,
} from '@taller/shared';
import { validar } from '../../middleware/validate.js';
import { operariosController } from './controller.js';

// Sin DELETE: la baja de operario es siempre lógica (CA-8.2).
export const operariosRouter = Router();

operariosRouter.get('/', validar(listarOperariosQuerySchema, 'query'), operariosController.listar);
operariosRouter.post('/', validar(crearOperarioSchema), operariosController.crear);
operariosRouter.get('/:id', operariosController.obtener);
operariosRouter.patch('/:id', validar(editarOperarioSchema), operariosController.editar);
