// Cliente Prisma apuntado a la BD de TEST para toda la suite.
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config({ path: '.env' });

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error('DATABASE_URL_TEST no definida en server/.env');

export const prisma = new PrismaClient({ datasourceUrl: url });
