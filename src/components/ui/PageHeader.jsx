import Button from './Button';

const TITLE_CLASSES = {
  sm: 'text-xl font-semibold',
  compact: 'text-xl font-bold',
  md: 'text-2xl font-bold',
  lg: 'text-3xl font-bold',
  xl: 'text-4xl font-bold',
};

const SPACING_CLASSES = { none: '', sm: 'mb-4', md: 'mb-6', lg: 'mb-8' };

/**
 * Шапка страницы: заголовок, подпись, primary CTA и secondaryActions.
 */
export default function PageHeader({
  title,
  description,
  createLabel,
  onCreate,
  actions,
  secondaryActions = [],
  titleSize = 'md',
  spacing = 'md',
  className = '',
}) {
  return (
    <div className={`${SPACING_CLASSES[spacing] ?? SPACING_CLASSES.md} flex items-start justify-between gap-3 ${className}`.trim()}>
      <div>
        <h1 className={`${TITLE_CLASSES[titleSize] || TITLE_CLASSES.md} text-aspectum-text`}>{title}</h1>
        {description ? <p className="mt-1 text-sm text-aspectum-text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : <div className="hidden md:flex items-center gap-2">
        {secondaryActions
          .filter(Boolean)
          .map((action) => (
            <Button
              key={action.key || action.label}
              type="button"
              onClick={action.onClick}
              variant="outline"
              size="md"
            >
              {action.label}
            </Button>
          ))}
        {onCreate ? (
          <Button type="button" onClick={onCreate} variant="primary" size="md">
            {createLabel}
          </Button>
        ) : null}
      </div>}
    </div>
  );
}
