import Button from './Button';

export default function SidebarActions({
  actions = [],
  onAction,
  onRefresh,
  emptyText = 'Нет действий для этой страницы',
  refreshLabel = 'Обновить страницу',
}) {
  return (
    <div className="space-y-2">
      {actions.length > 0 ? actions.map((action, index) => (
        <Button
          key={action.id || `${action.label}-${index}`}
          type="button"
          disabled={!!action.disabled}
          onClick={() => onAction?.(action)}
          className={`w-full justify-start text-left ${action.variant === 'danger'
            ? 'bg-aspectum-danger-soft text-aspectum-danger hover:bg-aspectum-danger/10'
            : action.variant === 'primary'
              ? 'bg-aspectum-primary text-aspectum-on-accent hover:bg-aspectum-primary-hover'
              : 'bg-aspectum-surface-muted text-aspectum-text hover:bg-aspectum-text/10'
          }`}
        >
          {action.label}
        </Button>
      )) : (
        <div className="text-sm text-aspectum-text-muted border border-dashed border-aspectum-border rounded-aspectum-control p-3">
          {emptyText}
        </div>
      )}
      {onRefresh && (
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={onRefresh}
          className="w-full justify-start bg-aspectum-surface-muted hover:bg-aspectum-text/10"
        >
          {refreshLabel}
        </Button>
      )}
    </div>
  );
}
