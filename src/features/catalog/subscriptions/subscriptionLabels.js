import { getMultiLangValue } from '../shared/i18n';

export function getCityLabel(city) {
  if (!city) return '—';
  if (typeof city === 'string') return city;
  return getMultiLangValue(city.name || city.city_name) || String(city.id || '—');
}

export function getEventLabel(event) {
  if (!event) return '—';
  if (typeof event === 'string') return event;
  return getMultiLangValue(event.title || event.name) || String(event.id || '—');
}

export function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}
