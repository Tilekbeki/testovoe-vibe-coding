import Link from 'next/link';
import { fetchCategories, fetchCities, fetchCompanies, type CompanySort } from '../../src/db/companies';

type CompaniesPageProps = {
  searchParams: Promise<{
    q?: string;
    city?: string;
    category?: string;
    hasSite?: string;
    minReviews?: string;
    sort?: string;
  }>;
};

type SortColumn = {
  key: string;
  label: string;
  defaultDirection: 'asc' | 'desc';
};

const defaultSort: CompanySort = 'reviews_desc';

const sortColumns: SortColumn[] = [
  { key: 'name', label: 'Компания', defaultDirection: 'asc' },
  { key: 'category', label: 'Категория', defaultDirection: 'asc' },
  { key: 'city', label: 'Город', defaultDirection: 'asc' },
  { key: 'rating', label: 'Рейтинг', defaultDirection: 'desc' },
  { key: 'reviews', label: 'Отзывы', defaultDirection: 'desc' },
  { key: 'site', label: 'Сайт', defaultDirection: 'desc' },
  { key: 'phone', label: 'Телефон', defaultDirection: 'asc' }
];

const sortLabels: Record<CompanySort, string> = {
  name_asc: 'Компания А-Я',
  name_desc: 'Компания Я-А',
  category_asc: 'Категория А-Я',
  category_desc: 'Категория Я-А',
  city_asc: 'Город А-Я',
  city_desc: 'Город Я-А',
  rating_asc: 'Рейтинг ниже',
  rating_desc: 'Рейтинг выше',
  reviews_asc: 'Меньше отзывов',
  reviews_desc: 'Больше отзывов',
  site_asc: 'Без сайта сначала',
  site_desc: 'С сайтом сначала',
  phone_asc: 'Телефон А-Я',
  phone_desc: 'Телефон Я-А'
};

function parseMinReviews(value: string | undefined) {
  const number = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(number) || number < 0) return '';
  return String(number);
}

function parseSort(value: string | undefined): CompanySort {
  return value && value in sortLabels ? (value as CompanySort) : defaultSort;
}

function getSortParts(sort: CompanySort) {
  const separatorIndex = sort.lastIndexOf('_');
  return {
    key: sort.slice(0, separatorIndex),
    direction: sort.slice(separatorIndex + 1) as 'asc' | 'desc'
  };
}

function buildSortHref(
  column: SortColumn,
  currentSort: CompanySort,
  filters: { query: string; city: string; category: string; hasSite: boolean; minReviews: string }
) {
  const current = getSortParts(currentSort);
  const nextDirection =
    current.key === column.key
      ? current.direction === 'asc'
        ? 'desc'
        : 'asc'
      : column.defaultDirection;

  const params = new URLSearchParams();
  if (filters.query) params.set('q', filters.query);
  if (filters.city) params.set('city', filters.city);
  if (filters.category) params.set('category', filters.category);
  if (filters.minReviews) params.set('minReviews', filters.minReviews);
  if (filters.hasSite) params.set('hasSite', '1');
  params.set('sort', `${column.key}_${nextDirection}`);

  return `/companies?${params.toString()}`;
}

function getAriaSort(columnKey: string, currentSort: CompanySort) {
  const current = getSortParts(currentSort);
  if (current.key !== columnKey) return 'none';
  return current.direction === 'asc' ? 'ascending' : 'descending';
}

function getSortMark(columnKey: string, currentSort: CompanySort) {
  const current = getSortParts(currentSort);
  if (current.key !== columnKey) return '↕';
  if (columnKey === 'rating') return current.direction === 'asc' ? '1→5' : '5→1';
  if (columnKey === 'reviews') return current.direction === 'asc' ? '0→9' : '9→0';
  return current.direction === 'asc' ? '↑' : '↓';
}

