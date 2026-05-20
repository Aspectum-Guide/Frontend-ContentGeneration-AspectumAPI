import { getAttrName, getFlag } from './sessionWizardShared.jsx';

const normalizeId = (value) => {
  if (value == null) return '';

  if (typeof value === 'object') {
    return String(value.id ?? value.uuid ?? value.pk ?? '');
  }

  return String(value);
};

const getAttractionDisplayName = (attraction) => {
  if (!attraction) return 'Без названия';

  try {
    const name = getAttrName(attraction);

    if (name && name !== '(без названия)') {
      return name;
    }
  } catch {
    // ignore
  }

  if (typeof attraction.name === 'string') {
    return attraction.name || 'Без названия';
  }

  if (attraction.name && typeof attraction.name === 'object') {
    return (
      attraction.name.ru ||
      attraction.name.en ||
      attraction.name.it ||
      Object.values(attraction.name).find(Boolean) ||
      attraction.id ||
      'Без названия'
    );
  }

  if (typeof attraction.title === 'string') {
    return attraction.title || 'Без названия';
  }

  if (attraction.title && typeof attraction.title === 'object') {
    return (
      attraction.title.ru ||
      attraction.title.en ||
      attraction.title.it ||
      Object.values(attraction.title).find(Boolean) ||
      attraction.id ||
      'Без названия'
    );
  }

  return (
    attraction.display_name ||
    attraction.name_ru ||
    attraction.title_ru ||
    attraction.id ||
    'Без названия'
  );
};

const getAttractionInfoName = (info) => {
  if (!info) return '(без названия)';

  if (typeof info.name === 'string') {
    return info.name || '(без названия)';
  }

  if (info.name && typeof info.name === 'object') {
    return (
      info.name.ru ||
      info.name.en ||
      info.name.it ||
      Object.values(info.name).find(Boolean) ||
      '(без названия)'
    );
  }

  return info.title || info.display_name || info.id || '(без названия)';
};

const getDatabaseAttractionId = (info) => {
  return normalizeId(
    info?.event_id ??
      info?.event ??
      info?.attraction_id ??
      info?.attraction
  );
};

const getSessionAttractionId = (info) => {
  return normalizeId(
    info?.session_attraction_id ??
      info?.session_attraction ??
      info?.sessionAttractionId ??
      info?.sessionAttraction
  );
};

const getAttractionInfoBindingLabel = (
  info,
  referenceAttractions = [],
  sessionAttractions = []
) => {
  const assignedAttractionType = info?.assigned_attraction_type || 'none';

  if (assignedAttractionType === 'database') {
    const attractionFromInfo =
      info?.event && typeof info.event === 'object'
        ? info.event
        : info?.attraction && typeof info.attraction === 'object'
          ? info.attraction
          : null;

    const attractionId = getDatabaseAttractionId(info);

    const attraction =
      attractionFromInfo ||
      referenceAttractions.find((item) => normalizeId(item.id) === attractionId);

    return attraction
      ? `Достопримечательность из базы: ${getAttractionDisplayName(attraction)}`
      : 'Достопримечательность из базы: не выбрана';
  }

  if (assignedAttractionType === 'draft') {
    const attractionFromInfo =
      info?.session_attraction && typeof info.session_attraction === 'object'
        ? info.session_attraction
        : null;

    const attractionId = getSessionAttractionId(info);

    const attraction =
      attractionFromInfo ||
      sessionAttractions.find((item) => normalizeId(item.id) === attractionId);

    return attraction
      ? `Достопримечательность из сессии: ${getAttractionDisplayName(attraction)}`
      : 'Достопримечательность из сессии: не выбрана';
  }

  return 'Без достопримечательности';
};

