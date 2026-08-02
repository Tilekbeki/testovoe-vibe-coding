import { createPool, insertAnomaly, upsertCompany, withTransaction } from './lib/db.mjs';
import { naturalKey, normalizeCompany, readReviewCsv, validateCompany } from './lib/data-utils.mjs';

const pool = createPool();

function detectCsvAnomalies(company, raw, rowNumber) {
  const anomalies = [];

  if (raw.rating?.trim().toUpperCase() === 'N/A') {
    anomalies.push({
      severity: 'warning',
      type: 'rating_na',
      details: 'rating is N/A and was stored as NULL'
    });
  }

  if (raw.rating?.includes(',')) {
    anomalies.push({
      severity: 'info',
      type: 'rating_comma_decimal',
      details: `rating "${raw.rating}" uses comma decimal separator`
    });
  }

  if (raw.site?.trim() === '') {
    anomalies.push({
      severity: 'info',
      type: 'empty_site',
      details: 'site is empty and was stored as NULL'
    });
  }

  if (raw.phone?.trim() === '') {
    anomalies.push({
      severity: 'warning',
      type: 'empty_phone',
      details: 'phone is empty'
    });
  }

  if (company.sourceId && /^c_(\d+)$/.test(company.sourceId)) {
    const numericId = Number(company.sourceId.slice(2));
    if (numericId > 1000) {
      anomalies.push({
        severity: 'warning',
        type: 'unexpected_new_source_id',
        details: 'id is outside original page_001..page_020 range'
      });
    }
  }

  return anomalies.map((anomaly) => ({
    ...anomaly,
    importName: 'review_csv',
    rowNumber,
    sourceId: company.sourceId
  }));
}

try {
  const rows = await readReviewCsv();
  const seenSourceIds = new Set();
  const seenNaturalKeys = new Set();
  const stats = { read: rows.length, insertedOrUpdated: 0, staged: 0, skipped: 0, anomalies: 0 };

  await withTransaction(pool, async (client) => {
    for (const { rowNumber, raw } of rows) {
      const company = normalizeCompany(raw);
      const validationErrors = validateCompany(company);
      const anomalies = detectCsvAnomalies(company, raw, rowNumber);

      for (const anomaly of anomalies) {
        stats.anomalies += 1;
        await insertAnomaly(client, anomaly);
      }

      await client.query(
        `INSERT INTO review_import_rows (
          source_id, name, category, city, address, rating, reviews_count, site, phone, row_number
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
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
          rowNumber
        ]
      );
      stats.staged += 1;

      if (validationErrors.length > 0) {
        stats.skipped += 1;
        stats.anomalies += 1;
        await insertAnomaly(client, {
          importName: 'review_csv',
          rowNumber,
          sourceId: company.sourceId,
          severity: 'error',
          type: 'invalid_company',
          details: validationErrors.join(', ')
        });
        continue;
      }

      if (seenSourceIds.has(company.sourceId)) {
        stats.skipped += 1;
        stats.anomalies += 1;
        await insertAnomaly(client, {
          importName: 'review_csv',
          rowNumber,
          sourceId: company.sourceId,
          severity: 'warning',
          type: 'duplicate_source_id_in_csv',
          details: 'same id appears more than once in review.csv'
        });
        continue;
      }

      const key = naturalKey(company);
      if (seenNaturalKeys.has(key)) {
        stats.skipped += 1;
        stats.anomalies += 1;
        await insertAnomaly(client, {
          importName: 'review_csv',
          rowNumber,
          sourceId: company.sourceId,
          severity: 'warning',
          type: 'duplicate_natural_key_in_csv',
          details: 'same name, city, address and phone appears more than once in review.csv'
        });
        continue;
      }

      try {
        await upsertCompany(client, company, 'review_csv');
        seenSourceIds.add(company.sourceId);
        seenNaturalKeys.add(key);
        stats.insertedOrUpdated += 1;
      } catch (error) {
        stats.skipped += 1;
        stats.anomalies += 1;
        await insertAnomaly(client, {
          importName: 'review_csv',
          rowNumber,
          sourceId: company.sourceId,
          severity: 'error',
          type: error.code === '23505' ? 'duplicate_in_database' : 'database_error',
          details: error.message
        });
      }
    }
  });

  console.log(`Было прочитано строк из review.csv: ${stats.read}.`);
  console.log(`Строк сохранено в staging-таблицу review_import_rows: ${stats.staged}.`);
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