export default async function CompaniesPage({ searchParams }: CompaniesPageProps) {
  const params = await searchParams;
  const query = (params.q ?? '').trim();
  const city = (params.city ?? '').trim();
  const category = (params.category ?? '').trim();
  const hasSite = params.hasSite === '1';
  const minReviews = parseMinReviews(params.minReviews);
  const sort = parseSort(params.sort);
  const filters = { query, city, category, hasSite, minReviews };

  const [companiesResult, citiesResult, categoriesResult] = await Promise.allSettled([
    fetchCompanies({ ...filters, sort }),
    fetchCities(),
    fetchCategories()
  ]);

  const companies = companiesResult.status === 'fulfilled' ? companiesResult.value : [];
  const cities = citiesResult.status === 'fulfilled' ? citiesResult.value : [];
  const categories = categoriesResult.status === 'fulfilled' ? categoriesResult.value : [];
  const dbError =
    companiesResult.status === 'rejected' ||
    citiesResult.status === 'rejected' ||
    categoriesResult.status === 'rejected'
      ? 'Не удалось получить данные из Postgres. Проверьте DATABASE_URL и запуск миграции.'
      : null;

  const hasActiveFilters = Boolean(query || city || category || hasSite || minReviews);
  const hasActiveState = hasActiveFilters || sort !== defaultSort;

  return (
    <main className="page-shell">
      <section className="toolbar-band">
        <div>
          <p className="eyebrow">Polza Agency</p>
          <h1>Компании</h1>
        </div>
      </section>

      <section className="controls-panel" aria-label="Фильтры">
        <form className="filters" action="/companies">
          <input type="hidden" name="sort" value={sort} />
          <label>
            <span>Поиск</span>
            <input name="q" placeholder="Название компании" defaultValue={query} />
          </label>
          <label>
            <span>Город</span>
            <select name="city" defaultValue={city}>
              <option value="">Все города</option>
              {cities.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Категория</span>
            <select name="category" defaultValue={category}>
              <option value="">Все категории</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Мин. отзывов</span>
            <input name="minReviews" type="number" min="0" step="1" defaultValue={minReviews} />
          </label>
          <label className="checkbox-field">
            <input name="hasSite" type="checkbox" value="1" defaultChecked={hasSite} />
            <span>Только с сайтом</span>
          </label>
          <button type="submit">Применить</button>
          {hasActiveState && (
            <Link className="reset-link" href="/companies">
              Сбросить
            </Link>
          )}
        </form>
      </section>

      {dbError && <div className="notice">{dbError}</div>}

      <section className="summary-row" aria-label="Сводка">
        <div>
          <span>Показано</span>
          <strong>{companies.length}</strong>
        </div>
        <div>
          <span>Фильтры</span>
          <strong>{hasActiveFilters ? 'применены' : 'нет'}</strong>
        </div>
        <div>
          <span>Сортировка</span>
          <strong>{sortLabels[sort]}</strong>
        </div>
      </section>

      <section className="table-wrap">
        <table>
          <thead>
            <tr>
              {sortColumns.map((column) => (
                <th key={column.key} aria-sort={getAriaSort(column.key, sort)}>
                  <Link className="sort-link" href={buildSortHref(column, sort, filters)}>
                    <span>{column.label}</span>
                    <span className="sort-mark">{getSortMark(column.key, sort)}</span>
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {companies.map((company) => (
              <tr key={company.source_id}>
                <td>
                  <strong>{company.name}</strong>
                  <span>{company.address ?? 'Адрес не указан'}</span>
                </td>
                <td>{company.category}</td>
                <td>{company.city}</td>
                <td>{company.rating ?? 'нет'}</td>
                <td>{company.reviews_count}</td>
                <td>
                  {company.site ? (
                    <a href={company.site} target="_blank" rel="noreferrer">
                      открыть
                    </a>
                  ) : (
                    'нет'
                  )}
                </td>
                <td>{company.phone ?? 'нет'}</td>
              </tr>
            ))}
            {companies.length === 0 && (
              <tr>
                <td className="empty" colSpan={7}>
                  Ничего не найдено
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
