import { describe, expect, it } from 'vitest';
import {
  ADMIN,
  STUDIO,
  explicitAppMode,
  filterCatalogSections,
  filterNavSections,
  isStudioPath,
  landingPath,
  modeFromProbeStatus,
  probeAppMode,
} from './appMode';

describe('appMode', () => {
  it('читает 404 как админку, а живой маршрут генерации как студию', () => {
    expect(modeFromProbeStatus(404)).toBe(ADMIN);
    expect(modeFromProbeStatus(401)).toBe(STUDIO);
    expect(modeFromProbeStatus(403)).toBe(STUDIO);
    expect(modeFromProbeStatus(200)).toBe(STUDIO);
    expect(modeFromProbeStatus(500)).toBeNull();
  });

  it('отличает студийные адреса от каталога продаж', () => {
    expect(isStudioPath('/generation')).toBe(true);
    expect(isStudioPath('/generation/12')).toBe(true);
    expect(isStudioPath('/catalog/events/orphans')).toBe(true);
    expect(isStudioPath('/catalog/external-products/linking')).toBe(true);
    expect(isStudioPath('/ai/settings')).toBe(true);
    expect(isStudioPath('/catalog/external-products')).toBe(false);
    expect(isStudioPath('/catalog/booking-setup')).toBe(false);
    expect(isStudioPath('/catalog/tags')).toBe(false);
    expect(isStudioPath('/catalog/authors')).toBe(false);
    expect(isStudioPath('/catalog/llm/keys')).toBe(false);
  });

  it('в админке оставляет только разделы без генерации', () => {
    const sections = filterNavSections([
      {
        title: 'Сессии',
        items: [{ label: 'Все сессии', to: '/generation' }],
      },
      {
        title: 'Контент',
        items: [
          { label: 'Города', to: '/catalog/cities' },
          { label: 'Авторы', to: '/catalog/authors' },
          { label: 'Теги и фильтры', to: '/catalog/tags' },
        ],
      },
      {
        title: 'Букинг',
        items: [{ label: 'Настройка продаж', to: '/catalog/booking-setup' }],
      },
    ], ADMIN);

    expect(sections.map((section) => section.title)).toEqual(['Контент', 'Букинг']);
    expect(sections[0].items.map((item) => item.to)).toEqual([
      '/catalog/authors',
      '/catalog/tags',
    ]);
  });

  it('в студии меню не режет', () => {
    const sections = [{ title: 'Сессии', items: [{ to: '/generation' }] }];
    expect(filterNavSections(sections, STUDIO)).toBe(sections);
    expect(filterCatalogSections(sections, STUDIO)).toBe(sections);
  });

  it('после входа ведёт студию в сессии, админку в каталог', () => {
    expect(landingPath(STUDIO)).toBe('/generation');
    expect(landingPath(ADMIN)).toBe('/catalog');
  });

  it('явный VITE_APP_MODE не ходит на сервер', async () => {
    let called = false;
    const storage = {
      value: null,
      getItem() { return this.value; },
      setItem(_key, value) { this.value = value; },
    };
    const mode = await probeAppMode({
      env: { VITE_APP_MODE: 'admin' },
      storage,
      fetchImpl: () => {
        called = true;
        return Promise.resolve({ status: 200 });
      },
    });
    expect(mode).toBe(ADMIN);
    expect(called).toBe(false);
    expect(storage.value).toBe(ADMIN);
  });

  it('без флага 404 переключает панель в админку', async () => {
    const storage = {
      value: null,
      getItem() { return this.value; },
      setItem(_key, value) { this.value = value; },
    };
    const mode = await probeAppMode({
      env: {},
      apiBase: '/api/v1',
      storage,
      fetchImpl: async (url) => {
        expect(url).toBe('/api/v1/generation/workspaces/');
        return { status: 404 };
      },
    });
    expect(mode).toBe(ADMIN);
    expect(explicitAppMode({})).toBeNull();
  });
});
