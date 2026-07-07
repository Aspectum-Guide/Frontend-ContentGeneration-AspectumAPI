export const parseUsefulInfoTextImport = (rawText) => {
  if (!rawText || typeof rawText !== 'string') return [];

  const headingRe = /^\s{0,3}#{1,6}\s*(.*\S)\s*$/;
  const lines = rawText.replace(/\r\n?/g, '\n').split('\n');

  const items = [];
  let current = null;

  lines.forEach((line) => {
    const match = line.match(headingRe);

    if (match) {
      current = { title: match[1].trim(), bodyLines: [] };
      items.push(current);
    } else if (current) {
      current.bodyLines.push(line);
    }
  });

  return items
    .map((item) => ({
      title: item.title,
      text: item.bodyLines.join('\n').trim(),
    }))
    .filter((item) => item.title);
};

