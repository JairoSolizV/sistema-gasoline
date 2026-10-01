import { Router } from 'express';
import { z } from 'zod';
import {
  asignarGrupoSchema,
  cerrarCorteSchema,
  crearCorteSchema,
  editarServicioSchema,
  editarTendidoSchema,
  listarCortesQuerySchema,
  procesoCorteSchema,
  reemplazarAsignacionesSchema,
  registrarProcesoSchema,
} from '@taller/shared';
import { validar } from '../../middleware/validate.js';
import { cortesController } from './controller.js';

export const cortesRouter = Router();

// /:id/procesos/:proceso — proceso ∈ busqueda | trazado | doblado | corte | clasificacion
const paramsProceso = z.object({ id: z.string(), proceso: procesoCorteSchema });

cortesRouter.get('/', validar(listarCortesQuerySchema, 'query'), cortesController.listar);
cortesRouter.post('/', validar(crearCorteSchema), cortesController.crear);
cortesRouter.get('/:id', cortesController.obtener);
cortesRouter.post('/:id/abrir', cortesController.abrir);
cortesRouter.put('/:id/tendido', validar(editarTendidoSchema), cortesController.editarTendido);
// Servicio de corte interno (docs/PLAN_SERVICIO_CORTE.md)
cortesRouter.patch('/:id/servicio', validar(editarServicioSchema), cortesController.editarServicio);
cortesRouter.put(
  '/:id/procesos/:proceso',
  validar(paramsProceso, 'params'),
  validar(registrarProcesoSchema),
  cortesController.registrarProceso,
);
cortesRouter.delete(
  '/:id/procesos/:proceso',
  validar(paramsProceso, 'params'),
  cortesController.quitarProceso,
);
cortesRouter.post('/:id/cerrar', validar(cerrarCorteSchema), cortesController.cerrar);
cortesRouter.post('/:id/asignar-grupo', validar(asignarGrupoSchema), cortesController.asignarGrupo);
cortesRouter.put(
  '/:id/operaciones/:opId/asignaciones',
  validar(reemplazarAsignacionesSchema),
  cortesController.reemplazarAsignaciones,
);
