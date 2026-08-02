'use client';

export default function CompaniesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="page-shell">
      <section className="toolbar-band">
        <div>
          <p className="eyebrow">Polza Agency</p>
          <h1>Компании</h1>
        </div>
      </section>

      <section className="error-state" role="alert">
        <div>
          <strong>Не удалось загрузить компании</strong>
          <span>Проверьте подключение к Postgres и переменную DATABASE_URL.</span>
        </div>
        <button type="button" onClick={reset}>
          Повторить
        </button>
      </section>
    </main>
  );
}
