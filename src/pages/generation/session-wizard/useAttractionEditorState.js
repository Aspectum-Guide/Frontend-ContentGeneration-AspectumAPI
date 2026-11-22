import { useCallback, useEffect, useRef, useState } from 'react';
import { attractionsAPI } from '../../../api/generation';
import { parseApiError } from '../../../utils/apiError';
import { normalizeId, normalizeTagIds } from './sessionWizardShared.jsx';
import {
  buildAttrLocaleDataWithPrevious as buildAttractionLocaleData,
  normalizeDraftId,
  upsertById,
  waitForPersistenceIdle,
} from './useSessionWizardHelpers.js';
import { parseAttractionsTextImport } from './attractionsTextImport';
import useFlushOnLeave from './useFlushOnLeave';
import {
  buildAttractionPayload,
  buildAttractionPersistSnapshot as buildAttrPersistSnapshot,
  collectAttractionLocaleTexts as collectAttrLocaleTexts,
  getAttractionName as getAttrName,
  normalizeAttraction,
} from './attractionCore.js';
import { resolveActiveAttractionCityDraftId as findActiveAttractionCityDraftId } from './attractionLocaleCore.js';

export function useAttractionEditorState({
  sessionId,
  showNote,
  confirm,
  localeData,
  cityDrafts,
  referenceCities,
  activeCityDraftIdRef,
  hasUnsavedChangesRef,
  setSession,
  setCommonsTarget,
  setCommonsModalOpen,
  getSessionUuid,
  imagesAPI,
}) {
  // ─── Attraction main state ─────────────────────────────────────────────────
  const [attractions, setAttractions] = useState([]);
  const [attrView, setAttrView] = useState('list');
  const [currentAttr, setCurrentAttr] = useState(null);
  const [attrLocaleData, setAttrLocaleData] = useState({});
  const [attrActiveLocale, setAttrActiveLocale] = useState('ru-RU');
  const [attrSaving, setAttrSaving] = useState(false);
  const [attrAutoSaving, setAttrAutoSaving] = useState(false);
  const [attrAutoSaved, setAttrAutoSaved] = useState(false);
  const [attractionsLoaded, setAttractionsLoaded] = useState(false);

  const attrLocaleDataAttractionIdRef = useRef(null);
  const attrSavedSnapshotRef = useRef(null);
  const attrSavingRef = useRef(false);
  const attrAutoSavingRef = useRef(false);
  const attrAutoSaveTimerRef = useRef(null);
  const attrAutoSavedTimerRef = useRef(null);

  // ─── Ref syncing effects ───────────────────────────────────────────────────
  useEffect(() => {
    attrSavingRef.current = attrSaving;
  }, [attrSaving]);

  useEffect(() => {
    attrAutoSavingRef.current = attrAutoSaving;
  }, [attrAutoSaving]);

  useEffect(() => {
    return () => {
      clearTimeout(attrAutoSaveTimerRef.current);
      clearTimeout(attrAutoSavedTimerRef.current);
    };
  }, []);

  // ─── buildAttrLocaleData ───────────────────────────────────────────────────
  const buildAttrLocaleData = useCallback((attr = {}, previousData = null) => {
    return buildAttractionLocaleData(attr, previousData, {
      localeData,
      cityDrafts,
      referenceCities,
      activeCityDraftIdRef,
    });
  }, [localeData, cityDrafts, referenceCities, activeCityDraftIdRef]);

  // ─── Attr locale data sync ─────────────────────────────────────────────────
  useEffect(() => {
    if (!currentAttr) return;

    const currentAttrId = normalizeId(currentAttr.id);

    setAttrLocaleData((prev) => {
      const shouldPreserveValues =
        attrLocaleDataAttractionIdRef.current === currentAttrId;

      const next = buildAttrLocaleData(
        currentAttr,
        shouldPreserveValues ? prev : null
      );

      attrLocaleDataAttractionIdRef.current = currentAttrId;

      return next;
    });
  }, [currentAttr, buildAttrLocaleData]);

  useEffect(() => {
    const availableKeys = Object.keys(attrLocaleData || {});

    if (availableKeys.length === 0) return;

    if (!availableKeys.includes(attrActiveLocale)) {
      setAttrActiveLocale(availableKeys[0]);
    }
  }, [attrLocaleData, attrActiveLocale]);

  // ─── openAttrDetail ────────────────────────────────────────────────────────
  const saveCurrentAttrIfDirtyRef = useRef(null);
  const openAttrDetail = useCallback(async (attrId) => {
    const nextAttrId = normalizeId(attrId);
    const currentAttrId = normalizeId(currentAttr?.id);

    if (currentAttrId && currentAttrId !== nextAttrId) {
      try {
        await saveCurrentAttrIfDirtyRef.current?.({ silent: true });
      } catch {
        return;
      }
    }

    try {
      const cachedAttr = attractions.find((item) => String(item.id) === String(attrId));

      const res = await attractionsAPI.get(sessionId, attrId, {
        skipApiGetCache: true,
      });
      const responseAttr = res?.data?.attraction || res?.data || null;

      if (!responseAttr && !cachedAttr) return;

      const mergedAttr = {
        ...(cachedAttr || {}),
        ...(responseAttr || {}),

        image_id:
          responseAttr?.image_id ??
          responseAttr?.image?.id ??
          cachedAttr?.image_id ??
          cachedAttr?.image?.id ??
          null,

        image_url:
          responseAttr?.image_url ??
          responseAttr?.image?.url ??
          responseAttr?.image?.file ??
          cachedAttr?.image_url ??
          cachedAttr?.imagePreview ??
          cachedAttr?.image?.url ??
          cachedAttr?.image?.file ??
          null,

        image_original_url:
          responseAttr?.image_original_url ??
          responseAttr?.imageOriginalUrl ??
          responseAttr?.original_image_url ??
          responseAttr?.originalImageUrl ??
          cachedAttr?.image_original_url ??
          cachedAttr?.imageOriginalUrl ??
          cachedAttr?.original_image_url ??
          cachedAttr?.originalImageUrl ??
          '',

        image_copyright:
          responseAttr?.image_copyright ??
          responseAttr?.imageCopyright ??
          responseAttr?.copyright ??
          responseAttr?.image?.copyright ??
          cachedAttr?.image_copyright ??
          cachedAttr?.imageCopyright ??
          cachedAttr?.copyright ??
          cachedAttr?.image?.copyright ??
          '',

        tags: responseAttr?.tags ?? cachedAttr?.tags ?? [],
      };

      const attr = normalizeAttraction(mergedAttr);

      const openedAttrId = normalizeId(attr.id);
      if (attrLocaleDataAttractionIdRef.current !== openedAttrId) {
        attrLocaleDataAttractionIdRef.current = null;
      }

      setAttractions((items) =>
        items.map((item) => (String(item.id) === String(attr.id) ? attr : item))
      );

      const nextLocaleData = buildAttrLocaleData(attr);
      const nextLocaleKeys = Object.keys(nextLocaleData);

      setCurrentAttr(attr);
      setAttrLocaleData(nextLocaleData);
      setAttrActiveLocale(nextLocaleKeys[0] || 'ru-RU');
      attrSavedSnapshotRef.current = buildAttrPersistSnapshot(attr, nextLocaleData);
      setAttrView('detail');
    } catch (e) {
      showNote('Не удалось открыть достопримечательность: ' + e.message, 'error');
    }
  }, [sessionId, attractions, buildAttrLocaleData, showNote, currentAttr?.id]);

  const resolveActiveAttractionCityDraftId = useCallback(() => {
    return findActiveAttractionCityDraftId(activeCityDraftIdRef.current, cityDrafts);
  }, [activeCityDraftIdRef, cityDrafts]);

  // ─── addAttraction ─────────────────────────────────────────────────────────
  const addAttraction = useCallback(async () => {
    try {
      const nextIndex = attractions.length;

      const activeDraftId = normalizeDraftId(activeCityDraftIdRef.current);
      const shouldAttachToDraft =
        activeDraftId && activeDraftId !== 'legacy';

      const res = await attractionsAPI.create(sessionId, {
        name: {},
        description: {},

        lat: null,
        lon: null,

        index: nextIndex,
        rank: 0,

        assigned_city_type: shouldAttachToDraft ? 'draft' : 'none',

        city: null,
        city_id: null,

        session_city: shouldAttachToDraft ? activeDraftId : null,
        session_city_id: shouldAttachToDraft ? activeDraftId : null,

        image_id: null,

        order: nextIndex,
      });

      const rawAttr = res?.data?.attraction || res?.data;

      const attr = normalizeAttraction(rawAttr || {});

      if (attr?.id) {
        const nextAttrId = normalizeId(attr.id);
        if (attrLocaleDataAttractionIdRef.current !== nextAttrId) {
          attrLocaleDataAttractionIdRef.current = null;
        }

        const nextLocaleData = buildAttrLocaleData(attr);
        const nextLocaleKeys = Object.keys(nextLocaleData);

        setAttractions((prev) => [...prev, attr]);
        setCurrentAttr(attr);
        setAttrLocaleData(nextLocaleData);
        setAttrActiveLocale(nextLocaleKeys[0] || 'ru-RU');
        attrSavedSnapshotRef.current = buildAttrPersistSnapshot(attr, nextLocaleData);
        setAttrView('detail');

        if (setSession) {
          setSession((prev) =>
            prev
              ? { ...prev, attractions: upsertById(prev.attractions || [], attr) }
              : prev,
          );
        }

        showNote(
          shouldAttachToDraft
            ? 'Достопримечательность добавлена и привязана к текущему городу'
            : 'Достопримечательность добавлена',
          'success'
        );
      }
    } catch (e) {
      showNote('Ошибка при добавлении: ' + parseApiError(e, e.message), 'error');
    }
  }, [
    sessionId,
    attractions.length,
    buildAttrLocaleData,
    showNote,
    activeCityDraftIdRef,
    setSession,
  ]);

  const importAttractionsFromText = useCallback(async (langRaw = 'ru', rawText = '') => {
    const lang = String(langRaw || 'ru').split('-')[0].trim().toLowerCase() || 'ru';
    const parsed = parseAttractionsTextImport(rawText);

    if (parsed.length === 0) {
      showNote('Не удалось распознать достопримечательности. Каждый объект должен начинаться с «# Название».', 'error');
      return 0;
    }

    const activeDraftId = resolveActiveAttractionCityDraftId();
    if (!activeDraftId) {
      showNote(
        'Сначала откройте или сохраните город сессии: импорт достопримечательностей должен быть привязан к городу.',
        'error',
      );
      return 0;
    }

    const created = [];

    try {
      for (const item of parsed) {
        const index = Number.isFinite(Number(item.index)) ? Number(item.index) : 1;
        const rank = Number.isFinite(Number(item.rank)) ? Number(item.rank) : 5;
        const name = { [lang]: item.name };
        const description = { [lang]: item.description || '' };
        const contents = { [lang]: item.description || '' };

        const res = await attractionsAPI.create(sessionId, {
          name,
          description,
          lat: item.lat,
          lon: item.lon,
          index,
          rank,
          assigned_city_type: 'draft',
          city: null,
          city_id: null,
          session_city: activeDraftId,
          session_city_id: activeDraftId,
          image_id: null,
          order: index,
        });

        const rawAttr = res?.data?.attraction || res?.data;
        const createdId = normalizeId(rawAttr?.id);

        if (createdId) {
          await attractionsAPI.saveContent(sessionId, createdId, {
            language: lang,
            text: item.description || '',
          });
        }

        const attr = normalizeAttraction({
          ...(rawAttr || {}),
          name: rawAttr?.name ?? name,
          description: rawAttr?.description ?? description,
          contents: {
            ...(rawAttr?.contents || {}),
            ...contents,
          },
          assigned_city_type: rawAttr?.assigned_city_type ?? 'draft',
          session_city: rawAttr?.session_city ?? activeDraftId,
          session_city_id: rawAttr?.session_city_id ?? activeDraftId,
          index: rawAttr?.index ?? index,
          order: rawAttr?.order ?? index,
          rank: rawAttr?.rank ?? rank,
          lat: rawAttr?.lat ?? item.lat,
          lon: rawAttr?.lon ?? item.lon,
        });

        if (attr?.id) {
          created.push(attr);
        }
      }

      if (created.length > 0) {
        setAttractions((prev) => {
          let next = prev;
          created.forEach((attr) => {
            next = upsertById(next, attr);
          });
          return next;
        });

        if (setSession) {
          setSession((prev) => {
            if (!prev) return prev;
            let nextAttractions = prev.attractions || [];
            created.forEach((attr) => {
              nextAttractions = upsertById(nextAttractions, attr);
            });
            return { ...prev, attractions: nextAttractions };
          });
        }
      }

      showNote(`Создано достопримечательностей: ${created.length}`, 'success');
      return created.length;
    } catch (e) {
      showNote(
        'Ошибка при импорте достопримечательностей: ' + parseApiError(e, 'Ошибка создания'),
        'error',
      );
      throw e;
    }
  }, [
    sessionId,
    resolveActiveAttractionCityDraftId,
    showNote,
    setSession,
  ]);

  // ─── deleteCurrentAttr ─────────────────────────────────────────────────────
  const deleteCurrentAttr = useCallback(async () => {
    if (!currentAttr) return;
    const name = getAttrName(currentAttr);
    if (!(await confirm({ message: `Удалить «${name}»?`, danger: true }))) return;
    try {
      await attractionsAPI.delete(sessionId, currentAttr.id);
      const deletedId = normalizeId(currentAttr.id);
      setAttractions(prev => prev.filter((item) => normalizeId(item.id) !== deletedId));
      setAttrView('list');
      setCurrentAttr(null);
      if (setSession) {
        setSession((prev) =>
          prev
            ? {
                ...prev,
                attractions: (prev.attractions || []).filter(
                  (item) => normalizeId(item.id) !== deletedId,
                ),
              }
            : prev,
        );
      }
      showNote('Удалено', 'success');
    } catch (e) {
      showNote('Ошибка при удалении: ' + e.message, 'error');
    }
  }, [sessionId, currentAttr, showNote, confirm, setSession]);

  const deleteAttractionsByIds = useCallback(async (ids = []) => {
    const targetIds = Array.from(
      new Set((ids || []).map((id) => normalizeId(id)).filter(Boolean)),
    );

    if (targetIds.length === 0) return { deleted: 0, failed: 0 };

    if (
      !(await confirm({
        message: `Удалить выбранные достопримечательности (${targetIds.length})?`,
        danger: true,
      }))
    ) {
      return { deleted: 0, failed: 0, cancelled: true };
    }

    const results = await Promise.allSettled(
      targetIds.map((id) => attractionsAPI.delete(sessionId, id)),
    );

    const deletedIds = new Set();
    let failed = 0;

    results.forEach((res, idx) => {
      if (res.status === 'fulfilled') {
        deletedIds.add(targetIds[idx]);
      } else {
        failed += 1;
      }
    });

    if (deletedIds.size > 0) {
      setAttractions((items) =>
        items.filter((item) => !deletedIds.has(normalizeId(item.id))),
      );
      setCurrentAttr((prev) =>
        prev && deletedIds.has(normalizeId(prev.id)) ? null : prev,
      );
      setAttrView((prev) =>
        currentAttr && deletedIds.has(normalizeId(currentAttr.id)) ? 'list' : prev,
      );

      if (setSession) {
        setSession((prev) =>
          prev
            ? {
                ...prev,
                attractions: (prev.attractions || []).filter(
                  (item) => !deletedIds.has(normalizeId(item.id)),
                ),
              }
            : prev,
        );
      }
    }

    if (failed === 0) {
      showNote(`Удалено достопримечательностей: ${deletedIds.size}`, 'success');
    } else if (deletedIds.size > 0) {
      showNote(`Удалено: ${deletedIds.size}, не удалось: ${failed}`, 'warning');
    } else {
      showNote('Не удалось удалить выбранные достопримечательности', 'error');
    }

    return { deleted: deletedIds.size, failed };
  }, [sessionId, confirm, showNote, setSession, currentAttr]);

  // ─── isCurrentAttrDirty ────────────────────────────────────────────────────
  const isCurrentAttrDirty = useCallback(() => {
    if (!currentAttr?.id) return false;

    const snap = buildAttrPersistSnapshot(currentAttr, attrLocaleData);

    return snap !== attrSavedSnapshotRef.current;
  }, [currentAttr, attrLocaleData]);

  // ─── saveCurrentAttr ───────────────────────────────────────────────────────
  const saveCurrentAttr = useCallback(
    async ({ silent = false } = {}) => {
      if (!currentAttr?.id) return null;

      setAttrSaving(true);

      try {
        const { name, description } = collectAttrLocaleTexts(attrLocaleData);
        const updated = await attractionsAPI.update(
          sessionId,
          currentAttr.id,
          buildAttractionPayload(currentAttr, name, description),
        );

        const responseAttr = updated?.data?.attraction || updated?.data || {};

        const updatedAttr = normalizeAttraction({
          ...currentAttr,
          ...responseAttr,

          assigned_city_type:
            responseAttr.assigned_city_type ?? currentAttr.assigned_city_type,
          city_id: responseAttr.city_id ?? responseAttr.city ?? currentAttr.city_id,
          city: responseAttr.city_id ?? responseAttr.city ?? currentAttr.city,
          session_city_id:
            responseAttr.session_city_id ??
            responseAttr.session_city ??
            currentAttr.session_city_id,
          session_city:
            responseAttr.session_city_id ??
            responseAttr.session_city ??
            currentAttr.session_city,

          name: responseAttr.name ?? name,
          description: responseAttr.description ?? description,

          image_id:
            responseAttr.image_id ??
            responseAttr.image?.id ??
            currentAttr.image_id ??
            null,

          image_url:
            responseAttr.image_url ??
            responseAttr.image?.url ??
            responseAttr.image?.file ??
            currentAttr.image_url ??
            currentAttr.imagePreview ??
            null,

          image_original_url:
            responseAttr.image_original_url ??
            responseAttr.imageOriginalUrl ??
            currentAttr.image_original_url ??
            currentAttr.imageOriginalUrl ??
            '',

          image_copyright:
            responseAttr.image_copyright ??
            responseAttr.imageCopyright ??
            currentAttr.image_copyright ??
            currentAttr.imageCopyright ??
            '',

          tags: normalizeTagIds(responseAttr.tags ?? currentAttr.tags ?? []),
        });

        setAttractions((prev) => upsertById(prev, updatedAttr));

        setCurrentAttr(updatedAttr);

        if (setSession) {
          setSession((prev) =>
            prev
              ? {
                  ...prev,
                  attractions: upsertById(prev.attractions || [], updatedAttr),
                }
              : prev,
          );
        }

        // Единое поле описания (Variant B): текст достопримечательности
        // хранится в description (его показывает приложение и заполняет ИИ)
        // и сохраняется выше через update_attraction. Осиротевший
        // AttractionContent («Текст») из формы больше не пишем.

        attrSavedSnapshotRef.current = buildAttrPersistSnapshot(
          updatedAttr,
          attrLocaleData,
        );

        if (!silent) {
          showNote('Достопримечательность сохранена', 'success');
        }

        return updatedAttr;
      } catch (e) {
        if (!silent) {
          showNote(
            'Ошибка при сохранении: ' + parseApiError(e, e.message),
            'error',
          );
        }
        throw e;
      } finally {
        setAttrSaving(false);
      }
    },
    [sessionId, currentAttr, attrLocaleData, showNote, setSession],
  );

  // ─── saveCurrentAttrIfDirty ────────────────────────────────────────────────
  const saveCurrentAttrIfDirty = useCallback(
    async (options = {}) => {
      clearTimeout(attrAutoSaveTimerRef.current);
      await waitForPersistenceIdle(
        () => attrSavingRef.current || attrAutoSavingRef.current,
      );

      if (!currentAttr?.id || !isCurrentAttrDirty()) {
        return true;
      }

      await saveCurrentAttr(options);
      return true;
    },
    [currentAttr, isCurrentAttrDirty, saveCurrentAttr],
  );
  saveCurrentAttrIfDirtyRef.current = saveCurrentAttrIfDirty;
  // Уход со страницы отменяет debounce-таймер — правки дожимаются немедленно.
  useFlushOnLeave(() => saveCurrentAttrIfDirty({ silent: true }));

  // ─── Auto-save for attraction ──────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(attrAutoSaveTimerRef.current);

    if (!sessionId || !currentAttr?.id) return;
    if (attrView !== 'detail') return;

    if (!isCurrentAttrDirty()) return;

    hasUnsavedChangesRef.current = true;
    attrAutoSaveTimerRef.current = setTimeout(async () => {
      if (attrSavingRef.current) return;

      setAttrAutoSaving(true);
      setAttrAutoSaved(false);

      try {
        await saveCurrentAttr({ silent: true });

        setAttrAutoSaved(true);
        hasUnsavedChangesRef.current = false;

        clearTimeout(attrAutoSavedTimerRef.current);
        attrAutoSavedTimerRef.current = setTimeout(() => {
          setAttrAutoSaved(false);
        }, 2500);
      } catch (e) {
        showNote('Ошибка автосохранения достопримечательности: ' + parseApiError(e, 'Неизвестная ошибка'), 'error');
      } finally {
        setAttrAutoSaving(false);
      }
    }, 2500);

    return () => {
      clearTimeout(attrAutoSaveTimerRef.current);
    };
  }, [
    sessionId,
    currentAttr,
    attrLocaleData,
    attrView,
    isCurrentAttrDirty,
    saveCurrentAttr,
    showNote,
    hasUnsavedChangesRef,
  ]);

  // ─── updateAttrLocaleField ─────────────────────────────────────────────────
  const updateAttrLocaleField = useCallback((field, value) => {
    setAttrLocaleData(prev => ({
      ...prev,
      [attrActiveLocale]: { ...prev[attrActiveLocale], [field]: value },
    }));
  }, [attrActiveLocale]);

  // ─── updateCurrentAttrPatch ────────────────────────────────────────────────
  const updateCurrentAttrPatch = useCallback((patch) => {
    setCurrentAttr((prev) => {
      if (!prev) return prev;

      const next = normalizeAttraction({
        ...prev,
        ...patch,
      });

      setAttractions((items) =>
        items.map((item) => (item.id === next.id ? next : item))
      );

      return next;
    });
  }, []);

  // ─── persistAttractionImage ────────────────────────────────────────────────
  const persistAttractionImage = useCallback(
    async (patch, { silent = true } = {}) => {
      if (!currentAttr?.id) return null;

      const merged = normalizeAttraction({ ...currentAttr, ...patch });

      setAttractions((prev) =>
        prev.map((item) => (item.id === merged.id ? merged : item)),
      );
      setCurrentAttr(merged);

      setAttrSaving(true);

      try {
        const { name, description } = collectAttrLocaleTexts(attrLocaleData);
        const updated = await attractionsAPI.update(
          sessionId,
          merged.id,
          buildAttractionPayload(merged, name, description),
        );
        const responseAttr = updated?.data?.attraction || updated?.data || {};
        const updatedAttr = normalizeAttraction({
          ...merged,
          ...responseAttr,
          assigned_city_type:
            responseAttr.assigned_city_type ?? merged.assigned_city_type,
          city_id: responseAttr.city_id ?? responseAttr.city ?? merged.city_id,
          city: responseAttr.city_id ?? responseAttr.city ?? merged.city,
          session_city_id:
            responseAttr.session_city_id ??
            responseAttr.session_city ??
            merged.session_city_id,
          session_city:
            responseAttr.session_city_id ??
            responseAttr.session_city ??
            merged.session_city,
          name: responseAttr.name ?? name,
          description: responseAttr.description ?? description,
          image_id:
            responseAttr.image_id ??
            responseAttr.image?.id ??
            merged.image_id ??
            null,
          image_url:
            responseAttr.image_url ??
            responseAttr.image?.url ??
            merged.image_url ??
            merged.imagePreview ??
            null,
          image_original_url:
            responseAttr.image_original_url ??
            responseAttr.imageOriginalUrl ??
            merged.image_original_url ??
            merged.imageOriginalUrl ??
            '',
          image_copyright:
            responseAttr.image_copyright ??
            responseAttr.imageCopyright ??
            merged.image_copyright ??
            merged.imageCopyright ??
            '',
          tags: normalizeTagIds(responseAttr.tags ?? merged.tags ?? []),
        });

        setAttractions((prev) =>
          prev.map((item) => (item.id === merged.id ? updatedAttr : item)),
        );
        setCurrentAttr(updatedAttr);

        await Promise.all(
          Object.values(attrLocaleData).map((d) =>
            attractionsAPI.saveContent(sessionId, merged.id, {
              language: d.lang,
              text: d.contentText || '',
            }),
          ),
        );

        attrSavedSnapshotRef.current = buildAttrPersistSnapshot(
          updatedAttr,
          attrLocaleData,
        );

        if (!silent) {
          showNote('Изображение достопримечательности сохранено', 'success');
        }

        return updatedAttr;
      } catch (e) {
        showNote(
          'Ошибка при сохранении изображения: ' + parseApiError(e, e.message),
          'error',
        );
        throw e;
      } finally {
        setAttrSaving(false);
      }
    },
    [sessionId, currentAttr, attrLocaleData, showNote],
  );

  // ─── toggleCurrentAttractionTag ────────────────────────────────────────────
  const toggleCurrentAttractionTag = useCallback((tagId) => {
    const id = normalizeId(tagId);

    if (!id) return;

    setCurrentAttr((prev) => {
      if (!prev) return prev;

      const current = normalizeTagIds(prev.tags);
      const nextTags = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];

      const updated = normalizeAttraction({
        ...prev,
        tags: nextTags,
      });

      setAttractions((items) =>
        items.map((item) =>
          normalizeId(item.id) === normalizeId(updated.id)
            ? updated
            : item
        )
      );

      return updated;
    });
  }, []);

  // ─── addCurrentAttractionRelatedEvent / removeCurrentAttractionRelatedEvent ──
  const addCurrentAttractionRelatedEvent = useCallback((row) => {
    const id = normalizeId(row?.id);

    if (!id) return;

    setCurrentAttr((prev) => {
      if (!prev) return prev;

      const currentIds = normalizeTagIds(prev.related_event_ids);
      if (currentIds.includes(id)) return prev;

      const updated = normalizeAttraction({
        ...prev,
        related_event_ids: [...currentIds, id],
        related_events: [
          ...(prev.related_events || []),
          { id, title: row.title ?? row.name ?? {}, kind: row.kind ?? 'session' },
        ],
      });

      setAttractions((items) =>
        items.map((item) =>
          normalizeId(item.id) === normalizeId(updated.id) ? updated : item
        )
      );

      return updated;
    });
  }, []);

  const removeCurrentAttractionRelatedEvent = useCallback((eventId) => {
    const id = normalizeId(eventId);

    if (!id) return;

    setCurrentAttr((prev) => {
      if (!prev) return prev;

      const updated = normalizeAttraction({
        ...prev,
        related_event_ids: normalizeTagIds(prev.related_event_ids).filter(
          (item) => item !== id,
        ),
        related_events: (prev.related_events || []).filter(
          (item) => normalizeId(item.id) !== id,
        ),
      });

      setAttractions((items) =>
        items.map((item) =>
          normalizeId(item.id) === normalizeId(updated.id) ? updated : item
        )
      );

      return updated;
    });
  }, []);

  // ─── openAttractionCommonsModal ────────────────────────────────────────────
  const openAttractionCommonsModal = useCallback((attr) => {
    setCommonsTarget({
      type: 'attraction',
      id: attr?.id ?? null,
    });

    setCommonsModalOpen(true);
  }, [setCommonsTarget, setCommonsModalOpen]);

  // ─── handleAttractionPhotoFile ─────────────────────────────────────────────
  // Загрузка главного фото достопримечательности из файла (кнопка «+ Добавить фото»
  // и вставка из буфера по Ctrl+V при наведении на рамку).
  const handleAttractionPhotoFile = useCallback(async (event, attrArg = null) => {
    const file = event.target.files?.[0];

    if (!file || !file.type.startsWith('image/')) return;

    event.target.value = '';

    const targetAttr = attrArg || currentAttr;

    if (!targetAttr?.id) return;

    try {
      const fd = new FormData();

      fd.append('file', file);
      fd.append('session_uuid', getSessionUuid() || '');
      fd.append('temp', '1');

      const existingCopyright =
        targetAttr.image_copyright || targetAttr.imageCopyright || '';

      if (existingCopyright) {
        fd.append('copyright', existingCopyright);
      }

      const res = await imagesAPI.upload(fd);
      const { id, url, copyright: uploadedCopyright } = res?.data || {};

      if (id && url) {
        const copyright =
          uploadedCopyright != null ? uploadedCopyright || '' : existingCopyright;

        await persistAttractionImage(
          {
            image_id: id,
            image: id,

            image_url: url,
            imageUrl: url,
            imagePreview: url,

            image_original_url: '',
            imageOriginalUrl: '',

            image_copyright: copyright,
            imageCopyright: copyright,
          },
          { silent: false },
        );
      }
    } catch (err) {
      showNote(
        'Ошибка загрузки изображения: ' + parseApiError(err, 'Ошибка загрузки'),
        'error',
      );
    }
  }, [getSessionUuid, currentAttr, persistAttractionImage, showNote, imagesAPI]);

  return {
    attractions, setAttractions,
    currentAttr, setCurrentAttr,
    attrView, setAttrView,
    attrLocaleData,
    attrActiveLocale, setAttrActiveLocale,
    attrSaving,
    attrAutoSaving,
    attrAutoSaved,
    attractionsLoaded, setAttractionsLoaded,
    attrLocaleDataAttractionIdRef,
    attrSavedSnapshotRef,
    attrSavingRef,
    attrAutoSavingRef,
    attrAutoSaveTimerRef,
    attrAutoSavedTimerRef,
    buildAttrLocaleData,
    openAttrDetail,
    addAttraction,
    importAttractionsFromText,
    deleteCurrentAttr,
    deleteAttractionsByIds,
    saveCurrentAttr,
    saveCurrentAttrIfDirty,
    isCurrentAttrDirty,
    updateAttrLocaleField,
    updateCurrentAttrPatch,
    persistAttractionImage,
    handleAttractionPhotoFile,
    toggleCurrentAttractionTag,
    addCurrentAttractionRelatedEvent,
    removeCurrentAttractionRelatedEvent,
    openAttractionCommonsModal,
  };
}
