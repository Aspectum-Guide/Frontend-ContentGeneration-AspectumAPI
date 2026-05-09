export default function SessionWizardTagsStep({
  tagInput,
  cityTags,
  availableTags,
  saving,
  onTagInputChange,
  onTagKeyDown,
  onTagBlur,
  onAddTag,
  onRemoveTag,
  onGoToStep,
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Теги</h2>
        <p className="text-sm text-gray-500">Категории для поиска. Можно выбрать из справочника или добавить свои.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Теги города</label>
        <input
          type="text"
          value={tagInput}
          onChange={(e) => onTagInputChange(e.target.value)}
          onKeyDown={onTagKeyDown}
          onBlur={onTagBlur}
          placeholder="Введите тег и нажмите Enter"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex flex-wrap gap-2 min-h-[2.5rem] p-2 bg-gray-50 rounded-lg border border-gray-200">
        {cityTags.length === 0 ? (
          <span className="text-sm text-gray-400 self-center">Тегов пока нет</span>
        ) : cityTags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
            {tag}
            <button type="button" onClick={() => onRemoveTag(tag)} className="hover:text-red-600 transition-colors">×</button>
          </span>
        ))}
      </div>

      {availableTags.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-1.5">Справочник тегов:</p>
          <div className="flex flex-wrap gap-1.5">
            {availableTags.map((tag, i) => {
              const label = tag.display_name || tag.slug || tag.name || (typeof tag === 'string' ? tag : '');
              if (!label) return null;
              const isAdded = cityTags.includes(label);
              return (
                <button
                  key={tag.id || i}
                  type="button"
                  onClick={() => onAddTag(label)}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${isAdded
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                    }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button onClick={() => onGoToStep(1)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          ← Назад
        </button>
        <button
          onClick={() => onGoToStep(3)}
          disabled={saving}
          className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Сохранение...' : 'Далее: Достопримечательности →'}
        </button>
      </div>
    </div>
  );
}