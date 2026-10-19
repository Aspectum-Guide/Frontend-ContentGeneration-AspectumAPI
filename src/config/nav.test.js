import { describe, expect, it } from 'vitest';
import { NAV_GROUPS, findActiveGroupId, getNavGroups, isNavItemActive, pageTitleFor, resolveNavScope } from './nav';

describe('nav config', () => {
  it('has unique group ids and unique item paths, each with an icon', () => {
    const ids = NAV_GROUPS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    const paths = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.to));
    expect(new Set(paths).size).toBe(paths.length);
    for (const group of NAV_GROUPS) {
      expect(group.icon).toBeTruthy();
      expect(group.scopes.length).toBeGreaterThan(0);
      for (const item of group.items) expect(item.icon, item.to).toBeTruthy();
    }
  });

  it('keeps "Ивенты" from lighting up on "Ивенты без города"', () => {
    const events = { to: '/catalog/events' };
    const orphans = { to: '/catalog/events/orphans' };
    expect(isNavItemActive('/catalog/events', events)).toBe(true);
    expect(isNavItemActive('/catalog/events/123', events)).toBe(true);
    expect(isNavItemActive('/catalog/events/orphans', events)).toBe(false);
    expect(isNavItemActive('/catalog/events/orphans', orphans)).toBe(true);
  });

  it('finds the group of the current route', () => {
    expect(findActiveGroupId('/catalog/cities/42')).toBe('content');
    expect(findActiveGroupId('/tasks/audio-queue')).toBe('tasks');
    expect(findActiveGroupId('/nowhere')).toBeNull();
  });

  it('trims the menu by scope and falls back to everything', () => {
    expect(resolveNavScope('studio')).toBe('studio');
    expect(resolveNavScope('bogus')).toBe('all');
    expect(getNavGroups('all')).toBe(NAV_GROUPS);
    const studio = getNavGroups('studio').map((g) => g.id);
    expect(studio).toContain('sessions');
    expect(studio).toContain('transfer');
    expect(studio).not.toContain('booking');
    const catalog = getNavGroups('catalog').map((g) => g.id);
    expect(catalog).toContain('booking');
    expect(catalog).not.toContain('sessions');
  });

  it('resolves page titles, most specific first', () => {
    expect(pageTitleFor('/catalog/events/orphans')).toBe('Ивенты без города');
    expect(pageTitleFor('/tasks/audio-queue')).toBe('Очередь озвучки');
    expect(pageTitleFor('/unknown')).toBe('Aspectum Admin');
  });
});
