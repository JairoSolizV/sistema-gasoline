// Validación Zod en la entrada (ARQUITECTURA §5.1). El body validado reemplaza
// a req.body; params/query validados quedan en res.locals (en Express 5 esos
// campos de req son de solo lectura).
import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { AppError } from './errors.js';

type Parte = 'body' | 'params' | 'query';

export function validar(schema: ZodType, parte: Parte = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    const resultado = schema.safeParse(req[parte]);
    if (!resultado.success) {
      const detalle = resultado.error.issues
        .map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
        .join('; ');
      next(new AppError('VALIDACION', detalle, 400));
      return;
    }
    if (parte === 'body') req.body = resultado.data;
    res.locals[parte] = resultado.data;
    next();
  };
}
