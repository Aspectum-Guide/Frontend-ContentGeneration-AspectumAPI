import { useEffect, useMemo, useState } from 'react';
import { Link, useMatch, useNavigate } from 'react-router-dom';
import { ChevronsLeft, Plus, Search } from 'lucide-react';
import { Button, ChoiceGroup, IconButton, Spinner, TextInput } from '@aspectum/admin-ui-web';
import useSessionsSidebar from '../hooks/useSessionsSidebar';
import { STATUS_DOT, STATUS_FILTERS, STATUS_LABELS, formatRelative, sessionTitle } from './sessionsPanelHelpers';

const STORAGE_KEY = 'sessionsPanelFilters';
const NON_SESSION_SEGMENTS = new Set(['new', 'list']);

function readFilters() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      filter: STATUS_FILTERS.some((f) => f.id === parsed.filter) ? parsed.filter : 'work',
      scope: parsed.scope === 'all' ? 'all' : 'mine',
    };
  } catch {
    return { filter: 'work', scope: 'mine' };
  }
}

function writeFilters(value) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // storage unavailable: the choice then lasts for this page load only
  }
}

function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function SessionRow({ row, active, showCreator }) {
  const meta = [STATUS_LABELS[row.status] || row.status, formatRelative(row.updated_at)];
  if (showCreator && !row.is_mine && row.creator_name) meta.push(row.creator_name);
  return (
    <li>
      <Link
        to={`/generation/${row.id}`}
        aria-current={active ? 'page' : undefined}
        className={`flex items-start gap-2.5 rounded-aspectum-control px-2.5 py-2 transition-colors ${active ? 'bg-aspectum-primary-muted' : 'hover:bg-aspectum-surface-subtle'}`}
      >
        <span aria-hidden="true" className={`mt-1.5 size-2 shrink-0 rounded-full ${STATUS_DOT[row.status] || 'bg-aspectum-text-disabled'}`} />
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm font-medium ${active ? 'text-aspectum-primary-strong' : 'text-aspectum-text'}`}>{sessionTitle(row)}</span>
          <span className="block truncate text-xs text-aspectum-text-muted">{meta.filter(Boolean).join(' · ')}</span>
        </span>
      </Link>
    </li>
  );
}

/**
 * Every session of the studio in the sidebar: search, status filter, mine/all, and
 * "show more" pagination. `embedded` drops the fixed column chrome for the mobile drawer.
 */
export default function SessionsPanel({ onCollapse, embedded = false, className = '' }) {
  const navigate = useNavigate();
  const match = useMatch('/generation/:sessionId');
  const activeId = match && !NON_SESSION_SEGMENTS.has(match.params.sessionId) ? match.params.sessionId : null;

  const [{ filter, scope }, setFilters] = useState(readFilters);
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());

  const statusParam = STATUS_FILTERS.find((f) => f.id === filter)?.status;
  const query = useSessionsSidebar({ scope, status: statusParam, q });

  const rows = useMemo(() => (query.data?.pages || []).flatMap((page) => page?.results || []), [query.data]);
  const effectiveScope = query.data?.pages?.[0]?.scope || scope;

  const update = (patch) => setFilters((current) => {
    const next = { ...current, ...patch };
    writeFilters(next);
    return next;
  });

  const empty = !query.isPending && !query.isError && rows.length === 0;

  return (
    <section
      aria-label="Сессии"
      data-ui="sessions-panel"
      className={`flex min-h-0 flex-col ${embedded ? '' : 'h-full'} ${className}`.trim()}
    >
      <div className="flex items-center justify-between gap-2 px-3 pt-3">
        <h2 className="text-sm font-semibold text-aspectum-text">Сессии</h2>
        <div className="flex items-center gap-1">
          <IconButton label="Новая сессия" onClick={() => navigate('/generation/new')}>
            <Plus className="size-4" aria-hidden="true" />
          </IconButton>
          {onCollapse && (
            <IconButton label="Скрыть панель сессий" onClick={onCollapse}>
              <ChevronsLeft className="size-4" aria-hidden="true" />
            </IconButton>
          )}
        </div>
      </div>

      <div className="space-y-2 px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-aspectum-text-muted" aria-hidden="true" />
          <TextInput
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск по городу или названию"
            aria-label="Поиск сессий"
            className="pl-8 text-sm"
          />
        </div>
        <ChoiceGroup
          ariaLabel="Статус сессий"
          items={STATUS_FILTERS.map(({ id, label }) => ({ id, label }))}
          value={filter}
          onChange={(id) => update({ filter: id })}
        />
        <ChoiceGroup
          ariaLabel="Чьи сессии"
          items={[{ id: 'mine', label: 'Мои' }, { id: 'all', label: 'Все' }]}
          value={effectiveScope}
          onChange={(id) => update({ scope: id })}
        />
        {scope === 'all' && effectiveScope === 'mine' && (
          <p className="text-xs text-aspectum-text-muted">Сессии других редакторов доступны только персоналу.</p>
        )}
      </div>

      <div className={`min-h-0 flex-1 px-1.5 pb-3 ${embedded ? 'max-h-72 overflow-y-auto' : 'overflow-y-auto'}`}>
        {query.isPending && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-aspectum-text-muted"><Spinner size="sm" /> Загрузка…</div>
        )}
        {query.isError && (
          <div role="alert" className="space-y-2 px-2 py-4 text-sm text-aspectum-danger">
            <p>Не удалось загрузить сессии.</p>
            <Button type="button" size="sm" variant="outline" onClick={() => query.refetch()}>Повторить</Button>
          </div>
        )}
        {empty && (
          <p className="px-2 py-6 text-center text-sm text-aspectum-text-muted">
            {q ? 'Ничего не найдено.' : 'Сессий в этом разделе пока нет.'}
          </p>
        )}
        {rows.length > 0 && (
          <ul className="space-y-0.5">
            {rows.map((row) => (
              <SessionRow key={row.id} row={row} active={row.id === activeId} showCreator={effectiveScope === 'all'} />
            ))}
          </ul>
        )}
        {query.hasNextPage && (
          <div className="px-2 pt-2">
            <Button type="button" size="sm" variant="outline" className="w-full" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
              {query.isFetchingNextPage ? 'Загрузка…' : 'Показать ещё'}
            </Button>
          </div>
        )}
      </div>

      <div className="border-t border-aspectum-border px-3 py-2">
        <Link to="/generation" className="text-xs font-medium text-aspectum-text-muted hover:text-aspectum-text">Таблица всех сессий →</Link>
      </div>
    </section>
  );
}
