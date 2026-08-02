import { naturalKey, normalizeCompany, readJsonPages, readReviewCsv } from './lib/data-utils.mjs';

const jsonRows = await readJsonPages();
const jsonCompanies = jsonRows.map(({ item }) => normalizeCompany(item));
const reviewRows = await readReviewCsv();
const reviewCompanies = reviewRows.map(({ raw, rowNumber }) => ({
  rowNumber,
  raw,
  company: normalizeCompany(raw)
}));

const jsonIds = new Set(jsonCompanies.map((company) => company.sourceId));
const jsonNaturalKeys = new Set(jsonCompanies.map(naturalKey));
const csvIds = new Map();
const csvNaturalKeys = new Map();
const jsonIdRows = new Map();
const anomalies = [];

for (const [index, company] of jsonCompanies.entries()) {
  const rowNumber = index + 1;
  if (jsonIdRows.has(company.sourceId)) {
    anomalies.push({
      rowNumber,
      sourceId: company.sourceId,
      type: 'duplicate_id_in_json_pages',
      firstRow: jsonIdRows.get(company.sourceId)
    });
  }
  jsonIdRows.set(company.sourceId, rowNumber);
}

for (const { rowNumber, raw, company } of reviewCompanies) {
  if (!jsonIds.has(company.sourceId)) {
    anomalies.push({ rowNumber, sourceId: company.sourceId, type: 'id_not_in_json_pages' });
  }

  if (company.sourceId && csvIds.has(company.sourceId)) {
    anomalies.push({ rowNumber, sourceId: company.sourceId, type: 'duplicate_id_in_csv', firstRow: csvIds.get(company.sourceId) });
  }
  csvIds.set(company.sourceId, rowNumber);

  const key = naturalKey(company);
  if (csvNaturalKeys.has(key)) {
    anomalies.push({ rowNumber, sourceId: company.sourceId, type: 'duplicate_natural_key_in_csv', firstRow: csvNaturalKeys.get(key) });
  }
  csvNaturalKeys.set(key, rowNumber);

  if (jsonNaturalKeys.has(key) && !jsonIds.has(company.sourceId)) {
    anomalies.push({ rowNumber, sourceId: company.sourceId, type: 'same_company_different_id' });
  }

  if (raw.rating?.trim().toUpperCase() === 'N/A') {
    anomalies.push({ rowNumber, sourceId: company.sourceId, type: 'rating_na' });
  }

  if (raw.rating?.includes(',')) {
    anomalies.push({ rowNumber, sourceId: company.sourceId, type: 'rating_comma_decimal', value: raw.rating });
  }

  if (!raw.site?.trim()) {
    anomalies.push({ rowNumber, sourceId: company.sourceId, type: 'empty_site' });
  }

  if (!raw.phone?.trim()) {
    anomalies.push({ rowNumber, sourceId: company.sourceId, type: 'empty_phone' });
  }
}

const summary = {
  jsonRows: jsonCompanies.length,
  jsonUniqueIds: jsonIds.size,
  reviewRows: reviewCompanies.length,
  reviewUniqueIds: csvIds.size,
  idsAlreadyInJson: reviewCompanies.filter(({ company }) => jsonIds.has(company.sourceId)).length,
  idsMissingFromJson: reviewCompanies.filter(({ company }) => !jsonIds.has(company.sourceId)).length,
  anomalyCounts: anomalies.reduce((acc, anomaly) => {
    acc[anomaly.type] = (acc[anomaly.type] ?? 0) + 1;
    return acc;
  }, {})
};

const jsonDuplicateIds = summary.jsonRows - summary.jsonUniqueIds;
const reviewDuplicateIds = summary.reviewRows - summary.reviewUniqueIds;

console.log(`Было прочитано записей из JSON: ${summary.jsonRows}.`);
console.log(`Уникальных id в JSON: ${summary.jsonUniqueIds}. Дубликатов id в JSON: ${jsonDuplicateIds}.`);
console.log(`Было прочитано строк из review.csv: ${summary.reviewRows}.`);
console.log(`Уникальных id в review.csv: ${summary.reviewUniqueIds}. Дубликатов id в review.csv: ${reviewDuplicateIds}.`);
console.log(`Строк review.csv, которые уже есть в JSON по id: ${summary.idsAlreadyInJson}.`);
console.log(`Строк review.csv с id, которых нет в JSON: ${summary.idsMissingFromJson}.`);
console.log('Краткий смысл: review.csv похож не на обычное обновление той же базы, а на смешанную или перепутанную выгрузку.');
console.log('Подробная машинная сводка ниже:');
console.log(JSON.stringify({ summary, firstAnomalies: anomalies.slice(0, 25) }, null, 2));
