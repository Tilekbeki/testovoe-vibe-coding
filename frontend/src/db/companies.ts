import pg from 'pg';

const { Pool } = pg;

export type CompanySort =
  | 'name_asc'
  | 'name_desc'
  | 'category_asc'
  | 'category_desc'
  | 'city_asc'
  | 'city_desc'
  | 'rating_asc'
  | 'rating_desc'
  | 'reviews_asc'
  | 'reviews_desc'
  | 'site_asc'
  | 'site_desc'
  | 'phone_asc'
  | 'phone_desc';

type CompanyFilters = {
  query?: string;
  city?: string;
  category?: string;
  hasSite?: boolean;
  minReviews?: string;
  sort?: CompanySort;
};

export type CompanyRow = {
  source_id: string;
  name: string;
  category: string;
  city: string;
  address: string | null;
  rating: string | null;
  reviews_count: number;
  site: string | null;
  phone: string | null;
};

const sortSql: Record<CompanySort, string> = {
  name_asc: 'name ASC, city ASC, reviews_count DESC',
  name_desc: 'name DESC, city ASC, reviews_count DESC',
  category_asc: 'category ASC, name ASC',
  category_desc: 'category DESC, name ASC',
  city_asc: 'city ASC, name ASC',
  city_desc: 'city DESC, name ASC',
  rating_asc: 'rating::numeric ASC NULLS LAST, reviews_count DESC, name ASC',
  rating_desc: 'rating::numeric DESC NULLS LAST, reviews_count DESC, name ASC',
  reviews_asc: 'reviews_count ASC, rating DESC NULLS LAST, name ASC',
  reviews_desc: 'reviews_count DESC, rating DESC NULLS LAST, name ASC',
  site_asc: 'site ASC NULLS LAST, name ASC',
  site_desc: 'site DESC NULLS LAST, name ASC',
  phone_asc: 'phone ASC NULLS LAST, name ASC',
  phone_desc: 'phone DESC NULLS LAST, name ASC'
};

let pool: pg.Pool | null = null;

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 10_000
  });

  return pool;
}

export async function fetchCompanies(filters: CompanyFilters): Promise<CompanyRow[]> {
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (filters.query) {
    params.push(`%${filters.query}%`);
    where.push(`name ILIKE $${params.length}`);
  }

  if (filters.city) {
    params.push(filters.city);
    where.push(`city = $${params.length}`);
  }

  if (filters.category) {
    params.push(filters.category);
    where.push(`category = $${params.length}`);
  }

  if (filters.hasSite) {
    where.push('site IS NOT NULL');
  }

  if (filters.minReviews) {
    const minReviews = Number.parseInt(filters.minReviews, 10);
    if (Number.isFinite(minReviews) && minReviews >= 0) {
      params.push(minReviews);
      where.push(`reviews_count >= $${params.length}`);
    }
  }

  const orderBy = sortSql[filters.sort ?? 'reviews_desc'];
  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await getPool().query<CompanyRow>(
    `SELECT source_id, name, category, city, address, rating::text, reviews_count, site, phone
     FROM companies
     ${whereSql}
     ORDER BY ${orderBy}
     LIMIT 100`,
    params
  );

  return rows;
}

export async function fetchCities(): Promise<string[]> {
  const { rows } = await getPool().query<{ city: string }>(
    'SELECT DISTINCT city FROM companies ORDER BY city'
  );
  return rows.map((row) => row.city);
}

export async function fetchCategories(): Promise<string[]> {
  const { rows } = await getPool().query<{ category: string }>(
    'SELECT DISTINCT category FROM companies ORDER BY category'
  );
  return rows.map((row) => row.category);
}
