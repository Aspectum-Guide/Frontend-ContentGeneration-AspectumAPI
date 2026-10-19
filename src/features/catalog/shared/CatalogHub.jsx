import { Link } from 'react-router-dom';
import { Heading, PageHeader, Panel, SectionHeader } from '@aspectum/admin-ui-web';
import { ArrowRight } from 'lucide-react';
import { renderIcon } from '@aspectum/admin-ui-web';

export function CatalogCard({ to, title, description, icon }) {
  return (
    <Panel
      as={Link}
      to={to}
      className="group block p-4 hover:shadow-aspectum-raised hover:border-aspectum-primary-border transition-all"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-aspectum-control bg-aspectum-surface-muted border border-aspectum-border flex items-center justify-center text-xl">
          {renderIcon(icon, 'size-5 text-aspectum-text-subtle')}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Heading level={2} size="sm" className="truncate group-hover:text-aspectum-primary-hover">{title}</Heading>
            <ArrowRight className="size-3.5 text-aspectum-text-disabled group-hover:text-aspectum-focus" aria-hidden="true" />
          </div>
          <p className="text-sm text-aspectum-text-muted mt-1 line-clamp-2">
            {description}
          </p>
          <p className="text-xs text-aspectum-text-faint mt-2 font-mono truncate">
            {to}
          </p>
        </div>
      </div>
    </Panel>
  );
}

export function CatalogSection({ section }) {
  return (
    <Panel as="section" className="p-4 md:p-5">
      <SectionHeader className="mb-4" title={section.title} description={section.description} actions={<span className={`rounded-aspectum-compact px-2 py-1 text-[11px] font-semibold tracking-wide ${section.badgeClass}`}>{section.badge}</span>} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {section.items.map((item) => (
          <CatalogCard key={item.to} {...item} />
        ))}
      </div>
    </Panel>
  );
}

export function CatalogHubPage({ title, subtitle, sections }) {
  return (
    <>
      <Panel className="mb-6 p-4 md:p-5">
        <PageHeader title={title} description={subtitle} spacing="none" />
      </Panel>

      <div className="space-y-4">
        {sections.map((section) => (
          <CatalogSection key={section.id} section={section} />
        ))}
      </div>
    </>
  );
}
