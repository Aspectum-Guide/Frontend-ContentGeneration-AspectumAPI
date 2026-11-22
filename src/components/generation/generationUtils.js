export const COUNT_LIMITS = {
  cities: { min: 1, max: 50, default: 5 },
  attractions: { min: 1, max: 50, default: 5 },
  interactive_locations: { min: 1, max: 50, default: 5 },
  city_info: { min: 1, max: 20, default: 5 },
  attraction_info: { min: 1, max: 20, default: 5 },
};

export function clampGenerationCount(value, generationType = 'cities') {
  const limits = COUNT_LIMITS[generationType] || COUNT_LIMITS.cities;
  let count = parseInt(String(value), 10);
  if (Number.isNaN(count)) count = limits.default;
  return Math.max(limits.min, Math.min(limits.max, count));
}

export const DEFAULT_GENERATION_MODE = 'instant';

export const DEEP_RESEARCH_MODES = new Set(['deep_research_mini', 'deep_research_full']);

export function isDeepResearchMode(mode) {
  return DEEP_RESEARCH_MODES.has(mode);
}

export const GENERATION_MODE_OPTIONS = [
  { value: 'instant', label: 'Instant', description: 'Быстрее и дешевле. Подходит для простых генераций.', requiresOpenAI: false },
  { value: 'thinking_standard', label: 'Thinking Standard', description: 'Более внимательная генерация. Лучше для больших пачек и структурированных данных.', requiresOpenAI: true },
  { value: 'thinking_extended', label: 'Thinking Extended', description: 'Максимально вдумчивая генерация. Дольше и дороже.', requiresOpenAI: true },
  { value: 'deep_research_mini', label: 'Deep Research Mini', description: 'Исследовательская генерация с встроенным поиском. Дольше, но лучше для сложных и объёмных задач.', requiresOpenAI: true },
  { value: 'deep_research_full', label: 'Deep Research Full', description: 'Максимальный Deep Research с встроенным поиском. Самый долгий режим — для самых сложных генераций.', requiresOpenAI: true },
];

export function buildGenerationPayloadFields(generationMode, useWebSearch) {
  const mode = generationMode || DEFAULT_GENERATION_MODE;
  return {
    generation_mode: mode,
    use_web_search: isDeepResearchMode(mode) ? false : Boolean(useWebSearch),
  };
}

export function formatGenerationDedupeResultMessage(createData, { dedupeField = 'dedupe_existing_items' } = {}) {
  const data = createData || {};
  const createdCount = typeof data.created_count === 'number' ? data.created_count : 0;
  const requestedCount = data.requested_count;
  const dedupeOn = data[dedupeField] !== false;
  const skippedExisting = data.skipped_existing_duplicates_count || 0;
  const skippedBatch = data.skipped_batch_duplicates_count || 0;
  const skippedInvalid = data.skipped_invalid_count || 0;
  const refillAttempts = data.refill_attempts || 0;

  let message = `Создано: ${createdCount}`;
  if (typeof requestedCount === 'number') message += ` из ${requestedCount}`;
  if (dedupeOn) {
    if (skippedExisting > 0) message += `. Пропущено дублей с существующими: ${skippedExisting}`;
  } else {
    message += '. Дубли с существующими разрешены';
  }
  if (skippedBatch > 0) message += `. Пропущено повторов в ответе AI: ${skippedBatch}`;
  if (skippedInvalid > 0) message += `. Пропущено некорректных: ${skippedInvalid}`;
  if (refillAttempts > 0) message += `. Догенерация: ${refillAttempts}/1`;
  return message;
}
