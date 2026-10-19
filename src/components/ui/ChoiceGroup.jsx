import { useRef } from 'react';

const styles = {
  primary: {
    group: 'gap-1',
    item: 'px-2.5 py-1',
    active: 'bg-aspectum-primary text-aspectum-on-accent',
    inactive: 'bg-aspectum-surface-muted text-aspectum-text-muted hover:bg-aspectum-text/10',
  },
  violet: {
    group: 'gap-2',
    item: 'px-3 py-1.5 border',
    active: 'bg-aspectum-violet/10 border-aspectum-violet/40 text-aspectum-violet',
    inactive: 'bg-aspectum-surface border-aspectum-border text-aspectum-text-muted hover:bg-aspectum-surface-muted',
  },
};

export default function ChoiceGroup({
  items = [],
  value,
  onChange,
  multiple = false,
  disabled = false,
  tone = 'primary',
  ariaLabel,
  className = '',
}) {
  const itemRefs = useRef(new Map());
  const visual = styles[tone] || styles.primary;
  const selected = new Set((multiple ? value || [] : [value]).map(String));
  const enabledItems = items.filter((item) => !disabled && !item.disabled);
  const activeEnabledId = enabledItems.find((item) => selected.has(String(item.id)))?.id;
  const tabbableId = activeEnabledId ?? enabledItems[0]?.id;

  const selectItem = (item) => {
    const id = String(item.id);
    if (multiple) {
      const current = Array.isArray(value) ? value : [];
      onChange?.(selected.has(id)
        ? current.filter((entry) => String(entry) !== id)
        : [...current, item.id]);
    } else {
      onChange?.(item.id);
    }
  };

  const moveSingleSelection = (event, currentId) => {
    if (multiple || enabledItems.length === 0) return;
    const currentIndex = enabledItems.findIndex((item) => String(item.id) === String(currentId));
    let nextIndex;
    if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = enabledItems.length - 1;
    else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % enabledItems.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + enabledItems.length) % enabledItems.length;
    else return;
    event.preventDefault();
    const next = enabledItems[nextIndex];
    if (!next) return;
    onChange?.(next.id);
    itemRefs.current.get(String(next.id))?.focus();
  };

  return (
    <div
      role={multiple ? 'group' : 'radiogroup'}
      aria-label={ariaLabel}
      className={`flex flex-wrap ${visual.group} ${className}`.trim()}
    >
      {items.map((item) => {
        const id = String(item.id);
        const active = selected.has(id);
        const itemDisabled = disabled || item.disabled;
        return (
          <button
            key={id}
            ref={(node) => { if (node) itemRefs.current.set(id, node); else itemRefs.current.delete(id); }}
            type="button"
            role={multiple ? undefined : 'radio'}
            aria-pressed={multiple ? active : undefined}
            aria-checked={multiple ? undefined : active}
            tabIndex={multiple ? undefined : (String(tabbableId) === id ? 0 : -1)}
            disabled={itemDisabled}
            onClick={() => selectItem(item)}
            onKeyDown={(event) => moveSingleSelection(event, item.id)}
            className={`${visual.item} rounded-aspectum-control text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-aspectum-primary focus-visible:outline-offset-2 disabled:opacity-50 ${active ? visual.active : visual.inactive}`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
