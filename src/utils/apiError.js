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

export function parseApiError(error, fallback = 'Произошла ошибка') {
  const data = error?.response?.data;

  const message = pickFirstString(
    data?.error
    || data?.detail
    || data?.message
    || data?.non_field_errors
    || data
  );

  if (message) return message;
  if (typeof error?.message === 'string' && error.message.trim()) return error.message.trim();
  return fallback;
}

export default parseApiError;