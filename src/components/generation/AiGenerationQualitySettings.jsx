import { DEFAULT_GENERATION_MODE,
  GENERATION_MODE_OPTIONS,
  isDeepResearchMode,
} from './generationUtils';
import { FormLabel, Checkbox, RadioGroup } from '@aspectum/ui';

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
      <legend className="text-sm font-medium text-aspectum-text-strong">Качество генерации</legend>

      <RadioGroup
        name="generation_mode"
        value={generationMode}
        onChange={handleModeChange}
        disabled={disabled}
        options={GENERATION_MODE_OPTIONS.map((option) => ({
          ...option,
          disabled: option.requiresOpenAI && advancedDisabled,
        }))}
      />

      {advancedDisabled && (
        <p className="text-xs text-aspectum-warning-strong bg-aspectum-warning-soft border border-aspectum-warning-border rounded-aspectum-control px-3 py-2">
          Режимы Thinking, Deep Research и Web Search доступны только с провайдером OpenAI.
        </p>
      )}

      {deepResearchSelected ? (
        <p className="text-xs text-aspectum-text-subtle bg-aspectum-surface-muted border border-aspectum-border rounded-aspectum-control px-3 py-2">
          Deep Research использует встроенный исследовательский поиск. Отдельный Web Search не нужен.
        </p>
      ) : (
        <FormLabel
          className={`flex items-start gap-3 rounded-aspectum-control border border-aspectum-border px-3 py-2 ${
            webSearchDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
          }`}
        >
          <Checkbox
            checked={Boolean(useWebSearch)}
            onChange={(e) => onUseWebSearchChange?.(e.target.checked)}
            disabled={webSearchDisabled}
            className="mt-1"
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-aspectum-text">
              Использовать Web Search
            </span>
            <span className="block text-xs text-aspectum-text-muted mt-0.5">
              Может повысить точность и актуальность, но генерация будет дольше.
            </span>
          </span>
        </FormLabel>
      )}
    </fieldset>
  );
}
