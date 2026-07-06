import { useMemo, useRef, useState } from 'react';

import { getFlag, normalizeId } from './sessionWizardShared.jsx';

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
      Object.values(value).find(
        (item) => typeof item === 'string' && item.trim()
      ) ||
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
      Object.values(text).find(
        (value) => typeof value === 'string' && value.trim()
      ) ||
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

const isFeedItemBindingIncomplete = (item) => {
  const type = item?.assigned_attraction_type || 'none';
  if (type === 'database') return !getDatabaseAttractionId(item);
  if (type === 'draft') return !getSessionAttractionId(item);
  return false;
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
      referenceAttractions.find(
        (entry) => normalizeId(entry.id) === attractionId
      );

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
      sessionAttractions.find(
        (entry) => normalizeId(entry.id) === attractionId
      );

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
  onAddFeedBlock,
}) {
  const currentId = normalizeId(currentAttractionFeedItem?.id);

  return (
    <div className="p-3 border border-gray-200 rounded-xl bg-gray-50">
      <div className="flex items-center justify-between mb-2 gap-3">
        <p className="text-sm font-medium text-gray-800">
          Элементы ленты
        </p>

        <button
          type="button"
          onClick={() => onAddFeedBlock?.()}
          className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors"
        >
          + Блок (фото + текст)
        </button>
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

                <span
                  className={
                    item.item_type === 'image'
                      ? 'text-purple-600'
                      : 'text-blue-600'
                  }
                >
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

// ─── Блочная модель ленты ────────────────────────────────────────────────────
// UI группирует элементы в блоки «фото + текст», но в API это по-прежнему
// отдельные feed-item'ы (item_type=image / text) с индексами — контракт
// бэкенда и мобильного приложения не меняется.

const getFeedItemBindingKey = (item) =>
  getDatabaseAttractionId(item) || getSessionAttractionId(item) || 'none';

function buildFeedBlocks(items = []) {
  const sorted = [...items].sort((a, b) => {
    const ai = Number(a.index ?? 0);
    const bi = Number(b.index ?? 0);
    if (ai !== bi) return ai - bi;
    return String(a.id).localeCompare(String(b.id));
  });

  const blocks = [];
  let cursor = 0;
  while (cursor < sorted.length) {
    const item = sorted[cursor];
    const next = sorted[cursor + 1];

    if (
      item.item_type === 'image' &&
      next?.item_type === 'text' &&
      getFeedItemBindingKey(item) === getFeedItemBindingKey(next)
    ) {
      blocks.push({ key: `${item.id}:${next.id}`, image: item, text: next });
      cursor += 2;
      continue;
    }

    if (item.item_type === 'image') {
      blocks.push({ key: String(item.id), image: item, text: null });
    } else {
      blocks.push({ key: String(item.id), image: null, text: item });
    }
    cursor += 1;
  }

  return blocks;
}

const flattenBlocksToIds = (blocks) =>
  blocks.flatMap((block) => [block.image?.id, block.text?.id].filter(Boolean));

function FeedBlockCard({
  block,
  position,
  referenceAttractions,
  attractions,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onOpenItem,
  onAddMissingHalf,
  onDeleteBlock,
}) {
  const anchorItem = block.image || block.text;
  const textPreview = block.text ? getFeedItemTextPreview(block.text) : '';
  const imagePreview = block.image ? getFeedImagePreview(block.image) : null;
  const bindingIncomplete = isFeedItemBindingIncomplete(anchorItem);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`relative flex gap-3 p-3 bg-white border rounded-xl transition-all select-none ${
        isDragging
          ? 'opacity-40 border-blue-400'
          : isDropTarget
            ? 'border-blue-500 ring-2 ring-blue-200'
            : 'border-gray-200 hover:border-blue-300'
      }`}
    >
      {/* Ручка + номер блока */}
      <div className="flex flex-col items-center gap-1 shrink-0 pt-1 cursor-grab active:cursor-grabbing text-gray-400">
        <span className="text-base leading-none" title="Перетащите, чтобы изменить порядок">⠿</span>
        <span className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
          {position + 1}
        </span>
      </div>

      {/* Фото-половина */}
      <div className="w-32 shrink-0">
        {block.image ? (
          <button
            type="button"
            onClick={() => onOpenItem?.(block.image.id)}
            className="relative block w-full aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden border border-gray-200 hover:ring-2 hover:ring-blue-300 transition-shadow"
            title="Открыть фото"
          >
            {imagePreview ? (
              <img src={imagePreview} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-[11px] text-gray-400 px-1 text-center">
                Фото не выбрано — нажмите, чтобы добавить
              </span>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onAddMissingHalf?.(block, 'image')}
            className="w-full aspect-[4/3] rounded-lg border-2 border-dashed border-gray-300 text-gray-400 text-xs hover:border-blue-400 hover:text-blue-500 transition-colors"
          >
            + фото
          </button>
        )}
      </div>

      {/* Текст-половина */}
      <div className="flex-1 min-w-0 flex flex-col">
        {block.text ? (
          <button
            type="button"
            onClick={() => onOpenItem?.(block.text.id)}
            className="flex-1 text-left text-sm text-gray-700 leading-snug rounded-lg px-2 py-1.5 -mx-1 hover:bg-blue-50 transition-colors"
            title="Открыть текст"
          >
            {textPreview ? (
              <span className="line-clamp-4">{textPreview}</span>
            ) : (
              <span className="text-gray-400 italic">
                Текст не заполнен — нажмите, чтобы написать
              </span>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onAddMissingHalf?.(block, 'text')}
            className="flex-1 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 text-xs hover:border-blue-400 hover:text-blue-500 transition-colors"
          >
            + текст к этому фото
          </button>
        )}

        <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mt-1.5 min-w-0">
          <span className="truncate">
            {getFeedItemBindingLabel(anchorItem, referenceAttractions, attractions)}
          </span>
          {bindingIncomplete && (
            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium shrink-0">
              ⚠ не выбрана
            </span>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onDeleteBlock?.(block)}
        className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-md text-gray-300 hover:text-red-600 hover:bg-red-50 transition-colors"
        title="Удалить блок"
      >
        ✕
      </button>
    </div>
  );
}

export default function SessionWizardAttractionFeedStep({
  embedded = false,
  scopedToAttractionId = '',

  attractionFeedItems = [],
  currentAttractionFeedItem,
  attractionFeedLocaleData = {},
  attractionFeedActiveLocale = 'ru-RU',
  attractionFeedSaving = false,
  attractionFeedAutoSaving = false,
  attractionFeedAutoSaved = false,
  attractionFeedPhotoUploading = false,
  attractionFeedPhotoFileRef,

  referenceAttractions = [],
  attractions = [],

  onOpenAttractionFeedItemDetail,
  onAddAttractionFeedItem,
  onAddAttractionFeedBlock,
  onReorderAttractionFeedItems,
  onDeleteAttractionFeedItemsByIds,
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

  const isBindingIncomplete = isFeedItemBindingIncomplete(currentAttractionFeedItem);

  const updateItemPatch = (patch) => {
    if (typeof onUpdateCurrentAttractionFeedItemPatch === 'function') {
      onUpdateCurrentAttractionFeedItemPatch(patch);
    }
  };

  // ─── Блочный режим списка: карточки «фото + текст» с drag&drop ────────────
  const feedBlocks = useMemo(
    () => buildFeedBlocks(attractionFeedItems),
    [attractionFeedItems],
  );

  const [dragBlockKey, setDragBlockKey] = useState(null);
  const [dropBlockKey, setDropBlockKey] = useState(null);
  // ref — источник истины для drop: state может не успеть обновиться
  // между dragstart и drop (быстрый жест), стейт нужен только для подсветки
  const dragBlockKeyRef = useRef(null);

  const handleBlockDrop = (targetKey) => {
    const sourceKey = dragBlockKeyRef.current;
    setDropBlockKey(null);
    if (!sourceKey || sourceKey === targetKey) return;

    const fromIdx = feedBlocks.findIndex((b) => b.key === sourceKey);
    const toIdx = feedBlocks.findIndex((b) => b.key === targetKey);
    if (fromIdx < 0 || toIdx < 0) return;

    const next = [...feedBlocks];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);

    onReorderAttractionFeedItems?.(flattenBlocksToIds(next));
  };

  const handleAddMissingHalf = (block, type) => {
    const sibling = block.image || block.text;
    if (!sibling) return;

    // Фото встаёт ПЕРЕД текстом пары, текст — ПОСЛЕ фото пары
    const insertAt = type === 'image'
      ? Number(sibling.index ?? 0)
      : Number(sibling.index ?? 0) + 1;

    onAddAttractionFeedItem?.(type, {
      bindingFromItem: sibling,
      insertAt,
    });
  };

  const handleDeleteBlock = (block) => {
    const ids = [block.image?.id, block.text?.id].filter(Boolean);
    const label = ids.length > 1 ? 'блок (фото и текст)' : 'элемент ленты';
    onDeleteAttractionFeedItemsByIds?.(ids, { label });
  };

  if (!currentAttractionFeedItem) {
    return (
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Лента достопримечательности
            </h2>

            <p className="text-sm text-gray-500">
              Блок ленты — это фотография и подпись к ней. Перетаскивайте
              карточки за ⠿, чтобы изменить порядок показа в приложении.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onAddAttractionFeedBlock?.()}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shrink-0"
          >
            + Добавить блок
          </button>
        </div>

        {feedBlocks.length === 0 ? (
          <div className="text-center py-10 text-gray-400 border border-dashed border-gray-200 rounded-xl bg-gray-50">
            <div className="text-3xl mb-2">🖼️</div>

            <p className="text-sm">
              {scopedToAttractionId
                ? 'Для этой достопримечательности пока нет ленты.'
                : 'Лента пуста. Добавьте первый блок «фото + текст».'}
            </p>
          </div>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-1 lg:grid-cols-2">
            {feedBlocks.map((block, position) => (
              <FeedBlockCard
                key={block.key}
                block={block}
                position={position}
                referenceAttractions={referenceAttractions}
                attractions={attractions}
                isDragging={dragBlockKey === block.key}
                isDropTarget={dropBlockKey === block.key && dragBlockKey !== block.key}
                onDragStart={(event) => {
                  if (event.dataTransfer) {
                    event.dataTransfer.effectAllowed = 'move';
                  }
                  dragBlockKeyRef.current = block.key;
                  setDragBlockKey(block.key);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (event.dataTransfer) {
                    event.dataTransfer.dropEffect = 'move';
                  }
                  setDropBlockKey(block.key);
                }}
                onDragLeave={() => {
                  setDropBlockKey((prev) => (prev === block.key ? null : prev));
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  handleBlockDrop(block.key);
                }}
                onDragEnd={() => {
                  dragBlockKeyRef.current = null;
                  setDragBlockKey(null);
                  setDropBlockKey(null);
                }}
                onOpenItem={onOpenAttractionFeedItemDetail}
                onAddMissingHalf={handleAddMissingHalf}
                onDeleteBlock={handleDeleteBlock}
              />
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
        onAddFeedBlock={onAddAttractionFeedBlock}
      />

      {itemType === 'text' && (
        <div className="flex items-center gap-1 flex-wrap">
          {Object.entries(attractionFeedLocaleData || {}).map(([key, locale]) => {
            const isActive = key === attractionFeedActiveLocale;

            return (
              <button
                key={key}
                type="button"
                onClick={() => onSetAttractionFeedActiveLocale?.(key)}
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
                if (nextType === itemType) return;

                const hasText = itemType === 'text' && Object.values(
                  (typeof currentAttractionFeedItem?.text === 'object'
                    ? currentAttractionFeedItem.text : {})
                ).some(Boolean);
                const hasImage = itemType === 'image' && getFeedImagePreview(currentAttractionFeedItem);

                if ((hasText || hasImage) && !window.confirm(
                  nextType === 'text'
                    ? 'Смена типа на «Текст» сотрёт прикреплённое изображение. Продолжить?'
                    : 'Смена типа на «Изображение» сотрёт текстовое содержимое. Продолжить?'
                )) {
                  event.target.value = itemType;
                  return;
                }

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
                  updateItemPatch({ item_type: 'image', text: {} });
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

          {isBindingIncomplete && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              ⚠ Выбран тип привязки, но достопримечательность не выбрана. Элемент сохранится без привязки.
            </p>
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
              rows={embedded ? 5 : 8}
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

        <div className="flex items-center justify-end gap-3">
          {(attractionFeedAutoSaving || attractionFeedAutoSaved) && !attractionFeedSaving && (
            <div
              className={`flex items-center gap-1.5 text-xs transition-opacity ${
                attractionFeedAutoSaved && !attractionFeedAutoSaving
                  ? 'text-emerald-600'
                  : 'text-gray-400'
              }`}
            >
              {attractionFeedAutoSaving ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                  <span>Сохранение...</span>
                </>
              ) : (
                <>
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>Сохранено</span>
                </>
              )}
            </div>
          )}
          {isBindingIncomplete && (
            <span className="text-xs text-amber-600">Привязка не выбрана</span>
          )}
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
    </section>
  );
}