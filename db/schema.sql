CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS companies (
  source_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT,
  rating NUMERIC(2, 1) CHECK (rating IS NULL OR rating BETWEEN 0 AND 5),
  reviews_count INTEGER NOT NULL DEFAULT 0 CHECK (reviews_count >= 0),
  site TEXT CHECK (site IS NULL OR site ~* '^https?://'),
  phone TEXT,
  source TEXT NOT NULL DEFAULT 'api_json',
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS companies_natural_unique_idx
  ON companies (
    lower(name),
    lower(city),
    lower(coalesce(address, '')),
    lower(coalesce(phone, ''))
  );

CREATE INDEX IF NOT EXISTS companies_city_idx ON companies (city);
CREATE INDEX IF NOT EXISTS companies_category_idx ON companies (category);
CREATE INDEX IF NOT EXISTS companies_name_trgm_idx ON companies USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS companies_has_site_idx ON companies (category) WHERE site IS NOT NULL;
CREATE INDEX IF NOT EXISTS companies_rating_reviews_idx ON companies (city, reviews_count, rating);

CREATE TABLE IF NOT EXISTS review_import_rows (
  id BIGSERIAL PRIMARY KEY,
  source_id TEXT,
  name TEXT,
  category TEXT,
  city TEXT,
  address TEXT,
  rating NUMERIC(2, 1),
  reviews_count INTEGER,
  site TEXT,
  phone TEXT,
  row_number INTEGER NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS import_anomalies (
  id BIGSERIAL PRIMARY KEY,
  import_name TEXT NOT NULL,
  row_number INTEGER,
  source_id TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error')),
  anomaly_type TEXT NOT NULL,
  details TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
