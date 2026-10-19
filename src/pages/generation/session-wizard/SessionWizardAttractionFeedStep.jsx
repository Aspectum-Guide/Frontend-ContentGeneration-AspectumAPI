import { useMemo, useRef, useState } from 'react';
import { FormLabel, Alert, Button, ConfirmModal, EmptyState, FileButton, IconButton, LoadingOverlay, LocaleEditor, Panel, SectionHeader, Select, SelectableCard, Spinner, TextInput, Textarea } from '@aspectum/ui';

import { normalizeId } from './sessionWizardShared.jsx';
import { usePasteImageOnHover } from '../../../hooks/usePasteImageOnHover';

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
    <Panel tone="muted" className="p-3">
      <div className="flex items-center justify-between mb-2 gap-3">
        <p className="text-sm font-medium text-aspectum-text-emphasis">
          Элементы ленты
        </p>

        <Button
          type="button"
          onClick={() => onAddFeedBlock?.()}
          variant="softStrong"
          size="sm"
        >
          + Блок (фото + текст)
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {attractionFeedItems.length === 0 ? (
          <EmptyState title="Пока нет элементов ленты" className="py-3" />
        ) : (
          attractionFeedItems.map((item, index) => {
            const itemId = normalizeId(item.id);
            const isActive = itemId === currentId;

            return (
              <SelectableCard
                key={item.id}
                onSelect={() => {
                  if (!isActive) {
                    onSelectFeedItem?.(item.id);
                  }
                }}
                ariaLabel={getFeedItemName(item)}
                className={`flex items-center gap-1 px-2 py-1 rounded-aspectum-control border text-xs transition-colors ${
                  isActive
                    ? 'bg-aspectum-primary-soft border-aspectum-primary-border-strong text-aspectum-primary-hover font-medium'
                    : 'bg-aspectum-surface border-aspectum-border text-aspectum-text-strong hover:border-aspectum-primary-border-strong hover:bg-aspectum-primary-soft'
                }`}
                title={getFeedItemName(item)}
              >
                <span className="text-aspectum-text-disabled">{index + 1}.</span>

                <span
                  className={
                    item.item_type === 'image'
                      ? 'text-aspectum-purple'
                      : 'text-aspectum-primary'
                  }
                >
                  {item.item_type === 'image' ? '🖼️' : '💬'}
                </span>

                <span>{getFeedItemName(item)}</span>
              </SelectableCard>
            );
          })
        )}
      </div>
    </Panel>
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

  const photoPaste = usePasteImageOnHover((file) =>
    onPhotoFileChange?.({ target: { files: [file], value: '' } }, currentItem),
  );

  return (
    <aside className="w-52 shrink-0 space-y-3">
      <div
        {...photoPaste}
        title="Наведите и нажмите Ctrl+V, чтобы вставить фото из буфера"
        className="relative aspect-[3/4] bg-aspectum-surface-subtle rounded-aspectum-card overflow-hidden border border-aspectum-border flex items-center justify-center">
        {imagePreview ? (
          <img
            src={imagePreview}
            alt="Изображение ленты"
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-aspectum-text-disabled text-sm text-center px-2">
            Изображение ленты
          </span>
        )}

        <LoadingOverlay loading={photoUploading} label="Загрузка фото…" className="absolute inset-0" />

        <Button
          type="button"
          onClick={() => onOpenCommonsModal?.(currentItem)}
          title="Библиотека изображений: Commons, Минкульт, Openverse, Pastvu, Mapillary"
          variant="purple"
          size="sm"
          className="absolute top-2 right-2 shadow-aspectum-elevated"
        >
          ⊞ Библиотека
        </Button>
      </div>

      <div>
        <FileButton
          inputRef={photoFileRef}
          accept="image/*"
          variant="soft"
          size="md"
          className="w-full"
          onChange={(event) => onPhotoFileChange?.(event, currentItem)}
        >
          + Добавить фото
        </FileButton>
      </div>

      <div className="space-y-1.5">
        <div>
          <FormLabel  layout="block" size="xs" tone="muted" spacing="xxs">
            URL
          </FormLabel>

          <TextInput type="url" value={imageOriginalUrl || ''} onChange={(event) => { onUpdateItemPatch?.({ image_original_url: event.target.value, imageOriginalUrl: event.target.value, }); }} placeholder="https://upload.wikimedia.org/..." />
        </div>

        <div>
          <FormLabel  layout="block" size="xs" tone="muted" spacing="xxs">
            Авторские права
          </FormLabel>

          <TextInput type="text" value={imageCopyright || ''} onChange={(event) => { onUpdateItemPatch?.({ image_copyright: event.target.value, imageCopyright: event.target.value, }); }} placeholder="© Автор / Источник" />
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
    <Panel
      as="article"
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`relative flex gap-3 p-3 transition-all select-none ${
        isDragging
          ? 'opacity-40 border-aspectum-primary-light'
          : isDropTarget
            ? 'border-aspectum-focus ring-2 ring-aspectum-primary-border'
            : 'border-aspectum-border hover:border-aspectum-primary-border-strong'
      }`}
    >
      {/* Ручка + номер блока */}
      <div className="flex flex-col items-center gap-1 shrink-0 pt-1 cursor-grab active:cursor-grabbing text-aspectum-text-disabled">
        <span className="text-base leading-none" title="Перетащите, чтобы изменить порядок">⠿</span>
        <span className="w-6 h-6 flex items-center justify-center rounded-full bg-aspectum-surface-subtle text-xs font-medium text-aspectum-text-subtle">
          {position + 1}
        </span>
      </div>

      {/* Фото-половина */}
      <div className="w-32 shrink-0">
        {block.image ? (
          <Button
            type="button"
            onClick={() => onOpenItem?.(block.image.id)}
            variant="mediaTile"
            size="sm"
            className="relative block w-full aspect-[4/3] min-h-0 p-0 overflow-hidden"
            title="Открыть фото"
          >
            {imagePreview ? (
              <img src={imagePreview} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-[11px] text-aspectum-text-disabled px-1 text-center">
                Фото не выбрано — нажмите, чтобы добавить
              </span>
            )}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => onAddMissingHalf?.(block, 'image')}
            variant="dashedTile"
            size="sm"
            className="w-full aspect-[4/3] min-h-0"
          >
            + фото
          </Button>
        )}
      </div>

      {/* Текст-половина */}
      <div className="flex-1 min-w-0 flex flex-col">
        {block.text ? (
          <Button
            type="button"
            onClick={() => onOpenItem?.(block.text.id)}
            variant="textTile"
            size="sm"
            className="flex-1 min-h-0 text-left text-sm leading-snug -mx-1"
            title="Открыть текст"
          >
            {textPreview ? (
              <span className="line-clamp-4">{textPreview}</span>
            ) : (
              <span className="text-aspectum-text-muted italic">
                Текст не заполнен — нажмите, чтобы написать
              </span>
            )}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => onAddMissingHalf?.(block, 'text')}
            variant="dashedTile"
            size="sm"
            className="flex-1 min-h-0"
          >
            + текст к этому фото
          </Button>
        )}

        <div className="flex items-center gap-1.5 text-[11px] text-aspectum-text-muted mt-1.5 min-w-0">
          <span className="truncate">
            {getFeedItemBindingLabel(anchorItem, referenceAttractions, attractions)}
          </span>
          {bindingIncomplete && (
            <span className="px-1.5 py-0.5 rounded-aspectum-control bg-aspectum-warning-soft text-aspectum-warning font-medium shrink-0">
              ⚠ не выбрана
            </span>
          )}
        </div>
      </div>

      <IconButton
        onClick={() => onDeleteBlock?.(block)}
        className="absolute top-2 right-2 w-6 h-6 p-0"
        label="Удалить блок"
        variant="ghostDanger"
      >
        ✕
      </IconButton>
    </Panel>
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
  const [pendingItemType, setPendingItemType] = useState(null);
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

  const applyItemType = (nextType) => {
    if (nextType === 'text') {
      updateItemPatch({
        item_type: 'text', image: null, image_id: null, image_url: '', imageUrl: '',
        image_original_url: '', imageOriginalUrl: '', image_copyright: '', imageCopyright: '',
      });
      return;
    }
    updateItemPatch({ item_type: 'image', text: {} });
  };

  const handleItemTypeChange = (event) => {
    const nextType = event.target.value;
    if (nextType === itemType) return;
    const hasText = itemType === 'text' && Object.values(
      typeof currentAttractionFeedItem?.text === 'object' ? currentAttractionFeedItem.text : {},
    ).some(Boolean);
    const hasImage = itemType === 'image' && getFeedImagePreview(currentAttractionFeedItem);
    if (hasText || hasImage) {
      setPendingItemType(nextType);
      return;
    }
    applyItemType(nextType);
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
        <SectionHeader title="Лента достопримечательности" description="Блок ленты — это фотография и подпись к ней. Перетаскивайте карточки за ⠿, чтобы изменить порядок показа в приложении." actions={<Button
            type="button"
            onClick={() => onAddAttractionFeedBlock?.()}
            variant="primary"
            size="md"
          >
            + Добавить блок
          </Button>} />

        {feedBlocks.length === 0 ? (
          <EmptyState
            icon="🖼️"
            title={scopedToAttractionId ? 'Лента пока пуста' : 'Лента пуста'}
            description={scopedToAttractionId
              ? 'Для этой достопримечательности пока нет ленты.'
              : 'Добавьте первый блок «фото + текст».'}
          />
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
            <Button
              type="button"
              onClick={() => onGoToStep?.(3)}
              variant="outline"
              size="md"
            >
              ← Назад
            </Button>

            <Button
              type="button"
              onClick={() => onGoToStep?.(4)}
              variant="primary"
              size="md"
            >
              Далее: Публикация →
            </Button>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <IconButton
          onClick={() => onSetCurrentAttractionFeedItem?.(null)}
          className="w-8 h-8"
          label="Назад к списку элементов ленты"
          variant="outline"
        >
          ←
        </IconButton>

        <span className="text-base font-semibold text-aspectum-text">
          {getFeedItemName(currentAttractionFeedItem)}
        </span>

        <Button
          type="button"
          onClick={onDeleteCurrentAttractionFeedItem}
          variant="softDanger"
          size="sm"
          className="ml-auto"
        >
          Удалить
        </Button>
      </div>

      <AttractionFeedItemsPanel
        attractionFeedItems={attractionFeedItems}
        currentAttractionFeedItem={currentAttractionFeedItem}
        onSelectFeedItem={onOpenAttractionFeedItemDetail}
        onAddFeedBlock={onAddAttractionFeedBlock}
      />

      {itemType === 'text' && (
        <LocaleEditor
          localeData={attractionFeedLocaleData}
          activeLocale={attractionFeedActiveLocale}
          onSwitch={onSetAttractionFeedActiveLocale}
          showStatus={false}
        />
      )}

      <main className="space-y-4">
        <Panel tone="muted" className="p-3 space-y-3">
          <div>
            <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="xs">
              Тип элемента ленты
            </FormLabel>

            <Select className="bg-aspectum-surface" value={itemType} onChange={handleItemTypeChange}>
              <option value="text">Текст</option>
              <option value="image">Изображение</option>
            </Select>

            <p className="mt-1 text-xs text-aspectum-text-muted">
              Текст и изображение создаются как отдельные элементы ленты.
            </p>
          </div>

          <div>
            <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="xs">
              Индекс
            </FormLabel>

            <TextInput type="number" value={currentAttractionFeedItem?.index ?? 0} onChange={(event) => { updateItemPatch({ index: Number(event.target.value || 0), }); }} />
          </div>
        </Panel>

        <Panel tone="muted" className="p-3 space-y-3">
          <div>
            <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="xs">
              Привязка к достопримечательности
            </FormLabel>

            <Select className="bg-aspectum-surface" value={assignedAttractionType} onChange={(event) => { const type = event.target.value; updateItemPatch({ assigned_attraction_type: type, event: null, event_id: null, attraction: null, attraction_id: null, session_attraction: null, session_attraction_id: null, }); }}>
              <option value="none">Без достопримечательности</option>
              <option value="database">Достопримечательность из базы</option>
              <option value="draft">Достопримечательность из сессии</option>
            </Select>
          </div>

          {assignedAttractionType === 'database' && (
            <div>
              <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="xs">
                Достопримечательность из базы
              </FormLabel>

              <Select className="bg-aspectum-surface" value={selectedDatabaseAttractionId} onChange={(event) => { const eventId = event.target.value || null; updateItemPatch({ assigned_attraction_type: 'database', event: eventId, event_id: eventId, attraction: eventId, attraction_id: eventId, session_attraction: null, session_attraction_id: null, }); }}>
                <option value="">Выберите достопримечательность из базы</option>

                {referenceAttractions.map((attraction) => (
                  <option key={attraction.id} value={attraction.id}>
                    {getAttractionDisplayName(attraction)}
                  </option>
                ))}
              </Select>

              {referenceAttractions.length === 0 && (
                <p className="mt-1 text-xs text-aspectum-warning">
                  Список достопримечательностей из базы не загружен.
                </p>
              )}
            </div>
          )}

          {assignedAttractionType === 'draft' && (
            <div>
              <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="xs">
                Достопримечательность из сессии
              </FormLabel>

              <Select className="bg-aspectum-surface" value={selectedSessionAttractionId} onChange={(event) => { const attractionId = event.target.value || null; updateItemPatch({ assigned_attraction_type: 'draft', session_attraction: attractionId, session_attraction_id: attractionId, event: null, event_id: null, attraction: null, attraction_id: null, }); }}>
                <option value="">Выберите достопримечательность из сессии</option>

                {attractions.map((attraction) => (
                  <option key={attraction.id} value={attraction.id}>
                    {getAttractionDisplayName(attraction)}
                  </option>
                ))}
              </Select>

              {attractions.length === 0 && (
                <Alert tone="warning" className="mt-1 text-xs">
                  В текущей сессии пока нет достопримечательностей.
                </Alert>
              )}
            </div>
          )}

          {isBindingIncomplete && (
            <Alert tone="warning" className="text-xs px-3 py-2">
              ⚠ Выбран тип привязки, но достопримечательность не выбрана. Элемент сохранится без привязки.
            </Alert>
          )}
        </Panel>

        {itemType === 'text' ? (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FormLabel  size="sm" weight="medium" tone="strong">
                Текст
              </FormLabel>

              <span className="px-1.5 py-0.5 bg-aspectum-primary-muted text-aspectum-primary-hover text-xs rounded font-mono">
                {currentLocale.lang?.toUpperCase() || 'RU'}
              </span>
            </div>

            <Textarea value={currentLocale.text || ''} onChange={(event) => onUpdateAttractionFeedLocaleField?.('text', event.target.value) } rows={embedded ? 5 : 8} placeholder="Комментарий для ленты достопримечательности..." />
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
                  ? 'text-aspectum-success'
                  : 'text-aspectum-text-disabled'
              }`}
            >
              {attractionFeedAutoSaving ? (
                <>
                  <Spinner size="xs" className="border-2 border-aspectum-border-strong" />
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
            <span className="text-xs text-aspectum-warning">Привязка не выбрана</span>
          )}
          <Button
            type="button"
            onClick={onSaveCurrentAttractionFeedItem}
            disabled={attractionFeedSaving}
            variant="primary"
            size="md"
          >
            {attractionFeedSaving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </main>
      <ConfirmModal
        open={!!pendingItemType}
        onClose={() => setPendingItemType(null)}
        onConfirm={() => {
          applyItemType(pendingItemType);
          setPendingItemType(null);
        }}
        title="Сменить тип элемента?"
        message={pendingItemType === 'text'
          ? 'Смена типа на «Текст» сотрёт прикреплённое изображение.'
          : 'Смена типа на «Изображение» сотрёт текстовое содержимое.'}
        confirmLabel="Сменить"
        danger
      />
    </section>
  );
}
