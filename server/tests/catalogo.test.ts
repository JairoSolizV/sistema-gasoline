// Rebanada 9 — catálogo Máquina → Proceso → Pieza + Grupos
// (docs/PLAN_CATALOGO_MAQUINAS.md §8: CAT-1..CAT-8).
// Limpieza: todo lo creado acá se borra en afterAll para no alterar los conteos
// del catálogo que deja el backfill del seed.
import { afterAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { backfillCatalogo } from '../prisma/backfill-catalogo.js';
import { prisma } from './helpers/db.js';

const app = crearApp();

const arbol = async (soloActivos = true) => {
  const res = await request(app).get(`/api/v1/catalogo/arbol?soloActivos=${soloActivos}`);
  expect(res.status).toBe(200);
  return res.body.data as {
    maquinas: {
      id: string;
      nombre: string;
      activo: boolean;
      usos: number;
      procesos: {
        id: string;
        nombre: string;
        usos: number;
        piezas: { id: string; nombre: string; usos: number }[];
      }[];
    }[];
    grupos: { id: string; nombre: string; activo: boolean; usos: number }[];
  };
};

const buscarMaquina = async (nombre: string, soloActivos = true) =>
  (await arbol(soloActivos)).maquinas.find((m) => m.nombre === nombre);

afterAll(async () => {
  await prisma.pieza.deleteMany({ where: { nombre: { startsWith: 'test ' } } });
  await prisma.proceso.deleteMany({ where: { nombre: { startsWith: 'test ' } } });
  await prisma.maquina.deleteMany({ where: { nombre: { startsWith: 'test ' } } });
  await prisma.grupo.deleteMany({ where: { nombre: { startsWith: 'TEST ' } } });
  await prisma.operacion.deleteMany({ where: { version: { modelo: { nombre: { startsWith: 'TEST MODELO' } } } } });
  const modelosTest = await prisma.modelo.findMany({
    where: { nombre: { startsWith: 'TEST MODELO' } },
    select: { id: true },
  });
  await prisma.modeloVersion.deleteMany({ where: { modeloId: { in: modelosTest.map((m) => m.id) } } });
  await prisma.modelo.deleteMany({ where: { id: { in: modelosTest.map((m) => m.id) } } });
  await prisma.$disconnect();
});

describe('GET /api/v1/catalogo/arbol — jerarquía', () => {
  test('CAT-1: los procesos de "recta" son solo los suyos', async () => {
    const datos = await arbol();
    const recta = datos.maquinas.find((m) => m.nombre === 'recta');
    const overlock = datos.maquinas.find((m) => m.nombre === 'overlock');
    expect(recta).toBeDefined();
    expect(overlock).toBeDefined();

    // El punto del módulo: la cascada achica la lista. Los números salen del
    // seed real (modelos + plantilla del clásico), ya unificado con
    // normalizacion-equipos.ts.
    expect(recta!.procesos.length).toBe(27);
    expect(overlock!.procesos.length).toBe(9);

    // "pinza" se hace en recta; que no aparezca colgando de overlock.
    expect(recta!.procesos.map((p) => p.nombre)).toContain('pinza');
    expect(overlock!.procesos.map((p) => p.nombre)).not.toContain('pinza');
  });

  test('CAT-2: las piezas de (recta, pinza) son solo las de ese par', async () => {
    const recta = await buscarMaquina('recta');
    const pinza = recta!.procesos.find((p) => p.nombre === 'pinza');
    expect(pinza!.piezas.map((pz) => pz.nombre)).toEqual(['trasero']);
  });

  test('CAT-2b: un proceso homónimo en otra máquina tiene sus propias piezas', async () => {
    const datos = await arbol();
    const piezasDe = (maquina: string) =>
      datos.maquinas
        .find((m) => m.nombre === maquina)!
        .procesos.find((p) => p.nombre === 'despunte')!
        .piezas.map((pz) => pz.nombre)
        .sort();

    // "despunte" se hace en recta, plana y codo: cada rama lista lo suyo (§3.1)
    const enRecta = piezasDe('recta');
    const enPlana = piezasDe('plana');
    expect(enRecta).toContain('solapa');
    expect(enRecta).not.toEqual(enPlana);
  });

  test('el catálogo trae los grupos en MAYÚSCULAS y con su uso', async () => {
    const { grupos } = await arbol();
    expect(grupos.map((g) => g.nombre)).toContain('TRASEROS');
    // "DELANTERO" se unificó con "DELANTEROS" al cargar (§11)
    expect(grupos.map((g) => g.nombre)).not.toContain('DELANTERO');
    expect(grupos.every((g) => g.nombre === g.nombre.toUpperCase())).toBe(true);
    expect(grupos.find((g) => g.nombre === 'TRASEROS')!.usos).toBeGreaterThan(0);
  });

  test('CAT-13: las repeticiones y las cantidades NO se unifican con la operación simple', async () => {
    const recta = await buscarMaquina('recta');
    const plana = await buscarMaquina('plana');
    const nombres = (m: typeof recta) => m!.procesos.map((p) => p.nombre);

    // "2corrida" es la segunda pasada y "3/5 pinza" es cuántas pinzas lleva:
    // cada una tiene su propio CT, así que son operaciones distintas de
    // "corrida" o "pinza" a secas (§11.4).
    expect(nombres(recta)).toEqual(expect.arrayContaining(['despunte', 'despunte 1', 'corrida 2']));
    expect(nombres(recta)).toEqual(expect.arrayContaining(['pinza', '3 pinzas', '5 pinzas']));
    expect(nombres(plana)).toEqual(expect.arrayContaining(['despunte', 'despunte 1', 'despunte 2']));
  });

  test('el conteo de usos refleja las operaciones reales', async () => {
    const recta = await buscarMaquina('recta');
    const pinza = recta!.procesos.find((p) => p.nombre === 'pinza')!;
    const trasero = pinza.piezas.find((pz) => pz.nombre === 'trasero')!;
    expect(recta!.usos).toBeGreaterThan(0);
    expect(pinza.usos).toBeGreaterThanOrEqual(trasero.usos);
    expect(trasero.usos).toBeGreaterThan(0);
  });
});

describe('altas — C-1 unicidad por rama, C-2 normalización', () => {
  test('CAT-3: proceso duplicado en la misma máquina → 409; en otra máquina → 201', async () => {
    const m1 = await request(app).post('/api/v1/catalogo/maquinas').send({ nombre: 'TEST maq uno' });
    const m2 = await request(app).post('/api/v1/catalogo/maquinas').send({ nombre: 'TEST maq dos' });
    expect(m1.status).toBe(201);

    const alta = await request(app)
      .post(`/api/v1/catalogo/maquinas/${m1.body.data.id}/procesos`)
      .send({ nombre: 'test proc' });
    expect(alta.status).toBe(201);

    const duplicado = await request(app)
      .post(`/api/v1/catalogo/maquinas/${m1.body.data.id}/procesos`)
      .send({ nombre: 'test proc' });
    expect(duplicado.status).toBe(409);
    expect(duplicado.body.error.code).toBe('NOMBRE_DUPLICADO');

    // el mismo nombre bajo otra máquina es legítimo (árbol estricto, §3.1)
    const enOtraMaquina = await request(app)
      .post(`/api/v1/catalogo/maquinas/${m2.body.data.id}/procesos`)
      .send({ nombre: 'test proc' });
    expect(enOtraMaquina.status).toBe(201);
  });

  test('CAT-7: máquina/proceso/pieza en minúsculas y grupos en MAYÚSCULAS', async () => {
    const maquina = await request(app)
      .post('/api/v1/catalogo/maquinas')
      .send({ nombre: '  TEST   Maq   Normalizada ' });
    expect(maquina.body.data.nombre).toBe('test maq normalizada');

    const pieza = await request(app)
      .post(`/api/v1/catalogo/maquinas/${maquina.body.data.id}/procesos`)
      .send({ nombre: 'TEST Proc' })
      .then((r) =>
        request(app).post(`/api/v1/catalogo/procesos/${r.body.data.id}/piezas`).send({
          nombre: 'TEST Pieza',
        }),
      );
    expect(pieza.body.data.nombre).toBe('test pieza');

    const grupo = await request(app)
      .post('/api/v1/catalogo/grupos')
      .send({ nombre: '  test grupo nuevo ' });
    expect(grupo.status).toBe(201);
    expect(grupo.body.data.nombre).toBe('TEST GRUPO NUEVO');

    const grupoDuplicado = await request(app)
      .post('/api/v1/catalogo/grupos')
      .send({ nombre: 'TEST GRUPO NUEVO' });
    expect(grupoDuplicado.status).toBe(409);
  });
});

describe('baja lógica y borrado', () => {
  test('CAT-4: desactivar una máquina la saca del árbol de activos sin tocar operaciones', async () => {
    const alta = await request(app)
      .post('/api/v1/catalogo/maquinas')
      .send({ nombre: 'TEST maq baja' });
    const id = alta.body.data.id as string;

    const operacionesAntes = await prisma.operacion.count();

    const baja = await request(app).patch(`/api/v1/catalogo/maquinas/${id}`).send({ activo: false });
    expect(baja.status).toBe(200);
    expect(baja.body.data.activo).toBe(false);

    expect(await buscarMaquina('test maq baja', true)).toBeUndefined();
    expect(await buscarMaquina('test maq baja', false)).toBeDefined();
    expect(await prisma.operacion.count()).toBe(operacionesAntes);

    // reactivar la devuelve tal cual (C-3)
    await request(app).patch(`/api/v1/catalogo/maquinas/${id}`).send({ activo: true });
    expect(await buscarMaquina('test maq baja', true)).toBeDefined();
  });

  test('CAT-4b: desactivar la máquina oculta también sus procesos y piezas', async () => {
    const maquina = await request(app)
      .post('/api/v1/catalogo/maquinas')
      .send({ nombre: 'TEST maq con hijos' });
    await request(app)
      .post(`/api/v1/catalogo/maquinas/${maquina.body.data.id}/procesos`)
      .send({ nombre: 'test proc oculto' });

    await request(app)
      .patch(`/api/v1/catalogo/maquinas/${maquina.body.data.id}`)
      .send({ activo: false });

    const activos = await arbol(true);
    expect(activos.maquinas.flatMap((m) => m.procesos).map((p) => p.nombre)).not.toContain(
      'test proc oculto',
    );
  });

  test('CAT-14: renombrar arrastra las operaciones de los modelos (no las deja huérfanas)', async () => {
    const maquina = await request(app)
      .post('/api/v1/catalogo/maquinas')
      .send({ nombre: 'TEST maq renombrar' });
    const proceso = await request(app)
      .post(`/api/v1/catalogo/maquinas/${maquina.body.data.id}/procesos`)
      .send({ nombre: 'test proc viejo' });
    await request(app)
      .post(`/api/v1/catalogo/procesos/${proceso.body.data.id}/piezas`)
      .send({ nombre: 'test pieza vieja' });

    const modelo = await request(app)
      .post('/api/v1/modelos')
      .send({
        nombre: 'TEST MODELO RENOMBRAR',
        operaciones: [
          {
            grupo: 'TRASEROS',
            n: '1',
            equipo: 'test maq renombrar',
            proceso: 'test proc viejo',
            pieza: 'test pieza vieja',
            ct: 30,
          },
        ],
      });
    expect(modelo.status).toBe(201);

    // renombrar los tres niveles, de abajo hacia arriba
    const piezaId = (await arbol(false)).maquinas
      .find((m) => m.nombre === 'test maq renombrar')!
      .procesos[0].piezas[0].id;
    await request(app)
      .patch(`/api/v1/catalogo/piezas/${piezaId}`)
      .send({ nombre: 'test pieza nueva' })
      .expect(200);
    await request(app)
      .patch(`/api/v1/catalogo/procesos/${proceso.body.data.id}`)
      .send({ nombre: 'test proc nuevo' })
      .expect(200);
    await request(app)
      .patch(`/api/v1/catalogo/maquinas/${maquina.body.data.id}`)
      .send({ nombre: 'TEST maq renombrada' })
      .expect(200);

    // la operación del modelo dice los nombres nuevos…
    const version = await request(app).get(`/api/v1/versiones/${modelo.body.data.id}`);
    expect(version.body.data.operaciones[0]).toMatchObject({
      equipo: 'test maq renombrada',
      proceso: 'test proc nuevo',
      pieza: 'test pieza nueva',
      ct: 30, // …y el CT no se toca
    });

    // …y el catálogo la sigue contando como en uso (el bug era que caía a 0)
    const renombrada = (await arbol(false)).maquinas.find(
      (m) => m.nombre === 'test maq renombrada',
    )!;
    expect(renombrada.usos).toBe(1);
    expect(renombrada.procesos[0].usos).toBe(1);
    expect(renombrada.procesos[0].piezas[0].usos).toBe(1);

    const id = modelo.body.data.modeloId as string;
    await prisma.operacion.deleteMany({ where: { version: { modeloId: id } } });
    await prisma.modeloVersion.deleteMany({ where: { modeloId: id } });
    await prisma.modelo.delete({ where: { id } });
  });

  test('CAT-5: renombrar en el catálogo NO reescribe el snapshot del corte', async () => {
    const antesSnapshot = await prisma.corteOperacion.findMany({
      select: { id: true, equipo: true, proceso: true, pieza: true },
      orderBy: { id: 'asc' },
    });

    const recta = await buscarMaquina('recta');
    await request(app)
      .patch(`/api/v1/catalogo/maquinas/${recta!.id}`)
      .send({ nombre: 'recta renombrada' })
      .expect(200);

    const despuesSnapshot = await prisma.corteOperacion.findMany({
      select: { id: true, equipo: true, proceso: true, pieza: true },
      orderBy: { id: 'asc' },
    });

    // el snapshot pagable queda congelado aunque el catálogo cambie (CA-1.4)
    expect(despuesSnapshot).toEqual(antesSnapshot);

    // restaurar el catálogo para el resto de la suite
    await request(app)
      .patch(`/api/v1/catalogo/maquinas/${recta!.id}`)
      .send({ nombre: 'recta' })
      .expect(200);
  });

  test('CAT-4c: no se puede borrar físicamente algo en uso; sí lo que no se usa', async () => {
    const recta = await buscarMaquina('recta');
    const enUso = await request(app).delete(`/api/v1/catalogo/maquinas/${recta!.id}`);
    expect(enUso.status).toBe(409);
    expect(enUso.body.error.code).toBe('EN_USO');
    expect(await buscarMaquina('recta')).toBeDefined();

    const nueva = await request(app)
      .post('/api/v1/catalogo/maquinas')
      .send({ nombre: 'TEST maq borrable' });
    const borrado = await request(app).delete(`/api/v1/catalogo/maquinas/${nueva.body.data.id}`);
    expect(borrado.status).toBe(200);
    expect(await buscarMaquina('test maq borrable', false)).toBeUndefined();
  });
});

describe('convivencia con el alta de modelos', () => {
  test('CAT-8: crear un modelo con textos libres sigue funcionando igual que antes', async () => {
    const res = await request(app)
      .post('/api/v1/modelos')
      .send({
        nombre: 'TEST MODELO CATALOGO LIBRE',
        operaciones: [
          { grupo: 'TRASEROS', n: '1', equipo: 'recta', proceso: 'pinza', pieza: 'trasero', ct: 15 },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.costoManoObraPrenda).toBe(15);

    const modelo = await prisma.modelo.findUnique({
      where: { nombre: 'TEST MODELO CATALOGO LIBRE' },
      select: { id: true },
    });
    await prisma.operacion.deleteMany({ where: { version: { modeloId: modelo!.id } } });
    await prisma.modeloVersion.deleteMany({ where: { modeloId: modelo!.id } });
    await prisma.modelo.delete({ where: { id: modelo!.id } });
  });
});

describe('backfill', () => {
  test('CAT-6: es idempotente y deja el catálogo del seed real', async () => {
    // el seed ya corrió el backfill en global-setup: repetirlo no debe crear nada
    const resumen = await backfillCatalogo(prisma);
    expect(resumen).toEqual({ maquinas: 0, procesos: 0, piezas: 0, grupos: 0 });

    // conteos derivados de las 201 operaciones de los modelos del seed más las
    // 36 de la plantilla del clásico, con las variantes ya unificadas
    // (PLAN_CATALOGO §1 y §11)
    expect(await prisma.maquina.count({ where: { nombre: { not: { startsWith: 'test ' } } } })).toBe(11);
    expect(await prisma.proceso.count({ where: { nombre: { not: { startsWith: 'test ' } } } })).toBe(63);
    expect(await prisma.pieza.count({ where: { nombre: { not: { startsWith: 'test ' } } } })).toBe(109);
    expect(await prisma.grupo.count({ where: { nombre: { not: { startsWith: 'TEST ' } } } })).toBe(8);
  });
});

// ── Fusión de entradas duplicadas (DELANTERO + DELANTEROS = lo mismo) ─────────
// Es la única operación del módulo que reescribe `Operacion`; el snapshot de los
// cortes NO se toca nunca (CA-1.4) y ningún monto cambia.
describe('POST .../fusionar', () => {
  async function maquinaConProceso(nombreMaquina: string, nombreProceso: string, pieza?: string) {
    const maquina = await request(app)
      .post('/api/v1/catalogo/maquinas')
      .send({ nombre: nombreMaquina });
    const proceso = await request(app)
      .post(`/api/v1/catalogo/maquinas/${maquina.body.data.id}/procesos`)
      .send({ nombre: nombreProceso });
    const piezaCreada = pieza
      ? await request(app)
          .post(`/api/v1/catalogo/procesos/${proceso.body.data.id}/piezas`)
          .send({ nombre: pieza })
      : null;
    return {
      maquinaId: maquina.body.data.id as string,
      procesoId: proceso.body.data.id as string,
      piezaId: piezaCreada?.body.data.id as string | undefined,
    };
  }

  test('CAT-9: unir grupos reescribe las operaciones y borra el duplicado', async () => {
    const a = await request(app).post('/api/v1/catalogo/grupos').send({ nombre: 'TEST GRUPO A' });
    const b = await request(app).post('/api/v1/catalogo/grupos').send({ nombre: 'TEST GRUPO B' });

    const modelo = await request(app)
      .post('/api/v1/modelos')
      .send({
        nombre: 'TEST MODELO FUSION',
        operaciones: [
          { grupo: 'TEST GRUPO A', n: '1', equipo: 'recta', proceso: 'pinza', pieza: 'trasero', ct: 15 },
          { grupo: 'TEST GRUPO B', n: '2', equipo: 'recta', proceso: 'pinza', pieza: 'trasero', ct: 20 },
        ],
      });
    expect(modelo.status).toBe(201);

    const res = await request(app)
      .post(`/api/v1/catalogo/grupos/${a.body.data.id}/fusionar`)
      .send({ destinoId: b.body.data.id });

    expect(res.status).toBe(200);
    expect(res.body.data.nombreAbsorbido).toBe('TEST GRUPO A');
    expect(res.body.data.destino.nombre).toBe('TEST GRUPO B');
    expect(res.body.data.operacionesActualizadas).toBe(1);

    const version = await request(app).get(`/api/v1/versiones/${modelo.body.data.id}`);
    expect(version.body.data.operaciones.map((o: { grupo: string }) => o.grupo)).toEqual([
      'TEST GRUPO B',
      'TEST GRUPO B',
    ]);
    // el CT no se toca: unir es cosmético sobre el nombre
    expect(version.body.data.costoManoObraPrenda).toBe(35);
    expect((await arbol(false)).grupos.map((g) => g.nombre)).not.toContain('TEST GRUPO A');

    const id = modelo.body.data.modeloId as string;
    await prisma.operacion.deleteMany({ where: { version: { modeloId: id } } });
    await prisma.modeloVersion.deleteMany({ where: { modeloId: id } });
    await prisma.modelo.delete({ where: { id } });
  });

  test('CAT-10: unir procesos migra las piezas y fusiona las homónimas', async () => {
    const origen = await maquinaConProceso('TEST maq fusion', 'test proc origen', 'test pieza sola');
    const destinoProceso = await request(app)
      .post(`/api/v1/catalogo/maquinas/${origen.maquinaId}/procesos`)
      .send({ nombre: 'test proc destino' });
    await request(app)
      .post(`/api/v1/catalogo/procesos/${destinoProceso.body.data.id}/piezas`)
      .send({ nombre: 'test pieza comun' });
    await request(app)
      .post(`/api/v1/catalogo/procesos/${origen.procesoId}/piezas`)
      .send({ nombre: 'test pieza comun' });

    const res = await request(app)
      .post(`/api/v1/catalogo/procesos/${origen.procesoId}/fusionar`)
      .send({ destinoId: destinoProceso.body.data.id });
    expect(res.status).toBe(200);

    const maquina = (await arbol(false)).maquinas.find((m) => m.nombre === 'test maq fusion')!;
    expect(maquina.procesos.map((p) => p.nombre)).toEqual(['test proc destino']);
    // la pieza que solo estaba en el origen se mudó; la repetida no se duplicó
    expect(maquina.procesos[0].piezas.map((p) => p.nombre).sort()).toEqual([
      'test pieza comun',
      'test pieza sola',
    ]);
  });

  test('CAT-11: no se unen procesos de máquinas distintas', async () => {
    const a = await maquinaConProceso('TEST maq uno fusion', 'test proc x');
    const b = await maquinaConProceso('TEST maq dos fusion', 'test proc y');

    const res = await request(app)
      .post(`/api/v1/catalogo/procesos/${a.procesoId}/fusionar`)
      .send({ destinoId: b.procesoId });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('FUSION_INVALIDA');

    const consigoMismo = await request(app)
      .post(`/api/v1/catalogo/procesos/${a.procesoId}/fusionar`)
      .send({ destinoId: a.procesoId });
    expect(consigoMismo.status).toBe(400);
  });

  test('CAT-12: unir NO toca el snapshot del corte ni los montos', async () => {
    const antesSnapshot = await prisma.corteOperacion.findMany({
      select: { id: true, grupo: true, equipo: true, proceso: true, pieza: true, ct: true },
      orderBy: { id: 'asc' },
    });
    const antesAsignaciones = await prisma.asignacion.findMany({
      select: { id: true, total: true, tarifaEfectiva: true },
      orderBy: { id: 'asc' },
    });

    const a = await request(app).post('/api/v1/catalogo/grupos').send({ nombre: 'TEST SNAP A' });
    const b = await request(app).post('/api/v1/catalogo/grupos').send({ nombre: 'TEST SNAP B' });
    await request(app)
      .post(`/api/v1/catalogo/grupos/${a.body.data.id}/fusionar`)
      .send({ destinoId: b.body.data.id })
      .expect(200);

    expect(
      await prisma.corteOperacion.findMany({
        select: { id: true, grupo: true, equipo: true, proceso: true, pieza: true, ct: true },
        orderBy: { id: 'asc' },
      }),
    ).toEqual(antesSnapshot);
    expect(
      await prisma.asignacion.findMany({
        select: { id: true, total: true, tarifaEfectiva: true },
        orderBy: { id: 'asc' },
      }),
    ).toEqual(antesAsignaciones);
  });
});
