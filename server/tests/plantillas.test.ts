// Rebanada 10 — plantillas de modelo.
// La plantilla es una receta de operaciones con un CT de REFERENCIA opcional
// por fila: precarga el alta de modelo, donde se confirma o se cambia. La del
// pantalón clásico es `protegida`: se edita, no se borra; para una variante se
// duplica.
import { afterAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { prisma } from './helpers/db.js';

const app = crearApp();

const CLASICO = 'Pantalón clásico';

interface PlantillaDetalle {
  id: string;
  nombre: string;
  notas: string | null;
  protegida: boolean;
  cantidadOperaciones: number;
  grupos: string[];
  costoReferencia: number;
  operacionesConReferencia: number;
  operaciones: {
    id: string;
    orden: number;
    grupo: string;
    n: string | null;
    equipo: string;
    proceso: string;
    pieza: string | null;
    ctReferencia: number | null;
  }[];
}

const listar = async () => {
  const res = await request(app).get('/api/v1/plantillas');
  expect(res.status).toBe(200);
  return res.body.data as Omit<PlantillaDetalle, 'operaciones'>[];
};

const clasico = async () => {
  const fila = (await listar()).find((p) => p.nombre === CLASICO)!;
  const res = await request(app).get(`/api/v1/plantillas/${fila.id}`);
  return res.body.data as PlantillaDetalle;
};

afterAll(async () => {
  await prisma.plantilla.deleteMany({ where: { nombre: { startsWith: 'TEST ' } } });
  await prisma.$disconnect();
});

describe('plantilla fija del pantalón clásico', () => {
  test('PLA-1: viene del Excel con sus 36 operaciones en 6 grupos', async () => {
    const p = await clasico();
    expect(p.protegida).toBe(true);
    expect(p.cantidadOperaciones).toBe(36);
    expect(p.grupos).toEqual([
      'TRASEROS',
      'DELANTEROS',
      'ENSAMBLE',
      'CERRADO',
      'ACABADO',
      'PRESILLA',
    ]);
    expect(p.operaciones.map((o) => o.orden)).toEqual(
      Array.from({ length: 36 }, (_, i) => i + 1),
    );
    // los CT de referencia salen de la columna CT del Excel: suman 7.16 (celda F8)
    expect(p.operacionesConReferencia).toBe(36);
    expect(p.costoReferencia).toBe(716);
    expect(p.operaciones[0].ctReferencia).toBe(20); // codo/herraje/trasero 0.20
    expect(p.operaciones[35].ctReferencia).toBe(6); // atraque/atraque/jota 0.06
  });

  test('PLA-2: solo guarda CT de referencia y sus textos salen normalizados al catálogo', async () => {
    const p = await clasico();
    // no hay un `ct` que se pague: solo la referencia opcional
    expect(p.operaciones.every((o) => !('ct' in o) && 'ctReferencia' in o)).toBe(true);

    // las abreviaturas y erratas del Excel quedaron resueltas
    const textos = p.operaciones.map((o) => `${o.equipo}/${o.proceso}/${o.pieza}`);
    expect(textos).toContain('recta/asegurado/popelina'); // "pope"
    expect(textos).toContain('codo/despunte/entrepierna'); // "entrepier"
    expect(textos).toContain('plana/ensamble/delantero'); // "delant"
    expect(textos).toContain('atraque/atraque/jota'); // "atraqie/jota/delantero"
    expect(textos.some((t) => t.includes('atraqie'))).toBe(false);

    // y esos textos existen en el catálogo, así que la cascada los encuentra
    const arbol = await request(app).get('/api/v1/catalogo/arbol?soloActivos=true');
    const maquinas = arbol.body.data.maquinas as {
      nombre: string;
      procesos: { nombre: string; piezas: { nombre: string }[] }[];
    }[];
    for (const o of p.operaciones) {
      const maquina = maquinas.find((m) => m.nombre === o.equipo);
      expect(maquina, `falta la máquina ${o.equipo}`).toBeDefined();
      const proceso = maquina!.procesos.find((x) => x.nombre === o.proceso);
      expect(proceso, `falta ${o.equipo}/${o.proceso}`).toBeDefined();
      if (o.pieza) {
        expect(
          proceso!.piezas.map((z) => z.nombre),
          `falta ${o.equipo}/${o.proceso}/${o.pieza}`,
        ).toContain(o.pieza);
      }
    }
  });

  test('PLA-3: la protegida no se puede borrar', async () => {
    const p = await clasico();
    const res = await request(app).delete(`/api/v1/plantillas/${p.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PLANTILLA_PROTEGIDA');
    expect((await clasico()).cantidadOperaciones).toBe(36);
  });

  test('PLA-4: pero sí se puede editar', async () => {
    const p = await clasico();
    const res = await request(app)
      .patch(`/api/v1/plantillas/${p.id}`)
      .send({ notas: 'TEST nota de prueba' });
    expect(res.status).toBe(200);
    expect(res.body.data.notas).toBe('TEST nota de prueba');
    await request(app).patch(`/api/v1/plantillas/${p.id}`).send({ notas: p.notas ?? '' });
  });
});

describe('duplicar y editar', () => {
  test('PLA-5: la copia trae las mismas operaciones y ya no está protegida', async () => {
    const p = await clasico();
    const res = await request(app)
      .post(`/api/v1/plantillas/${p.id}/duplicar`)
      .send({ nombre: 'TEST copia del clasico' });

    expect(res.status).toBe(201);
    const copia = res.body.data as PlantillaDetalle;
    expect(copia.protegida).toBe(false);
    expect(copia.cantidadOperaciones).toBe(36);
    expect(copia.operaciones.map((o) => `${o.grupo}/${o.equipo}/${o.proceso}`)).toEqual(
      p.operaciones.map((o) => `${o.grupo}/${o.equipo}/${o.proceso}`),
    );

    // editar la copia no toca el original
    const quitada = await request(app).delete(
      `/api/v1/plantilla-operaciones/${copia.operaciones[0].id}`,
    );
    expect(quitada.status).toBe(200);
    expect(quitada.body.data.cantidadOperaciones).toBe(35);
    expect((await clasico()).cantidadOperaciones).toBe(36);

    // y la copia sí se borra
    expect((await request(app).delete(`/api/v1/plantillas/${copia.id}`)).status).toBe(200);
    expect((await listar()).some((x) => x.nombre === 'TEST copia del clasico')).toBe(false);
  });

  test('PLA-6: alta propia, agregar y editar operaciones, y nombre único', async () => {
    const creada = await request(app)
      .post('/api/v1/plantillas')
      .send({
        nombre: 'TEST plantilla propia',
        operaciones: [
          { grupo: 'TRASEROS', n: '1', equipo: 'recta', proceso: 'pinza', pieza: 'trasero' },
        ],
      });
    expect(creada.status).toBe(201);
    const id = creada.body.data.id as string;
    expect(creada.body.data.cantidadOperaciones).toBe(1);

    const duplicada = await request(app)
      .post('/api/v1/plantillas')
      .send({ nombre: 'TEST plantilla propia', operaciones: [] });
    expect(duplicada.status).toBe(409);
    expect(duplicada.body.error.code).toBe('NOMBRE_DUPLICADO');

    const agregada = await request(app)
      .post(`/api/v1/plantillas/${id}/operaciones`)
      .send({ grupo: 'ENSAMBLE', n: '1', equipo: 'plana', proceso: 'ensamble', pieza: 'delantero' });
    expect(agregada.status).toBe(201);
    expect(agregada.body.data.operaciones.map((o: { orden: number }) => o.orden)).toEqual([1, 2]);

    const editada = await request(app)
      .patch(`/api/v1/plantilla-operaciones/${agregada.body.data.operaciones[1].id}`)
      .send({ pieza: 'lateral/solapa' });
    expect(editada.status).toBe(200);
    expect(editada.body.data.operaciones[1].pieza).toBe('lateral/solapa');
  });
});

describe('CT de referencia', () => {
  const fila = (ctReferencia?: number | null) => ({
    grupo: 'TRASEROS',
    n: '1',
    equipo: 'recta',
    proceso: 'pinza',
    pieza: 'trasero',
    ...(ctReferencia !== undefined ? { ctReferencia } : {}),
  });

  test('PLA-9: se guarda en centavos, es opcional y suma exacta por prenda', async () => {
    const creada = await request(app)
      .post('/api/v1/plantillas')
      .send({ nombre: 'TEST plantilla con precios', operaciones: [fila(15), fila(), fila(null)] });
    expect(creada.status).toBe(201);
    const p = creada.body.data as PlantillaDetalle;
    expect(p.operaciones.map((o) => o.ctReferencia)).toEqual([15, null, null]);
    expect(p.costoReferencia).toBe(15);
    expect(p.operacionesConReferencia).toBe(1);

    // se edita desde el editor (PUT con la lista completa) y suma sin descuadres
    const guardada = await request(app)
      .put(`/api/v1/plantillas/${p.id}/operaciones`)
      .send({ operaciones: [fila(15), fila(20), fila(35)] });
    expect(guardada.status).toBe(200);
    expect(guardada.body.data.costoReferencia).toBe(70);
    expect(guardada.body.data.operacionesConReferencia).toBe(3);

    // y también fila por fila
    const idSegunda = guardada.body.data.operaciones[1].id as string;
    const editada = await request(app)
      .patch(`/api/v1/plantilla-operaciones/${idSegunda}`)
      .send({ ctReferencia: 25 });
    expect(editada.body.data.costoReferencia).toBe(75);

    // la lista también trae el total
    const enLista = (await listar()).find((x) => x.id === p.id)!;
    expect(enLista.costoReferencia).toBe(75);
  });

  test('PLA-10: la referencia debe ser centavos enteros mayores a 0', async () => {
    for (const malo of [0, -5, 1.5, '0.15']) {
      const res = await request(app)
        .post('/api/v1/plantillas')
        .send({ nombre: 'TEST referencia invalida', operaciones: [fila(malo as number)] });
      expect(res.status, `aceptó ${malo}`).toBe(400);
    }
  });

  test('PLA-11: duplicar copia la referencia y editarla no toca el original', async () => {
    const original = await request(app)
      .post('/api/v1/plantillas')
      .send({ nombre: 'TEST ref original', operaciones: [fila(30)] });
    const copia = await request(app)
      .post(`/api/v1/plantillas/${original.body.data.id}/duplicar`)
      .send({ nombre: 'TEST ref copia' });
    expect(copia.body.data.operaciones[0].ctReferencia).toBe(30);

    await request(app)
      .patch(`/api/v1/plantilla-operaciones/${copia.body.data.operaciones[0].id}`)
      .send({ ctReferencia: 45 })
      .expect(200);
    const despues = await request(app).get(`/api/v1/plantillas/${original.body.data.id}`);
    expect(despues.body.data.operaciones[0].ctReferencia).toBe(30);
  });

  test('PLA-12: cambiar la referencia no toca un modelo creado con ella', async () => {
    const plantilla = await request(app)
      .post('/api/v1/plantillas')
      .send({ nombre: 'TEST ref vs modelo', operaciones: [fila(40)] });
    // el cliente precarga el CT con la referencia y el dueño lo confirma
    const op = plantilla.body.data.operaciones[0];
    const modelo = await request(app)
      .post('/api/v1/modelos')
      .send({
        nombre: 'TEST modelo desde plantilla con ref',
        operaciones: [{ ...fila(), ct: op.ctReferencia }],
      });
    expect(modelo.status).toBe(201);

    await request(app)
      .patch(`/api/v1/plantilla-operaciones/${op.id}`)
      .send({ ctReferencia: 99 })
      .expect(200);

    const version = await request(app).get(`/api/v1/versiones/${modelo.body.data.id}`);
    expect(version.status).toBe(200);
    expect(version.body.data.operaciones[0].ct).toBe(40);
    expect(version.body.data.costoManoObraPrenda).toBe(40);

    // limpieza en orden (operaciones → versiones → modelo, sin cascade)
    const modeloId = version.body.data.modeloId as string;
    await prisma.operacion.deleteMany({ where: { version: { modeloId } } });
    await prisma.modeloVersion.deleteMany({ where: { modeloId } });
    await prisma.modelo.delete({ where: { id: modeloId } });
  });
});

describe('convivencia con el catálogo', () => {
  test('PLA-8: lo que usa una plantilla cuenta como en uso y no se puede borrar', async () => {
    const maquina = await request(app)
      .post('/api/v1/catalogo/maquinas')
      .send({ nombre: 'TEST maq usada por plantilla' });
    await request(app)
      .post('/api/v1/plantillas')
      .send({
        nombre: 'TEST plantilla que usa',
        operaciones: [
          {
            grupo: 'TRASEROS',
            n: null,
            equipo: 'test maq usada por plantilla',
            proceso: 'test proc',
            pieza: null,
          },
        ],
      })
      .expect(201);

    const arbol = await request(app).get('/api/v1/catalogo/arbol?soloActivos=false');
    const enCatalogo = (arbol.body.data.maquinas as { nombre: string; usos: number }[]).find(
      (m) => m.nombre === 'test maq usada por plantilla',
    )!;
    expect(enCatalogo.usos).toBe(1);

    const borrado = await request(app).delete(`/api/v1/catalogo/maquinas/${maquina.body.data.id}`);
    expect(borrado.status).toBe(409);
    expect(borrado.body.error.code).toBe('EN_USO');

    await prisma.plantilla.deleteMany({ where: { nombre: 'TEST plantilla que usa' } });
    await prisma.maquina.deleteMany({ where: { nombre: 'test maq usada por plantilla' } });
  });

  test('PLA-7: renombrar en el catálogo también arrastra las plantillas', async () => {
    const maquina = await request(app)
      .post('/api/v1/catalogo/maquinas')
      .send({ nombre: 'TEST maq plantilla' });
    const plantilla = await request(app)
      .post('/api/v1/plantillas')
      .send({
        nombre: 'TEST plantilla catalogo',
        operaciones: [
          {
            grupo: 'TRASEROS',
            n: '1',
            equipo: 'test maq plantilla',
            proceso: 'test proc',
            pieza: null,
          },
        ],
      });
    expect(plantilla.status).toBe(201);

    await request(app)
      .patch(`/api/v1/catalogo/maquinas/${maquina.body.data.id}`)
      .send({ nombre: 'TEST maq plantilla renombrada' })
      .expect(200);

    const despues = await request(app).get(`/api/v1/plantillas/${plantilla.body.data.id}`);
    expect(despues.body.data.operaciones[0].equipo).toBe('test maq plantilla renombrada');

    await prisma.maquina.deleteMany({ where: { nombre: { startsWith: 'test maq plantilla' } } });
  });
});
