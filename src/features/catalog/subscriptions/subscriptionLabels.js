import { getCityLabel as sharedCityLabel, getEventLabel as sharedEventLabel } from '../shared/labels';
import { formatDateTime } from '../shared/scheduleParsers';

export { formatDateTime };

/** City label for subscription tables. Missing value stays an em dash. */
export function getCityLabel(city) {
  if (!city) return '—';
  return sharedCityLabel(city) || '—';
}

/** Event label for subscription tables. Missing value stays an em dash. */
export function getEventLabel(event) {
  if (!event) return '—';
  return sharedEventLabel(event) || '—';
}
