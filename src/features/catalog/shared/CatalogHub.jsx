import { Link } from 'react-router-dom';

export function CatalogCard({ to, title, description, icon }) {
  return (
    <Link
      to={to}
      className="group block rounded-xl border border-gray-200 bg-white p-4 hover:shadow-md hover:border-blue-200 transition-all"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-xl">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-900 group-hover:text-blue-700 truncate">
              {title}
            </h2>
            <span className="text-xs text-gray-400 group-hover:text-blue-500">→</span>
          </div>
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
            {description}
          </p>
          <p className="text-xs text-gray-300 mt-2 font-mono truncate">
            {to}
          </p>
        </div>
      </div>
    </Link>
  );
}

export function CatalogSection({ section }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 md:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
          <p className="mt-1 text-sm text-gray-500">{section.description}</p>
        </div>
        <span className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold tracking-wide ${section.badgeClass}`}>
          {section.badge}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {section.items.map((item) => (
          <CatalogCard key={item.to} {...item} />
        ))}
      </div>
    </section>
  );
}

export function CatalogHubPage({ title, subtitle, sections }) {
  return (
    <>
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 md:p-5">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-gray-500">{subtitle}</p> : null}
      </div>

      <div className="space-y-4">
        {sections.map((section) => (
          <CatalogSection key={section.id} section={section} />
        ))}
      </div>
    </>
  );
}
