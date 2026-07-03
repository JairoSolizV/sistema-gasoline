// Manejo de errores centralizado (ARQUITECTURA §5.2):
// éxito → { data }, fallo → { error: { code, message } }. Ninguna ruta improvisa formas.
import type { NextFunction, Request, Response } from 'express';

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

export function noEncontrado(_req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NO_ENCONTRADO', message: 'Recurso no encontrado' } });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: 'ERROR_INTERNO', message: 'Error interno del servidor' } });
}
