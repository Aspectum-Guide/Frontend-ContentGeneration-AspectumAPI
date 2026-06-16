export const normalizeId = (value: unknown): string => {
  if (value === null || value === undefined) return '';

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return String(obj.id ?? obj.uuid ?? obj.pk ?? '').trim();
  }

  return String(value).trim();
};

export const normalizeTagIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  return [...new Set(
    value
      .map((item) => {
        if (item == null) return '';

        if (typeof item === 'object') {
          const obj = item as Record<string, unknown>;
          return String(obj.id ?? obj.uuid ?? obj.pk ?? '');
        }

        return String(item);
      })
      .filter(Boolean)
  )];
};
