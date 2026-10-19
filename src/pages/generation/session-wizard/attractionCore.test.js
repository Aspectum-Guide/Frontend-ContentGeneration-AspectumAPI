import { describe, expect, it } from 'vitest';
import {
  buildAttractionPayload,
  buildAttractionPersistSnapshot,
  collectAttractionLocaleTexts,
  getAttractionName,
  makeAttractionLocaleEntries,
  normalizeAttraction,
  sortAttractionLocaleEntries,
} from './attractionCore.js';

describe('attractionCore', () => {
  it('orders known locales consistently and keeps only the first entry per language', () => {
    const entries = [
      ['de-DE', { lang: 'de', marker: 'first' }],
      ['ru-RU', { lang: 'ru' }],
      ['de-CH', { lang: 'de', marker: 'duplicate' }],
      ['en-US', { lang: 'en' }],
    ];

    const result = sortAttractionLocaleEntries(entries);

    expect(result.map(([, locale]) => locale.lang)).toEqual(['ru', 'en', 'de']);
    expect(result[2][1].marker).toBe('first');
  });

  it('normalizes and deduplicates language keys when creating locale entries', () => {
    const result = makeAttractionLocaleEntries([' DE ', 'ru', 'de', '', null]);

    expect(result.map(([, locale]) => locale.lang)).toEqual(['ru', 'de']);
    expect(result[1][1]).toMatchObject({ lang: 'de', isCustom: true });
  });

  it('uses the preferred attraction name and then falls back to any translation', () => {
    expect(getAttractionName({ name: { fr: 'Musée', en: 'Museum' } })).toBe('Museum');
    expect(getAttractionName({ name: { fr: 'Musée' } })).toBe('Musée');
    expect(getAttractionName({})).toBe('(без названия)');
  });

  it('normalizes assignment, indexes, tags, and legacy image fields', () => {
    const result = normalizeAttraction({
      id: 7,
      order: '3',
      rank: '2',
      session_city_id: 'draft-4',
      image: {
        id: 9,
        url: 'https://example.com/preview.jpg',
        original_url: 'https://example.com/original.jpg',
        copyright: 'Author',
      },
      tags: [{ id: 1 }, '2'],
      related_event_ids: [{ id: 5 }],
    });

    expect(result).toMatchObject({
      id: 7,
      index: 3,
      order: 3,
      rank: 2,
      assigned_city_type: 'draft',
      session_city_id: 'draft-4',
      image_id: '9',
      image_url: 'https://example.com/preview.jpg',
      image_original_url: 'https://example.com/original.jpg',
      image_copyright: 'Author',
      tags: ['1', '2'],
      related_event_ids: ['5'],
    });
    expect(result.image).toBeNull();
  });

  it('collects only locale rows that contain editable attraction text', () => {
    expect(collectAttractionLocaleTexts({
      ru: { lang: 'ru', name: 'Имя', description: '' },
      en: { lang: 'en', name: '', description: '' },
      invalid: { name: 'Ignored' },
    })).toEqual({ name: { ru: 'Имя' }, description: { ru: '' } });
  });

  it('builds a payload with blank coordinates cleared and inactive assignments removed', () => {
    expect(buildAttractionPayload({
      assigned_city_type: 'database',
      city_id: '12',
      session_city_id: 'draft-8',
      lat: '',
      lon: '',
      order: '4',
      tags: [{ id: 3 }],
    })).toMatchObject({
      lat: null,
      lon: null,
      index: 4,
      order: 4,
      city: '12',
      city_id: '12',
      session_city: null,
      session_city_id: null,
      tags: ['3'],
    });
  });

  it('creates a stable persistence snapshot with localized contents', () => {
    expect(buildAttractionPersistSnapshot({}, {})).toBeNull();

    const snapshot = JSON.parse(buildAttractionPersistSnapshot(
      { id: 1, assigned_city_type: 'none' },
      {
        ru: { lang: 'ru', name: 'Имя', description: 'Описание', contentText: 'Текст' },
        en: { lang: 'en', name: 'Name', description: '', contentText: '' },
      },
    ));

    expect(snapshot.payload.name).toEqual({ ru: 'Имя', en: 'Name' });
    expect(snapshot.payload.description).toEqual({ ru: 'Описание', en: '' });
    expect(snapshot.contents).toEqual({ ru: 'Текст', en: '' });
  });
});
