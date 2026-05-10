import { getFlag } from './sessionWizardShared.jsx';

const normalizeId = (value) => {
  if (value == null) return '';

  if (typeof value === 'object') {
    return String(value.id ?? value.uuid ?? value.pk ?? '');
  }

  return String(value);
};

const getInfoName = (info) => {
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

const getCityDisplayName = (city) => {
  if (!city) return 'Без названия';

  if (typeof city.name === 'string') return city.name;

  if (city.name && typeof city.name === 'object') {
    return (
      city.name.ru ||
      city.name.en ||
      city.name.it ||
      Object.values(city.name).find(Boolean) ||
      city.id
    );
  }

  return city.display_name || city.title || city.id || 'Без названия';
};

const getDraftCityDisplayName = (draft) => {
  if (!draft) return 'Без названия';

  if (typeof draft.name === 'string') return draft.name;

  if (draft.name && typeof draft.name === 'object') {
    return (
      draft.name.ru ||
      draft.name.en ||
      draft.name.it ||
      Object.values(draft.name).find(Boolean) ||
      draft.id
    );
  }

  return draft.display_name || draft.title || draft.id || 'Без названия';
};

const getCityInfoDatabaseCityId = (info) => {
  return normalizeId(info?.city_id ?? info?.city);
};

const getCityInfoDraftCityId = (info) => {
  return normalizeId(info?.session_city_id ?? info?.session_city);
};

const getCityInfoBindingLabel = (info, referenceCities = [], cityDrafts = []) => {
  const assignedCityType = info?.assigned_city_type || 'none';

  if (assignedCityType === 'database') {
    const cityFromInfo = info?.city && typeof info.city === 'object' ? info.city : null;
    const cityId = getCityInfoDatabaseCityId(info);

    const city =
      cityFromInfo ||
      referenceCities.find((item) => normalizeId(item.id) === cityId);

    return city
      ? `Город из базы: ${getCityDisplayName(city)}`
      : 'Город из базы: не выбран';
  }

  if (assignedCityType === 'draft') {
    const draftFromInfo =
      info?.session_city && typeof info.session_city === 'object'
        ? info.session_city
        : null;

    const draftId = getCityInfoDraftCityId(info);

    const draft =
      draftFromInfo ||
      cityDrafts.find((item) => normalizeId(item.id) === draftId);

    return draft
      ? `Город из сессии: ${getDraftCityDisplayName(draft)}`
      : 'Город из сессии: не выбран';
  }

  return 'Без города';
};

function CityInfoDraftsPanel({
  cityInfos = [],
  currentCityInfo,
  onSelectCityInfo,
  onAddCityInfo,
}) {
  const currentCityInfoId = normalizeId(currentCityInfo?.id);

  return (
    <div className="p-3 border border-gray-200 rounded-xl bg-gray-50">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-800">
          Черновики полезной информации в сессии
        </p>

        <button
          type="button"
          onClick={onAddCityInfo}
          className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors"
        >
          + Добавить
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {cityInfos.length === 0 ? (
          <span className="text-xs text-gray-500">
            Пока нет полезной информации
          </span>
        ) : (
          cityInfos.map((info, index) => {
            const infoId = normalizeId(info.id);
            const isActive = infoId === currentCityInfoId;

            return (
              <button
                key={info.id}
                type="button"
                onClick={() => {
                  if (!isActive) {
                    onSelectCityInfo(info.id);
                  }
                }}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs transition-colors ${
                  isActive
                    ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                }`}
                title={getInfoName(info)}
              >
                <span className="text-gray-400">{index + 1}.</span>
                <span>{getInfoName(info)}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function SessionWizardCityInfoStep({
  embedded = false,

  cityInfos = [],
  currentCityInfo,
  cityInfoLocaleData = {},
  cityInfoActiveLocale = 'ru-RU',
  cityInfoSaving = false,

  referenceCities = [],
  cityDrafts = [],

  onOpenCityInfoDetail,
  onAddCityInfo,
  onSetCurrentCityInfo,
  onSetCityInfoActiveLocale,
  onUpdateCityInfoLocaleField,
  onUpdateCurrentCityInfoPatch,
  onSaveCurrentCityInfo,
  onDeleteCurrentCityInfo,
  onGoToStep,
}) {
  const currentLocale = cityInfoLocaleData[cityInfoActiveLocale] || {};

  const assignedCityType = currentCityInfo?.assigned_city_type || 'none';

  const selectedDatabaseCityId = normalizeId(
    currentCityInfo?.city_id ?? currentCityInfo?.city
  );

  const selectedDraftCityId = normalizeId(
    currentCityInfo?.session_city_id ?? currentCityInfo?.session_city
  );

  const updateCityInfoPatch = (patch) => {
    if (typeof onUpdateCurrentCityInfoPatch === 'function') {
      onUpdateCurrentCityInfoPatch(patch);
    }
  };

  return (
    <section className={embedded ? 'space-y-4' : ''}>
      {!currentCityInfo ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Полезная информация о городе
              </h2>

              <p className="text-sm text-gray-500">
                Добавьте полезные блоки о городе и при необходимости привяжите их к городу
              </p>
            </div>

            <button
              type="button"
              onClick={onAddCityInfo}
              className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shrink-0"
            >
              + Добавить
            </button>
          </div>

          {cityInfos.length === 0 ? (
            <div className="text-center py-10 text-gray-400 border border-dashed border-gray-200 rounded-xl bg-gray-50">
              <div className="text-3xl mb-2">ℹ️</div>

              <p className="text-sm">
                Нет полезной информации. Нажмите «+ Добавить»
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {cityInfos.map((info, idx) => (
                <div
                  key={info.id}
                  onClick={() => onOpenCityInfoDetail?.(info.id)}
                  className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600 shrink-0">
                      {idx + 1}
                    </span>

                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {getInfoName(info)}
                      </div>

                      <div className="text-xs text-gray-500">
                        {getCityInfoBindingLabel(
                          info,
                          referenceCities,
                          cityDrafts
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
                onClick={() => onGoToStep?.(1)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                ← Назад
              </button>

              <button
                type="button"
                onClick={() => onGoToStep?.(2)}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Далее: Теги →
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onSetCurrentCityInfo?.(null)}
              className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors"
            >
              ←
            </button>

            <span className="text-base font-semibold text-gray-900">
              {getInfoName(currentCityInfo)}
            </span>

            <button
              type="button"
              onClick={onDeleteCurrentCityInfo}
              className="ml-auto px-3 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
            >
              Удалить
            </button>
          </div>

          <CityInfoDraftsPanel
            cityInfos={cityInfos}
            currentCityInfo={currentCityInfo}
            onSelectCityInfo={onOpenCityInfoDetail}
            onAddCityInfo={onAddCityInfo}
          />

          <div className="flex items-center gap-1 flex-wrap">
            {Object.entries(cityInfoLocaleData || {}).map(([key, loc]) => {
              const isActive = key === cityInfoActiveLocale;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSetCityInfoActiveLocale?.(key)}
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
                  onUpdateCityInfoLocaleField?.('name', e.target.value)
                }
                placeholder="Например: Транспорт, Безопасность, Когда лучше ехать"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="p-3 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Привязка к городу
                </label>

                <select
                  value={assignedCityType}
                  onChange={(e) => {
                    const type = e.target.value;

                    updateCityInfoPatch({
                      assigned_city_type: type,

                      city: null,
                      city_id: null,

                      session_city: null,
                      session_city_id: null,
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="none">Без города</option>
                  <option value="database">Город из базы</option>
                  <option value="draft">Город из сессии</option>
                </select>
              </div>

              {assignedCityType === 'database' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Город из базы
                  </label>

                  <select
                    value={selectedDatabaseCityId}
                    onChange={(e) => {
                      const cityId = e.target.value || null;

                      updateCityInfoPatch({
                        assigned_city_type: 'database',

                        city: cityId,
                        city_id: cityId,

                        session_city: null,
                        session_city_id: null,
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Выберите город из базы</option>

                    {referenceCities.map((city) => (
                      <option key={city.id} value={city.id}>
                        {getCityDisplayName(city)}
                      </option>
                    ))}
                  </select>

                  {referenceCities.length === 0 && (
                    <p className="mt-1 text-xs text-amber-600">
                      Список городов из базы не загружен.
                    </p>
                  )}
                </div>
              )}

              {assignedCityType === 'draft' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Город из сессии
                  </label>

                  <select
                    value={selectedDraftCityId}
                    onChange={(e) => {
                      const draftId = e.target.value || null;

                      updateCityInfoPatch({
                        assigned_city_type: 'draft',

                        session_city: draftId,
                        session_city_id: draftId,

                        city: null,
                        city_id: null,
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Выберите город</option>

                    {cityDrafts.map((draft) => (
                      <option key={draft.id} value={draft.id}>
                        {getDraftCityDisplayName(draft)}
                      </option>
                    ))}
                  </select>

                  {cityDrafts.length === 0 && (
                    <p className="mt-1 text-xs text-amber-600">
                      В текущей сессии пока нет городов.
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
                  onUpdateCityInfoLocaleField?.('description', e.target.value)
                }
                rows={embedded ? 5 : 7}
                placeholder="Описание полезной информации для пользователя..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={onSaveCurrentCityInfo}
                disabled={cityInfoSaving}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {cityInfoSaving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </main>
        </div>
      )}
    </section>
  );
}