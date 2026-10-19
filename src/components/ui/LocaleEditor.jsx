import { useRef } from 'react';
import Button from './Button';
import IconButton from './IconButton';
import TabButton from './TabButton';
import { Star } from 'lucide-react';

function localeStatus(locale = {}) {
  const filled = [locale.name, locale.description, locale.country].filter((value) => (value || '').trim()).length;
  return filled === 3 ? 'complete' : filled > 0 ? 'partial' : 'empty';
}

export default function LocaleEditor({
  localeData = {},
  activeLocale,
  defaultLocale,
  onSwitch,
  onSetDefault,
  onAddLocale,
  onRemoveLocale,
  showStatus = true,
  className = '',
}) {
  const tabRefs = useRef(new Map());
  const localeKeys = Object.keys(localeData);
  const moveFocus = (event, currentKey) => {
    const currentIndex = localeKeys.indexOf(currentKey);
    let nextIndex;
    if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = localeKeys.length - 1;
    else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % localeKeys.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + localeKeys.length) % localeKeys.length;
    else return;
    event.preventDefault();
    const nextKey = localeKeys[nextIndex];
    if (!nextKey) return;
    onSwitch?.(nextKey);
    tabRefs.current.get(nextKey)?.focus();
  };

  return (
    <div role="tablist" aria-label="Языки редактора" className={`flex items-center gap-1.5 flex-wrap ${className}`.trim()}>
      {Object.entries(localeData).map(([key, locale]) => {
        const active = key === activeLocale;
        const isDefault = key === defaultLocale;
        const status = localeStatus(locale);
        const statusColor = status === 'complete' ? 'bg-aspectum-success' : status === 'partial' ? 'bg-aspectum-warning' : 'bg-aspectum-danger';
        return (
          <div key={key} className="flex items-center gap-0.5">
            <TabButton
              selected={active}
              onClick={() => onSwitch?.(key)}
              onKeyDown={(event) => moveFocus(event, key)}
              ref={(node) => { if (node) tabRefs.current.set(key, node); else tabRefs.current.delete(key); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-aspectum-control text-sm font-medium border ${active ? 'bg-aspectum-primary text-aspectum-on-accent border-aspectum-primary shadow-aspectum-card' : 'bg-aspectum-surface text-aspectum-text-muted border-aspectum-border hover:border-aspectum-primary hover:text-aspectum-primary'}`}
            >
              <span className="text-base leading-none">{locale.flag || locale.code?.toUpperCase()}</span>
              <span>{locale.langName || locale.lang || key.toUpperCase()}</span>
              {isDefault && <span className={`text-xs ${active ? 'text-aspectum-primary-soft' : 'text-aspectum-warning'}`}><Star className="size-3 fill-current" aria-hidden="true" /></span>}
              {showStatus && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusColor} ${active ? 'opacity-80' : ''}`} />}
            </TabButton>
            {!locale.isDefault && onRemoveLocale && <IconButton label="Удалить язык" onClick={() => onRemoveLocale(key)} variant="ghostDanger" size="iconXs">×</IconButton>}
            {!isDefault && onSetDefault && <IconButton label="Сделать основным" onClick={() => onSetDefault(key)} variant="ghostWarning" size="iconXs"><Star className="size-3" aria-hidden="true" /></IconButton>}
          </div>
        );
      })}
      {onAddLocale && <Button onClick={onAddLocale} title="Добавить язык" variant="outlineDashed" size="iconMd" className="font-light">+</Button>}
    </div>
  );
}
