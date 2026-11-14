import { Button } from '@aspectum/admin-ui-web';

export default function CatalogPageHeader({
  title,
  description,
  createLabel,
  onCreate,
  secondaryActions = [],
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-aspectum-text">{title}</h1>
        {description && <p className="mt-1 text-sm text-aspectum-text-subtle">{description}</p>}
      </div>
      <div className="hidden md:flex items-center gap-2">
        {secondaryActions
          .filter(Boolean)
          .map((action) => (
            <Button
              key={action.key || action.label}
              type="button"
              variant="secondary"
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          ))}
        {onCreate ? (
          <Button
            type="button"
            variant="primary"
            onClick={onCreate}
          >
            {createLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
