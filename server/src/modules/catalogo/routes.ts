import { Router } from 'express';
import {
  crearGrupoSchema,
  crearMaquinaSchema,
  crearPiezaSchema,
  crearProcesoSchema,
  editarGrupoSchema,
  editarMaquinaSchema,
  editarPiezaSchema,
  editarProcesoSchema,
  fusionarSchema,
  listarCatalogoQuerySchema,
} from '@taller/shared';
import { validar } from '../../middleware/validate.js';
import { catalogoController } from './controller.js';

// Se monta en /api/v1/catalogo. Un solo GET (el árbol) alimenta tanto el
// formulario de modelos como la pantalla de administración.
export const catalogoRouter = Router();

catalogoRouter.get('/arbol', validar(listarCatalogoQuerySchema, 'query'), catalogoController.arbol);

catalogoRouter.post('/maquinas', validar(crearMaquinaSchema), catalogoController.crearMaquina);
catalogoRouter.patch('/maquinas/:id', validar(editarMaquinaSchema), catalogoController.editarMaquina);
catalogoRouter.delete('/maquinas/:id', catalogoController.borrarMaquina);
catalogoRouter.post(
  '/maquinas/:id/fusionar',
  validar(fusionarSchema),
  catalogoController.fusionarMaquina,
);

catalogoRouter.post(
  '/maquinas/:id/procesos',
  validar(crearProcesoSchema),
  catalogoController.crearProceso,
);
catalogoRouter.patch('/procesos/:id', validar(editarProcesoSchema), catalogoController.editarProceso);
catalogoRouter.delete('/procesos/:id', catalogoController.borrarProceso);
catalogoRouter.post(
  '/procesos/:id/fusionar',
  validar(fusionarSchema),
  catalogoController.fusionarProceso,
);

catalogoRouter.post('/procesos/:id/piezas', validar(crearPiezaSchema), catalogoController.crearPieza);
catalogoRouter.patch('/piezas/:id', validar(editarPiezaSchema), catalogoController.editarPieza);
catalogoRouter.delete('/piezas/:id', catalogoController.borrarPieza);
catalogoRouter.post('/piezas/:id/fusionar', validar(fusionarSchema), catalogoController.fusionarPieza);

catalogoRouter.post('/grupos', validar(crearGrupoSchema), catalogoController.crearGrupo);
catalogoRouter.patch('/grupos/:id', validar(editarGrupoSchema), catalogoController.editarGrupo);
catalogoRouter.delete('/grupos/:id', catalogoController.borrarGrupo);
catalogoRouter.post('/grupos/:id/fusionar', validar(fusionarSchema), catalogoController.fusionarGrupo);
