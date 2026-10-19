import { describe, expect, it } from 'vitest';
import {
  applyAttractionFeedBinding,
  buildAttractionFeedLocaleData,
  buildAttractionInfoLocaleData,
  getAttractionFeedItemName,
  getAttractionInfoName,
  getAttractionLocaleLang,
  resolveActiveAttractionCityDraftId,
  resolveDefaultAttractionAiLang,
} from './attractionLocaleCore.js';

describe('attraction locale and binding helpers', () => {
  it('builds info locales from the active draft attraction locales', () => {
    const result = buildAttractionInfoLocaleData({
      info: {
        assigned_attraction_type: 'draft',
        session_attraction_id: 'attr-1',
        name: { ru: 'Факт' },
        description: { en: 'Fact' },
      },
      currentAttraction: { id: 'attr-1' },
      attractionLocaleData: {
        'en-US': { lang: 'en', code: 'US', langName: 'English' },
        'ru-RU': { lang: 'ru', code: 'RU', langName: 'Русский' },
      },
    });
    expect(Object.keys(result)).toEqual(['ru-RU', 'en-US']);
    expect(result['ru-RU']).toMatchObject({ name: 'Факт', description: '' });
    expect(result['en-US']).toMatchObject({ name: '', description: 'Fact' });
  });

  it('uses the referenced database attraction languages for info locales', () => {
    const result = buildAttractionInfoLocaleData({
      info: { assigned_attraction_type: 'database', event_id: 8 },
      referenceAttractions: [{ id: '8', title: { de: 'Titel' } }],
    });
    expect(Object.values(result).map((locale) => locale.lang)).toEqual(['de']);
  });

  it('preserves edited feed text only when the item has no value for that language', () => {
    const result = buildAttractionFeedLocaleData({
      item: {
        item_type: 'text',
        assigned_attraction_type: 'none',
        text: { ru: 'Server value', en: '' },
      },
      previousData: {
        'ru-RU': { text: 'Edited value' },
        'en-US': { text: 'Edited English' },
      },
    });
    expect(result['ru-RU'].text).toBe('Server value');
    expect(result['en-US'].text).toBe('');
    expect(buildAttractionFeedLocaleData({ item: { item_type: 'image' } })).toEqual({});
  });

  it('formats info and feed labels with the established fallbacks', () => {
    expect(getAttractionInfoName({ name: { en: 'Information' } })).toBe('Information');
    expect(getAttractionInfoName({ name: '' })).toBe('(без названия)');
    expect(getAttractionFeedItemName({ item_type: 'image', image_copyright: 'Author' }))
      .toBe('Author');
    expect(getAttractionFeedItemName({ item_type: 'text', text: 'x'.repeat(70) }))
      .toBe('x'.repeat(60));
  });

  it('resolves locale language and the first usable city draft', () => {
    expect(getAttractionLocaleLang('en-US')).toBe('en');
    expect(getAttractionLocaleLang('de-DE')).toBe('de');
    expect(resolveActiveAttractionCityDraftId('legacy', [
      { id: 'legacy' },
      { id: 17 },
    ])).toBe('17');
    expect(resolveActiveAttractionCityDraftId(9, [{ id: 17 }])).toBe('9');
  });

  it('applies draft or copied database feed bindings without mutating the source item', () => {
    const original = { item_type: 'text' };
    expect(applyAttractionFeedBinding(original, { activeAttractionId: 3 })).toMatchObject({
      assigned_attraction_type: 'draft',
      session_attraction_id: '3',
      event_id: null,
    });
    expect(original).toEqual({ item_type: 'text' });
    expect(applyAttractionFeedBinding(original, {
      bindingSource: { assigned_attraction_type: 'database', attraction_id: 12 },
    })).toMatchObject({
      assigned_attraction_type: 'database',
      event_id: 12,
      session_attraction_id: null,
    });
  });

  it('resolves AI language from locale data and then from the active draft', () => {
    expect(resolveDefaultAttractionAiLang({ first: { lang: 'IT-it' } }, null, []))
      .toBe('it');
    expect(resolveDefaultAttractionAiLang({}, 'draft-1', [
      { id: 'draft-1', description: { 'de-DE': 'Beschreibung' } },
    ])).toBe('de');
    expect(resolveDefaultAttractionAiLang({}, null, [])).toBe('ru');
  });
});
