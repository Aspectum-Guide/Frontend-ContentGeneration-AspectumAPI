import { describe, expect, it } from 'vitest';
import {
  filterCityInfosForActiveDraft,
  filterItemsForActiveAttraction,
} from './sessionWizardShared.jsx';

describe('Session Wizard entity scoping', () => {
  it('shows only city information assigned to the active draft', () => {
    const items = [
      { id: 'info-a', assigned_city_type: 'draft', session_city_id: 'draft-a' },
      { id: 'info-b', assigned_city_type: 'draft', session_city_id: 'draft-b' },
      { id: 'info-legacy', assigned_city_type: 'none', session_city: 'draft-a' },
    ];

    expect(filterCityInfosForActiveDraft(items, { activeCityDraftId: 'draft-a' }))
      .toEqual([items[0], items[2]]);
    expect(filterCityInfosForActiveDraft(items, { activeCityDraftId: 'draft-b' }))
      .toEqual([items[1]]);
  });

  it('keeps attraction children scoped to the opened draft or database event', () => {
    const items = [
      { id: 'draft-child', assigned_attraction_type: 'draft', session_attraction_id: 'attr-a' },
      { id: 'event-child', assigned_attraction_type: 'database', event_id: 'event-a' },
      { id: 'other-child', assigned_attraction_type: 'draft', session_attraction_id: 'attr-b' },
    ];

    expect(filterItemsForActiveAttraction(items, { activeAttractionId: 'attr-a' }))
      .toEqual([items[0]]);
    expect(filterItemsForActiveAttraction(items, { activeEventId: 'event-a' }))
      .toEqual([items[1]]);
  });
});
