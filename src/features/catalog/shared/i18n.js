const KNOWN_LANGUAGE_META = {
  ru: { label: 'RU', flag: '🇷🇺' },
  en: { label: 'EN', flag: '🇺🇸' },
  it: { label: 'IT', flag: '🇮🇹' },
  fr: { label: 'FR', flag: '🇫🇷' },
  de: { label: 'DE', flag: '🇩🇪' },
  es: { label: 'ES', flag: '🇪🇸' },
};

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasAnyText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function extractLangCodes(values = [], fallback = []) {
  const set = new Set();

  for (const value of values) {
    if (!isPlainObject(value)) continue;
    for (const [lang, text] of Object.entries(value)) {
      if (typeof lang === 'string' && lang.trim()) {
        // include keys even if empty to allow managing translations via UI
        set.add(lang);
      } else if (hasAnyText(text)) {
        set.add(lang);
      }
    }
  }

  if (set.size === 0) {
    for (const lang of fallback) {
      if (typeof lang === 'string' && lang.trim()) {
        set.add(lang);
      }
    }
  }

  return [...set];
}

export function buildLangOptions(values = [], fallback) {
  return extractLangCodes(values, fallback).map((lang) => {
    const meta = KNOWN_LANGUAGE_META[lang];
    return {
      code: lang,
      label: meta?.label || lang.toUpperCase(),
      flag: meta?.flag || '🌐',
    };
  });
}

export function pickPrimaryLangCode(values = [], fallback = '') {
  const fallbackList = fallback ? [fallback] : [];
  const [first] = extractLangCodes(values, fallbackList);
  return first || fallback || '';
}

export function getMultiLangValue(value, preferredOrder = []) {
  if (!value) return '';
  if (typeof value === 'string') return value;

  if (!isPlainObject(value)) return '';

  for (const lang of preferredOrder) {
    const candidate = value?.[lang];
    if (hasAnyText(candidate)) {
      return candidate;
    }
  }

  const fallback = Object.values(value).find((item) => hasAnyText(item));
  return fallback || '';
}

export function getFilledLangCodes(value) {
  if (!isPlainObject(value)) return new Set();
  return new Set(
    Object.entries(value)
      .filter(([, text]) => hasAnyText(text))
      .map(([lang]) => lang)
  );
}
