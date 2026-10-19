import { Field, Textarea, TextInput } from './FormField';

export default function LocaleField({
  label,
  value = {},
  onChange,
  activeLocale,
  multiline = false,
  rows = 3,
  required = false,
  className = '',
}) {
  if (!activeLocale) return null;

  const input = multiline ? (
    <Textarea
      value={value?.[activeLocale] || ''}
      onChange={(event) => onChange?.({ ...value, [activeLocale]: event.target.value })}
      rows={rows}
      placeholder={`${label} (${activeLocale})`}
    />
  ) : (
    <TextInput
      value={value?.[activeLocale] || ''}
      onChange={(event) => onChange?.({ ...value, [activeLocale]: event.target.value })}
      placeholder={`${label} (${activeLocale})`}
    />
  );

  return (
    <div className={className}>
      <Field
        required={required}
        label={<>{label} <span className="text-aspectum-text-muted font-normal uppercase text-xs">{activeLocale}</span></>}
      >
      {input}
      </Field>
    </div>
  );
}
