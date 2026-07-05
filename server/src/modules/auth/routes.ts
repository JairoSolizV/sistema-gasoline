import { Router } from 'express';
import { loginSchema } from '@taller/shared';
import { validar } from '../../middleware/validate.js';
import { authController } from './controller.js';

export const authRouter = Router();

authRouter.post('/login', validar(loginSchema), authController.login);
