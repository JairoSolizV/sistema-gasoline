import { Router } from 'express';
import { rendicionQuerySchema } from '@taller/shared';
import { validar } from '../../middleware/validate.js';
import { rendicionController } from './controller.js';

export const rendicionRouter = Router();

rendicionRouter.get(
  '/:operarioId',
  validar(rendicionQuerySchema, 'query'),
  rendicionController.rendir,
);
