/**
 * Универсальная таблица данных с пагинацией, поиском и действиями.
 *
 * Props:
 *   columns   — массив { key, label, render?, className? }
 *   rows      — массив объектов
 *   loading   — boolean
 *   error     — string | null
 *   emptyIcon — emoji/string (default '📄')
 *   emptyText — string
 *   actions   — (row) => ReactNode  (правая колонка «Действия»)
 *   // Поиск
 *   search    — string
 *   onSearch  — (value) => void
 *   searchPlaceholder — string
 *   // Пагинация
 *   page       — number
 *   totalCount — number
 *   pageSize   — number
 *   onPage     — (n) => void
 *   // Доп. фильтры (рендерятся рядом с поиском)
 *   filters   — ReactNode
 *   // Кнопки в шапке
 *   headerRight — ReactNode
 *   title     — string
 *   subtitle  — string
 */
export default function DataTable({
  columns = [],
  rows = [],
  loading = false,
  error = null,
  emptyIcon = '📄',
  emptyText = 'Данных нет',
  actions,
  search,
  onSearch,
  searchPlaceholder = 'Поиск...',
  page = 1,
  totalCount = 0,
  pageSize = 20,
  onPage,
  filters,
  headerRight,
  title,
  subtitle,
  onRowClick,
}) {
  const totalPages = Math.ceil(totalCount / pageSize);
  const showPagination = onPage && totalPages > 1;

  return (
    <div>
      {/* Заголовок */}
      {(title || headerRight) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-xl font-bold text-gray-900">{title}</h2>}
            {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          {headerRight && <div className="shrink-0">{headerRight}</div>}
        </div>
      )}

      {/* Поиск + фильтры */}
      {(onSearch || filters) && (
        <div className="mb-3 flex flex-wrap gap-2">
          {onSearch && (
            <input
              type="text"
              value={search ?? ''}
              onChange={(e) => onSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          )}
          {filters}
        </div>
      )}

      {/* Ошибка */}
      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Таблица */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 flex items-center justify-center">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <span className="animate-spin inline-block w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full" />
            Загрузка...
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-5xl mb-3">{emptyIcon}</div>
          <p className="text-gray-500 text-sm">{emptyText}</p>
        </div>
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {rows.map((row, idx) => (
              <div
                key={row.id ?? idx}
                className={`bg-white rounded-xl border border-gray-200 p-3 ${onRowClick ? 'cursor-pointer' : ''}`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                <div className="space-y-2">
                  {columns.map((col, cidx) => (
                    <div key={col.key} className="grid grid-cols-[110px_1fr] gap-2 items-start">
                      <div className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold pt-0.5">
                        {col.label}
                      </div>
                      <div className={`text-sm text-gray-800 min-w-0 ${cidx === 0 ? 'font-medium text-gray-900' : ''}`}>
                        {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                      </div>
                    </div>
                  ))}
                </div>
                {actions && (
                  <div
                    className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {actions(row)}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={`px-4 py-3 text-left font-semibold ${col.headerClass || ''}`}
                    >
                      {col.label}
                    </th>
                  ))}
                  {actions && (
                    <th className="px-4 py-3 text-right font-semibold">Действия</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row, idx) => (
                  <tr
                    key={row.id ?? idx}
                    className={`hover:bg-gray-50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={`px-4 py-3 ${col.className || ''}`}>
                        {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                      </td>
                    ))}
                    {actions && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1.5">{actions(row)}</div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

          </div>
        </>
      )}

      {/* Пагинация */}
      {showPagination && !loading && rows.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-4 py-3 border border-gray-200 rounded-xl bg-white">
          <span className="text-xs text-gray-500">
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} из {totalCount}
          </span>
          <div className="flex items-center gap-1">
            <PageBtn disabled={page <= 1} onClick={() => onPage(page - 1)}>←</PageBtn>
            {buildPageRange(page, totalPages).map((p, i) =>
              p === '...' ? (
                <span key={`ellipsis-${i}`} className="px-2 text-gray-400 text-xs">…</span>
              ) : (
                <PageBtn key={p} active={p === page} onClick={() => onPage(p)}>{p}</PageBtn>
              )
            )}
            <PageBtn disabled={page >= totalPages} onClick={() => onPage(page + 1)}>→</PageBtn>
          </div>
        </div>
      )}
    </div>
  );
}

function PageBtn({ children, disabled, active, onClick }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`px-2.5 py-1 text-xs rounded border transition-colors ${
        active
          ? 'bg-blue-600 text-white border-blue-600'
          : 'border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed'
      }`}
    >
      {children}
    </button>
  );
}

function buildPageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push('...');
    result.push(sorted[i]);
  }
  return result;
}
