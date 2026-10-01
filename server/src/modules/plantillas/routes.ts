import { Router } from 'express';
import {
  crearPlantillaSchema,
  duplicarPlantillaSchema,
  editarPlantillaOperacionSchema,
  editarPlantillaSchema,
  plantillaOperacionInputSchema,
  reemplazarOperacionesSchema,
} from '@taller/shared';
import { validar } from '../../middleware/validate.js';
import { plantillasController } from './controller.js';

// Se monta en /api/v1 (cubre /plantillas y /plantilla-operaciones).
export const plantillasRouter = Router();

plantillasRouter.get('/plantillas', plantillasController.listar);
plantillasRouter.post('/plantillas', validar(crearPlantillaSchema), plantillasController.crear);
plantillasRouter.get('/plantillas/:id', plantillasController.obtener);
plantillasRouter.patch(
  '/plantillas/:id',
  validar(editarPlantillaSchema),
  plantillasController.editar,
);
plantillasRouter.delete('/plantillas/:id', plantillasController.borrar);
plantillasRouter.post(
  '/plantillas/:id/duplicar',
  validar(duplicarPlantillaSchema),
  plantillasController.duplicar,
);
plantillasRouter.post(
  '/plantillas/:id/operaciones',
  validar(plantillaOperacionInputSchema),
  plantillasController.agregarOperacion,
);

plantillasRouter.put(
  '/plantillas/:id/operaciones',
  validar(reemplazarOperacionesSchema),
  plantillasController.reemplazarOperaciones,
);

// Las operaciones sueltas van fuera de /plantillas/:id para no chocar con esa ruta.
plantillasRouter.patch(
  '/plantilla-operaciones/:opId',
  validar(editarPlantillaOperacionSchema),
  plantillasController.editarOperacion,
);
plantillasRouter.delete('/plantilla-operaciones/:opId', plantillasController.eliminarOperacion);
