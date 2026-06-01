import { getEventLabel } from '../labels';

/**
 * Standard `<select>` of events for booking catalog forms.
 * Use `placeholder` to override the empty-option label.
 */
export default function EventSelect({
  value,
  onChange,
  options,
  disabled = false,
  required = false,
  placeholder = 'Выберите событие',
  className,
  ariaLabel,
}) {
  return (
    <select
      value={value || ''}
      onChange={(e) => onChange?.(e.target.value)}
      disabled={disabled}
      required={required}
      aria-label={ariaLabel}
      className={
        className ||
        'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none'
      }
    >
      <option value="">{placeholder}</option>
      {(options || []).map((ev) => (
        <option key={ev.id} value={ev.id}>
          {getEventLabel(ev) || ev.id}
        </option>
      ))}
    </select>
  );
}
