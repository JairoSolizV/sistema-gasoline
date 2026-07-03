// Único cliente Prisma del server; solo los repositories lo importan (ARQUITECTURA §2.1).
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
