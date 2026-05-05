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
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
      <div className="hidden md:flex items-center gap-2">
        {secondaryActions
          .filter(Boolean)
          .map((action) => (
            <button
              key={action.key || action.label}
              type="button"
              onClick={action.onClick}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {action.label}
            </button>
          ))}
        <button
          type="button"
          onClick={onCreate}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          {createLabel}
        </button>
      </div>
    </div>
  );
}
