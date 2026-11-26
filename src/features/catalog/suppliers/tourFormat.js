// Конструктор экскурсий партнёров: подписи статусов и полей, помощники для
// текстов на языках. Сервер — AspectumAPI PartnersAPI (docs/TOURS_CONSTRUCTOR.md).

export const TOUR_STATUSES = {
  draft: { label: 'Черновик', className: 'bg-gray-200 text-gray-700' },
  submitted: { label: 'На модерации', className: 'bg-blue-100 text-blue-700' },
  changes_requested: { label: 'Нужны правки', className: 'bg-amber-100 text-amber-800' },
  published: { label: 'Опубликована', className: 'bg-green-100 text-green-700' },
  withdrawn: { label: 'Снята', className: 'bg-red-100 text-red-700' },
};

export const MISSING_LABELS = {
  title: 'название',
  city_id: 'город',
  meeting_point: 'место встречи с точкой на карте',
  summary: 'краткое описание',
  description: 'подробное описание',
  cover_image_id: 'обложка',
  duration_minutes: 'длительность',
  languages: 'языки проведения',
  tickets: 'билеты с ценой',
};

export const TEXT_LANGS = [
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'Английский' },
  { code: 'de', label: 'Немецкий' },
  { code: 'es', label: 'Испанский' },
  { code: 'fr', label: 'Французский' },
  { code: 'it', label: 'Итальянский' },
];

export const SPOKEN_LANGS = [...TEXT_LANGS, { code: 'zh', label: 'Китайский' }];

export const CURRENCIES = ['RUB', 'EUR', 'USD'];

export function pickText(value, lang = 'ru') {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value[lang] || value.ru || value.en || Object.values(value).find(Boolean) || '';
}

export function setText(value, lang, text) {
  return { ...(value || {}), [lang]: text };
}

export function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export function parseCoords(raw) {
  const match = String(raw || '').trim().match(/^(-?\d{1,2}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1].replace(',', '.'));
  const lon = Number(match[2].replace(',', '.'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}
