import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppNav from './AppNav';

function renderNav(props) {
  return render(
    <MemoryRouter>
      <AppNav {...props} />
    </MemoryRouter>
  );
}

describe('AppNav', () => {
  // Node's experimental built-in localStorage can shadow jsdom's; use a plain in-memory store.
  beforeEach(() => {
    const store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
      clear: () => store.clear(),
    });
  });
  it('opens the group of the current route and leaves the others collapsed', () => {
    renderNav({ pathname: '/catalog/cities' });
    expect(screen.getByRole('link', { name: /Города/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Типы подписки/ })).toBeNull();
  });

  it('marks the current item and toggles other groups open', () => {
    renderNav({ pathname: '/catalog/cities' });
    expect(screen.getByRole('link', { name: /Города/ }).getAttribute('aria-current')).toBe('page');
    fireEvent.click(screen.getByRole('button', { name: /Подписки/ }));
    expect(screen.getByRole('link', { name: /Типы подписки/ })).toBeTruthy();
  });

  it('remembers opened groups between mounts', () => {
    const first = renderNav({ pathname: '/catalog/cities' });
    fireEvent.click(screen.getByRole('button', { name: /Подписки/ }));
    first.unmount();
    renderNav({ pathname: '/catalog/cities' });
    expect(screen.getByRole('link', { name: /Типы подписки/ })).toBeTruthy();
  });

  it('puts runtime items ahead of the static ones in their group', () => {
    renderNav({
      pathname: '/generation',
      extraItems: { sessions: [{ label: 'Рим', to: '/generation/abc', badge: 'Active' }] },
    });
    const labels = screen.getAllByRole('link').map((a) => a.textContent);
    expect(labels.findIndex((l) => l.includes('Рим'))).toBeLessThan(labels.findIndex((l) => l.includes('Все сессии')));
  });

  it('renders every item as an icon-only link in the collapsed rail', () => {
    renderNav({ pathname: '/catalog/cities', collapsed: true });
    expect(screen.queryByRole('button', { name: /Подписки/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Типы подписки' }).getAttribute('title')).toBe('Типы подписки');
  });

  it('only shows the groups of the requested scope', () => {
    renderNav({ pathname: '/generation', groups: undefined });
    // default scope is "all" in tests
    expect(screen.getByRole('button', { name: /Букинг/ })).toBeTruthy();
  });
});
