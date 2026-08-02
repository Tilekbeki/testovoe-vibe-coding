import { createPool, insertAnomaly, upsertCompany, withTransaction } from './lib/db.mjs';
import { naturalKey, normalizeCompany, readJsonPages, validateCompany } from './lib/data-utils.mjs';

const pool = createPool();

try {
  const rows = await readJsonPages();
  const seenSourceIds = new Set();
  const seenNaturalKeys = new Set();
  const stats = { read: rows.length, insertedOrUpdated: 0, skipped: 0, anomalies: 0 };

  await withTransaction(pool, async (client) => {
    for (const [index, row] of rows.entries()) {
      const company = normalizeCompany(row.item);
      const validationErrors = validateCompany(company);
      const rowNumber = index + 1;

      if (validationErrors.length > 0) {
        stats.skipped += 1;
        stats.anomalies += 1;
        await insertAnomaly(client, {
          importName: 'api_json',
          rowNumber,
          sourceId: company.sourceId,
          severity: 'error',
          type: 'invalid_company',
          details: `${row.file}: ${validationErrors.join(', ')}`
        });
        continue;
      }

      if (seenSourceIds.has(company.sourceId)) {
        stats.skipped += 1;
        stats.anomalies += 1;
        await insertAnomaly(client, {
          importName: 'api_json',
          rowNumber,
          sourceId: company.sourceId,
          severity: 'warning',
          type: 'duplicate_source_id_in_batch',
          details: `${row.file}: duplicate source id ${company.sourceId}`
        });
        continue;
      }

      const key = naturalKey(company);
      if (seenNaturalKeys.has(key)) {
        stats.skipped += 1;
        stats.anomalies += 1;
        await insertAnomaly(client, {
          importName: 'api_json',
          rowNumber,
          sourceId: company.sourceId,
          severity: 'warning',
          type: 'duplicate_natural_key_in_batch',
          details: `${row.file}: same name, city, address and phone`
        });
        continue;
      }

      try {
        await upsertCompany(client, company, 'api_json');
        seenSourceIds.add(company.sourceId);
        seenNaturalKeys.add(key);
        stats.insertedOrUpdated += 1;
      } catch (error) {
        stats.skipped += 1;
        stats.anomalies += 1;
        await insertAnomaly(client, {
          importName: 'api_json',
          rowNumber,
          sourceId: company.sourceId,
          severity: 'error',
          type: error.code === '23505' ? 'duplicate_in_database' : 'database_error',
          details: error.message
        });
      }
    }
  });

  console.log(`Было прочитано записей из JSON: ${stats.read}.`);
  console.log(`Успешно добавлено или обновлено компаний: ${stats.insertedOrUpdated}.`);
  console.log(`Пропущено проблемных или дублирующихся строк: ${stats.skipped}.`);
  console.log(`Зафиксировано аномалий в import_anomalies: ${stats.anomalies}.`);
  console.table(stats);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
