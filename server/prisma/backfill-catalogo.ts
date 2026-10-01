// Backfill del catálogo Máquina → Proceso → Pieza + Grupos
// (docs/PLAN_CATALOGO_MAQUINAS.md §6).
//
// El catálogo NO se arma a mano: se deriva de las operaciones que ya existen en
// la BD, TAL CUAL dicen: acá no se unifica nada. Si unificara (p. ej. mandando
// "recta+pres" a "recta"), las operaciones que dicen el nombre viejo quedarían
// apuntando a una entrada inexistente. Unificar es trabajo del seed al cargar
// (normalizacion-equipos.ts) o de la fusión desde la pantalla de catálogo.
//
// Las listas planas de docs/seed_datos_taller.json (catalogo_maquinas,
// catalogo_procesos, catalogo_piezas) se descartan a propósito: vienen sucias,
// con variantes del mismo concepto, y no contienen la jerarquía. La jerarquía
// real es la de las ternas (equipo, proceso, pieza) efectivamente usadas.
//
// Es idempotente: solo CREA filas que falten. Nunca modifica ni borra
// operaciones, ni el catálogo ya editado por el dueño.
import { PrismaClient } from '@prisma/client';
import { normalizarNombreCatalogo, normalizarNombreGrupo } from '@taller/shared';

export interface ResumenBackfill {
  maquinas: number;
  procesos: number;
  piezas: number;
  grupos: number;
}

export async function backfillCatalogo(prisma: PrismaClient): Promise<ResumenBackfill> {
  const campos = { grupo: true, equipo: true, proceso: true, pieza: true };
  // Las plantillas también tienen que poder elegirse desde el catálogo, así que
  // sus operaciones cuentan igual que las de los modelos.
  const [deModelos, dePlantillas] = await Promise.all([
    prisma.operacion.findMany({ select: campos }),
    prisma.plantillaOperacion.findMany({ select: campos }),
  ]);
  const operaciones = [...deModelos, ...dePlantillas];

  // Árbol en memoria: máquina → proceso → piezas. Son pocas filas (≈200 en el
  // seed real), así que una sola lectura alcanza.
  const arbol = new Map<string, Map<string, Set<string>>>();
  const grupos = new Set<string>();

  for (const op of operaciones) {
    const maquina = normalizarNombreCatalogo(op.equipo);
    const proceso = normalizarNombreCatalogo(op.proceso);
    if (!maquina || !proceso) continue;

    const procesos = arbol.get(maquina) ?? new Map<string, Set<string>>();
    arbol.set(maquina, procesos);
    const piezas = procesos.get(proceso) ?? new Set<string>();
    procesos.set(proceso, piezas);

    // La pieza es opcional (C-6): hay operaciones reales sin pieza.
    const pieza = op.pieza == null ? '' : normalizarNombreCatalogo(op.pieza);
    if (pieza) piezas.add(pieza);

    const grupo = normalizarNombreGrupo(op.grupo);
    if (grupo) grupos.add(grupo);
  }

  const resumen: ResumenBackfill = { maquinas: 0, procesos: 0, piezas: 0, grupos: 0 };

  for (const nombre of [...grupos].sort()) {
    const existente = await prisma.grupo.findUnique({ where: { nombre } });
    if (existente) continue;
    await prisma.grupo.create({ data: { nombre } });
    resumen.grupos += 1;
  }

  for (const [nombreMaquina, procesos] of [...arbol].sort(([a], [b]) => a.localeCompare(b))) {
    let maquina = await prisma.maquina.findUnique({ where: { nombre: nombreMaquina } });
    if (!maquina) {
      maquina = await prisma.maquina.create({ data: { nombre: nombreMaquina } });
      resumen.maquinas += 1;
    }

    for (const [nombreProceso, piezas] of [...procesos].sort(([a], [b]) => a.localeCompare(b))) {
      let proceso = await prisma.proceso.findUnique({
        where: { maquinaId_nombre: { maquinaId: maquina.id, nombre: nombreProceso } },
      });
      if (!proceso) {
        proceso = await prisma.proceso.create({
          data: { maquinaId: maquina.id, nombre: nombreProceso },
        });
        resumen.procesos += 1;
      }

      for (const nombrePieza of [...piezas].sort()) {
        const existente = await prisma.pieza.findUnique({
          where: { procesoId_nombre: { procesoId: proceso.id, nombre: nombrePieza } },
        });
        if (existente) continue;
        await prisma.pieza.create({ data: { procesoId: proceso.id, nombre: nombrePieza } });
        resumen.piezas += 1;
      }
    }
  }

  return resumen;
}

// Ejecución directa: `npm run catalogo:backfill` (útil sobre una BD que ya tenía
// modelos cargados antes de que existiera el catálogo).
const ejecutadoDirecto = process.argv[1]?.replace(/\\/g, '/').endsWith('backfill-catalogo.ts');
if (ejecutadoDirecto) {
  const prisma = new PrismaClient();
  backfillCatalogo(prisma)
    .then(async (r) => {
      const totales = await Promise.all([
        prisma.maquina.count(),
        prisma.proceso.count(),
        prisma.pieza.count(),
        prisma.grupo.count(),
      ]);
      console.log(
        `✓ Backfill: +${r.maquinas} máquinas, +${r.procesos} procesos, +${r.piezas} piezas, +${r.grupos} grupos`,
      );
      console.log(
        `  Catálogo total: ${totales[0]} máquinas, ${totales[1]} procesos, ${totales[2]} piezas, ${totales[3]} grupos`,
      );
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
