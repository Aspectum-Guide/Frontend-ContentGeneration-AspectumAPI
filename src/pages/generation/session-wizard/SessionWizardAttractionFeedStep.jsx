import { DEFAULT_LOCALE_DEFS, getFlag } from './sessionWizardShared.jsx';

const normalizeId = (value) => {
  if (value == null) return '';

  if (typeof value === 'object') {
    return String(value.id ?? value.uuid ?? value.pk ?? '');
  }

  return String(value);
};

const getMultilangDisplay = (value, fallback = '') => {
  if (!value) return fallback;

  if (typeof value === 'string') {
    return value || fallback;
  }

  if (typeof value === 'object') {
    return (
      value.ru ||
      value.en ||
      value.it ||
      Object.values(value).find((item) => typeof item === 'string' && item.trim()) ||
      fallback
    );
  }

  return fallback;
};

const getAttractionDisplayName = (attraction) => {
  if (!attraction) return 'Без названия';

  const fromName = getMultilangDisplay(attraction.name);
  if (fromName) return fromName;

  const fromTitle = getMultilangDisplay(attraction.title);
  if (fromTitle) return fromTitle;

  return (
    attraction.display_name ||
    attraction.name_ru ||
    attraction.title_ru ||
    attraction.id ||
    'Без названия'
  );
};

const getFeedItemTextPreview = (item) => {
  const text = item?.text || {};

  if (typeof text === 'string') {
    return text || '(без текста)';
  }

  if (text && typeof text === 'object') {
    return (
      text.ru ||
      text.en ||
      text.it ||
      Object.values(text).find((value) => typeof value === 'string' && value.trim()) ||
      '(без текста)'
    );
  }

  return '(без текста)';
};

const getFeedItemName = (item) => {
  if (!item) return '(без названия)';

  if (item.item_type === 'image') {
    return (
      item.image_copyright ||
      item.imageCopyright ||
      item.image_original_url ||
      item.imageOriginalUrl ||
      item.image_url ||
      item.imageUrl ||
      'Изображение'
    );
  }

  const preview = getFeedItemTextPreview(item);

  if (preview.length > 70) {
    return `${preview.slice(0, 70)}...`;
  }

  return preview;
};

const getFeedItemTypeLabel = (item) => {
  if (item?.item_type === 'image') return 'Изображение';
  return 'Текст';
};

const getDatabaseAttractionId = (item) => {
  return normalizeId(
    item?.event_id ??
      item?.event ??
      item?.attraction_id ??
      item?.attraction
  );
};

const getSessionAttractionId = (item) => {
  return normalizeId(
    item?.session_attraction_id ??
      item?.session_attraction ??
      item?.sessionAttractionId ??
      item?.sessionAttraction
  );
};

const getFeedItemBindingLabel = (
  item,
  referenceAttractions = [],
  sessionAttractions = []
) => {
  const assignedAttractionType = item?.assigned_attraction_type || 'none';

  if (assignedAttractionType === 'database') {
    const attractionFromItem =
      item?.event && typeof item.event === 'object'
        ? item.event
        : item?.attraction && typeof item.attraction === 'object'
          ? item.attraction
          : null;

    const attractionId = getDatabaseAttractionId(item);

    const attraction =
      attractionFromItem ||
      referenceAttractions.find((entry) => normalizeId(entry.id) === attractionId);

    return attraction
      ? `Достопримечательность из базы: ${getAttractionDisplayName(attraction)}`
      : 'Достопримечательность из базы: не выбрана';
  }

  if (assignedAttractionType === 'draft') {
    const attractionFromItem =
      item?.session_attraction && typeof item.session_attraction === 'object'
        ? item.session_attraction
        : null;

    const attractionId = getSessionAttractionId(item);

    const attraction =
      attractionFromItem ||
      sessionAttractions.find((entry) => normalizeId(entry.id) === attractionId);

    return attraction
      ? `Достопримечательность из сессии: ${getAttractionDisplayName(attraction)}`
      : 'Достопримечательность из сессии: не выбрана';
  }

  return 'Без достопримечательности';
};

