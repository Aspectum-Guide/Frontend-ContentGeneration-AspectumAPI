import Checkbox from './Checkbox';
import { Field } from './FormField';

export default function CheckboxField({ label = 'Статус', checked, onChange, text, disabled = false }) {
  return (
    <Field label={label}>
      <label className="flex items-center gap-2 select-none cursor-pointer w-fit pt-2">
        <Checkbox
          checked={!!checked}
          disabled={disabled}
          onChange={(event) => onChange?.(event.target.checked)}
        />
        {text && <span className="text-sm text-aspectum-text-strong">{text}</span>}
      </label>
    </Field>
  );
}
