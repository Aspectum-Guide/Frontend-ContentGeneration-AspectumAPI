import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildAttractionInfoPayload,
  buildAttractionInfoPersistSnapshot,
  collectAttractionInfoLocaleTexts,
  createEmptyAttractionInfo,
  normalizeAttractionInfo,
} from './attractionInfoCore.js';

describe('attractionInfoCore', () => {
  afterEach(() => vi.restoreAllMocks());

  it('infers database and draft assignments from legacy relation fields', () => {
    expect(normalizeAttractionInfo({ attraction_id: 12 })).toMatchObject({
      assigned_attraction_type: 'database',
      event: 12,
      event_id: 12,
      attraction: 12,
      attraction_id: 12,
      session_attraction: null,
    });
    expect(normalizeAttractionInfo({ session_attraction: 'draft-2' })).toMatchObject({
      assigned_attraction_type: 'draft',
      session_attraction: 'draft-2',
      session_attraction_id: 'draft-2',
    });
  });

  it('keeps an explicit assignment type authoritative', () => {
    expect(normalizeAttractionInfo({
      assigned_attraction_type: 'none',
      event_id: 4,
    }).assigned_attraction_type).toBe('none');
  });

  it('clears the inactive relation when building payloads', () => {
    expect(buildAttractionInfoPayload({
      assigned_attraction_type: 'draft',
      event_id: 8,
      session_attraction_id: 'draft-7',
    })).toMatchObject({
      event: null,
      event_id: null,
      attraction: null,
      attraction_id: null,
      session_attraction: 'draft-7',
      session_attraction_id: 'draft-7',
    });
  });

  it('creates a localized draft info record for the active attraction', () => {
    vi.spyOn(Date, 'now').mockReturnValue(123);
    expect(createEmptyAttractionInfo({
      activeAttractionId: 42,
      sourceLocaleData: {
        ru: { lang: 'ru' },
        custom: { lang: 'de' },
      },
    })).toEqual({
      id: 'attraction-info-123',
      name: { ru: '', de: '' },
      description: { ru: '', de: '' },
      assigned_attraction_type: 'draft',
      attraction: null,
      attraction_id: null,
      session_attraction: '42',
      session_attraction_id: '42',
      isNew: true,
    });
  });

  it('creates an unattached record when there is no active attraction', () => {
    expect(createEmptyAttractionInfo({ activeAttractionId: null })).toMatchObject({
      assigned_attraction_type: 'none',
      session_attraction: null,
      session_attraction_id: null,
      isNew: true,
    });
  });

  it('collects every valid locale row including intentionally blank values', () => {
    expect(collectAttractionInfoLocaleTexts({
      ru: { lang: 'ru', name: 'Название', description: '' },
      en: { lang: 'en', name: '', description: 'Description' },
      invalid: { name: 'Ignored' },
    })).toEqual({
      name: { ru: 'Название', en: '' },
      description: { ru: '', en: 'Description' },
    });
  });

  it('serializes the normalized payload and returns null without an id', () => {
    expect(buildAttractionInfoPersistSnapshot({}, {})).toBeNull();
    const snapshot = JSON.parse(buildAttractionInfoPersistSnapshot(
      { id: 1, session_attraction_id: 'draft-1' },
      { ru: { lang: 'ru', name: 'Факт', description: 'Описание' } },
    ));
    expect(snapshot).toMatchObject({
      name: { ru: 'Факт' },
      description: { ru: 'Описание' },
      assigned_attraction_type: 'draft',
      event: null,
      session_attraction: 'draft-1',
    });
  });
});