const getFeedImagePreview = (item) => {
  const image =
    item?.image_preview ||
    item?.imagePreview ||
    item?.image_url ||
    item?.imageUrl ||
    item?.localUrl ||
    item?.local_url ||
    item?.photo_url ||
    item?.photoUrl ||
    item?.image ||
    item?.photo ||
    '';

  if (!image) return '';

  if (typeof image === 'string') return image;

  if (typeof image === 'object') {
    return (
      image.preview_url ||
      image.previewUrl ||
      image.url ||
      image.file ||
      image.src ||
      ''
    );
  }

  return '';
};

const getFeedImageOriginalUrl = (item) => {
  return (
    item?.image_original_url ||
    item?.imageOriginalUrl ||
    item?.original_image_url ||
    item?.originalImageUrl ||
    ''
  );
};

const getFeedImageCopyright = (item) => {
  return (
    item?.image_copyright ||
    item?.imageCopyright ||
    item?.copyright ||
    item?.photo_copyright ||
    item?.photoCopyright ||
    ''
  );
};

function AttractionFeedItemsPanel({
  attractionFeedItems = [],
  currentAttractionFeedItem,
  onSelectFeedItem,
  onAddFeedItem,
}) {
  const currentId = normalizeId(currentAttractionFeedItem?.id);

  return (
    <div className="p-3 border border-gray-200 rounded-xl bg-gray-50">
      <div className="flex items-center justify-between mb-2 gap-3">
        <p className="text-sm font-medium text-gray-800">
          Черновики элементов ленты
        </p>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onAddFeedItem?.('text')}
            className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors"
          >
            + Текст
          </button>

          <button
            type="button"
            onClick={() => onAddFeedItem?.('image')}
            className="px-2.5 py-1 text-xs font-medium text-purple-700 bg-purple-100 rounded-md hover:bg-purple-200 transition-colors"
          >
            + Изображение
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {attractionFeedItems.length === 0 ? (
          <span className="text-xs text-gray-500">
            Пока нет элементов ленты
          </span>
        ) : (
          attractionFeedItems.map((item, index) => {
            const itemId = normalizeId(item.id);
            const isActive = itemId === currentId;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (!isActive) {
                    onSelectFeedItem?.(item.id);
                  }
                }}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs transition-colors ${
                  isActive
                    ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                }`}
                title={getFeedItemName(item)}
              >
                <span className="text-gray-400">{index + 1}.</span>

                <span className={item.item_type === 'image' ? 'text-purple-600' : 'text-blue-600'}>
                  {item.item_type === 'image' ? '🖼️' : '💬'}
                </span>

                <span>{getFeedItemName(item)}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function FeedImagePanel({
  currentItem,
  photoUploading,
  photoFileRef,
  onOpenCommonsModal,
  onPhotoFileChange,
  onUpdateItemPatch,
}) {
  const imagePreview = getFeedImagePreview(currentItem);
  const imageOriginalUrl = getFeedImageOriginalUrl(currentItem);
  const imageCopyright = getFeedImageCopyright(currentItem);

  return (
    <aside className="w-52 shrink-0 space-y-3">
      <div className="relative aspect-[3/4] bg-gray-100 rounded-xl overflow-hidden border border-gray-200 flex items-center justify-center">
        {imagePreview ? (
          <img
            src={imagePreview}
            alt="Изображение ленты"
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-gray-400 text-sm text-center px-2">
            Изображение ленты
          </span>
        )}

        {photoUploading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full" />
          </div>
        )}

        <button
          type="button"
          onClick={() => onOpenCommonsModal?.(currentItem)}
          className="absolute top-2 right-2 px-2 py-1 text-xs bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors shadow-lg"
          title="Подобрать в Wikimedia Commons"
        >
          ✦ Commons
        </button>
      </div>

      <div>
        <label className="block w-full text-center text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg py-1.5 cursor-pointer hover:bg-blue-100 transition-colors">
          + Добавить фото

          <input
            ref={photoFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              onPhotoFileChange?.(event, currentItem);
            }}
          />
        </label>
      </div>

      <div className="space-y-1.5">
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">
            URL
          </label>

          <input
            type="url"
            value={imageOriginalUrl || ''}
            onChange={(event) => {
              onUpdateItemPatch?.({
                image_original_url: event.target.value,
                imageOriginalUrl: event.target.value,
              });
            }}
            placeholder="https://upload.wikimedia.org/..."
            className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-0.5">
            Авторские права
          </label>

          <input
            type="text"
            value={imageCopyright || ''}
            onChange={(event) => {
              onUpdateItemPatch?.({
                image_copyright: event.target.value,
                imageCopyright: event.target.value,
              });
            }}
            placeholder="© Автор / Источник"
            className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
      </div>
    </aside>
  );
}

export default function SessionWizardAttractionFeedStep({
  attractionFeedItems = [],
  currentAttractionFeedItem,
  attractionFeedLocaleData = {},
  attractionFeedActiveLocale = 'ru-RU',
  attractionFeedSaving = false,
  attractionFeedPhotoUploading = false,
  attractionFeedPhotoFileRef,

  referenceAttractions = [],
  attractions = [],

  onOpenAttractionFeedItemDetail,
  onAddAttractionFeedItem,
  onSetCurrentAttractionFeedItem,
  onSetAttractionFeedActiveLocale,
  onUpdateAttractionFeedLocaleField,
  onUpdateCurrentAttractionFeedItemPatch,
  onSaveCurrentAttractionFeedItem,
  onDeleteCurrentAttractionFeedItem,
  onAttractionFeedPhotoFileChange,
  onOpenAttractionFeedCommonsModal,
  onGoToStep,
}) {
  const currentLocale =
    attractionFeedLocaleData[attractionFeedActiveLocale] || {};

  const itemType = currentAttractionFeedItem?.item_type || 'text';

  const assignedAttractionType =
    currentAttractionFeedItem?.assigned_attraction_type || 'none';

  const selectedDatabaseAttractionId =
    getDatabaseAttractionId(currentAttractionFeedItem);

  const selectedSessionAttractionId =
    getSessionAttractionId(currentAttractionFeedItem);

  const updateItemPatch = (patch) => {
    if (typeof onUpdateCurrentAttractionFeedItemPatch === 'function') {
      onUpdateCurrentAttractionFeedItemPatch(patch);
    }
  };

  return (
    <div>
      {!currentAttractionFeedItem ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Лента достопримечательности
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onAddAttractionFeedItem?.('text')}
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                + Текст
              </button>

              <button
                type="button"
                onClick={() => onAddAttractionFeedItem?.('image')}
                className="px-3 py-1.5 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
              >
                + Изображение
              </button>
            </div>
          </div>

          {attractionFeedItems.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-3xl mb-2">🖼️</div>

              <p className="text-sm">
                Нет элементов ленты. Добавьте текст или изображение.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {attractionFeedItems.map((item, index) => (
                <div
                  key={item.id}
                  onClick={() => onOpenAttractionFeedItemDetail?.(item.id)}
                  className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600 shrink-0">
                      {index + 1}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${
                            item.item_type === 'image'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {getFeedItemTypeLabel(item)}
                        </span>

                        <div className="text-sm font-medium text-gray-900 truncate">
                          {getFeedItemName(item)}
                        </div>
                      </div>

                      <div className="text-xs text-gray-500 mt-0.5">
                        {getFeedItemBindingLabel(
                          item,
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

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => onGoToStep?.(4)}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              ← Назад
            </button>

            <button
              type="button"
              onClick={() => onGoToStep?.(6)}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Далее: Контент →
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onSetCurrentAttractionFeedItem?.(null)}
              className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors"
            >
              ←
            </button>

            <span className="text-base font-semibold text-gray-900">
              {getFeedItemName(currentAttractionFeedItem)}
            </span>

            <button
              type="button"
              onClick={onDeleteCurrentAttractionFeedItem}
              className="ml-auto px-3 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
            >
              Удалить
            </button>
          </div>

          <AttractionFeedItemsPanel
            attractionFeedItems={attractionFeedItems}
            currentAttractionFeedItem={currentAttractionFeedItem}
            onSelectFeedItem={onOpenAttractionFeedItemDetail}
            onAddFeedItem={onAddAttractionFeedItem}
          />

          {itemType === 'text' && (
            <div className="flex items-center gap-1 flex-wrap">
              {DEFAULT_LOCALE_DEFS.map((locale) => {
                const isActive = locale.key === attractionFeedActiveLocale;

                return (
                  <button
                    key={locale.key}
                    type="button"
                    onClick={() => onSetAttractionFeedActiveLocale?.(locale.key)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    <span>{getFlag(locale.code)}</span>
                    <span>{locale.langName}</span>
                  </button>
                );
              })}
            </div>
          )}

          <main className="space-y-4">
            <div className="p-3 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Тип элемента ленты
                </label>

                <select
                  value={itemType}
                  onChange={(event) => {
                    const nextType = event.target.value;

                    if (nextType === 'text') {
                      updateItemPatch({
                        item_type: 'text',

                        image: null,
                        image_id: null,

                        image_url: '',
                        imageUrl: '',

                        image_original_url: '',
                        imageOriginalUrl: '',

                        image_copyright: '',
                        imageCopyright: '',
                      });
                    } else {
                      updateItemPatch({
                        item_type: 'image',
                        text: {},
                      });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="text">Текст</option>
                  <option value="image">Изображение</option>
                </select>

                <p className="mt-1 text-xs text-gray-500">
                  Текст и изображение создаются как отдельные элементы ленты.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Индекс
                </label>

                <input
                  type="number"
                  value={currentAttractionFeedItem?.index ?? 0}
                  onChange={(event) => {
                    updateItemPatch({
                      index: Number(event.target.value || 0),
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="p-3 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Привязка к достопримечательности
                </label>

                <select
                  value={assignedAttractionType}
                  onChange={(event) => {
                    const type = event.target.value;

                    updateItemPatch({
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
                    onChange={(event) => {
                      const eventId = event.target.value || null;

                      updateItemPatch({
                        assigned_attraction_type: 'database',

                        event: eventId,
                        event_id: eventId,

                        attraction: eventId,
                        attraction_id: eventId,

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
                    onChange={(event) => {
                      const attractionId = event.target.value || null;

                      updateItemPatch({
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

            {itemType === 'text' ? (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="text-sm font-medium text-gray-700">
                    Текст
                  </label>

                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded font-mono">
                    {currentLocale.lang?.toUpperCase() || 'RU'}
                  </span>
                </div>

                <textarea
                  value={currentLocale.text || ''}
                  onChange={(event) =>
                    onUpdateAttractionFeedLocaleField?.('text', event.target.value)
                  }
                  rows={8}
                  placeholder="Комментарий для ленты достопримечательности..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            ) : (
              <div className="flex gap-5 items-start">
                <FeedImagePanel
                  currentItem={currentAttractionFeedItem}
                  photoUploading={attractionFeedPhotoUploading}
                  photoFileRef={attractionFeedPhotoFileRef}
                  onOpenCommonsModal={onOpenAttractionFeedCommonsModal}
                  onPhotoFileChange={onAttractionFeedPhotoFileChange}
                  onUpdateItemPatch={updateItemPatch}
                />
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={onSaveCurrentAttractionFeedItem}
                disabled={attractionFeedSaving}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {attractionFeedSaving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </main>
        </div>
      )}
    </div>
  );
}