import { Router } from 'express';
import {
  asignarGrupoSchema,
  cerrarCorteSchema,
  crearCorteSchema,
  listarCortesQuerySchema,
  reemplazarAsignacionesSchema,
} from '@taller/shared';
import { validar } from '../../middleware/validate.js';
import { cortesController } from './controller.js';

export const cortesRouter = Router();

cortesRouter.get('/', validar(listarCortesQuerySchema, 'query'), cortesController.listar);
cortesRouter.post('/', validar(crearCorteSchema), cortesController.crear);
cortesRouter.get('/:id', cortesController.obtener);
cortesRouter.post('/:id/abrir', cortesController.abrir);
cortesRouter.post('/:id/cerrar', validar(cerrarCorteSchema), cortesController.cerrar);
cortesRouter.post('/:id/asignar-grupo', validar(asignarGrupoSchema), cortesController.asignarGrupo);
cortesRouter.put(
  '/:id/operaciones/:opId/asignaciones',
  validar(reemplazarAsignacionesSchema),
  cortesController.reemplazarAsignaciones,
);
