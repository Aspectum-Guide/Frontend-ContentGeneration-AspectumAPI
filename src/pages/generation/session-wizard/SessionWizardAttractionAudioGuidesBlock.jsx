import { useEffect, useRef, useState } from 'react';

import { audioAPI } from '../../../api/generation';

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

const getAudioGuideName = (guide) => {
  if (!guide) return '(без названия)';

  const title = guide.title || guide.name || {};

  if (typeof title === 'string') {
    return title || '(без названия)';
  }

  if (title && typeof title === 'object') {
    return (
      title.ru ||
      title.en ||
      title.it ||
      Object.values(title).find(Boolean) ||
      '(без названия)'
    );
  }

  return guide.display_name || guide.id || '(без названия)';
};

const getDatabaseAttractionId = (guide) => {
  return normalizeId(
    guide?.event_id ??
      guide?.event ??
      guide?.attraction_id ??
      guide?.attraction
  );
};

const getSessionAttractionId = (guide) => {
  return normalizeId(
    guide?.session_attraction_id ??
      guide?.session_attraction
  );
};

const getAudioGuideBindingLabel = (
  guide,
  referenceAttractions = [],
  sessionAttractions = []
) => {
  const assignedAttractionType = guide?.assigned_attraction_type || 'none';

  if (assignedAttractionType === 'database') {
    const attractionFromGuide =
      guide?.event && typeof guide.event === 'object' ? guide.event : null;

    const attractionId = getDatabaseAttractionId(guide);

    const attraction =
      attractionFromGuide ||
      referenceAttractions.find(
        (item) => normalizeId(item.id) === attractionId
      );

    return attraction
      ? `Достопримечательность из базы: ${getAttractionDisplayName(attraction)}`
      : 'Достопримечательность из базы: не выбрана';
  }

  if (assignedAttractionType === 'draft') {
    const attractionFromGuide =
      guide?.session_attraction && typeof guide.session_attraction === 'object'
        ? guide.session_attraction
        : null;

    const attractionId = getSessionAttractionId(guide);

    const attraction =
      attractionFromGuide ||
      sessionAttractions.find(
        (item) => normalizeId(item.id) === attractionId
      );

    return attraction
      ? `Достопримечательность из сессии: ${getAttractionDisplayName(attraction)}`
      : 'Достопримечательность из сессии: не выбрана';
  }

  return 'Без достопримечательности';
};

