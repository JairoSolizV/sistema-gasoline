// Antes de la suite: migra y seedea la BD de TEST (DATABASE_URL_TEST).
import { execSync } from 'node:child_process';
import { config } from 'dotenv';

export default function setup() {
  config({ path: '.env' });
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error('DATABASE_URL_TEST no definida en server/.env');
  const env = { ...process.env, DATABASE_URL: url };
  execSync('npx prisma migrate deploy', { env, stdio: 'inherit' });
  execSync('npx tsx prisma/seed.ts', { env, stdio: 'inherit' });
}
