// CA-1.1 y CA-1.2: los costos de mano de obra por prenda del seed deben dar
// exactamente 8.10, 5.97, 7.68, 6.29 y 7.18 Bs (en centavos: 810, 597, 768, 629, 718).
import { afterAll, describe, expect, test } from 'vitest';
import { prisma } from './helpers/db.js';

const MODELOS_ESPERADOS = [
  { nombre: 'black DOBLE PRET 06', centavos: 810, operaciones: 47 }, // CA-1.1
  { nombre: 'black SHORT 16', centavos: 597 }, // CA-1.2
  { nombre: 'black SH FALD 20', centavos: 768 },
  { nombre: 'CRUDO SHORT', centavos: 629 },
  { nombre: 'SHORT 2 PRETIN', centavos: 718 },
];

afterAll(async () => {
  await prisma.$disconnect();
});

describe('CA-1.1 / CA-1.2 — suma de CT por modelo (seed)', () => {
  for (const esperado of MODELOS_ESPERADOS) {
    test(`${esperado.nombre} v1 suma ${esperado.centavos} centavos`, async () => {
      const version = await prisma.modeloVersion.findFirst({
        where: { modelo: { nombre: esperado.nombre }, numeroVersion: 1 },
        include: { operaciones: true },
      });
      expect(version, `modelo "${esperado.nombre}" no está seedeado`).not.toBeNull();
      const suma = version!.operaciones.reduce((acc, op) => acc + op.ct, 0);
      expect(suma).toBe(esperado.centavos);
      expect(version!.costoManoObraPrenda).toBe(esperado.centavos);
      if (esperado.operaciones) {
        expect(version!.operaciones.length).toBe(esperado.operaciones);
      }
    });
  }
});

describe('seed — operarios y configuración', () => {
  test('los 13 operarios del roster están activos y regulares', async () => {
    const operarios = await prisma.operario.findMany({ where: { activo: true } });
    expect(operarios.length).toBe(13);
    expect(operarios.every((o) => o.tipo === 'regular')).toBe(true);
    expect(operarios.map((o) => o.nombre)).toContain('RUBEN');
    expect(operarios.map((o) => o.nombre)).toContain('CHEMA');
  });

  test('configuración: tope 2000.00 Bs y diferencial 0.10 Bs (en centavos)', async () => {
    const config = await prisma.configuracion.findUnique({ where: { id: 1 } });
    expect(config).not.toBeNull();
    expect(config!.topeAnticipoAdvertencia).toBe(200000);
    expect(config!.diferencialMaestroExterno).toBe(10);
  });

  test('el seed es idempotente: no duplica al re-ejecutarse (verificado por conteos)', async () => {
    // global-setup ya corrió el seed sobre una BD que puede venir seedeada de
    // una corrida anterior: si duplicara, estos conteos explotarían.
    expect(await prisma.operario.count()).toBe(13);
    expect(await prisma.modelo.count()).toBe(5);
    expect(await prisma.modeloVersion.count()).toBe(5);
  });
});
