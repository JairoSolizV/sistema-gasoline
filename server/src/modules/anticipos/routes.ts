import { Router } from 'express';
import {
  crearAnticipoSchema,
  editarAnticipoSchema,
  listarAnticiposQuerySchema,
} from '@taller/shared';
import { validar } from '../../middleware/validate.js';
import { anticiposController } from './controller.js';

export const anticiposRouter = Router();

anticiposRouter.get('/', validar(listarAnticiposQuerySchema, 'query'), anticiposController.listar);
anticiposRouter.post('/', validar(crearAnticipoSchema), anticiposController.crear);
anticiposRouter.patch('/:id', validar(editarAnticipoSchema), anticiposController.editar);
anticiposRouter.delete('/:id', anticiposController.eliminar);
