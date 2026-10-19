import { Field, TextInput } from '@aspectum/admin-ui-web';
import { COUNT_LIMITS } from './generationUtils';

export default function AiGenerationCountField({
  id,
  label,
  value,
  onChange,
  generationType = 'cities',
  disabled = false,
  helperText = 'Количество задаётся отдельным полем, не нужно писать число в запросе.',
}) {
  const limits = COUNT_LIMITS[generationType] || COUNT_LIMITS.cities;

  return (
    <Field label={label} hint={helperText}>
      <TextInput
        id={id}
        type="number"
        min={limits.min}
        max={limits.max}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
      />
    </Field>
  );
}
