export const LOCALE_FLAGS = {
  US: '🇺🇸', IT: '🇮🇹', RU: '🇷🇺', FR: '🇫🇷', DE: '🇩🇪', ES: '🇪🇸',
  JP: '🇯🇵', CN: '🇨🇳', KR: '🇰🇷', GB: '🇬🇧', UA: '🇺🇦', NL: '🇳🇱',
  PL: '🇵🇱', PT: '🇵🇹', TR: '🇹🇷', BR: '🇧🇷', CA: '🇨🇦', AU: '🇦🇺',
};

export const LOCALE_INFO_MAP = {
  ru: { code: 'RU', name: 'Русский' }, en: { code: 'US', name: 'Английский' },
  it: { code: 'IT', name: 'Итальянский' }, fr: { code: 'FR', name: 'Французский' },
  de: { code: 'DE', name: 'Немецкий' }, es: { code: 'ES', name: 'Испанский' },
  pl: { code: 'PL', name: 'Польский' }, pt: { code: 'PT', name: 'Португальский' },
  nl: { code: 'NL', name: 'Нидерландский' }, zh: { code: 'CN', name: 'Китайский' },
  ja: { code: 'JP', name: 'Японский' }, ko: { code: 'KR', name: 'Корейский' },
  tr: { code: 'TR', name: 'Турецкий' }, uk: { code: 'UA', name: 'Украинский' },
};

export const DEFAULT_LOCALE_DEFS = [
  { key: 'ru-RU', lang: 'ru', code: 'RU', langName: 'Русский', isDefault: true },
  { key: 'en-US', lang: 'en', code: 'US', langName: 'Английский', isDefault: true },
];

export function getLocaleInfo(lang) {
  const code = (lang || '').toLowerCase().substring(0, 2);
  return LOCALE_INFO_MAP[code] || { code: (lang || 'XX').toUpperCase().substring(0, 2), name: lang || 'Язык' };
}

export function getFlag(code) {
  return LOCALE_FLAGS[(code || '').toUpperCase()] || '🌍';
}

export function getCityDraftName(draft) {
  const name = draft?.name || {};
  return name.ru || name.en || name.it || Object.values(name).find(Boolean) || 'Новый город';
}

export function getAttrName(attr) {
  const name = attr?.name || {};
  return name.ru || name.en || name.it || Object.values(name).find(Boolean) || '(без названия)';
}

const STATUS_MAP = {
  draft: { label: 'Черновик', cls: 'bg-gray-100 text-gray-700' },
  in_progress: { label: 'В процессе', cls: 'bg-yellow-100 text-yellow-800' },
  completed: { label: 'Завершена', cls: 'bg-green-100 text-green-800' },
  published: { label: 'Опубликована', cls: 'bg-blue-100 text-blue-800' },
  closed_saved: { label: 'Закрыта (сохранена)', cls: 'bg-purple-100 text-purple-700' },
  closed_discarded: { label: 'Закрыта (отменена)', cls: 'bg-red-100 text-red-700' },
  corrected: { label: 'Скорректирована', cls: 'bg-teal-100 text-teal-700' },
};

export function StatusBadge({ status, label }) {
  const state = STATUS_MAP[status] || { label: label || status, cls: 'bg-gray-100 text-gray-600' };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${state.cls}`}>
      {label || state.label}
    </span>
  );
}