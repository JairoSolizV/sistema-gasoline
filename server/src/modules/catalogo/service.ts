// Reglas del módulo (docs/PLAN_CATALOGO_MAQUINAS.md §4):
//  C-1 unicidad por rama · C-2 normalización (en los esquemas Zod de shared)
//  C-3 baja lógica · C-4 sin borrado físico si está en uso
//  C-5 el catálogo NO reescribe historia: renombrar acá no toca ninguna
//      Operacion ni CorteOperacion ya guardada (por eso no hay FK).
// Los grupos van por fuera de la cascada: envuelven a las operaciones del modelo
// y no limitan qué máquina/proceso/pieza se puede elegir.
//
// C-5 tiene dos excepciones explícitas, las dos en reescritura.ts: renombrar y
// unir SÍ reescriben el texto de las `Operacion` que lo usaban (si no, quedarían
// fuera del catálogo). Ninguna de las dos toca `CorteOperacion`.
import { Prisma } from '@prisma/client';
import {
  normalizarNombreCatalogo,
  normalizarNombreGrupo,
  type CatalogoArbolDTO,
  type CatalogoNodoDTO,
  type FusionDTO,
  type CrearNodoCatalogoInput,
  type EditarNodoCatalogoInput,
} from '@taller/shared';
import { AppError } from '../../middleware/errors.js';
import { catalogoRepository } from './repository.js';
import { fusionRepository, renombreRepository } from './reescritura.js';

/** Conteo de uso por texto. Sin FK, la relación catálogo↔operación es el nombre
 *  ya normalizado; se compara así para que "ENTREPI" del Excel cuente para "entrepi". */
interface Usos {
  maquinas: Map<string, number>;
  procesos: Map<string, number>; // clave "maquina|proceso"
  piezas: Map<string, number>; // clave "maquina|proceso|pieza"
  grupos: Map<string, number>;
}

function sumar(mapa: Map<string, number>, clave: string) {
  mapa.set(clave, (mapa.get(clave) ?? 0) + 1);
}

async function contarUsos(): Promise<Usos> {
  const operaciones = await catalogoRepository.textosDeOperaciones();
  const usos: Usos = {
    maquinas: new Map(),
    procesos: new Map(),
    piezas: new Map(),
    grupos: new Map(),
  };
  for (const op of operaciones) {
    const maquina = normalizarNombreCatalogo(op.equipo);
    const proceso = normalizarNombreCatalogo(op.proceso);
    sumar(usos.maquinas, maquina);
    sumar(usos.procesos, `${maquina}|${proceso}`);
    if (op.pieza) sumar(usos.piezas, `${maquina}|${proceso}|${normalizarNombreCatalogo(op.pieza)}`);
    sumar(usos.grupos, normalizarNombreGrupo(op.grupo));
  }
  return usos;
}

function nodo(
  fila: { id: string; nombre: string; activo: boolean },
  usos: Map<string, number>,
  clave: string,
): CatalogoNodoDTO {
  return { id: fila.id, nombre: fila.nombre, activo: fila.activo, usos: usos.get(clave) ?? 0 };
}

/** Traduce el choque de @@unique de Prisma al error de negocio C-1. */
function comoDuplicado<T>(promesa: Promise<T>, que: string): Promise<T> {
  return promesa.catch((e: unknown) => {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new AppError('NOMBRE_DUPLICADO', `Ya existe ${que} con ese nombre`, 409);
    }
    throw e;
  });
}

function datosEdicion(input: EditarNodoCatalogoInput) {
  return {
    ...(input.nombre !== undefined ? { nombre: input.nombre } : {}),
    ...(input.activo !== undefined ? { activo: input.activo } : {}),
    ...(input.orden !== undefined ? { orden: input.orden } : {}),
  };
}

async function exigirNoEnUso(usos: number, que: string) {
  if (usos > 0) {
    throw new AppError(
      'EN_USO',
      `No se puede eliminar: ${que} se usa en ${usos} operación(es). Desactivalo en su lugar.`,
      409,
    );
  }
}

