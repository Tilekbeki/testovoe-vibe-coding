import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export const PROJECT_ROOT = path.resolve(currentDir, '../..');
export const DATA_DIR = path.join(PROJECT_ROOT, 'data');

export function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function normalizeText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

export function normalizeRating(value) {
  const text = normalizeText(value);
  if (!text || text.toUpperCase() === 'N/A') return null;
  const rating = Number(text.replace(',', '.'));
  if (!Number.isFinite(rating) || rating < 0 || rating > 5) return null;
  return Math.round(rating * 10) / 10;
}

export function normalizeReviewsCount(value) {
  const text = normalizeText(value);
  if (!text) return 0;
  const count = Number.parseInt(text, 10);
  return Number.isFinite(count) && count >= 0 ? count : 0;
}

export function normalizeSite(value) {
  const text = normalizeText(value);
  if (!text) return null;
  if (!/^https?:\/\//i.test(text)) return null;
  try {
    const url = new URL(text);
    return url.href.replace(/\/$/, '');
  } catch {
    return null;
  }
}

export function normalizeCompany(raw) {
  return {
    sourceId: normalizeText(raw.id),
    name: normalizeText(raw.name),
    category: normalizeText(raw.category),
    city: normalizeText(raw.city),
    address: normalizeText(raw.address),
    rating: normalizeRating(raw.rating),
    reviewsCount: normalizeReviewsCount(raw.reviews_count),
    site: normalizeSite(raw.site),
    phone: normalizeText(raw.phone)
  };
}

export function validateCompany(company) {
  const errors = [];
  for (const key of ['sourceId', 'name', 'category', 'city']) {
    if (!company[key]) errors.push(`missing_${key}`);
  }
  if (company.rating === null && company.reviewsCount > 0) {
    errors.push('missing_rating_with_reviews');
  }
  return errors;
}

export function naturalKey(company) {
  return [
    company.name,
    company.city,
    company.address ?? '',
    company.phone ?? ''
  ].map((value) => value.toLocaleLowerCase('ru-RU')).join('|');
}

export async function readJsonPages() {
  const files = (await fs.readdir(DATA_DIR))
    .filter((file) => /^page_\d+\.json$/.test(file))
    .sort();

  const companies = [];
  for (const file of files) {
    try {
      const payload = JSON.parse(await fs.readFile(path.join(DATA_DIR, file), 'utf8'));
      if (!Array.isArray(payload.items)) {
        throw new Error('items is not an array');
      }
      for (const item of payload.items) {
        companies.push({ file, item });
      }
    } catch (error) {
      throw new Error(`Cannot read ${file}: ${error.message}`);
    }
  }

  return companies;
}

export function parseCsv(text) {
  const rows = [];
  let current = '';
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(current);
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  row.push(current);
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  return rows;
}

export async function readReviewCsv() {
  const text = await fs.readFile(path.join(DATA_DIR, 'review.csv'), 'utf8');
  const [headers, ...rows] = parseCsv(text);
  return rows.map((row, index) => ({
    rowNumber: index + 2,
    raw: Object.fromEntries(headers.map((header, headerIndex) => [header, row[headerIndex] ?? '']))
  }));
}
