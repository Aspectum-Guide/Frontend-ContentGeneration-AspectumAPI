/**
 * Парсинг пары координат из одной строки.
 * Поддерживает форматы: "55.7558, 37.6173", "55.7558 37.6173",
 * "55.7558;37.6173", "55,7558 37,6173" (десятичная запятая).
 * Возвращает { lat, lon } числами или null, если строка не похожа на пару координат.
 */
export function parseCoordinatePair(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;

  // Десятичная запятая ("55,7558; 37,6173") -> точка
  const normalized = /^[-+]?\d+,\d+[;\s]+[-+]?\d+,\d+$/.test(text)
    ? text.replace(/,/g, '.')
    : text;

  const numbers = normalized.match(/[-+]?\d+(?:\.\d+)?/g);
  if (!numbers || numbers.length !== 2) return null;

  // Кроме двух чисел и разделителей ничего быть не должно — иначе это обычный текст
  const leftovers = normalized
    .replace(/[-+]?\d+(?:\.\d+)?/g, '')
    .replace(/[,;\s]/g, '');
  if (leftovers) return null;

  const lat = Number.parseFloat(numbers[0]);
  const lon = Number.parseFloat(numbers[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;

  return { lat, lon };
}

/**
 * Создаёт onPaste-обработчик для полей широты/долготы: если в буфере
 * обмена пара координат — заполняет оба поля разом через applyPair({ lat, lon }).
 * Иначе вставка работает как обычно.
 */
export function createCoordinatePasteHandler(applyPair) {
  return (event) => {
    const pair = parseCoordinatePair(event.clipboardData?.getData('text'));
    if (!pair) return;
    event.preventDefault();
    applyPair(pair);
  };
}
