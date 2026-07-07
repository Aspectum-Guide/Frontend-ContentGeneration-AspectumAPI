const normalizeFieldLabel = (value) =>
  String(value || '')
    .replace(/\*/g, '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[\s_-]+/g, ' ');

const parseNumber = (value) => {
  const match = String(value || '').match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0].replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

const parseCoordinatePair = (value) => {
  const text = String(value || '');
  const match = text.match(
    /(-?\d+(?:[.,]\d+)?)\s*[,;]\s*(-?\d+(?:[.,]\d+)?)/,
  );

  if (!match) return null;

  const lat = Number(match[1].replace(',', '.'));
  const lon = Number(match[2].replace(',', '.'));

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    return null;
  }

  return { lat, lon };
};

const clampRank = (value) => {
  const parsed = parseNumber(value);
  if (parsed == null) return 5;
  return Math.max(1, Math.min(10, Math.round(parsed)));
};

const parseIndex = (value) => {
  const parsed = parseNumber(value);
  if (parsed == null) return 1;
  return Math.max(1, Math.round(parsed));
};

const isFieldLine = (line) => /^\s{0,3}(?:[-*]\s*)?[^:\n]{2,40}\s*:\s*/.test(line);

const splitFieldLine = (line) => {
  const cleaned = String(line || '').replace(/^\s{0,3}[-*]\s*/, '');
  const idx = cleaned.indexOf(':');
  if (idx < 0) return null;
  return {
    label: normalizeFieldLabel(cleaned.slice(0, idx)),
    value: cleaned.slice(idx + 1).trim(),
  };
};

const isDescriptionLabel = (label) =>
  [
    'описание',
    'текст',
    'description',
    'desc',
    'content',
    'main text',
  ].includes(label);

const isCoordinatesLabel = (label) =>
  [
    'координаты',
    'координата',
    'coords',
    'coordinates',
    'lat lon',
    'latitude longitude',
  ].includes(label);

const isLatLabel = (label) =>
  ['широта', 'lat', 'latitude'].includes(label);

const isLonLabel = (label) =>
  ['долгота', 'lon', 'lng', 'longitude'].includes(label);

const isNameLabel = (label) =>
  ['название', 'имя', 'name', 'title'].includes(label);

const isIndexLabel = (label) =>
  ['индекс', 'index', 'order', 'порядок'].includes(label);

const isRankLabel = (label) =>
  ['ранг', 'rank', 'rating', 'оценка', 'важность'].includes(label);

const parseAttractionBlock = (heading, lines) => {
  let name = String(heading || '').trim();
  let lat = null;
  let lon = null;
  let index = 1;
  let rank = 5;
  const descriptionLines = [];
  let inDescription = false;

  lines.forEach((rawLine) => {
    const line = String(rawLine || '');
    const field = isFieldLine(line) ? splitFieldLine(line) : null;

    if (field) {
      const { label, value } = field;

      if (isDescriptionLabel(label)) {
        inDescription = true;
        if (value) descriptionLines.push(value);
        return;
      }

      if (isNameLabel(label)) {
        if (value) name = value;
        inDescription = false;
        return;
      }

      if (isCoordinatesLabel(label)) {
        const coords = parseCoordinatePair(value);
        if (coords) {
          lat = coords.lat;
          lon = coords.lon;
        }
        inDescription = false;
        return;
      }

      if (isLatLabel(label)) {
        const parsed = parseNumber(value);
        if (parsed != null && parsed >= -90 && parsed <= 90) lat = parsed;
        inDescription = false;
        return;
      }

      if (isLonLabel(label)) {
        const parsed = parseNumber(value);
        if (parsed != null && parsed >= -180 && parsed <= 180) lon = parsed;
        inDescription = false;
        return;
      }

      if (isIndexLabel(label)) {
        index = parseIndex(value);
        inDescription = false;
        return;
      }

      if (isRankLabel(label)) {
        rank = clampRank(value);
        inDescription = false;
        return;
      }
    }

    if (inDescription || !field) {
      descriptionLines.push(line);
    }
  });

  const description = descriptionLines.join('\n').trim();

  return {
    name,
    description,
    lat,
    lon,
    index,
    rank,
  };
};

export const parseAttractionsTextImport = (rawText) => {
  if (!rawText || typeof rawText !== 'string') return [];

  const headingRe = /^\s{0,3}#{1,6}\s*(.*\S)\s*$/;
  const lines = rawText.replace(/\r\n?/g, '\n').split('\n');

  const blocks = [];
  let current = null;

  lines.forEach((line) => {
    const match = line.match(headingRe);

    if (match) {
      current = { heading: match[1].trim(), lines: [] };
      blocks.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  });

  return blocks
    .map((block) => parseAttractionBlock(block.heading, block.lines))
    .filter((item) => item.name);
};

