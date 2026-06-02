function pickFirstString(value) {
  if (!value) return null;
  if (typeof value === 'string' && value.trim()) return value.trim();

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = pickFirstString(item);
      if (found) return found;
    }
    return null;
  }

  if (typeof value === 'object') {
    for (const nested of Object.values(value)) {
      const found = pickFirstString(nested);
      if (found) return found;
    }
  }

  return null;
}

function normalizeMessage(message) {
  if (typeof message !== 'string') return null;
  const trimmed = message.trim();
  if (!trimmed) return null;

  // Backend sometimes returns a full HTML debug/error page as a string.
  if (/<!doctype html/i.test(trimmed) || /<html[\s>]/i.test(trimmed)) {
    if (/ProtectedError/i.test(trimmed)) {
      return 'Нельзя удалить объект: есть связанные записи. Отключите его вместо удаления.';
    }
    return null;
  }

  return trimmed;
}

export function isNotFoundError(error) {
  return error?.response?.status === 404;
}

export function parseApiError(error, fallback = 'Произошла ошибка') {
  const data = error?.response?.data;

  const message = pickFirstString(
    data?.error
    || data?.detail
    || data?.message
    || data?.non_field_errors
    || data
  );

  const normalized = normalizeMessage(message);
  if (normalized) return normalized;

  const fallbackMessage = normalizeMessage(error?.message);
  if (fallbackMessage) return fallbackMessage;

  if (typeof data === 'string' && /ProtectedError/i.test(data)) {
    return 'Нельзя удалить объект: есть связанные записи. Отключите его вместо удаления.';
  }

  return fallback;
}

export default parseApiError;