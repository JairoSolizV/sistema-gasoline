import { Router } from 'express';
import { z } from 'zod';
import {
  asignarGrupoSchema,
  cerrarCorteSchema,
  crearCorteSchema,
  editarCodigoSchema,
  editarOperacionSchema,
  editarRollosSchema,
  editarServicioSchema,
  editarTendidoSchema,
  listarCortesQuerySchema,
  operacionInputSchema,
  procesoCorteSchema,
  reemplazarAsignacionesSchema,
  registrarProcesoSchema,
  reordenarOperacionesSchema,
} from '@taller/shared';
import { validar } from '../../middleware/validate.js';
import { cortesController } from './controller.js';

export const cortesRouter = Router();

// /:id/procesos/:proceso — proceso ∈ busqueda | trazado | doblado | corte | clasificacion
const paramsProceso = z.object({ id: z.string(), proceso: procesoCorteSchema });

cortesRouter.get('/', validar(listarCortesQuerySchema, 'query'), cortesController.listar);
cortesRouter.post('/', validar(crearCorteSchema), cortesController.crear);
// antes de '/:id' para que "siguiente-codigo" no se tome como un id
cortesRouter.get('/siguiente-codigo', cortesController.siguienteCodigo);
cortesRouter.get('/:id', cortesController.obtener);
cortesRouter.patch('/:id/codigo', validar(editarCodigoSchema), cortesController.editarCodigo);
cortesRouter.post('/:id/abrir', cortesController.abrir);
cortesRouter.put('/:id/tendido', validar(editarTendidoSchema), cortesController.editarTendido);
// calculadora de tendido: rollos de tela, traslape y retazo mínimo
cortesRouter.put('/:id/rollos', validar(editarRollosSchema), cortesController.editarRollos);
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
// Cambios de último momento a las operaciones del corte (no tocan el modelo)
cortesRouter.put(
  '/:id/operaciones/orden',
  validar(reordenarOperacionesSchema),
  cortesController.reordenarOperaciones,
);
cortesRouter.post('/:id/operaciones', validar(operacionInputSchema), cortesController.agregarOperacion);
cortesRouter.patch(
  '/:id/operaciones/:opId',
  validar(editarOperacionSchema),
  cortesController.editarOperacion,
);
cortesRouter.delete('/:id/operaciones/:opId', cortesController.quitarOperacion);
cortesRouter.put(
  '/:id/operaciones/:opId/asignaciones',
  validar(reemplazarAsignacionesSchema),
  cortesController.reemplazarAsignaciones,
);
