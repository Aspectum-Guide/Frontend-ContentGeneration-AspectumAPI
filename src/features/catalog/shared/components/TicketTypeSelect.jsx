import { Select } from '@aspectum/admin-ui-web';
import { getTicketTypeLabel } from '../labels';

/**
 * Standard select of ticket types for booking catalog forms.
 * Pass `multiple` to render a multi-select bound to an array of ids.
 */
export default function TicketTypeSelect({
  value,
  onChange,
  options,
  disabled = false,
  required = false,
  placeholder = 'Выберите тип билета',
  className = '',
  ariaLabel,
  multiple = false,
  size,
}) {
  if (multiple) {
    return (
      <Select
        multiple
        value={Array.isArray(value) ? value : []}
        onChange={(e) => {
          const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
          onChange?.(selected);
        }}
        disabled={disabled}
        aria-label={ariaLabel}
        size={size}
        className={className}
      >
        {(options || []).map((tt) => (
          <option key={tt.id} value={tt.id}>
            {getTicketTypeLabel(tt) || tt.id}
          </option>
        ))}
      </Select>
    );
  }

  return (
    <Select
      value={value || ''}
      onChange={(e) => onChange?.(e.target.value)}
      disabled={disabled}
      required={required}
      aria-label={ariaLabel}
      className={className}
    >
      <option value="">{placeholder}</option>
      {(options || []).map((tt) => (
        <option key={tt.id} value={tt.id}>
          {getTicketTypeLabel(tt) || tt.id}
        </option>
      ))}
    </Select>
  );
}
