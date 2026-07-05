import { Router } from 'express';
import { editarConfiguracionSchema } from '@taller/shared';
import { validar } from '../../middleware/validate.js';
import { configuracionController } from './controller.js';

export const configuracionRouter = Router();

configuracionRouter.get('/', configuracionController.obtener);
configuracionRouter.patch('/', validar(editarConfiguracionSchema), configuracionController.editar);