function AttractionInfoDraftsPanel({
  attractionInfos = [],
  currentAttractionInfo,
  onSelectAttractionInfo,
  onAddAttractionInfo,
}) {
  const currentId = normalizeId(currentAttractionInfo?.id);

  return (
    <div className="p-3 border border-gray-200 rounded-xl bg-gray-50">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-800">
          Черновики полезной информации о достопримечательностях
        </p>

        <button
          type="button"
          onClick={onAddAttractionInfo}
          className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors"
        >
          + Добавить
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {attractionInfos.length === 0 ? (
          <span className="text-xs text-gray-500">
            Пока нет полезной информации
          </span>
        ) : (
          attractionInfos.map((info, index) => {
            const infoId = normalizeId(info.id);
            const isActive = infoId === currentId;

            return (
              <button
                key={info.id}
                type="button"
                onClick={() => {
                  if (!isActive) {
                    onSelectAttractionInfo?.(info.id);
                  }
                }}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs transition-colors ${
                  isActive
                    ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                }`}
                title={getAttractionInfoName(info)}
              >
                <span className="text-gray-400">{index + 1}.</span>
                <span>{getAttractionInfoName(info)}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function SessionWizardAttractionInfoStep({
  embedded = false,
  scopedToAttractionId = '',

  attractionInfos = [],
  currentAttractionInfo,
  attractionInfoLocaleData = {},
  attractionInfoActiveLocale = 'ru-RU',
  attractionInfoSaving = false,

  referenceAttractions = [],
  attractions = [],

  onOpenAttractionInfoDetail,
  onAddAttractionInfo,
  onSetCurrentAttractionInfo,
  onSetAttractionInfoActiveLocale,
  onUpdateAttractionInfoLocaleField,
  onUpdateCurrentAttractionInfoPatch,
  onSaveCurrentAttractionInfo,
  onDeleteCurrentAttractionInfo,
  onGoToStep,
}) {
  const currentLocale =
    attractionInfoLocaleData[attractionInfoActiveLocale] || {};

  const assignedAttractionType =
    currentAttractionInfo?.assigned_attraction_type || 'none';

  const selectedDatabaseAttractionId =
    getDatabaseAttractionId(currentAttractionInfo);

  const selectedSessionAttractionId =
    getSessionAttractionId(currentAttractionInfo);

  const updatePatch = (patch) => {
    onUpdateCurrentAttractionInfoPatch?.(patch);
  };

  if (!currentAttractionInfo) {
    return (
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Полезная информация о достопримечательности
            </h2>

            <p className="text-sm text-gray-500">
              Добавьте полезные блоки: часы работы, билеты, правила посещения,
              советы
            </p>
          </div>

          <button
            type="button"
            onClick={onAddAttractionInfo}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shrink-0"
          >
            + Добавить
          </button>
        </div>

        {attractionInfos.length === 0 ? (
          <div className="text-center py-10 text-gray-400 border border-dashed border-gray-200 rounded-xl bg-gray-50">
            <div className="text-3xl mb-2">💡</div>

            <p className="text-sm">
              {scopedToAttractionId
                ? 'Для этой достопримечательности пока нет полезной информации.'
                : 'Нет полезной информации. Нажмите «+ Добавить»'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {attractionInfos.map((info, idx) => (
              <div
                key={info.id}
                onClick={() => onOpenAttractionInfoDetail?.(info.id)}
                className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600 shrink-0">
                    {idx + 1}
                  </span>

                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {getAttractionInfoName(info)}
                    </div>

                    <div className="text-xs text-gray-500">
                      {getAttractionInfoBindingLabel(
                        info,
                        referenceAttractions,
                        attractions
                      )}
                    </div>
                  </div>
                </div>

                <span className="text-xs text-blue-600 font-medium shrink-0">
                  Открыть →
                </span>
              </div>
            ))}
          </div>
        )}

        {!embedded && (
          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => onGoToStep?.(3)}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              ← Назад
            </button>

            <button
              type="button"
              onClick={() => onGoToStep?.(4)}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Далее: Публикация →
            </button>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onSetCurrentAttractionInfo?.(null)}
          className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors"
        >
          ←
        </button>

        <span className="text-base font-semibold text-gray-900">
          {getAttractionInfoName(currentAttractionInfo)}
        </span>

        <button
          type="button"
          onClick={onDeleteCurrentAttractionInfo}
          className="ml-auto px-3 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
        >
          Удалить
        </button>
      </div>

      <AttractionInfoDraftsPanel
        attractionInfos={attractionInfos}
        currentAttractionInfo={currentAttractionInfo}
        onSelectAttractionInfo={onOpenAttractionInfoDetail}
        onAddAttractionInfo={onAddAttractionInfo}
      />

      <div className="flex items-center gap-1 flex-wrap">
        {Object.entries(attractionInfoLocaleData || {}).map(([key, loc]) => {
          const isActive = key === attractionInfoActiveLocale;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSetAttractionInfoActiveLocale?.(key)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                isActive
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

      <main className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Название ({currentLocale.lang?.toUpperCase() || 'RU'})
          </label>

          <input
            type="text"
            value={currentLocale.name || ''}
            onChange={(e) =>
              onUpdateAttractionInfoLocaleField?.('name', e.target.value)
            }
            placeholder="Например: Часы работы, Билеты, Как добраться"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="p-3 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Привязка к достопримечательности
            </label>

            <select
              value={assignedAttractionType}
              onChange={(e) => {
                const type = e.target.value;

                updatePatch({
                  assigned_attraction_type: type,

                  event: null,
                  event_id: null,

                  attraction: null,
                  attraction_id: null,

                  session_attraction: null,
                  session_attraction_id: null,
                });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="none">Без достопримечательности</option>
              <option value="database">Достопримечательность из базы</option>
              <option value="draft">Достопримечательность из сессии</option>
            </select>
          </div>

          {assignedAttractionType === 'database' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Достопримечательность из базы
              </label>

              <select
                value={selectedDatabaseAttractionId}
                onChange={(e) => {
                  const attractionId = e.target.value || null;

                  updatePatch({
                    assigned_attraction_type: 'database',

                    event: attractionId,
                    event_id: attractionId,

                    attraction: attractionId,
                    attraction_id: attractionId,

                    session_attraction: null,
                    session_attraction_id: null,
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Выберите достопримечательность из базы</option>

                {referenceAttractions.map((attraction) => (
                  <option key={attraction.id} value={attraction.id}>
                    {getAttractionDisplayName(attraction)}
                  </option>
                ))}
              </select>

              {referenceAttractions.length === 0 && (
                <p className="mt-1 text-xs text-amber-600">
                  Список достопримечательностей из базы не загружен.
                </p>
              )}
            </div>
          )}

          {assignedAttractionType === 'draft' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Достопримечательность из сессии
              </label>

              <select
                value={selectedSessionAttractionId}
                onChange={(e) => {
                  const attractionId = e.target.value || null;

                  updatePatch({
                    assigned_attraction_type: 'draft',

                    session_attraction: attractionId,
                    session_attraction_id: attractionId,

                    event: null,
                    event_id: null,

                    attraction: null,
                    attraction_id: null,
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Выберите достопримечательность из сессии</option>

                {attractions.map((attraction) => (
                  <option key={attraction.id} value={attraction.id}>
                    {getAttractionDisplayName(attraction)}
                  </option>
                ))}
              </select>

              {attractions.length === 0 && (
                <p className="mt-1 text-xs text-amber-600">
                  В текущей сессии пока нет достопримечательностей.
                </p>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1">
            <label className="text-sm font-medium text-gray-700">
              Описание
            </label>

            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded font-mono">
              {currentLocale.lang?.toUpperCase() || 'RU'}
            </span>
          </div>

          <textarea
            value={currentLocale.description || ''}
            onChange={(e) =>
              onUpdateAttractionInfoLocaleField?.('description', e.target.value)
            }
            rows={embedded ? 5 : 7}
            placeholder="Описание полезной информации для пользователя..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onSaveCurrentAttractionInfo}
            disabled={attractionInfoSaving}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {attractionInfoSaving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </main>
    </section>
  );
}