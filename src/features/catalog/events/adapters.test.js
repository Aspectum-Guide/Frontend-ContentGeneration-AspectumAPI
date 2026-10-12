import { describe, expect, it } from 'vitest';
import { buildLangOptions } from '../shared/i18n';
import { createEmptyEvent, toApiEventPayload } from './adapters';

describe('createEmptyEvent', () => {
  it('starts with a language key so the editor shows tabs and the title field', () => {
    const event = createEmptyEvent();
    const options = buildLangOptions([event.title, event.description]);
    expect(options.map((o) => o.code)).toEqual(['ru']);
  });

  it('keeps an empty title invalid until the user types one', () => {
    const payload = toApiEventPayload(createEmptyEvent());
    expect(Object.values(payload.title).some((v) => String(v).trim())).toBe(false);
  });

  it('sends the typed title in the active language', () => {
    const event = { ...createEmptyEvent(), title: { ru: 'Новое событие' } };
    expect(toApiEventPayload(event).title).toEqual({ ru: 'Новое событие' });
  });
});
