import { mergeServerCollection } from './useSessionWizardHelpers.js';
import { normalizeAttraction } from './attractionCore.js';
import { normalizeAttractionInfo } from './attractionInfoCore.js';
import { normalizeAttractionFeedItem } from './attractionFeedCore.js';

export function buildAttractionSessionSync(session, currentAttractions, { saving = false } = {}) {
  if (!session?.id || !Array.isArray(session.attractions) || saving) return null;
  return {
    attractions: mergeServerCollection(
      currentAttractions,
      session.attractions,
      normalizeAttraction,
    ),
    attractionInfos: Array.isArray(session.attraction_infos)
      ? session.attraction_infos.map(normalizeAttractionInfo)
      : null,
    attractionFeedItems: Array.isArray(session.attraction_feed_items)
      ? session.attraction_feed_items.map(normalizeAttractionFeedItem)
      : null,
  };
}
