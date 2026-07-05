import { Router } from 'express';
import { cerrarMesSchema, consolidadoQuerySchema } from '@taller/shared';
import { validar } from '../../middleware/validate.js';
import { liquidacionController } from './controller.js';

export const liquidacionRouter = Router();

liquidacionRouter.get('/', validar(consolidadoQuerySchema, 'query'), liquidacionController.consolidado);
liquidacionRouter.post('/cerrar-mes', validar(cerrarMesSchema), liquidacionController.cerrarMes);
