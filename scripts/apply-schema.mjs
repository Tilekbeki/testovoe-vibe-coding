import fs from 'node:fs/promises';
import path from 'node:path';
import { createPool } from './lib/db.mjs';
import { PROJECT_ROOT } from './lib/data-utils.mjs';

const pool = createPool();

try {
  const schemaSql = await fs.readFile(path.join(PROJECT_ROOT, 'db/schema.sql'), 'utf8');
  await pool.query(schemaSql);
  console.log('Schema applied successfully');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
