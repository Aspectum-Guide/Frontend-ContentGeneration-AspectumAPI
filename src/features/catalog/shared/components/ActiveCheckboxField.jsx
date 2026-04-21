import { Field } from '../../../../components/ui/FormField';

export default function ActiveCheckboxField({ label = 'Статус', checked, onChange, text }) {
  return (
    <Field label={label}>
      <label className="flex items-center gap-2 select-none cursor-pointer w-fit pt-2">
        <input
          type="checkbox"
          checked={!!checked}
          onChange={(e) => onChange?.(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-700">{text}</span>
      </label>
    </Field>
  );
}
