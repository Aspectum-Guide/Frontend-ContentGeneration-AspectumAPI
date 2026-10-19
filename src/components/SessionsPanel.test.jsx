import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sidebar = vi.fn();
vi.mock('../api/generation', () => ({ sessionsAPI: { sidebar: (...args) => sidebar(...args) } }));

import SessionsPanel from './SessionsPanel';
import { formatRelative, sessionTitle } from './sessionsPanelHelpers';

const row = (overrides = {}) => ({
  id: 'id-1',
  name: 'Сессия от 01.10.2026',
  status: 'in_progress',
  city_display_name: 'Рим',
  city_country: 'Италия',
  updated_at: new Date(Date.now() - 5 * 60_000).toISOString(),
  creator_name: 'anna@test.local',
  is_mine: true,
  workspace: null,
  ...overrides,
});

const page = (results, extra = {}) => ({ data: { success: true, results, has_more: false, next_offset: null, scope: 'mine', ...extra } });

function renderPanel(path = '/generation') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <SessionsPanel />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('SessionsPanel', () => {
  beforeEach(() => {
    sidebar.mockReset();
    // Node's experimental built-in localStorage can shadow jsdom's; use a plain in-memory store.
    const store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
      clear: () => store.clear(),
    });
  });

  it('asks for my active sessions first and shows the city as the title', async () => {
    sidebar.mockResolvedValue(page([row()]));
    renderPanel();

    expect(await screen.findByText('Рим')).toBeTruthy();
    expect(sidebar).toHaveBeenCalledWith({ scope: 'mine', limit: 40, offset: 0, status: 'draft,in_progress' });
    const link = screen.getByRole('link', { name: /Рим/ });
    expect(link.getAttribute('href')).toBe('/generation/id-1');
    expect(link.textContent).toContain('В работе');
  });

  it('falls back to the session name when there is no city', async () => {
    sidebar.mockResolvedValue(page([row({ city_display_name: null, name: 'Тур по Сицилии' })]));
    renderPanel();
    expect(await screen.findByText('Тур по Сицилии')).toBeTruthy();
  });

  it('marks the open session and ignores non-session routes', async () => {
    sidebar.mockResolvedValue(page([row()]));
    renderPanel('/generation/id-1');
    const link = await screen.findByRole('link', { name: /Рим/ });
    expect(link.getAttribute('aria-current')).toBe('page');
  });

  it('does not treat /generation/new as an open session', async () => {
    sidebar.mockResolvedValue(page([row()]));
    renderPanel('/generation/new');
    const link = await screen.findByRole('link', { name: /Рим/ });
    expect(link.getAttribute('aria-current')).toBeNull();
  });

  it('switches the status filter and refetches with the new statuses', async () => {
    sidebar.mockResolvedValue(page([row()]));
    renderPanel();
    await screen.findByText('Рим');
    fireEvent.click(screen.getByRole('radio', { name: 'Опубл.' }));
    await waitFor(() => expect(sidebar).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'published', scope: 'mine' })));
  });

  it('sends the search text after the debounce', async () => {
    sidebar.mockResolvedValue(page([row()]));
    renderPanel();
    await screen.findByText('Рим');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Поиск сессий' }), { target: { value: 'рим' } });
    await waitFor(() => expect(sidebar).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'рим' })));
  });

  it('loads the next page on "Показать ещё"', async () => {
    sidebar
      .mockResolvedValueOnce(page([row({ id: 'a', city_display_name: 'Рим' })], { has_more: true, next_offset: 40 }))
      .mockResolvedValueOnce(page([row({ id: 'b', city_display_name: 'Париж' })]));
    renderPanel();
    await screen.findByText('Рим');
    fireEvent.click(screen.getByRole('button', { name: 'Показать ещё' }));
    expect(await screen.findByText('Париж')).toBeTruthy();
    expect(sidebar).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 40 }));
    expect(screen.queryByRole('button', { name: 'Показать ещё' })).toBeNull();
  });

  it('shows an empty state, and a different one for an empty search', async () => {
    sidebar.mockResolvedValue(page([]));
    renderPanel();
    expect(await screen.findByText('Сессий в этом разделе пока нет.')).toBeTruthy();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Поиск сессий' }), { target: { value: 'нет такого' } });
    expect(await screen.findByText('Ничего не найдено.')).toBeTruthy();
  });

  it('shows an error with a retry that refetches', async () => {
    sidebar.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(page([row()]));
    renderPanel();
    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(await screen.findByText('Рим')).toBeTruthy();
  });

  it('explains when the server refuses "all" and falls back to my sessions', async () => {
    sidebar.mockResolvedValue(page([row()], { scope: 'mine' }));
    renderPanel();
    await screen.findByText('Рим');
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Чьи сессии' })).getByRole('radio', { name: 'Все' }));
    await waitFor(() => expect(sidebar).toHaveBeenLastCalledWith(expect.objectContaining({ scope: 'all' })));
    expect(await screen.findByText(/доступны только персоналу/)).toBeTruthy();
  });

  it('names other editors only in the "all" view', async () => {
    sidebar.mockResolvedValue(page([row({ is_mine: false, creator_name: 'boris@test.local' })], { scope: 'all' }));
    localStorage.setItem('sessionsPanelFilters', JSON.stringify({ filter: 'work', scope: 'all' }));
    renderPanel();
    const link = await screen.findByRole('link', { name: /Рим/ });
    expect(link.textContent).toContain('boris@test.local');
  });
});

describe('helpers', () => {
  it('sessionTitle prefers the city, then the name, then a placeholder', () => {
    expect(sessionTitle({ city_display_name: ' Рим ', name: 'x' })).toBe('Рим');
    expect(sessionTitle({ city_display_name: '', name: 'Тур' })).toBe('Тур');
    expect(sessionTitle({})).toBe('Сессия без названия');
  });

  it('formatRelative gives short Russian relative times', () => {
    const now = Date.parse('2026-10-19T12:00:00Z');
    expect(formatRelative('2026-10-19T11:59:40Z', now)).toBe('только что');
    expect(formatRelative('2026-10-19T11:55:00Z', now)).toMatch(/5 мин/);
    expect(formatRelative('2026-10-19T09:00:00Z', now)).toMatch(/3 ч/);
    expect(formatRelative('not a date', now)).toBe('');
  });
});
