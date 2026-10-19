import { useEffect, useId, useState } from 'react';
import SelectableRow from './SelectableRow';
import { useFieldContextValue } from './FieldContext';
import { TextInput } from './FormField';

export default function SearchSelect({
  value = '',
  onChange,
  placeholder = 'Поиск...',
  options = [],
  loading = false,
  renderOption,
  onSelect,
  isOptionDisabled,
  disabled = false,
  emptyText = 'Ничего не найдено',
  minQueryLength = 1,
  ariaLabel,
  className = '',
}) {
  const fieldContext = useFieldContextValue();
  const listboxId = useId();
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dismissed, setDismissed] = useState(false);
  const queryReady = value.trim().length >= minQueryLength;
  const visible = queryReady && !dismissed && !disabled;
  const optionDisabled = (option) => disabled || Boolean(isOptionDisabled?.(option));
  const enabledIndices = loading ? [] : options.reduce((indices, option, index) => {
    if (!optionDisabled(option)) indices.push(index);
    return indices;
  }, []);
  const activeOptionId = visible && !loading && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;

  useEffect(() => {
    if (activeIndex >= options.length) setActiveIndex(-1);
  }, [activeIndex, options.length]);

  const selectOption = (option) => {
    if (optionDisabled(option)) return;
    onSelect?.(option);
    setDismissed(true);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      if (visible) event.preventDefault();
      setDismissed(true);
      setActiveIndex(-1);
      return;
    }
    if (event.key === 'Enter' && visible && !loading && activeIndex >= 0) {
      event.preventDefault();
      selectOption(options[activeIndex]);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    setDismissed(false);
    if (enabledIndices.length === 0) return;
    const currentPosition = enabledIndices.indexOf(activeIndex);
    const delta = event.key === 'ArrowDown' ? 1 : -1;
    const nextPosition = currentPosition < 0
      ? (delta > 0 ? 0 : enabledIndices.length - 1)
      : (currentPosition + delta + enabledIndices.length) % enabledIndices.length;
    setActiveIndex(enabledIndices[nextPosition]);
  };

  return (
    <div className={className}>
      <TextInput
        role="combobox"
        aria-label={ariaLabel || (!fieldContext ? placeholder : undefined)}
        aria-autocomplete="list"
        aria-expanded={visible}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        disabled={disabled}
        value={value}
        onChange={(event) => { setDismissed(false); setActiveIndex(-1); onChange?.(event.target.value); }}
        onFocus={() => { if (queryReady) setDismissed(false); }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
      {visible && (
        <div id={listboxId} role="listbox" className="mt-1 max-h-48 overflow-y-auto rounded-aspectum-control border border-aspectum-border bg-aspectum-surface">
          {loading && <p className="p-2 text-xs text-aspectum-text-muted">Поиск...</p>}
          {!loading && options.length === 0 && <p className="p-2 text-xs text-aspectum-text-muted">{emptyText}</p>}
          {!loading && options.map((option, index) => (
            <SelectableRow
              key={option.id}
              id={`${listboxId}-option-${index}`}
              role="option"
              tabIndex={-1}
              selected={index === activeIndex}
              disabled={optionDisabled(option)}
              onMouseEnter={() => { if (!optionDisabled(option)) setActiveIndex(index); }}
              onClick={() => selectOption(option)}
              className="flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-aspectum-violet/10 border-b border-aspectum-border last:border-0"
            >
              {renderOption ? renderOption(option) : option.label || option.name || option.id}
            </SelectableRow>
          ))}
        </div>
      )}
    </div>
  );
}