export const catalogoService = {
  async arbol(soloActivos: boolean): Promise<CatalogoArbolDTO> {
    const [maquinas, grupos, usos] = await Promise.all([
      catalogoRepository.maquinas(soloActivos),
      catalogoRepository.grupos(soloActivos),
      contarUsos(),
    ]);

    return {
      maquinas: maquinas.map((m) => ({
        ...nodo(m, usos.maquinas, m.nombre),
        procesos: m.procesos.map((p) => ({
          ...nodo(p, usos.procesos, `${m.nombre}|${p.nombre}`),
          piezas: p.piezas.map((pz) =>
            nodo(pz, usos.piezas, `${m.nombre}|${p.nombre}|${pz.nombre}`),
          ),
        })),
      })),
      grupos: grupos.map((g) => nodo(g, usos.grupos, g.nombre)),
    };
  },

  async crearMaquina(input: CrearNodoCatalogoInput): Promise<CatalogoNodoDTO> {
    const m = await comoDuplicado(catalogoRepository.crearMaquina(input.nombre), 'una máquina');
    return { id: m.id, nombre: m.nombre, activo: m.activo, usos: 0 };
  },

  async crearProceso(maquinaId: string, input: CrearNodoCatalogoInput): Promise<CatalogoNodoDTO> {
    const maquina = await catalogoRepository.maquina(maquinaId);
    if (!maquina) throw new AppError('NO_ENCONTRADO', 'Máquina no encontrada', 404);
    const p = await comoDuplicado(
      catalogoRepository.crearProceso(maquinaId, input.nombre),
      `un proceso en "${maquina.nombre}"`,
    );
    return { id: p.id, nombre: p.nombre, activo: p.activo, usos: 0 };
  },

  async crearPieza(procesoId: string, input: CrearNodoCatalogoInput): Promise<CatalogoNodoDTO> {
    const proceso = await catalogoRepository.proceso(procesoId);
    if (!proceso) throw new AppError('NO_ENCONTRADO', 'Proceso no encontrado', 404);
    const pz = await comoDuplicado(
      catalogoRepository.crearPieza(procesoId, input.nombre),
      `una pieza en "${proceso.maquina.nombre} / ${proceso.nombre}"`,
    );
    return { id: pz.id, nombre: pz.nombre, activo: pz.activo, usos: 0 };
  },

  async crearGrupo(input: CrearNodoCatalogoInput): Promise<CatalogoNodoDTO> {
    const g = await comoDuplicado(catalogoRepository.crearGrupo(input.nombre), 'un grupo');
    return { id: g.id, nombre: g.nombre, activo: g.activo, usos: 0 };
  },

  async editarMaquina(id: string, input: EditarNodoCatalogoInput): Promise<CatalogoNodoDTO> {
    const m = await comoDuplicado(
      renombreRepository.maquina(id, datosEdicion(input)),
      'una máquina',
    );
    const usos = await contarUsos();
    return nodo(m, usos.maquinas, m.nombre);
  },

  async editarProceso(id: string, input: EditarNodoCatalogoInput): Promise<CatalogoNodoDTO> {
    const actual = await catalogoRepository.proceso(id);
    if (!actual) throw new AppError('NO_ENCONTRADO', 'Proceso no encontrado', 404);
    const p = await comoDuplicado(
      renombreRepository.proceso(id, datosEdicion(input)),
      `un proceso en "${actual.maquina.nombre}"`,
    );
    const usos = await contarUsos();
    return nodo(p, usos.procesos, `${actual.maquina.nombre}|${p.nombre}`);
  },

  async editarPieza(id: string, input: EditarNodoCatalogoInput): Promise<CatalogoNodoDTO> {
    const actual = await catalogoRepository.pieza(id);
    if (!actual) throw new AppError('NO_ENCONTRADO', 'Pieza no encontrada', 404);
    const pz = await comoDuplicado(
      renombreRepository.pieza(id, datosEdicion(input)),
      `una pieza en "${actual.proceso.nombre}"`,
    );
    const usos = await contarUsos();
    const clave = `${actual.proceso.maquina.nombre}|${actual.proceso.nombre}|${pz.nombre}`;
    return nodo(pz, usos.piezas, clave);
  },

  async editarGrupo(id: string, input: EditarNodoCatalogoInput): Promise<CatalogoNodoDTO> {
    const g = await comoDuplicado(renombreRepository.grupo(id, datosEdicion(input)), 'un grupo');
    const usos = await contarUsos();
    return nodo(g, usos.grupos, g.nombre);
  },

  // Borrados: solo si nada los usa (C-4). Una máquina "en uso" incluye el uso de
  // cualquiera de sus procesos/piezas, porque la operación guarda las tres cosas.
  async borrarMaquina(id: string): Promise<void> {
    const maquina = await catalogoRepository.maquina(id);
    if (!maquina) throw new AppError('NO_ENCONTRADO', 'Máquina no encontrada', 404);
    const usos = await contarUsos();
    await exigirNoEnUso(usos.maquinas.get(maquina.nombre) ?? 0, `la máquina "${maquina.nombre}"`);
    await catalogoRepository.borrarMaquina(id);
  },

  async borrarProceso(id: string): Promise<void> {
    const proceso = await catalogoRepository.proceso(id);
    if (!proceso) throw new AppError('NO_ENCONTRADO', 'Proceso no encontrado', 404);
    const usos = await contarUsos();
    const clave = `${proceso.maquina.nombre}|${proceso.nombre}`;
    await exigirNoEnUso(usos.procesos.get(clave) ?? 0, `el proceso "${proceso.nombre}"`);
    await catalogoRepository.borrarProceso(id);
  },

  async borrarPieza(id: string): Promise<void> {
    const pieza = await catalogoRepository.pieza(id);
    if (!pieza) throw new AppError('NO_ENCONTRADO', 'Pieza no encontrada', 404);
    const usos = await contarUsos();
    const clave = `${pieza.proceso.maquina.nombre}|${pieza.proceso.nombre}|${pieza.nombre}`;
    await exigirNoEnUso(usos.piezas.get(clave) ?? 0, `la pieza "${pieza.nombre}"`);
    await catalogoRepository.borrarPieza(id);
  },

  // Unir dos entradas: la de origen desaparece y sus operaciones pasan a decir
  // el nombre de la de destino. Detalle y límites, en fusion.ts.
  async fusionar(
    nivel: 'maquinas' | 'procesos' | 'piezas' | 'grupos',
    origenId: string,
    destinoId: string,
  ): Promise<FusionDTO> {
    const { destino, nombreAbsorbido, operaciones } = await fusionRepository[nivel](
      origenId,
      destinoId,
    );
    const usos = await contarUsos();
    const mapa = usos[nivel];
    // la clave de uso del destino se recalcula recién ahora, ya reescrito el texto
    const clave =
      nivel === 'maquinas' || nivel === 'grupos'
        ? destino.nombre
        : [...mapa.keys()].find((k) => k.endsWith(`|${destino.nombre}`)) ?? destino.nombre;

    return {
      destino: nodo(destino, mapa, clave),
      nombreAbsorbido,
      operacionesActualizadas: operaciones,
    };
  },

  async borrarGrupo(id: string): Promise<void> {
    const grupo = await catalogoRepository.grupo(id);
    if (!grupo) throw new AppError('NO_ENCONTRADO', 'Grupo no encontrado', 404);
    const usos = await contarUsos();
    await exigirNoEnUso(usos.grupos.get(grupo.nombre) ?? 0, `el grupo "${grupo.nombre}"`);
    await catalogoRepository.borrarGrupo(id);
  },
};
