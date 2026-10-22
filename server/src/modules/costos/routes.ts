import { Router } from 'express';
import {
  compraInputSchema,
  conteoInputSchema,
  editarInsumoSchema,
  fichaCostoInputSchema,
  insumoInputSchema,
  listarComprasQuerySchema,
  mesQuerySchema,
  planInputSchema,
} from '@taller/shared';
import { validar } from '../../middleware/validate.js';
import { costosController } from './controller.js';

// Costos de producción (docs/PLAN_COSTOS.md). Solo consulta: no toca pagos.
export const costosRouter = Router();

costosRouter.get('/insumos', costosController.listarInsumos);
costosRouter.post('/insumos', validar(insumoInputSchema), costosController.crearInsumo);
costosRouter.patch('/insumos/:id', validar(editarInsumoSchema), costosController.editarInsumo);
costosRouter.delete('/insumos/:id', costosController.eliminarInsumo);

costosRouter.get('/compras', validar(listarComprasQuerySchema, 'query'), costosController.listarCompras);
costosRouter.post('/compras', validar(compraInputSchema), costosController.crearCompra);
costosRouter.delete('/compras/:id', costosController.eliminarCompra);

costosRouter.get('/fichas', costosController.listarFichas);
costosRouter.get('/fichas/:id', costosController.obtenerFicha);
costosRouter.post('/fichas', validar(fichaCostoInputSchema), costosController.crearFicha);
costosRouter.put('/fichas/:id', validar(fichaCostoInputSchema), costosController.reemplazarFicha);
costosRouter.delete('/fichas/:id', costosController.eliminarFicha);

// etapa 4: conteos físicos (stock), plan del mes y proyección
costosRouter.get('/conteos', validar(listarComprasQuerySchema, 'query'), costosController.listarConteos);
costosRouter.post('/conteos', validar(conteoInputSchema), costosController.crearConteo);
costosRouter.delete('/conteos/:id', costosController.eliminarConteo);
costosRouter.get('/proyeccion', validar(mesQuerySchema, 'query'), costosController.proyeccion);
costosRouter.put('/plan', validar(planInputSchema), costosController.guardarPlan);

// etapa 3: costo real de cada corte frente a su ficha
costosRouter.get('/cortes', costosController.listarCostosCortes);
costosRouter.get('/cortes/:id', costosController.costoCorte);
