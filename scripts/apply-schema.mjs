import fs from 'node:fs/promises';
import path from 'node:path';
import { createPool } from './lib/db.mjs';

const pool = createPool();

try {
  const schemaSql = await fs.readFile(path.resolve(process.cwd(), 'db/schema.sql'), 'utf8');
  await pool.query(schemaSql);
  console.log('Schema applied successfully');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
