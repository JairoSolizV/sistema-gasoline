import { Router } from 'express';
import {
  compraGastoInputSchema,
  compraInputSchema,
  conteoInputSchema,
  editarGastoFijoSchema,
  editarInsumoSchema,
  editarPrestamoSchema,
  fichaCostoInputSchema,
  gastoFijoInputSchema,
  insumoInputSchema,
  listarComprasQuerySchema,
  mesQuerySchema,
  montoGastoInputSchema,
  pagoPrestamoInputSchema,
  planInputSchema,
  prestamoInputSchema,
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

// etapa 5: costos fijos del taller (docs/PLAN_COSTOS.md §7c)
costosRouter.get('/fijos', validar(mesQuerySchema, 'query'), costosController.costosFijosMes);
costosRouter.post('/fijos/gastos', validar(gastoFijoInputSchema), costosController.crearGastoFijo);
costosRouter.patch('/fijos/gastos/:id', validar(editarGastoFijoSchema), costosController.editarGastoFijo);
costosRouter.delete('/fijos/gastos/:id', costosController.eliminarGastoFijo);
costosRouter.post('/fijos/gastos/:id/montos', validar(montoGastoInputSchema), costosController.guardarMontoGasto);
costosRouter.delete('/fijos/gastos/:id/montos/:montoId', costosController.eliminarMontoGasto);
costosRouter.post('/fijos/gastos/:id/compras', validar(compraGastoInputSchema), costosController.crearCompraGasto);
costosRouter.delete('/fijos/compras/:id', costosController.eliminarCompraGasto);
costosRouter.post('/fijos/prestamos', validar(prestamoInputSchema), costosController.crearPrestamo);
costosRouter.patch('/fijos/prestamos/:id', validar(editarPrestamoSchema), costosController.editarPrestamo);
costosRouter.delete('/fijos/prestamos/:id', costosController.eliminarPrestamo);
costosRouter.put('/fijos/prestamos/:id/pagos', validar(pagoPrestamoInputSchema), costosController.pagarCuota);
costosRouter.delete('/fijos/prestamos/:id/pagos', validar(mesQuerySchema, 'query'), costosController.quitarPagoCuota);
