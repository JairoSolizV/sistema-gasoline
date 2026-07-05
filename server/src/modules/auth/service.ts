// Auth Fase 1: un único admin. Password desde .env (comparación directa; "no te
// compliques" — CLAUDE.md §3) → JWT de 30 días. El rol queda previsto para Fase 2.
import jwt from 'jsonwebtoken';
import { AppError } from '../../middleware/errors.js';

export interface TokenPayload {
  rol: 'admin';
}

function secreto(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET no definida');
  return s;
}

export function firmarToken(): string {
  return jwt.sign({ rol: 'admin' } satisfies TokenPayload, secreto(), { expiresIn: '30d' });
}

export function verificarToken(token: string): TokenPayload {
  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(token, secreto());
  } catch {
    throw new AppError('NO_AUTORIZADO', 'Token inválido o expirado', 401);
  }
  if (typeof payload === 'string' || payload.rol !== 'admin') {
    throw new AppError('NO_AUTORIZADO', 'Token inválido', 401);
  }
  return { rol: 'admin' };
}

export const authService = {
  login(password: string): { token: string; rol: 'admin' } {
    const esperado = process.env.ADMIN_PASSWORD;
    if (!esperado) throw new Error('ADMIN_PASSWORD no definida');
    if (password !== esperado) {
      throw new AppError('CREDENCIALES', 'Contraseña incorrecta', 401);
    }
    return { token: firmarToken(), rol: 'admin' };
  },
};
