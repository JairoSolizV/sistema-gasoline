// Mismo cliente Prisma que usa la app: bajo Vitest ya apunta a DATABASE_URL_TEST
// (ver src/lib/prisma.ts). Compartirlo evita dos pools y garantiza que tests y
// app miran la misma BD.
export { prisma } from '../../src/lib/prisma.js';
