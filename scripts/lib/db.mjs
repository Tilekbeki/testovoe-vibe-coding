import pg from 'pg';
import { requiredEnv } from './data-utils.mjs';

const { Pool } = pg;

export function createPool() {
  return new Pool({
    connectionString: requiredEnv('DATABASE_URL'),
    max: 5,
    idleTimeoutMillis: 10_000
  });
}

export async function withTransaction(pool, callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function upsertCompany(client, company, source) {
  await client.query(
    `INSERT INTO companies (
      source_id, name, category, city, address, rating, reviews_count, site, phone, source
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (source_id) DO UPDATE SET
      name = EXCLUDED.name,
      category = EXCLUDED.category,
      city = EXCLUDED.city,
      address = EXCLUDED.address,
      rating = EXCLUDED.rating,
      reviews_count = EXCLUDED.reviews_count,
      site = EXCLUDED.site,
      phone = EXCLUDED.phone,
      source = EXCLUDED.source,
      updated_at = now()`,
    [
      company.sourceId,
      company.name,
      company.category,
      company.city,
      company.address,
      company.rating,
      company.reviewsCount,
      company.site,
      company.phone,
      source
    ]
  );
}

export async function insertAnomaly(client, anomaly) {
  await client.query(
    `INSERT INTO import_anomalies (
      import_name, row_number, source_id, severity, anomaly_type, details
    ) VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      anomaly.importName,
      anomaly.rowNumber ?? null,
      anomaly.sourceId ?? null,
      anomaly.severity,
      anomaly.type,
      anomaly.details
    ]
  );
}
