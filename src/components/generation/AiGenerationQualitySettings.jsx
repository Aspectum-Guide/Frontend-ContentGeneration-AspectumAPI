export const DEFAULT_GENERATION_MODE = 'instant';

export const DEEP_RESEARCH_MODES = new Set(['deep_research_mini', 'deep_research_full']);

export function isDeepResearchMode(mode) {
  return DEEP_RESEARCH_MODES.has(mode);
}

export const GENERATION_MODE_OPTIONS = [
  {
    value: 'instant',
    label: 'Instant',
    description: 'Быстрее и дешевле. Подходит для простых генераций.',
    requiresOpenAI: false,
  },
  {
    value: 'thinking_standard',
    label: 'Thinking Standard',
    description:
      'Более внимательная генерация. Лучше для больших пачек и структурированных данных.',
    requiresOpenAI: true,
  },
  {
    value: 'thinking_extended',
    label: 'Thinking Extended',
    description: 'Максимально вдумчивая генерация. Дольше и дороже.',
    requiresOpenAI: true,
  },
  {
    value: 'deep_research_mini',
    label: 'Deep Research Mini',
    description:
      'Исследовательская генерация с встроенным поиском. Дольше, но лучше для сложных и объёмных задач.',
    requiresOpenAI: true,
  },
  {
    value: 'deep_research_full',
    label: 'Deep Research Full',
    description:
      'Максимальный Deep Research с встроенным поиском. Самый долгий режим — для самых сложных генераций.',
    requiresOpenAI: true,
  },
];

export function buildGenerationPayloadFields(generationMode, useWebSearch) {
  const mode = generationMode || DEFAULT_GENERATION_MODE;
  return {
    generation_mode: mode,
    use_web_search: isDeepResearchMode(mode) ? false : Boolean(useWebSearch),
  };
}

export default function AiGenerationQualitySettings({
  generationMode = DEFAULT_GENERATION_MODE,
  onGenerationModeChange,
  useWebSearch = false,
  onUseWebSearchChange,
  disabled = false,
  advancedDisabled = false,
  className = '',
}) {
  const deepResearchSelected = isDeepResearchMode(generationMode);
  const webSearchDisabled = disabled || advancedDisabled || deepResearchSelected;

  const handleModeChange = (value) => {
    onGenerationModeChange?.(value);
    if (isDeepResearchMode(value) && useWebSearch) {
      onUseWebSearchChange?.(false);
    }
  };

  return (
    <fieldset className={`space-y-3 ${className}`.trim()}>
      <legend className="text-sm font-medium text-gray-700">Качество генерации</legend>

      <div className="space-y-2">
        {GENERATION_MODE_OPTIONS.map((option) => {
          const optionDisabled =
            disabled || (option.requiresOpenAI && advancedDisabled);

          return (
            <label
              key={option.value}
              className={`flex items-start gap-3 rounded-lg border px-3 py-2 ${
                generationMode === option.value
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-gray-200'
              } ${optionDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <input
                type="radio"
                name="generation_mode"
                value={option.value}
                checked={generationMode === option.value}
                onChange={() => handleModeChange(option.value)}
                disabled={optionDisabled}
                className="mt-1"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-gray-900">
                  {option.label}
                </span>
                <span className="block text-xs text-gray-500 mt-0.5">
                  {option.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {advancedDisabled && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Режимы Thinking, Deep Research и Web Search доступны только с провайдером OpenAI.
        </p>
      )}

      {deepResearchSelected ? (
        <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          Deep Research использует встроенный исследовательский поиск. Отдельный Web Search не нужен.
        </p>
      ) : (
        <label
          className={`flex items-start gap-3 rounded-lg border border-gray-200 px-3 py-2 ${
            webSearchDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
          }`}
        >
          <input
            type="checkbox"
            checked={Boolean(useWebSearch)}
            onChange={(e) => onUseWebSearchChange?.(e.target.checked)}
            disabled={webSearchDisabled}
            className="mt-1"
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-gray-900">
              Использовать Web Search
            </span>
            <span className="block text-xs text-gray-500 mt-0.5">
              Может повысить точность и актуальность, но генерация будет дольше.
            </span>
          </span>
        </label>
      )}
    </fieldset>
  );
}
