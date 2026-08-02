-- 1. Top-5 categories by number of companies.
SELECT
  category,
  count(*) AS companies_count
FROM companies
GROUP BY category
ORDER BY companies_count DESC, category
LIMIT 5;

-- 2. Average rating by city among companies with 10+ reviews.
SELECT
  city,
  round(avg(rating), 2) AS average_rating,
  count(*) AS companies_count
FROM companies
WHERE reviews_count >= 10
  AND rating IS NOT NULL
GROUP BY city
ORDER BY average_rating DESC, companies_count DESC, city;

-- 3. Share of companies with a website by category.
SELECT
  category,
  count(*) AS companies_count,
  count(*) FILTER (WHERE site IS NOT NULL) AS with_site_count,
  round(count(*) FILTER (WHERE site IS NOT NULL)::numeric / nullif(count(*), 0), 4) AS with_site_share
FROM companies
GROUP BY category
ORDER BY with_site_share DESC, companies_count DESC, category;
