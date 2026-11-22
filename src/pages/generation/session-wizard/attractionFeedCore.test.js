import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildAttractionFeedPayload,
  buildAttractionFeedPersistSnapshot,
  collectAttractionFeedLocaleTexts,
  createEmptyAttractionFeedItem,
  normalizeAttractionFeedItem,
} from './attractionFeedCore.js';

describe('attractionFeedCore', () => {
  afterEach(() => vi.restoreAllMocks());

  it('normalizes relations, numeric index, and nested image metadata', () => {
    expect(normalizeAttractionFeedItem({
      id: 1,
      attraction_id: 7,
      index: '3',
      image: {
        id: 9,
        url: 'https://example.com/image.jpg',
        original_url: 'https://example.com/source.jpg',
        copyright: 'Author',
      },
    })).toMatchObject({
      id: 1,
      item_type: 'text',
      assigned_attraction_type: 'database',
      event: '7',
      event_id: '7',
      attraction: '7',
      attraction_id: '7',
      image_id: 9,
      image_url: 'https://example.com/image.jpg',
      image_original_url: 'https://example.com/source.jpg',
      image_copyright: 'Author',
      index: 3,
      isNew: false,
    });
  });

  it('keeps an explicit assignment type instead of inferring another one', () => {
    expect(normalizeAttractionFeedItem({
      assigned_attraction_type: 'none',
      session_attraction_id: 5,
    }).assigned_attraction_type).toBe('none');
  });

  it('creates a localized empty feed item of the requested type', () => {
    vi.spyOn(Date, 'now').mockReturnValue(456);
    const item = createEmptyAttractionFeedItem('image');
    expect(item).toMatchObject({
      id: 'attraction-feed-456',
      item_type: 'image',
      image_id: null,
      index: 0,
      assigned_attraction_type: 'none',
      isNew: true,
    });
    expect(item.text).toMatchObject({ ru: '', en: '' });
  });

  it('builds a payload and clears the inactive assignment relation', () => {
    expect(buildAttractionFeedPayload({
      item_type: 'image',
      assigned_attraction_type: 'draft',
      event_id: 'event-1',
      session_attraction_id: 'draft-1',
      image_id: 'image-1',
      index: '2',
    })).toMatchObject({
      item_type: 'image',
      image_id: 'image-1',
      image: 'image-1',
      index: 2,
      event: null,
      event_id: null,
      attraction: null,
      attraction_id: null,
      session_attraction: 'draft-1',
      session_attraction_id: 'draft-1',
    });
  });

  it('collects valid localized text rows including blanks', () => {
    expect(collectAttractionFeedLocaleTexts({
      ru: { lang: 'ru', text: 'Текст' },
      en: { lang: 'en', text: '' },
      invalid: { text: 'Ignored' },
    })).toEqual({ ru: 'Текст', en: '' });
  });

  it('includes localized text in snapshots only for text items', () => {
    const locales = { ru: { lang: 'ru', text: 'Текст' } };
    expect(buildAttractionFeedPersistSnapshot({}, locales)).toBeNull();

    const textSnapshot = JSON.parse(buildAttractionFeedPersistSnapshot(
      { id: 1, item_type: 'text' },
      locales,
    ));
    const imageSnapshot = JSON.parse(buildAttractionFeedPersistSnapshot(
      { id: 2, item_type: 'image' },
      locales,
    ));
    expect(textSnapshot.text).toEqual({ ru: 'Текст' });
    expect(imageSnapshot.text).toEqual({});
  });
});
