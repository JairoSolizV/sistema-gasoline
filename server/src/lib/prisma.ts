// Único cliente Prisma del server; solo los repositories lo importan (ARQUITECTURA §2.1).
// Bajo Vitest apunta a DATABASE_URL_TEST para que los tests de integración
// (supertest sobre la app real) nunca toquen la BD de desarrollo.
import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

// server/.env por ruta absoluta: funciona sin importar desde qué cwd se ejecute.
config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env') });

const url = process.env.VITEST ? process.env.DATABASE_URL_TEST : process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    process.env.VITEST
      ? 'DATABASE_URL_TEST no definida en server/.env'
      : 'DATABASE_URL no definida en server/.env',
  );
}

export const prisma = new PrismaClient({ datasourceUrl: url });
