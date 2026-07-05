// requireAuth / requireRole (ARQUITECTURA §6). En Fase 1 solo existe 'admin';
// requireRole queda listo para el rol 'operario' de Fase 2 sin refactor.
import type { NextFunction, Request, Response } from 'express';
import { AppError } from './errors.js';
import { verificarToken, type TokenPayload } from '../modules/auth/service.js';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new AppError('NO_AUTORIZADO', 'Falta autenticación', 401);
  }
  const payload = verificarToken(header.slice(7)); // lanza 401 si inválido
  res.locals.usuario = payload;
  next();
}

export function requireRole(rol: TokenPayload['rol']) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const usuario = res.locals.usuario as TokenPayload | undefined;
    if (!usuario || usuario.rol !== rol) {
      throw new AppError('PROHIBIDO', 'No tenés permiso para esta acción', 403);
    }
    next();
  };
}
