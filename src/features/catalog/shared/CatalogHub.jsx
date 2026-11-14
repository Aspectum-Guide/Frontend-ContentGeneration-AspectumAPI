import { Link } from 'react-router-dom';
import { Card } from '@aspectum/admin-ui-web';

export function CatalogCard({ to, title, description, icon }) {
  return (
    <Link
      to={to}
      className="group block rounded-aspectum-card border border-aspectum-border bg-aspectum-surface p-4 hover:shadow-aspectum-elevated hover:border-aspectum-primary-border transition-all"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-aspectum-control bg-aspectum-surface-muted border border-aspectum-border flex items-center justify-center text-xl">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-aspectum-text group-hover:text-aspectum-primary truncate">
              {title}
            </h2>
            <span className="text-xs text-aspectum-text-faint group-hover:text-aspectum-primary">→</span>
          </div>
          <p className="text-sm text-aspectum-text-subtle mt-1 line-clamp-2">
            {description}
          </p>
          <p className="text-xs text-aspectum-text-disabled mt-2 font-mono truncate">
            {to}
          </p>
        </div>
      </div>
    </Link>
  );
}

export function CatalogSection({ section }) {
  return (
    <Card className="p-4 md:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-aspectum-text">{section.title}</h2>
          <p className="mt-1 text-sm text-aspectum-text-subtle">{section.description}</p>
        </div>
        <span className={`shrink-0 rounded-aspectum-compact px-2 py-1 text-[11px] font-semibold tracking-wide ${section.badgeClass}`}>
          {section.badge}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {section.items.map((item) => (
          <CatalogCard key={item.to} {...item} />
        ))}
      </div>
    </Card>
  );
}

export function CatalogHubPage({ title, subtitle, sections }) {
  return (
    <>
      <Card className="mb-6 p-4 md:p-5">
        <h1 className="text-2xl font-bold text-aspectum-text">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-aspectum-text-subtle">{subtitle}</p> : null}
      </Card>

      <div className="space-y-4">
        {sections.map((section) => (
          <CatalogSection key={section.id} section={section} />
        ))}
      </div>
    </>
  );
}
