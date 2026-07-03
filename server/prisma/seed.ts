// Carga docs/seed_datos_taller.json: configuración, operarios y modelos v1.
// Idempotente (re-ejecutable sin duplicar). NO crea cortes: las cantidades por
// talla del JSON quedan como referencia/fixture (PLAN §4 Rebanada 1).
// Al final valida las sumas de CT (CA-1.1, CA-1.2) y falla ruidosamente si no cuadran.
import { PrismaClient } from '@prisma/client';
import { aCentavos, formatBs } from '@taller/shared';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const prisma = new PrismaClient();

// Normalización de variantes ortográficas del Excel (solo máquinas; procesos y
// piezas se conservan tal cual — PLAN §6.4). No afecta ningún CT.
const MAPA_EQUIPOS: Record<string, string> = {
  over: 'overlock',
  overloc: 'overlock',
  rect: 'recta',
  Plancha: 'plancha',
};

interface OperacionSeed {
  orden: number;
  grupo: string;
  n: string | null;
  equipo: string;
  proceso: string;
  pieza: string | number | null;
  ct: number;
}

interface ModeloSeed {
  nombre: string;
  version: number;
  costo_mano_obra_prenda: number;
  operaciones: OperacionSeed[];
}

interface SeedData {
  configuracion: {
    tope_anticipo_advertencia: number;
    diferencial_maestro_externo: number;
    redondeo_decimales: number;
  };
  operarios_roster: { nombre: string; tipo: 'regular' | 'maestro_externo'; activo: boolean }[];
  modelos: ModeloSeed[];
}

async function main() {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const rutaSeed = path.resolve(dir, '../../docs/seed_datos_taller.json');
  const data: SeedData = JSON.parse(readFileSync(rutaSeed, 'utf-8'));

  await prisma.configuracion.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      topeAnticipoAdvertencia: aCentavos(data.configuracion.tope_anticipo_advertencia),
      diferencialMaestroExterno: aCentavos(data.configuracion.diferencial_maestro_externo),
      redondeoDecimales: data.configuracion.redondeo_decimales,
    },
  });

  for (const op of data.operarios_roster) {
    const existente = await prisma.operario.findFirst({ where: { nombre: op.nombre } });
    if (!existente) {
      await prisma.operario.create({
        data: { nombre: op.nombre, tipo: op.tipo, activo: op.activo },
      });
    }
  }

  for (const m of data.modelos) {
    const modelo = await prisma.modelo.upsert({
      where: { nombre: m.nombre },
      update: {},
      create: { nombre: m.nombre },
    });

    const versionExistente = await prisma.modeloVersion.findUnique({
      where: { modeloId_numeroVersion: { modeloId: modelo.id, numeroVersion: m.version } },
    });
    if (versionExistente) {
      console.log(`↷ ${m.nombre} v${m.version} ya existe, se omite`);
      continue;
    }

    const operaciones = m.operaciones.map((o) => ({
      orden: o.orden,
      grupo: o.grupo,
      n: o.n == null ? null : String(o.n),
      equipo: MAPA_EQUIPOS[o.equipo] ?? o.equipo,
      proceso: o.proceso,
      pieza: o.pieza == null ? null : String(o.pieza),
      ct: aCentavos(o.ct),
    }));
    const sumaCt = operaciones.reduce((acc, o) => acc + o.ct, 0);

    await prisma.modeloVersion.create({
      data: {
        modeloId: modelo.id,
        numeroVersion: m.version,
        costoManoObraPrenda: sumaCt,
        operaciones: { create: operaciones },
      },
    });
  }

  // Validación final contra el JSON (CA-1.1, CA-1.2): si no cuadra, el seed falla.
  for (const m of data.modelos) {
    const version = await prisma.modeloVersion.findFirst({
      where: { modelo: { nombre: m.nombre }, numeroVersion: m.version },
      include: { operaciones: true },
    });
    if (!version) throw new Error(`Seed inconsistente: falta ${m.nombre} v${m.version}`);
    const suma = version.operaciones.reduce((acc, o) => acc + o.ct, 0);
    const esperado = aCentavos(m.costo_mano_obra_prenda);
    if (suma !== esperado || version.costoManoObraPrenda !== esperado) {
      throw new Error(
        `Suma de CT de "${m.nombre}" no cuadra: BD=${suma}, esperado=${esperado} centavos`,
      );
    }
    console.log(
      `✓ ${m.nombre} v${m.version}: ${version.operaciones.length} operaciones, mano de obra/prenda = Bs ${formatBs(suma)}`,
    );
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
