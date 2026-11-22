import { useCallback, useEffect, useRef, useState } from 'react';
import { attractionFeedAPI } from '../../../api/generation';
import { parseApiError } from '../../../utils/apiError';
import { normalizeId } from './sessionWizardShared.jsx';
import useFlushOnLeave from './useFlushOnLeave';
import {
  normalizeAttractionFeedItem,
  createEmptyAttractionFeedItem,
  buildAttractionFeedPayload,
  collectAttractionFeedLocaleTexts,
  buildAttractionFeedPersistSnapshot,
} from './attractionFeedCore.js';
import {
  applyAttractionFeedBinding,
  buildAttractionFeedLocaleData as makeAttractionFeedLocaleData,
  getAttractionFeedItemName,
  getAttractionLocaleLang as getLocaleLang,
} from './attractionLocaleCore.js';

export function useAttractionFeedState({
  sessionId,
  currentAttr,
  attrLocaleData,
  attractions,
  referenceAttractions,
  showNote,
  confirm,
  getSessionUuid,
  imagesAPI,
  setCommonsTarget,
  setCommonsModalOpen,
}) {
  const [attractionFeedItems, setAttractionFeedItems] = useState([]);
  const [currentAttractionFeedItem, setCurrentAttractionFeedItem] = useState(null);
  const [attractionFeedLocaleData, setAttractionFeedLocaleData] = useState({});
  const [attractionFeedActiveLocale, setAttractionFeedActiveLocale] = useState('ru-RU');
  const [attractionFeedSaving, setAttractionFeedSaving] = useState(false);
  const [attractionFeedAutoSaving, setAttractionFeedAutoSaving] = useState(false);
  const [attractionFeedAutoSaved, setAttractionFeedAutoSaved] = useState(false);
  const [attractionFeedPhotoUploading, setAttractionFeedPhotoUploading] = useState(false);
  const attractionFeedPhotoFileRef = useRef(null);
  const attractionFeedSavedSnapshotRef = useRef(null);
  const currentAttractionFeedItemIdRef = useRef(null);
  const attractionFeedAutoSaveTimerRef = useRef(null);
  const attractionFeedAutoSavedTimerRef = useRef(null);
  const attractionFeedSavingRef = useRef(false);
  const attractionFeedPhotoUploadingRef = useRef(false);
  const attractionFeedLocaleDataItemIdRef = useRef(null);

  useEffect(() => {
    attractionFeedSavingRef.current = attractionFeedSaving;
  }, [attractionFeedSaving]);

  useEffect(() => {
    attractionFeedPhotoUploadingRef.current = attractionFeedPhotoUploading;
  }, [attractionFeedPhotoUploading]);

  useEffect(() => () => {
    clearTimeout(attractionFeedAutoSaveTimerRef.current);
    clearTimeout(attractionFeedAutoSavedTimerRef.current);
  }, []);

  // ─── buildAttractionFeedLocaleData ─────────────────────────────────────────
  const buildAttractionFeedLocaleData = useCallback(
    (item, previousData = null) => {
      return makeAttractionFeedLocaleData({
        item,
        previousData,
        currentAttraction: currentAttr,
        attractionLocaleData: attrLocaleData,
        attractions,
        referenceAttractions,
      });
    },
    [currentAttr, attrLocaleData, attractions, referenceAttractions]
  );

  // ─── Feed locale data sync ─────────────────────────────────────────────────
  useEffect(() => {
    if (!currentAttractionFeedItem) {
      attractionFeedLocaleDataItemIdRef.current = null;
      setAttractionFeedLocaleData({});
      return;
    }

    if (currentAttractionFeedItem.item_type !== 'text') {
      attractionFeedLocaleDataItemIdRef.current = normalizeId(
        currentAttractionFeedItem.id
      );
      setAttractionFeedLocaleData({});
      return;
    }

    const itemId = normalizeId(currentAttractionFeedItem.id);

    setAttractionFeedLocaleData((prev) => {
      const shouldPreserveValues =
        attractionFeedLocaleDataItemIdRef.current === itemId;

      const next = buildAttractionFeedLocaleData(
        currentAttractionFeedItem,
        shouldPreserveValues ? prev : null
      );

      attractionFeedLocaleDataItemIdRef.current = itemId;

      return next;
    });
  }, [currentAttractionFeedItem, buildAttractionFeedLocaleData]);

  useEffect(() => {
    if (!currentAttractionFeedItem) return;
    if (currentAttractionFeedItem.item_type !== 'text') return;

    const availableKeys = Object.keys(attractionFeedLocaleData || {});

    if (availableKeys.length === 0) return;

    if (!availableKeys.includes(attractionFeedActiveLocale)) {
      setAttractionFeedActiveLocale(availableKeys[0]);
    }
  }, [
    currentAttractionFeedItem,
    attractionFeedLocaleData,
    attractionFeedActiveLocale,
  ]);

  useEffect(() => {
    const id = normalizeId(currentAttractionFeedItem?.id);

    if (!id) {
      currentAttractionFeedItemIdRef.current = null;
      attractionFeedSavedSnapshotRef.current = null;
      return;
    }

    if (currentAttractionFeedItemIdRef.current !== id) {
      currentAttractionFeedItemIdRef.current = id;
      attractionFeedSavedSnapshotRef.current = buildAttractionFeedPersistSnapshot(
        currentAttractionFeedItem,
        attractionFeedLocaleData,
      );
    }
  }, [currentAttractionFeedItem, attractionFeedLocaleData]);

  // ─── addAttractionFeedItem ─────────────────────────────────────────────────
  // options.insertAt — вставить на позицию, сдвинув элементы с index >= insertAt
  // (достройка недостающей половины блока «фото+текст» рядом с парной);
  // options.bindingFromItem — скопировать привязку соседа.
  const addAttractionFeedItem = useCallback(async (itemType = 'text', options = {}) => {
    try {
      let emptyItem = createEmptyAttractionFeedItem(itemType);

      const insertAt = Number.isInteger(options.insertAt) ? options.insertAt : null;

      if (insertAt !== null) {
        // Сдвигаем соседей ДО создания: новый элемент займёт insertAt
        const toShift = attractionFeedItems.filter(
          (item) => Number(item.index) >= insertAt
        );
        await Promise.all(
          toShift.map((item) =>
            attractionFeedAPI.update(
              sessionId,
              item.id,
              buildAttractionFeedPayload({ ...item, index: Number(item.index) + 1 })
            )
          )
        );
      }

      emptyItem.index = insertAt !== null
        ? insertAt
        : attractionFeedItems.length;

      emptyItem = applyAttractionFeedBinding(emptyItem, {
        bindingSource: options.bindingFromItem,
        activeAttractionId: currentAttr?.id,
      });

      const res = await attractionFeedAPI.create(
        sessionId,
        buildAttractionFeedPayload(emptyItem)
      );

      const rawItem = res?.data?.attraction_feed_item || res?.data;
      const item = rawItem?.id != null ? normalizeAttractionFeedItem(rawItem) : null;

      if (item?.id) {
        const nextItemId = normalizeId(item.id);
        if (attractionFeedLocaleDataItemIdRef.current !== nextItemId) {
          attractionFeedLocaleDataItemIdRef.current = null;
        }

        setAttractionFeedItems((prev) => {
          const base = insertAt !== null
            ? prev.map((existing) =>
                Number(existing.index) >= insertAt
                  ? { ...existing, index: Number(existing.index) + 1 }
                  : existing
              )
            : prev;
          return [...base, item];
        });
        setCurrentAttractionFeedItem(item);

        showNote('Элемент ленты добавлен', 'success');
      }
      return item;
    } catch (e) {
      showNote(
        'Ошибка при добавлении элемента ленты: ' + parseApiError(e),
        'error'
      );
      return null;
    }
  }, [sessionId, attractionFeedItems, showNote, currentAttr]);

  // ─── addAttractionFeedBlock ────────────────────────────────────────────────
  // Блок = пара «изображение + текст». В API это по-прежнему ДВА отдельных
  // feed-item'а (item_type=image и item_type=text) с соседними индексами —
  // контракт бэкенда и мобильного приложения не меняется.
  const addAttractionFeedBlock = useCallback(async () => {
    try {
      // max(index)+1 устойчивее к дырам/дубликатам индексов, чем length
      const baseIndex = attractionFeedItems.reduce(
        (acc, item) => Math.max(acc, Number(item.index ?? 0) + 1),
        attractionFeedItems.length,
      );
      const created = [];

      for (const [offset, itemType] of [[0, 'image'], [1, 'text']]) {
        const emptyItem = applyAttractionFeedBinding(
          createEmptyAttractionFeedItem(itemType),
          { activeAttractionId: currentAttr?.id },
        );
        emptyItem.index = baseIndex + offset;

        const res = await attractionFeedAPI.create(
          sessionId,
          buildAttractionFeedPayload(emptyItem)
        );
        const rawItem = res?.data?.attraction_feed_item || res?.data;
        const item = rawItem?.id != null ? normalizeAttractionFeedItem(rawItem) : null;
        if (item?.id) created.push(item);
      }

      if (created.length) {
        setAttractionFeedItems((prev) => [...prev, ...created]);
        showNote('Блок ленты (фото + текст) добавлен', 'success');
      }
      return created;
    } catch (e) {
      showNote('Ошибка при добавлении блока ленты: ' + parseApiError(e), 'error');
      return [];
    }
  }, [sessionId, attractionFeedItems, showNote, currentAttr]);

  // ─── reorderAttractionFeedItems ────────────────────────────────────────────
  // Принимает id в новом визуальном порядке, переиндексирует 0..N-1 и
  // сохраняет изменившиеся индексы через существующий update-эндпоинт.
  const reorderAttractionFeedItems = useCallback(async (orderedIds, { silent = false } = {}) => {
    const orderMap = new Map(
      orderedIds.map((id, position) => [normalizeId(id), position])
    );

    // Считаем новый порядок ЧИСТО (не внутри setState-updater'а: его
    // side-effect'ы выполняются позже и PATCH'и не успели бы собраться)
    const next = [...attractionFeedItems]
      .sort((a, b) => {
        const pa = orderMap.get(normalizeId(a.id)) ?? Number.MAX_SAFE_INTEGER;
        const pb = orderMap.get(normalizeId(b.id)) ?? Number.MAX_SAFE_INTEGER;
        return pa - pb;
      })
      .map((item, position) =>
        Number(item.index) !== position ? { ...item, index: position } : item
      );

    const prevIndexById = new Map(
      attractionFeedItems.map((item) => [normalizeId(item.id), Number(item.index)])
    );
    const changed = next.filter(
      (item) => prevIndexById.get(normalizeId(item.id)) !== Number(item.index)
    );

    setAttractionFeedItems(next);

    // Текущий открытый элемент тоже мог сменить индекс
    setCurrentAttractionFeedItem((prev) => {
      if (!prev) return prev;
      const position = orderMap.get(normalizeId(prev.id));
      if (position === undefined || Number(prev.index) === position) return prev;
      return { ...prev, index: position };
    });

    try {
      await Promise.all(
        changed.map((item) =>
          attractionFeedAPI.update(
            sessionId,
            item.id,
            buildAttractionFeedPayload(item)
          )
        )
      );
      if (changed.length && !silent) {
        showNote('Порядок ленты обновлён', 'success');
      }
    } catch (e) {
      showNote('Ошибка при сохранении порядка: ' + parseApiError(e), 'error');
    }
  }, [sessionId, attractionFeedItems, showNote]);

  // ─── deleteAttractionFeedItemsByIds ────────────────────────────────────────
  // Удаление блока целиком (обе половины) из списка, без открытия detail.
  const deleteAttractionFeedItemsByIds = useCallback(async (ids, { label = 'блок' } = {}) => {
    const targetIds = (ids || []).map(normalizeId).filter(Boolean);
    if (!targetIds.length) return;

    if (!(await confirm({ message: `Удалить ${label}?`, danger: true }))) {
      return;
    }

    try {
      for (const id of targetIds) {
        await attractionFeedAPI.delete(sessionId, id);
      }
      setAttractionFeedItems((items) =>
        items.filter((item) => !targetIds.includes(normalizeId(item.id)))
      );
      setCurrentAttractionFeedItem((prev) =>
        prev && targetIds.includes(normalizeId(prev.id)) ? null : prev
      );
      showNote('Удалено', 'success');
    } catch (e) {
      showNote('Ошибка при удалении: ' + parseApiError(e), 'error');
    }
  }, [sessionId, confirm, showNote]);

  // ─── updateAttractionFeedLocaleField ───────────────────────────────────────
  const updateAttractionFeedLocaleField = useCallback((field, value) => {
    const lang =
      attractionFeedLocaleData?.[attractionFeedActiveLocale]?.lang ||
      getLocaleLang(attractionFeedActiveLocale);

    setCurrentAttractionFeedItem((prev) => {
      if (!prev) return prev;

      const prevField =
        prev[field] && typeof prev[field] === 'object' && !Array.isArray(prev[field])
          ? prev[field]
          : {};

      const updated = {
        ...prev,
        [field]: {
          ...prevField,
          [lang]: value,
        },
      };

      setAttractionFeedItems((items) =>
        items.map((item) =>
          normalizeId(item.id) === normalizeId(updated.id) ? updated : item
        )
      );

      return updated;
    });
  }, [attractionFeedActiveLocale, attractionFeedLocaleData]);

  // ─── updateCurrentAttractionFeedItemPatch ──────────────────────────────────
  const updateCurrentAttractionFeedItemPatch = useCallback((patch) => {
    setCurrentAttractionFeedItem((prev) => {
      if (!prev) return prev;

      const updated = normalizeAttractionFeedItem({
        ...prev,
        ...patch,
      });

      setAttractionFeedItems((items) =>
        items.map((item) =>
          normalizeId(item.id) === normalizeId(updated.id) ? updated : item
        )
      );

      return updated;
    });
  }, []);

  // ─── saveCurrentAttractionFeedItem ─────────────────────────────────────────
  const saveCurrentAttractionFeedItem = useCallback(
    async ({ silent = false } = {}) => {
      if (!currentAttractionFeedItem) return null;

      const assignedType = currentAttractionFeedItem.assigned_attraction_type ?? 'none';

      const eventId =
        currentAttractionFeedItem.event_id ??
        currentAttractionFeedItem.event ??
        currentAttractionFeedItem.attraction_id ??
        currentAttractionFeedItem.attraction ??
        null;

      const sessionAttractionId =
        currentAttractionFeedItem.session_attraction_id ??
        currentAttractionFeedItem.session_attraction ??
        null;

      if (assignedType === 'database' && !eventId) {
        if (!silent) {
          showNote('Выберите достопримечательность из базы', 'error');
        }
        throw new Error('missing-database-attraction');
      }

      if (assignedType === 'draft' && !sessionAttractionId) {
        if (!silent) {
          showNote('Выберите достопримечательность из сессии', 'error');
        }
        throw new Error('missing-session-attraction');
      }

      if (
        currentAttractionFeedItem.item_type === 'image' &&
        !currentAttractionFeedItem.image_id
      ) {
        if (!silent) {
          showNote('Добавьте изображение для элемента ленты', 'error');
        }
        throw new Error('missing-feed-image');
      }

      setAttractionFeedSaving(true);

      try {
        const text =
          currentAttractionFeedItem.item_type === 'text'
            ? collectAttractionFeedLocaleTexts(attractionFeedLocaleData)
            : {};

        const res = await attractionFeedAPI.update(
          sessionId,
          currentAttractionFeedItem.id,
          buildAttractionFeedPayload(currentAttractionFeedItem, text),
        );

        const responseItem = res?.data?.attraction_feed_item || res?.data || {};

        const updatedItem = normalizeAttractionFeedItem({
          ...currentAttractionFeedItem,
          ...responseItem,
          text: responseItem.text ?? text,
        });

        setAttractionFeedItems((prev) =>
          prev.map((item) =>
            normalizeId(item.id) === normalizeId(currentAttractionFeedItem.id)
              ? updatedItem
              : item,
          ),
        );

        setCurrentAttractionFeedItem(updatedItem);

        attractionFeedSavedSnapshotRef.current = buildAttractionFeedPersistSnapshot(
          updatedItem,
          attractionFeedLocaleData,
        );

        if (!silent) {
          showNote('Элемент ленты сохранён', 'success');
        }

        return updatedItem;
      } catch (e) {
        if (!silent) {
          showNote(
            'Ошибка при сохранении элемента ленты: ' + parseApiError(e),
            'error',
          );
        }
        throw e;
      } finally {
        setAttractionFeedSaving(false);
      }
    },
    [
      sessionId,
      currentAttractionFeedItem,
      attractionFeedLocaleData,
      showNote,
    ],
  );

  // ─── isCurrentAttractionFeedItemDirty ──────────────────────────────────────
  const isCurrentAttractionFeedItemDirty = useCallback(() => {
    if (!currentAttractionFeedItem?.id) return false;

    const snap = buildAttractionFeedPersistSnapshot(
      currentAttractionFeedItem,
      attractionFeedLocaleData,
    );

    return snap !== attractionFeedSavedSnapshotRef.current;
  }, [currentAttractionFeedItem, attractionFeedLocaleData]);

  // ─── saveCurrentAttractionFeedItemIfDirty ──────────────────────────────────
  const saveCurrentAttractionFeedItemIfDirty = useCallback(
    async (options = {}) => {
      clearTimeout(attractionFeedAutoSaveTimerRef.current);
      const deadline = Date.now() + 15000;
      while (
        (attractionFeedSavingRef.current ||
          attractionFeedAutoSaving ||
          attractionFeedPhotoUploadingRef.current) &&
        Date.now() < deadline
      ) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      if (
        !currentAttractionFeedItem?.id ||
        !isCurrentAttractionFeedItemDirty()
      ) {
        return true;
      }

      await saveCurrentAttractionFeedItem(options);
      return true;
    },
    [
      currentAttractionFeedItem,
      isCurrentAttractionFeedItemDirty,
      saveCurrentAttractionFeedItem,
      attractionFeedAutoSaving,
    ],
  );
  useFlushOnLeave(() => saveCurrentAttractionFeedItemIfDirty({ silent: true }));

  // ─── Auto-save for feed item ───────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(attractionFeedAutoSaveTimerRef.current);

    if (!sessionId || !currentAttractionFeedItem?.id) return;

    if (!isCurrentAttractionFeedItemDirty()) return;

    attractionFeedAutoSaveTimerRef.current = setTimeout(async () => {
      if (
        attractionFeedSavingRef.current ||
        attractionFeedPhotoUploadingRef.current
      ) {
        return;
      }

      setAttractionFeedAutoSaving(true);
      setAttractionFeedAutoSaved(false);

      try {
        await saveCurrentAttractionFeedItem({ silent: true });

        setAttractionFeedAutoSaved(true);

        clearTimeout(attractionFeedAutoSavedTimerRef.current);
        attractionFeedAutoSavedTimerRef.current = setTimeout(() => {
          setAttractionFeedAutoSaved(false);
        }, 2500);
      } catch (e) {
        showNote('Ошибка автосохранения ленты: ' + parseApiError(e, 'Неизвестная ошибка'), 'error');
      } finally {
        setAttractionFeedAutoSaving(false);
      }
    }, 2500);

    return () => {
      clearTimeout(attractionFeedAutoSaveTimerRef.current);
    };
  }, [
    sessionId,
    currentAttractionFeedItem,
    attractionFeedLocaleData,
    isCurrentAttractionFeedItemDirty,
    saveCurrentAttractionFeedItem,
    showNote,
  ]);

  // ─── openAttractionFeedItemDetail ──────────────────────────────────────────
  const openAttractionFeedItemDetail = useCallback(
    async (itemId) => {
      const currentId = normalizeId(currentAttractionFeedItem?.id);
      const nextId = normalizeId(itemId);

      if (currentId && nextId && currentId !== nextId) {
        try {
          await saveCurrentAttractionFeedItemIfDirty({ silent: true });
        } catch {
          return;
        }
      }

      const target = attractionFeedItems.find(
        (item) => normalizeId(item.id) === nextId,
      );

      if (!target) return;

      if (attractionFeedLocaleDataItemIdRef.current !== nextId) {
        attractionFeedLocaleDataItemIdRef.current = null;
      }

      setCurrentAttractionFeedItem(target);
    },
    [
      attractionFeedItems,
      currentAttractionFeedItem,
      saveCurrentAttractionFeedItemIfDirty,
    ],
  );

  // ─── deleteCurrentAttractionFeedItem ───────────────────────────────────────
  const deleteCurrentAttractionFeedItem = useCallback(async () => {
    if (!currentAttractionFeedItem) return;

    const name = getAttractionFeedItemName(currentAttractionFeedItem);

    if (!(await confirm({ message: `Удалить «${name}»?`, danger: true }))) {
      return;
    }

    try {
      await attractionFeedAPI.delete(sessionId, currentAttractionFeedItem.id);

      setAttractionFeedItems((items) =>
        items.filter(
          (item) => normalizeId(item.id) !== normalizeId(currentAttractionFeedItem.id)
        )
      );

      setCurrentAttractionFeedItem(null);

      showNote('Элемент ленты удалён', 'success');
    } catch (e) {
      showNote(
        'Ошибка при удалении элемента ленты: ' + parseApiError(e),
        'error'
      );
    }
  }, [
    sessionId,
    currentAttractionFeedItem,
    confirm,
    showNote,
  ]);

  // ─── handleAttractionFeedPhotoFile ─────────────────────────────────────────
  const handleAttractionFeedPhotoFile = useCallback(async (event, itemArg = null) => {
    const file = event.target.files?.[0];

    if (!file || !file.type.startsWith('image/')) return;

    event.target.value = '';

    const targetItem = itemArg || currentAttractionFeedItem;

    if (!targetItem) return;

    setAttractionFeedPhotoUploading(true);

    try {
      const fd = new FormData();

      fd.append('file', file);
      fd.append('session_uuid', getSessionUuid() || '');
      fd.append('temp', '1');

      const copyright =
        targetItem.image_copyright ||
        targetItem.imageCopyright ||
        '';

      if (copyright) {
        fd.append('copyright', copyright);
      }

      const res = await imagesAPI.upload(fd);
      const { id, url, copyright: uploadedCopyright } = res?.data || {};

      if (id && url) {
        const patch = {
          item_type: 'image',

          image_id: id,
          image: id,

          image_url: url,
          imageUrl: url,

          image_original_url: '',
          imageOriginalUrl: '',

          image_copyright:
            uploadedCopyright != null
              ? uploadedCopyright || ''
              : copyright,
          imageCopyright:
            uploadedCopyright != null
              ? uploadedCopyright || ''
              : copyright,

          text: {},
        };

        updateCurrentAttractionFeedItemPatch(patch);

        showNote('Изображение ленты загружено', 'success');
      }
    } catch (err) {
      showNote(
        'Ошибка загрузки изображения ленты: ' + parseApiError(err, 'Ошибка загрузки'),
        'error'
      );
    } finally {
      setAttractionFeedPhotoUploading(false);
    }
  }, [
    getSessionUuid,
    currentAttractionFeedItem,
    updateCurrentAttractionFeedItemPatch,
    showNote,
    imagesAPI,
  ]);

  // ─── openAttractionFeedCommonsModal ────────────────────────────────────────
  const openAttractionFeedCommonsModal = useCallback((item) => {
    setCommonsTarget({
      type: 'attraction_feed',
      id: item?.id ?? null,
    });

    setCommonsModalOpen(true);
  }, [setCommonsTarget, setCommonsModalOpen]);

  return {
    attractionFeedItems,
    setAttractionFeedItems,
    currentAttractionFeedItem,
    setCurrentAttractionFeedItem,
    attractionFeedLocaleData,
    attractionFeedActiveLocale,
    setAttractionFeedActiveLocale,
    attractionFeedSaving,
    attractionFeedAutoSaving,
    attractionFeedAutoSaved,
    attractionFeedPhotoUploading,
    attractionFeedPhotoFileRef,
    attractionFeedSavedSnapshotRef,
    currentAttractionFeedItemIdRef,
    attractionFeedAutoSaveTimerRef,
    attractionFeedAutoSavedTimerRef,
    attractionFeedSavingRef,
    attractionFeedPhotoUploadingRef,
    attractionFeedLocaleDataItemIdRef,
    addAttractionFeedItem,
    addAttractionFeedBlock,
    reorderAttractionFeedItems,
    deleteAttractionFeedItemsByIds,
    openAttractionFeedItemDetail,
    deleteCurrentAttractionFeedItem,
    saveCurrentAttractionFeedItem,
    saveCurrentAttractionFeedItemIfDirty,
    isCurrentAttractionFeedItemDirty,
    updateCurrentAttractionFeedItemPatch,
    updateAttractionFeedLocaleField,
    handleAttractionFeedPhotoFile,
    getAttractionFeedItemName,
    openAttractionFeedCommonsModal,
  };
}
