import { useRef } from 'react';
import TabButton from './TabButton';

/**
 * Горизонтальные вкладки.
 * items: [{ id, label, disabled? }]
 */
export default function Tabs({ items = [], value, onChange, className = '' }) {
  const tabRefs = useRef(new Map());
  const enabledItems = items.filter((item) => !item.disabled);

  const moveFocus = (event, currentId) => {
    const currentIndex = enabledItems.findIndex((item) => item.id === currentId);
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
    tabRefs.current.get(next.id)?.focus();
  };

  return (
    <div role="tablist" className={`flex flex-wrap gap-2 ${className}`}>
      {items.map((item) => {
        const active = value === item.id;
        return (
          <TabButton
            key={item.id}
            selected={active}
            disabled={item.disabled}
            onClick={() => onChange?.(item.id)}
            onKeyDown={(event) => moveFocus(event, item.id)}
            ref={(node) => { if (node) tabRefs.current.set(item.id, node); else tabRefs.current.delete(item.id); }}
            className={`rounded-aspectum-control px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
              active
                ? 'bg-aspectum-primary-soft text-aspectum-primary-hover'
                : 'text-aspectum-text-muted hover:bg-aspectum-surface-muted'
            }`}
          >
            {item.label}
          </TabButton>
        );
      })}
    </div>
  );
}
