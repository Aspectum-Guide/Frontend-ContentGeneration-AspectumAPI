import Alert from './Alert';
import Card from './Card';
import EmptyState from './EmptyState';
import { TextInput } from './FormField';
import Spinner from './Spinner';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
  isFiltered = false,
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
            {title && <h2 className="text-xl font-bold text-aspectum-text">{title}</h2>}
            {subtitle && <p className="text-sm text-aspectum-text-muted mt-0.5">{subtitle}</p>}
          </div>
          {headerRight && <div className="shrink-0">{headerRight}</div>}
        </div>
      )}

      {/* Поиск + фильтры */}
      {(onSearch || filters) && (
        <div className="mb-3 flex flex-wrap gap-2">
          {onSearch && (
            <TextInput
              type="text"
              value={search ?? ''}
              onChange={(e) => onSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="flex-1 min-w-[200px]"
            />
          )}
          {filters}
        </div>
      )}

      {/* Ошибка */}
      {error && (
        <Alert tone="error" className="mb-3">{error}</Alert>
      )}

      {/* Таблица */}
      {loading ? (
        <Card className="p-12 flex items-center justify-center">
          <div className="flex items-center gap-2 text-aspectum-text-muted text-sm">
            <Spinner />
            Загрузка...
          </div>
        </Card>
      ) : rows.length === 0 ? (
        isFiltered ? (
          <Card>
            <EmptyState
              icon="🔍"
              title="Ничего не найдено"
              description="Попробуйте изменить фильтры или поисковый запрос"
            />
          </Card>
        ) : (
          <Card>
            <EmptyState icon={emptyIcon} title={emptyText} />
          </Card>
        )
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {rows.map((row, idx) => (
              <Card
                key={row.id ?? idx}
                className={`p-3 ${onRowClick ? 'cursor-pointer' : ''}`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                <div className="space-y-2">
                  {columns.map((col, cidx) => (
                    <div key={col.key} className="grid grid-cols-[110px_1fr] gap-2 items-start">
                      <div className="text-[11px] uppercase tracking-wide text-aspectum-text-muted font-semibold pt-0.5">
                        {col.label}
                      </div>
                      <div className={`text-sm text-aspectum-text min-w-0 ${cidx === 0 ? 'font-medium' : ''}`}>
                        {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                      </div>
                    </div>
                  ))}
                </div>
                {actions && (
                  <div
                    className="mt-3 pt-3 border-t border-aspectum-border flex flex-wrap gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {actions(row)}
                  </div>
                )}
              </Card>
            ))}
          </div>

          <Card className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-aspectum-surface-muted border-b border-aspectum-border text-xs text-aspectum-text-muted uppercase tracking-wide">
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
              <tbody className="divide-y divide-aspectum-border">
                {rows.map((row, idx) => (
                  <tr
                    key={row.id ?? idx}
                    className={`hover:bg-aspectum-surface-muted transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
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
          </Card>
        </>
      )}

      {/* Пагинация */}
      {showPagination && !loading && rows.length > 0 && (
        <Card className="mt-3 flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <span className="text-xs text-aspectum-text-muted">
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} из {totalCount}
          </span>
          <div className="flex items-center gap-1">
            <PageBtn label="Предыдущая страница" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft className="size-3.5" aria-hidden="true" /></PageBtn>
            {buildPageRange(page, totalPages).map((p, i) =>
              p === '...' ? (
                <span key={`ellipsis-${i}`} className="px-2 text-aspectum-text-muted text-xs">…</span>
              ) : (
                <PageBtn key={p} active={p === page} onClick={() => onPage(p)}>{p}</PageBtn>
              )
            )}
            <PageBtn label="Следующая страница" disabled={page >= totalPages} onClick={() => onPage(page + 1)}><ChevronRight className="size-3.5" aria-hidden="true" /></PageBtn>
          </div>
        </Card>
      )}
    </div>
  );
}

function PageBtn({ children, disabled, active, onClick, label }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      disabled={disabled}
      onClick={onClick}
      className={`px-2.5 py-1 text-xs rounded border transition-colors ${
        active
          ? 'bg-aspectum-primary text-aspectum-on-accent border-aspectum-primary'
          : 'border-aspectum-border text-aspectum-text-muted hover:bg-aspectum-surface-muted disabled:opacity-40 disabled:cursor-not-allowed'
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
