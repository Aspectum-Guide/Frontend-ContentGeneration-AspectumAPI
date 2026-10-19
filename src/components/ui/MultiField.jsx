import { useEffect, useState } from 'react';
import Tabs from './Tabs';
import { Textarea, TextInput } from './FormField';

/**
 * Универсальное поле для объекта значений вида { key: value }.
 * Компонент ничего не знает о природе ключей: это могут быть языки,
 * регионы, версии или любые другие варианты одного поля.
 */
export default function MultiField({
  items = [],
  value = {},
  onChange,
  multiline = false,
  rows = 3,
  placeholder,
  disabled = false,
  errors = {},
  className = '',
}) {
  const [active, setActive] = useState(items[0]?.id || '');

  useEffect(() => {
    if (items.length && !items.some((item) => item.id === active)) {
      setActive(items[0].id);
    }
  }, [items, active]);

  const activeItem = items.find((item) => item.id === active) || items[0];
  if (!activeItem) return null;

  const handleChange = (event) => {
    onChange?.({ ...value, [activeItem.id]: event.target.value });
  };

  return (
    <div className={`space-y-2 ${className}`.trim()}>
      <Tabs
        items={items.map(({ id, label, disabled: itemDisabled }) => ({ id, label, disabled: itemDisabled }))}
        value={activeItem.id}
        onChange={setActive}
      />
      {multiline ? (
        <Textarea
          value={value?.[activeItem.id] || ''}
          onChange={handleChange}
          rows={rows}
          placeholder={placeholder || activeItem.placeholder}
          disabled={disabled}
        />
      ) : (
        <TextInput
          value={value?.[activeItem.id] || ''}
          onChange={handleChange}
          placeholder={placeholder || activeItem.placeholder}
          disabled={disabled}
        />
      )}
      {errors?.[activeItem.id] && <p className="text-sm text-aspectum-danger">{errors[activeItem.id]}</p>}
    </div>
  );
}
