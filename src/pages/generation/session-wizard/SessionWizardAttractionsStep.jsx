import { DEFAULT_LOCALE_DEFS, getAttrName, getFlag } from './sessionWizardShared.jsx';

export default function SessionWizardAttractionsStep({
  attrView,
  currentAttr,
  attrActiveLocale,
  attrLocaleData,
  attrSaving,
  attractions,
  onOpenAttrDetail,
  onAddAttraction,
  onDeleteCurrentAttr,
  onSetAttrView,
  onSetCurrentAttr,
  onSetAttrActiveLocale,
  onUpdateAttrLocaleField,
  onSaveCurrentAttr,
  onGoToStep,
}) {
  const attrCurrentLocale = attrLocaleData[attrActiveLocale] || {};

  return (
    <div>
      {attrView === 'list' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Достопримечательности</h2>
              <p className="text-sm text-gray-500">Добавьте объекты для этого города</p>
            </div>
            <button
              onClick={onAddAttraction}
              className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              + Добавить
            </button>
          </div>

          {attractions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-3xl mb-2">🏛️</div>
              <p className="text-sm">Нет достопримечательностей. Нажмите «+ Добавить»</p>
            </div>
          ) : (
            <div className="space-y-2">
              {attractions.map((attr, idx) => (
                <div
                  key={attr.id}
                  onClick={() => onOpenAttrDetail(attr.id)}
                  className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-900">{getAttrName(attr)}</span>
                  </div>
                  <span className="text-xs text-blue-600 font-medium">Открыть →</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button onClick={() => onGoToStep(2)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              ← Назад
            </button>
            <button onClick={() => onGoToStep(4)} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
              Далее: Контент →
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { onSetAttrView('list'); onSetCurrentAttr(null); }}
              className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors"
            >
              ←
            </button>
            <span className="text-base font-semibold text-gray-900">{getAttrName(currentAttr)}</span>
            <button
              onClick={onDeleteCurrentAttr}
              className="ml-auto px-3 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
            >
              Удалить
            </button>
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            {DEFAULT_LOCALE_DEFS.map((loc) => {
              const isActive = loc.key === attrActiveLocale;
              return (
                <button
                  key={loc.key}
                  type="button"
                  onClick={() => onSetAttrActiveLocale(loc.key)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${isActive
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                    }`}
                >
                  <span>{getFlag(loc.code)}</span>
                  <span>{loc.langName}</span>
                </button>
              );
            })}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Название ({attrCurrentLocale.lang?.toUpperCase() || 'RU'})</label>
            <input
              type="text"
              value={attrCurrentLocale.name || ''}
              onChange={(e) => onUpdateAttrLocaleField('name', e.target.value)}
              placeholder="Название достопримечательности"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Описание ({attrCurrentLocale.lang?.toUpperCase() || 'RU'})</label>
            <textarea
              value={attrCurrentLocale.description || ''}
              onChange={(e) => onUpdateAttrLocaleField('description', e.target.value)}
              rows={3}
              placeholder="Краткое описание"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <label className="text-sm font-medium text-gray-700">Текст</label>
              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded font-mono">{attrCurrentLocale.lang?.toUpperCase() || 'RU'}</span>
            </div>
            <textarea
              value={attrCurrentLocale.contentText || ''}
              onChange={(e) => onUpdateAttrLocaleField('contentText', e.target.value)}
              rows={7}
              placeholder="Подробный текст-описание, история, интересные факты..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={onSaveCurrentAttr}
              disabled={attrSaving}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {attrSaving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}