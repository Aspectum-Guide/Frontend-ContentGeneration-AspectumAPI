const HELPER_TEXT = {
  city_info: {
    on: 'Уже существующие блоки полезной информации по этому городу будут переданы модели и исключены из результата.',
    off: 'Повторы с уже существующей полезной информацией разрешены. Повторы внутри одного ответа AI всё равно не создаются.',
  },
  attraction_info: {
    on: 'Уже существующие блоки полезной информации по этой достопримечательности будут переданы модели и исключены из результата.',
    off: 'Повторы с уже существующей полезной информацией разрешены. Повторы внутри одного ответа AI всё равно не создаются.',
  },
  attractions: {
    on: 'Уже существующие достопримечательности города из базы и черновиков будут переданы модели и исключены из результата.',
    off: 'Повторы с уже существующими достопримечательностями разрешены. Повторы внутри одного ответа AI всё равно не создаются.',
  },
  interactive_locations: {
    on: 'Уже существующие достопримечательности и интерактивные локации города будут переданы модели и исключены из результата.',
    off: 'Повторы с существующими достопримечательностями и интерактивными локациями разрешены. Повторы внутри одного ответа AI всё равно не создаются.',
  },
};

export default function AiGenerationDedupeToggle({
  checked = true,
  onChange,
  disabled = false,
  entityType = 'attractions',
  enabledText,
  disabledText,
  className = '',
}) {
  const texts = HELPER_TEXT[entityType] || HELPER_TEXT.attractions;
  const helperOn = enabledText || texts.on;
  const helperOff = disabledText || texts.off;

  return (
    <div className={`rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 space-y-2 ${className}`.trim()}>
      <label className="flex items-center justify-between gap-3 cursor-pointer">
        <span className="text-sm font-medium text-gray-900">Исключать дубли</span>
        <input
          type="checkbox"
          checked={Boolean(checked)}
          onChange={(e) => onChange?.(e.target.checked)}
          disabled={disabled}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
        />
      </label>
      <p className="text-xs text-gray-600">{checked ? helperOn : helperOff}</p>
    </div>
  );
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
  if (typeof requestedCount === 'number') {
    message += ` из ${requestedCount}`;
  }
  if (dedupeOn) {
    if (skippedExisting > 0) {
      message += `. Пропущено дублей с существующими: ${skippedExisting}`;
    }
  } else {
    message += '. Дубли с существующими разрешены';
  }
  if (skippedBatch > 0) {
    message += `. Пропущено повторов в ответе AI: ${skippedBatch}`;
  }
  if (skippedInvalid > 0) {
    message += `. Пропущено некорректных: ${skippedInvalid}`;
  }
  if (refillAttempts > 0) {
    message += `. Догенерация: ${refillAttempts}/1`;
  }
  return message;
}
