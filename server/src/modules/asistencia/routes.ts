import { Router } from 'express';
import {
  borrarAsistenciaQuerySchema,
  marcarPresentesSchema,
  registrarAsistenciaSchema,
  semanaAsistenciaQuerySchema,
} from '@taller/shared';
import { validar } from '../../middleware/validate.js';
import { asistenciaController } from './controller.js';

// Asistencia diaria de los ayudantes (docs/PLAN_AYUDANTES.md). Toda escritura
// devuelve la semana actualizada, que es lo que muestra la pantalla.
export const asistenciaRouter = Router();

asistenciaRouter.get(
  '/semana',
  validar(semanaAsistenciaQuerySchema, 'query'),
  asistenciaController.semana,
);
asistenciaRouter.put('/', validar(registrarAsistenciaSchema), asistenciaController.registrar);
asistenciaRouter.delete('/', validar(borrarAsistenciaQuerySchema, 'query'), asistenciaController.borrar);
asistenciaRouter.post('/presentes', validar(marcarPresentesSchema), asistenciaController.marcarPresentes);