function AttractionAudioTrackPreview({ trackAudioId, trackAudioUrl }) {
  const blobUrlRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setPreviewUrl(null);
    setLoadError(false);

    if (!trackAudioId) {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);

    (async () => {
      try {
        const res = await audioAPI.getBlobByAudioId(trackAudioId);
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(res.data);
        blobUrlRef.current = objectUrl;
        setPreviewUrl(objectUrl);
      } catch {
        if (!cancelled) {
          setLoadError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [trackAudioId]);

  if (!trackAudioUrl && !trackAudioId) {
    return null;
  }

  if (trackAudioUrl && !trackAudioId) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-amber-600">
          Не удалось загрузить аудио для прослушивания (нет audio_id; защищённое
          воспроизведение недоступно).
        </p>

        <p className="text-xs text-gray-500 break-all">
          <span className="text-gray-400">URL:</span> {trackAudioUrl}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {loading ? (
        <p className="text-xs text-gray-600">Загрузка аудио...</p>
      ) : null}

      {loadError ? (
        <p className="text-xs text-red-600">
          Не удалось загрузить аудио для прослушивания
        </p>
      ) : null}

      {!loading && !loadError && previewUrl ? (
        <audio key={previewUrl} controls src={previewUrl} className="w-full" />
      ) : null}
    </div>
  );
}

function AudioGuideDraftsPanel({
  attractionAudioGuides = [],
  currentAttractionAudioGuide,
  onSelectAudioGuide,
  onAddAudioGuide,
}) {
  const currentId = normalizeId(currentAttractionAudioGuide?.id);

  return (
    <div className="p-3 border border-gray-200 rounded-xl bg-gray-50">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-800">
          Черновики аудиогидов
        </p>

        <button
          type="button"
          onClick={onAddAudioGuide}
          className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors"
        >
          + Добавить
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {attractionAudioGuides.length === 0 ? (
          <span className="text-xs text-gray-500">Пока нет аудиогидов</span>
        ) : (
          attractionAudioGuides.map((guide, index) => {
            const guideId = normalizeId(guide.id);
            const isActive = guideId === currentId;

            return (
              <button
                key={guide.id}
                type="button"
                onClick={() => {
                  if (!isActive) {
                    onSelectAudioGuide?.(guide.id);
                  }
                }}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs transition-colors ${
                  isActive
                    ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                }`}
                title={getAudioGuideName(guide)}
              >
                <span className="text-gray-400">{index + 1}.</span>
                <span>{getAudioGuideName(guide)}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function SessionWizardAttractionAudioGuidesBlock({
  embedded = false,

  attractionAudioGuides = [],
  currentAttractionAudioGuide,
  attractionAudioGuideLocaleData = {},
  attractionAudioGuideActiveLocale = 'ru-RU',
  attractionAudioGuideSaving = false,
  attractionAudioUploading = false,

  referenceAttractions = [],
  attractions = [],

  onOpenAttractionAudioGuideDetail,
  onAddAttractionAudioGuide,
  onSetCurrentAttractionAudioGuide,
  onSetAttractionAudioGuideActiveLocale,
  onUpdateAttractionAudioGuideLocaleField,
  onUpdateCurrentAttractionAudioGuidePatch,
  onUpdateAttractionAudioGuidePlanPoint,
  onAddAttractionAudioGuidePlanPoint,
  onRemoveAttractionAudioGuidePlanPoint,
  onUpdateAttractionAudioGuidePlanItemText,
  onShowNote,
  onSaveCurrentAttractionAudioGuide,
  onDeleteCurrentAttractionAudioGuide,
  onUploadAttractionAudioGuideTrack,
  onRemoveAttractionAudioGuideTrack,
  onGoToStep,
}) {
  const audioFileRef = useRef(null);

  const currentLocale =
    attractionAudioGuideLocaleData[attractionAudioGuideActiveLocale] || {};

  const assignedAttractionType =
    currentAttractionAudioGuide?.assigned_attraction_type || 'none';

  const selectedDatabaseAttractionId = getDatabaseAttractionId(
    currentAttractionAudioGuide
  );

  const selectedSessionAttractionId = getSessionAttractionId(
    currentAttractionAudioGuide
  );

  const updatePatch = (patch) => {
    onUpdateCurrentAttractionAudioGuidePatch?.(patch);
  };

  const handlePickAudioFile = () => {
    audioFileRef.current?.click();
  };

  const handleAudioFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    onUploadAttractionAudioGuideTrack?.(file);
  };

  if (!currentAttractionAudioGuide) {
    return (
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Аудиогид к достопримечательности
            </h2>

            <p className="text-sm text-gray-500">
              Загружайте мультиязычные аудиогиды к достопримечательностям.
            </p>
          </div>

          <button
            type="button"
            onClick={onAddAttractionAudioGuide}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shrink-0"
          >
            + Добавить
          </button>
        </div>

        {attractionAudioGuides.length === 0 ? (
          <div className="text-center py-10 text-gray-400 border border-dashed border-gray-200 rounded-xl bg-gray-50">
            <div className="text-3xl mb-2">🎧</div>

            <p className="text-sm">
              Нет аудиогидов. Нажмите «+ Добавить»
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {attractionAudioGuides.map((guide, idx) => (
              <div
                key={guide.id}
                onClick={() => onOpenAttractionAudioGuideDetail?.(guide.id)}
                className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600 shrink-0">
                    {idx + 1}
                  </span>

                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {getAudioGuideName(guide)}
                    </div>

                    <div className="text-xs text-gray-500">
                      {getAudioGuideBindingLabel(
                        guide,
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

  const planPoints = Array.isArray(currentLocale.contentPlan)
    ? currentLocale.contentPlan
    : [];

  const trackAudioId = currentLocale.track?.audio_id || null;
  const trackAudioUrl = currentLocale.track?.audio_url || '';
  const trackCopyright = currentLocale.track?.copyright || '';

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onSetCurrentAttractionAudioGuide?.(null)}
          className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors"
        >
          ←
        </button>

        <span className="text-base font-semibold text-gray-900">
          {getAudioGuideName(currentAttractionAudioGuide)}
        </span>

        <button
          type="button"
          onClick={onDeleteCurrentAttractionAudioGuide}
          className="ml-auto px-3 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
        >
          Удалить
        </button>
      </div>

      <AudioGuideDraftsPanel
        attractionAudioGuides={attractionAudioGuides}
        currentAttractionAudioGuide={currentAttractionAudioGuide}
        onSelectAudioGuide={onOpenAttractionAudioGuideDetail}
        onAddAudioGuide={onAddAttractionAudioGuide}
      />

      <div className="flex items-center gap-1 flex-wrap">
        {Object.entries(attractionAudioGuideLocaleData || {}).map(
          ([key, loc]) => {
            const isActive = key === attractionAudioGuideActiveLocale;

            return (
              <button
                key={key}
                type="button"
                onClick={() =>
                  onSetAttractionAudioGuideActiveLocale?.(key)
                }
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
          }
        )}
      </div>

      <main className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Название ({currentLocale.lang?.toUpperCase() || 'RU'})
          </label>

          <input
            type="text"
            value={currentLocale.title || ''}
            onChange={(e) =>
              onUpdateAttractionAudioGuideLocaleField?.('title', e.target.value)
            }
            placeholder="Например: Аудиогид по Колизею"
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
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-gray-700">
              План содержания ({currentLocale.lang?.toUpperCase() || 'RU'})
            </label>

          </div>

          <div className="space-y-2">
            {planPoints.length === 0 ? (
              <p className="text-xs text-gray-500">Пока нет пунктов плана</p>
            ) : (
              planPoints.map((point, index) => {
                const itemId = point?.id;
                const title = point?.title ?? '';

                return (
                  <div
                    key={point.id}
                    className="flex items-center gap-2"
                  >
                    <span className="w-6 text-xs text-gray-500 text-right">
                      {index + 1}.
                    </span>

                    <input
                      type="text"
                      value={title}
                      onChange={(e) =>
                        onUpdateAttractionAudioGuidePlanPoint?.(
                          currentLocale.lang,
                          itemId,
                          e.target.value
                        )
                      }
                      placeholder="Например: История строительства"
                      className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        onRemoveAttractionAudioGuidePlanPoint?.(
                          currentLocale.lang,
                          itemId
                        )
                      }
                      title="Удалить пункт"
                      className="text-xs text-red-600 hover:bg-red-50 rounded-md px-2 py-1 shrink-0"
                    >
                      Удалить
                    </button>
                  </div>
                );
              })
            )}

            <button
              type="button"
              onClick={() =>
                onAddAttractionAudioGuidePlanPoint?.(currentLocale.lang)
              }
              className="text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-md px-2.5 py-1"
            >
              + Добавить пункт
            </button>
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <label className="text-sm font-medium text-gray-700">
              Основной текст аудиогида ({currentLocale.lang?.toUpperCase() || 'RU'})
            </label>

          </div>

          <button
            type="button"
            onClick={() =>
              onShowNote?.(
                'В разработке',
                'info',
              )
            }
            className="mb-3 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Сгенерировать весь основной текст
          </button>

          {planPoints.length === 0 ? (
            <p className="text-xs text-gray-500">
              Сначала добавьте пункты плана, чтобы заполнить основной текст.
            </p>
          ) : (
            <div className="space-y-4">
              {planPoints.map((point, index) => {
                const itemId = point?.id;
                const planTitle = (point?.title ?? '').trim();
                const headerLabel = planTitle || 'Без названия';
                const planLang = currentLocale.lang;
                const rawText =
                  planLang &&
                  currentAttractionAudioGuide?.content_texts?.[planLang]?.[
                    itemId
                  ];
                const spokenText =
                  rawText != null && rawText !== undefined
                    ? String(rawText)
                    : '';

                return (
                  <div
                    key={`ag-main-text-${point.id}`}
                    className="p-3 border border-gray-200 rounded-lg bg-gray-50/80 space-y-2"
                  >
                    <div className="text-sm font-medium text-gray-800">
                      {index + 1}. {headerLabel}
                    </div>

                    <label className="block text-xs font-medium text-gray-600">
                      Основной текст для озвучки ({currentLocale.lang?.toUpperCase() || 'RU'})
                    </label>

                    <textarea
                      value={spokenText}
                      onChange={(e) =>
                        onUpdateAttractionAudioGuidePlanItemText?.(
                          planLang,
                          itemId,
                          e.target.value,
                        )
                      }
                      rows={4}
                      placeholder="Текст, который будет озвучен для этого пункта плана"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[88px]"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        onShowNote?.(
                          'В разработке',
                          'info',
                        )
                      }
                      className="text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md px-2.5 py-1 hover:bg-gray-50 transition-colors"
                    >
                      Сгенерировать этот пункт
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-3 border border-gray-200 rounded-lg bg-gray-50 space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Аудиофайл ({currentLocale.lang?.toUpperCase() || 'RU'})
          </label>

          {trackAudioUrl || trackAudioId ? (
            <AttractionAudioTrackPreview
              trackAudioId={trackAudioId}
              trackAudioUrl={trackAudioUrl}
            />
          ) : (
            <p className="text-xs text-gray-500">
              Файл ещё не загружен.
            </p>
          )}

          <input
            ref={audioFileRef}
            type="file"
            accept="audio/*"
            onChange={handleAudioFileChange}
            className="hidden"
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePickAudioFile}
              disabled={attractionAudioUploading}
              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {attractionAudioUploading
                ? 'Загрузка…'
                : trackAudioUrl || trackAudioId
                  ? 'Заменить аудио'
                  : 'Загрузить аудио'}
            </button>

            {trackAudioUrl || trackAudioId ? (
              <button
                type="button"
                onClick={() => onRemoveAttractionAudioGuideTrack?.()}
                disabled={attractionAudioUploading}
                className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
              >
                Удалить аудио
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onSaveCurrentAttractionAudioGuide}
            disabled={attractionAudioGuideSaving}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {attractionAudioGuideSaving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </main>
    </section>
  );
}
