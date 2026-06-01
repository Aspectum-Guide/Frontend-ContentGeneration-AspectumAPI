import { getTicketTypeLabel } from '../labels';

/**
 * Standard `<select>` of ticket types for booking catalog forms.
 * Pass `multiple` to render a multi-select bound to an array of ids.
 */
export default function TicketTypeSelect({
  value,
  onChange,
  options,
  disabled = false,
  required = false,
  placeholder = 'Выберите тип билета',
  className,
  ariaLabel,
  multiple = false,
  size,
}) {
  if (multiple) {
    return (
      <select
        multiple
        value={Array.isArray(value) ? value : []}
        onChange={(e) => {
          const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
          onChange?.(selected);
        }}
        disabled={disabled}
        aria-label={ariaLabel}
        size={size}
        className={
          className ||
          'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none'
        }
      >
        {(options || []).map((tt) => (
          <option key={tt.id} value={tt.id}>
            {getTicketTypeLabel(tt) || tt.id}
          </option>
        ))}
      </select>
    );
  }

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
      {(options || []).map((tt) => (
        <option key={tt.id} value={tt.id}>
          {getTicketTypeLabel(tt) || tt.id}
        </option>
      ))}
    </select>
  );
}
