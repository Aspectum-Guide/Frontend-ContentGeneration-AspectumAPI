import { renderIcon } from './glyphIcons';
const TITLE_CLASSES = { xs: 'text-sm font-semibold', sm: 'text-base font-semibold', md: 'text-lg font-semibold', lg: 'text-xl font-bold' };

export default function SectionHeader({ title, description, icon, actions, aside, headingId, level = 2, size = 'md', descriptionSize = 'sm', className = '' }) {
  const Heading = level === 3 ? 'h3' : 'h2';
  return (
    <div className={`flex items-start justify-between gap-3 ${className}`.trim()}>
      <div className={`min-w-0 ${icon ? 'flex items-start gap-4' : ''}`.trim()}>
        {icon ? <div className="shrink-0">{renderIcon(icon, 'size-6')}</div> : null}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Heading id={headingId} className={`${TITLE_CLASSES[size] || TITLE_CLASSES.md} text-aspectum-text`}>{title}</Heading>
            {aside}
          </div>
          {description ? <p className={`${descriptionSize === 'xs' ? 'mt-0.5 text-xs' : 'mt-1 text-sm'} text-aspectum-text-muted`}>{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div> : null}
    </div>
  );
}
