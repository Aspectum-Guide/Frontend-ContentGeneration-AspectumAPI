import { useEffect, useRef, useState } from 'react';
import { Ellipsis, RotateCw } from 'lucide-react';
import { Button, DropdownPanel, IconButton } from '@aspectum/admin-ui-web';
import { orderActions } from './pageActions';

// Page actions are registered by pages through LayoutActionsContext. Map their
// loose `variant` strings onto kit button variants.
const BUTTON_VARIANT = { primary: 'primary', danger: 'outlineDanger' };


function ActionButton({ action, onRun }) {
  return (
    <Button
      type="button"
      size="md"
      variant={BUTTON_VARIANT[action.variant] || 'outline'}
      disabled={!!action.disabled}
      onClick={() => onRun(action)}
    >
      {action.label}
    </Button>
  );
}

/**
 * The page's actions as a toolbar over the content (instead of a far-away side column):
 * the first `maxInline` actions are buttons, the rest live in an "Ещё" menu. Renders
 * nothing when the page has no actions.
 */
export default function PageActionBar({ actions = [], maxInline = 3, sticky = true, onRefresh, className = '' }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setMenuOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  if (!actions.length) return null;

  const sorted = orderActions(actions);
  const inline = sorted.slice(0, maxInline);
  const overflow = sorted.slice(maxInline);

  const run = (action) => {
    setMenuOpen(false);
    action.onClick?.();
  };

  return (
    <div
      ref={rootRef}
      role="toolbar"
      aria-label="Действия страницы"
      data-ui="page-action-bar"
      className={`flex flex-wrap items-center justify-end gap-2 ${sticky ? 'sticky top-0 z-20 border-b border-aspectum-border bg-aspectum-surface-muted/95 px-[var(--aspectum-space-page-x)] py-2 backdrop-blur md:px-[var(--aspectum-space-page-x-lg)]' : ''} ${className}`.trim()}
    >
      {inline.map((action, index) => (
        <ActionButton key={action.id || `${action.label}-${index}`} action={action} onRun={run} />
      ))}
      {overflow.length > 0 && (
        <div className="relative">
          <Button
            type="button"
            size="md"
            variant="outline"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="gap-1.5"
          >
            <Ellipsis className="size-4" aria-hidden="true" />
            Ещё
          </Button>
          {menuOpen && (
            <DropdownPanel role="menu" aria-label="Другие действия" className="absolute right-0 top-full z-30 mt-1 w-60 space-y-0.5 p-1">
              {overflow.map((action, index) => (
                <button
                  key={action.id || `${action.label}-${index}`}
                  type="button"
                  role="menuitem"
                  disabled={!!action.disabled}
                  onClick={() => run(action)}
                  className={`block w-full rounded-aspectum-compact px-3 py-2 text-left text-sm transition-colors disabled:opacity-50 ${action.variant === 'danger' ? 'text-aspectum-danger hover:bg-aspectum-danger-soft' : 'text-aspectum-text hover:bg-aspectum-surface-subtle'}`}
                >
                  {action.label}
                </button>
              ))}
            </DropdownPanel>
          )}
        </div>
      )}
      {onRefresh && (
        <IconButton label="Обновить страницу" onClick={onRefresh}>
          <RotateCw className="size-4" aria-hidden="true" />
        </IconButton>
      )}
    </div>
  );
}
