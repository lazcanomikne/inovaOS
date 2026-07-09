// Ejecuta las migraciones/seed contra Turso (libSQL).
//   npm run db:migrate   → aplica esquema (0001)
//   npm run db:seed      → aplica esquema + datos de ejemplo (0001 + 0002)
//
// Requiere en el entorno (o en .env):
//   TURSO_DATABASE_URL=libsql://...
//   TURSO_AUTH_TOKEN=...
import { createClient } from '@libsql/client';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const seed = process.argv.includes('--seed');

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error('✗ Falta TURSO_DATABASE_URL (ponlo en .env o expórtalo).');
  process.exit(1);
}

const client = createClient({ url, authToken });

const archivos = ['0001_init.sql'];
if (seed) archivos.push('0002_seed.sql');

for (const archivo of archivos) {
  const sql = readFileSync(join(__dirname, '..', 'migrations', archivo), 'utf8');
  process.stdout.write(`→ Aplicando ${archivo}… `);
  await client.executeMultiple(sql);
  console.log('OK');
}

console.log(seed ? '✓ Esquema + datos aplicados.' : '✓ Esquema aplicado.');
