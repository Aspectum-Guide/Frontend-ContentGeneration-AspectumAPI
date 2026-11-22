import { FormLabel, Checkbox } from '@aspectum/admin-ui-web';

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
    <div className={`rounded-aspectum-control border border-aspectum-border bg-aspectum-surface-muted px-3 py-3 space-y-2 ${className}`.trim()}>
      <FormLabel  layout="rowSpread" interactive>
        <span className="text-sm font-medium text-aspectum-text">Исключать дубли</span>
        <Checkbox
          checked={Boolean(checked)}
          onChange={(e) => onChange?.(e.target.checked)}
          disabled={disabled}
          className="h-4 w-4 rounded border-aspectum-border-strong text-aspectum-primary focus:ring-aspectum-focus disabled:opacity-50"
        />
      </FormLabel>
      <p className="text-xs text-aspectum-text-subtle">{checked ? helperOn : helperOff}</p>
    </div>
  );
}
