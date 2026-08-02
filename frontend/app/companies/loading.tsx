export default function CompaniesLoading() {
  return (
    <main className="page-shell">
      <section className="toolbar-band">
        <div>
          <p className="eyebrow">Polza Agency</p>
          <h1>Компании</h1>
        </div>
      </section>

      <section className="loading-state" aria-live="polite" aria-label="Загрузка компаний">
        <div className="spinner" />
        <div>
          <strong>Загружаем компании</strong>
          <span>Получаем данные из Postgres</span>
        </div>
      </section>

      <section className="summary-row" aria-hidden="true">
        <div className="skeleton-block" />
        <div className="skeleton-block" />
        <div className="skeleton-block" />
      </section>

      <section className="table-wrap loading-table" aria-hidden="true">
        {Array.from({ length: 7 }).map((_, index) => (
          <div className="skeleton-row" key={index}>
            <span />
            <span />
            <span />
            <span />
          </div>
        ))}
      </section>
    </main>
  );
}
