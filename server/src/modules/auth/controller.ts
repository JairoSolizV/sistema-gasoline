import type { Request, Response } from 'express';
import type { LoginInput } from '@taller/shared';
import { authService } from './service.js';

export const authController = {
  login(req: Request, res: Response) {
    const { password } = req.body as LoginInput;
    res.json({ data: authService.login(password) });
  },
};
