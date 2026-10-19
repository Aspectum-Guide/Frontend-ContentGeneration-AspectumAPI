import { describe, expect, it } from 'vitest';
import { buildAttractionSessionSync } from './attractionSessionSync.js';

describe('attraction session orchestration sync', () => {
  const session = {
    id: 'session-1',
    attractions: [{ id: 1, name: { ru: 'С сервера' }, order: '2' }],
    attraction_infos: [{ id: 2, session_attraction_id: 1 }],
    attraction_feed_items: [{ id: 3, session_attraction_id: 1, index: '4' }],
  };

  it('normalizes all three collections in one synchronization result', () => {
    const result = buildAttractionSessionSync(session, []);
    expect(result.attractions[0]).toMatchObject({ id: 1, index: 2, order: 2 });
    expect(result.attractionInfos[0]).toMatchObject({
      id: 2,
      assigned_attraction_type: 'draft',
      session_attraction_id: 1,
    });
    expect(result.attractionFeedItems[0]).toMatchObject({
      id: 3,
      assigned_attraction_type: 'draft',
      session_attraction_id: '1',
      index: 4,
    });
  });

  it('does not apply incoming session data while the attraction is saving', () => {
    const locallyEdited = [{ id: 1, name: { ru: 'Локальная правка' } }];
    expect(buildAttractionSessionSync(session, locallyEdited, { saving: true })).toBeNull();
  });
});
