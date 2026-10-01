// Plantilla fija del pantalón clásico, sacada de la hoja "CLAS GSLN BJO" del
// Excel del taller (server/prisma/plantilla-pantalon-clasico.json guarda las 36
// filas tal cual vienen, con sus abreviaturas y erratas).
//
// Acá se normalizan con las mismas reglas que los modelos (normalizarOperacion),
// para que sus máquinas/procesos/piezas caigan en el mismo catálogo.
//
// Es `protegida`: se puede editar, no borrar. Para una variante se duplica.
//
// El `ct` de cada fila (en Bs, opcional) se guarda como CT de REFERENCIA: solo
// precarga el alta de modelo. Si la plantilla ya existe, el seed completa las
// referencias que estén vacías y nunca pisa una que el dueño ya editó.
import type { PrismaClient } from '@prisma/client';
import { aCentavos } from '@taller/shared';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizarOperacion } from './normalizacion-equipos.js';

interface OperacionPlantillaJson {
  orden: number;
  grupo: string;
  n: string | number | null;
  equipo: string;
  proceso: string;
  pieza: string | number | null;
  ct?: number | string | null; // Bs
}

interface PlantillaJson {
  nombre: string;
  operaciones: OperacionPlantillaJson[];
}

export async function sembrarPlantillaClasico(prisma: PrismaClient): Promise<void> {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const datos: PlantillaJson = JSON.parse(
    readFileSync(path.resolve(dir, 'plantilla-pantalon-clasico.json'), 'utf-8'),
  );

  const operaciones = datos.operaciones.map((o) => ({
    orden: o.orden,
    n: o.n == null ? null : String(o.n),
    ...normalizarOperacion({
      grupo: o.grupo,
      equipo: o.equipo,
      proceso: o.proceso,
      pieza: o.pieza == null ? null : String(o.pieza),
    }),
    ctReferencia: o.ct == null || o.ct === '' ? null : aCentavos(o.ct),
  }));

  const existente = await prisma.plantilla.findUnique({
    where: { nombre: datos.nombre },
    include: { operaciones: true },
  });
  if (existente) {
    await completarReferencias(prisma, existente.operaciones, operaciones);
    return;
  }

  await prisma.plantilla.create({
    data: {
      nombre: datos.nombre,
      notas: 'Receta base del taller. Duplicala para armar variantes.',
      protegida: true,
      operaciones: { create: operaciones },
    },
  });

  const grupos = [...new Set(operaciones.map((o) => o.grupo))];
  console.log(
    `✓ Plantilla "${datos.nombre}": ${operaciones.length} operaciones en ${grupos.length} grupos (${grupos.join(', ')})`,
  );
}

type FilaSeed = { orden: number; equipo: string; proceso: string; pieza: string | null; ctReferencia: number | null };

/** Plantilla ya sembrada: pone la referencia del JSON solo donde falta y la fila
 *  sigue siendo la misma operación (mismo orden y misma terna). Si el dueño la
 *  reordenó o editó, esa fila se deja como está. */
async function completarReferencias(
  prisma: PrismaClient,
  enBd: { id: string; orden: number; equipo: string; proceso: string; pieza: string | null; ctReferencia: number | null }[],
  delJson: FilaSeed[],
): Promise<void> {
  let completadas = 0;
  for (const fila of enBd) {
    if (fila.ctReferencia != null) continue;
    const origen = delJson.find(
      (o) =>
        o.orden === fila.orden &&
        o.equipo === fila.equipo &&
        o.proceso === fila.proceso &&
        o.pieza === fila.pieza,
    );
    if (origen?.ctReferencia == null) continue;
    await prisma.plantillaOperacion.update({
      where: { id: fila.id },
      data: { ctReferencia: origen.ctReferencia },
    });
    completadas++;
  }
  console.log(
    `↷ plantilla ya existe; CT de referencia completados: ${completadas}`,
  );
}
