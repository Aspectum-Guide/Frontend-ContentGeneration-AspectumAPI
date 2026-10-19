import { describe, expect, it, vi } from 'vitest';
import {
  buildCityInfoPayload,
  buildCityInfoPersistSnapshot,
  collectCityInfoLocaleTexts,
  createEmptyCityInfo,
  getLocaleLang,
  getMultilangKeys,
  makeLocaleEntriesFromLangKeys,
  normalizeCityInfo,
  sortLocaleSourceEntries,
} from './cityInfoCore';

describe('cityInfoCore locale helpers', () => {
  it('normalizes and orders language keys', () => {
    expect(getMultilangKeys({ EN: 'x', ru: 'y' }, { it: 'z', en: 'again' }))
      .toEqual(['en', 'ru', 'it']);
    expect(makeLocaleEntriesFromLangKeys(['it', 'en', 'ru']).map(([, locale]) => locale.lang))
      .toEqual(['ru', 'en', 'it']);
    expect(getLocaleLang('en-US')).toBe('en');
    expect(getLocaleLang('pl-PL')).toBe('pl');
  });

  it('deduplicates locale entries by language in default-first order', () => {
    const entries = sortLocaleSourceEntries([
      ['it-IT', { lang: 'it' }],
      ['en-US', { lang: 'en' }],
      ['en-GB', { lang: 'en' }],
      ['ru-RU', { lang: 'ru' }],
    ]);
    expect(entries.map(([key]) => key)).toEqual(['ru-RU', 'en-US', 'it-IT']);
  });
});

describe('cityInfoCore payload helpers', () => {
  it('normalizes database and draft assignments', () => {
    expect(normalizeCityInfo({ city_id: 'db-1', title: { ru: 'Совет' } })).toMatchObject({
      assigned_city_type: 'database', city: 'db-1', city_id: 'db-1', name: { ru: 'Совет' },
    });
    expect(normalizeCityInfo({ session_city: 'draft-1' })).toMatchObject({
      assigned_city_type: 'draft', session_city_id: 'draft-1',
    });
  });

  it('clears the inactive assignment in the API payload', () => {
    const payload = buildCityInfoPayload({
      assigned_city_type: 'draft', city_id: 'db-1', session_city_id: 'draft-1',
    });
    expect(payload.city_id).toBeNull();
    expect(payload.session_city_id).toBe('draft-1');
  });

  it('collects only non-empty localized content and builds a stable snapshot', () => {
    const locales = {
      ru: { lang: 'ru', name: 'Название', description: '' },
      en: { lang: 'en', name: '', description: '' },
    };
    expect(collectCityInfoLocaleTexts(locales)).toEqual({
      name: { ru: 'Название' }, description: { ru: '' },
    });
    expect(JSON.parse(buildCityInfoPersistSnapshot({ id: '1', assigned_city_type: 'none' }, locales)))
      .toMatchObject({ name: { ru: 'Название' }, assigned_city_type: 'none' });
    expect(buildCityInfoPersistSnapshot({}, locales)).toBeNull();
  });

  it('creates a new info block attached only to a persisted draft', () => {
    vi.spyOn(Date, 'now').mockReturnValue(123);
    const info = createEmptyCityInfo({
      activeDraftId: 'draft-1',
      sourceLocaleData: { custom: { lang: 'it' } },
    });
    expect(info).toMatchObject({
      id: 'city-info-123', assigned_city_type: 'draft', session_city_id: 'draft-1',
      name: { it: '' }, description: { it: '' }, isNew: true,
    });
    expect(createEmptyCityInfo({ activeDraftId: 'legacy' }).assigned_city_type).toBe('none');
    vi.restoreAllMocks();
  });
});
