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
  const list = options || [];
  // Пока `options` ещё грузятся (или само событие по какой-то причине не
  // попало в справочник), для уже выбранного `value` может не быть <option>
  // — без этого select молча откатывается на пустой placeholder, хотя
  // событие на самом деле выбрано. Подставляем временный option с самим id,
  // чтобы значение оставалось видимым, пока не подтянется настоящий лейбл.
  const hasValueOption = !value || list.some((ev) => String(ev.id) === String(value));

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
      {!hasValueOption ? <option value={value}>{value}</option> : null}
      {list.map((ev) => (
        <option key={ev.id} value={ev.id}>
          {getEventLabel(ev) || ev.id}
        </option>
      ))}
    </select>
  );
}
