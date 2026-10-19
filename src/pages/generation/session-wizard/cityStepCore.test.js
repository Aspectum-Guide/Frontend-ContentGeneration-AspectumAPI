import { describe, expect, it } from 'vitest';
import {
  buildCityStepPayload,
  hasValidMapCoords,
  makeLocaleData,
  normalizeCityDraft,
  parseCreatedCityDraftResponse,
  parseMapCoord,
  resolveBackendLanguageCode,
  upsertCityDraft,
} from './cityStepCore';

describe('cityStepCore', () => {
  it('creates independent empty locale records', () => {
    const locales = makeLocaleData();
    expect(locales['ru-RU'].name).toBe('');
    expect(locales['en-US'].lang).toBe('en');
    expect(locales['ru-RU']).not.toBe(locales['en-US']);
  });

  it('normalizes supported backend language names', () => {
    expect(resolveBackendLanguageCode(' Английский ')).toBe('en');
    expect(resolveBackendLanguageCode('IT')).toBe('it');
    expect(resolveBackendLanguageCode('unsupported')).toBe('');
  });

  it('parses comma coordinates and validates geographic bounds', () => {
    expect(parseMapCoord('55,75')).toBe(55.75);
    expect(hasValidMapCoords('90', '-180')).toBe(true);
    expect(hasValidMapCoords('90.1', '10')).toBe(false);
    expect(hasValidMapCoords('', '10')).toBe(false);
  });

  it('builds the city API payload without legacy draft identifiers', () => {
    const payload = buildCityStepPayload({
      localeData: {
        'ru-RU': {
          lang: 'ru', code: 'RU', name: ' Москва ', description: 'Описание', country: 'Россия',
        },
      },
      defaultLocale: 'ru-RU',
      lat: '55.75',
      lon: '37.61',
      cityTags: ['tag-1', 'tag-1', null],
      imageId: 'image-1',
      imageOriginalUrl: 'https://example.test/image.jpg',
      parentCityId: '',
      authorIds: ['author-1'],
      activeCityDraftId: 'legacy',
      baseUpdatedAt: '2026-01-01T00:00:00Z',
    });

    expect(payload.name).toEqual({ ru: 'Москва' });
    expect(payload.lat).toBe(55.75);
    expect(payload.default_language).toBe('ru');
    expect(payload.tags).toEqual(['tag-1']);
    expect(payload).not.toHaveProperty('draft_id');
    expect(payload.base_updated_at).toBe('2026-01-01T00:00:00Z');
  });

  it('normalizes and replaces drafts while removing a legacy placeholder', () => {
    const normalized = normalizeCityDraft({ id: 2, city_tags: ['a'], isPending: true });
    expect(normalized).toEqual({ id: 2, city_tags: ['a'], tags: ['a'] });

    const result = upsertCityDraft(
      [{ id: 'legacy' }, { id: '2', order: 3 }, { id: '1', order: 1 }],
      { id: '2', order: 2, name: { ru: 'Новый' } },
    );
    expect(result.map((draft) => String(draft.id))).toEqual(['1', '2']);
    expect(result[1].name.ru).toBe('Новый');
  });

  it('accepts all supported create-draft response envelopes', () => {
    expect(parseCreatedCityDraftResponse({ data: { draft: { id: '1' } } })).toEqual({ id: '1' });
    expect(parseCreatedCityDraftResponse({ data: { data: { id: '2' } } })).toEqual({ id: '2' });
    expect(parseCreatedCityDraftResponse({ data: { draft_id: 3 } })).toMatchObject({ id: '3' });
    expect(parseCreatedCityDraftResponse({ data: null })).toBeNull();
  });
});
