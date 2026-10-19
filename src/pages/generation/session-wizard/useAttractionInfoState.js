import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { attractionInfosAPI } from '../../../api/generation';
import { parseApiError } from '../../../utils/apiError';
import { normalizeId, isPersistedSessionAttractionId } from './sessionWizardShared.jsx';
import { parseUsefulInfoTextImport } from './usefulInfoTextImport';
import useFlushOnLeave from './useFlushOnLeave';
import {
  normalizeAttractionInfo,
  buildAttractionInfoPayload,
  createEmptyAttractionInfo,
  collectAttractionInfoLocaleTexts,
  buildAttractionInfoPersistSnapshot,
} from './attractionInfoCore.js';
import {
  buildAttractionInfoLocaleData,
  getAttractionInfoName,
  getAttractionLocaleLang as getLocaleLang,
} from './attractionLocaleCore.js';

export function useAttractionInfoState({
  sessionId,
  currentAttr,
  attrLocaleData,
  attrActiveLocale,
  attractions,
  referenceAttractions,
  showNote,
  confirm,
  setSession,
  saveCurrentAttrIfDirty,
}) {
  const [attractionInfos, setAttractionInfos] = useState([]);
  const [currentAttractionInfo, setCurrentAttractionInfo] = useState(null);
  const [attractionInfoActiveLocale, setAttractionInfoActiveLocale] = useState('ru-RU');
  const [attractionInfoSaving, setAttractionInfoSaving] = useState(false);
  const attractionInfoSavedSnapshotRef = useRef(null);
  const currentAttractionInfoIdRef = useRef(null);
  const attractionInfoSavingRef = useRef(false);

  // ─── attractionInfoLocaleData computed ──────────────────────────────────────
  const attractionInfoLocaleData = useMemo(() => {
    return buildAttractionInfoLocaleData({
      info: currentAttractionInfo,
      currentAttraction: currentAttr,
      attractionLocaleData: attrLocaleData,
      attractions,
      referenceAttractions,
    });
  }, [
    currentAttractionInfo,
    currentAttr,
    attrLocaleData,
    attractions,
    referenceAttractions,
  ]);

  useEffect(() => {
    if (!currentAttractionInfo) return;

    const availableKeys = Object.keys(attractionInfoLocaleData || {});

    if (availableKeys.length === 0) return;

    if (!availableKeys.includes(attractionInfoActiveLocale)) {
      setAttractionInfoActiveLocale(availableKeys[0]);
    }
  }, [
    currentAttractionInfo,
    attractionInfoLocaleData,
    attractionInfoActiveLocale,
  ]);

  useEffect(() => {
    const id = normalizeId(currentAttractionInfo?.id);

    if (!id) {
      currentAttractionInfoIdRef.current = null;
      attractionInfoSavedSnapshotRef.current = null;
      return;
    }

    if (currentAttractionInfoIdRef.current !== id) {
      currentAttractionInfoIdRef.current = id;
      attractionInfoSavedSnapshotRef.current = buildAttractionInfoPersistSnapshot(
        currentAttractionInfo,
        attractionInfoLocaleData,
      );
    }
  }, [currentAttractionInfo, attractionInfoLocaleData]);

  // ─── addAttractionInfo ─────────────────────────────────────────────────────
  const addAttractionInfo = useCallback(async () => {
    try {
      const activeAttractionId = normalizeId(currentAttr?.id);

      const emptyInfo = createEmptyAttractionInfo({
        activeAttractionId,
        sourceLocaleData: attrLocaleData,
      });

      const res = await attractionInfosAPI.create(
        sessionId,
        buildAttractionInfoPayload(emptyInfo)
      );

      const rawInfo = res?.data?.attraction_info || res?.data;
      const info = rawInfo?.id != null ? normalizeAttractionInfo(rawInfo) : null;

      if (info?.id) {
        const localeKeys = Object.keys(attrLocaleData || {});
        const nextActiveLocale =
          localeKeys.includes(attrActiveLocale)
            ? attrActiveLocale
            : localeKeys[0] || 'ru-RU';

        setAttractionInfos((prev) => [...prev, info]);
        setCurrentAttractionInfo(info);
        setAttractionInfoActiveLocale(nextActiveLocale);

        showNote(
          activeAttractionId
            ? 'Блок полезной информации добавлен и привязан к текущей достопримечательности'
            : 'Блок полезной информации о достопримечательности добавлен',
          'success'
        );
      }
    } catch (e) {
      showNote(
        'Ошибка при добавлении полезной информации: ' + parseApiError(e),
        'error'
      );
    }
  }, [
    sessionId,
    currentAttr,
    attrLocaleData,
    attrActiveLocale,
    showNote,
  ]);

  const importAttractionInfoFromText = useCallback(async (langRaw = 'ru', rawText = '') => {
    const lang = String(langRaw || 'ru').split('-')[0].trim().toLowerCase() || 'ru';
    const parsed = parseUsefulInfoTextImport(rawText);

    if (parsed.length === 0) {
      showNote('Не удалось распознать блоки. Заголовки должны начинаться с «#».', 'error');
      return 0;
    }

    let activeAttractionId = normalizeId(currentAttr?.id);
    if (!currentAttr || !activeAttractionId || !isPersistedSessionAttractionId(activeAttractionId)) {
      showNote(
        'Откройте сохранённую достопримечательность перед импортом полезной информации.',
        'error',
      );
      return 0;
    }

    await saveCurrentAttrIfDirty({ silent: true });
    activeAttractionId = normalizeId(currentAttr.id);

    const created = [];

    try {
      for (const item of parsed) {
        const emptyInfo = createEmptyAttractionInfo({
          activeAttractionId,
          sourceLocaleData: attrLocaleData,
        });

        const name = {
          ...(emptyInfo.name || {}),
          [lang]: item.title,
        };
        const description = {
          ...(emptyInfo.description || {}),
          [lang]: item.text,
        };

        const res = await attractionInfosAPI.create(
          sessionId,
          buildAttractionInfoPayload(
            {
              ...emptyInfo,
              name,
              description,
            },
            name,
            description,
          ),
        );

        const rawInfo = res?.data?.attraction_info || res?.data;
        const info = rawInfo?.id != null ? normalizeAttractionInfo(rawInfo) : null;
        if (info?.id) {
          created.push(info);
        }
      }

      if (created.length > 0) {
        setAttractionInfos((prev) => {
          const existingIds = new Set(prev.map((item) => String(item.id)));
          const toAdd = created.filter((item) => item.id && !existingIds.has(String(item.id)));
          return [...prev, ...toAdd];
        });

        if (setSession) {
          setSession((prev) => {
            if (!prev) return prev;
            const existing = Array.isArray(prev.attraction_infos) ? prev.attraction_infos : [];
            const existingIds = new Set(existing.map((item) => String(item.id)));
            const toAdd = created.filter((item) => item.id && !existingIds.has(String(item.id)));
            return { ...prev, attraction_infos: [...existing, ...toAdd] };
          });
        }
      }

      showNote(`Создано блоков полезной информации: ${created.length}`, 'success');
      return created.length;
    } catch (e) {
      showNote(
        'Ошибка при создании полезной информации: ' + parseApiError(e, 'Ошибка создания'),
        'error',
      );
      throw e;
    }
  }, [
    sessionId,
    currentAttr,
    attrLocaleData,
    saveCurrentAttrIfDirty,
    showNote,
    setSession,
  ]);

  // ─── openAttractionInfoDetail ──────────────────────────────────────────────
  const openAttractionInfoDetail = useCallback((infoId) => {
    const target = attractionInfos.find(
      (info) => normalizeId(info.id) === normalizeId(infoId)
    );

    if (!target) return;

    setCurrentAttractionInfo(target);
    setAttractionInfoActiveLocale('ru-RU');
  }, [attractionInfos]);

  // ─── updateCurrentAttractionInfoPatch ──────────────────────────────────────
  const updateCurrentAttractionInfoPatch = useCallback((patch) => {
    setCurrentAttractionInfo((prev) => {
      if (!prev) return prev;

      const updated = normalizeAttractionInfo({
        ...prev,
        ...patch,
      });

      setAttractionInfos((items) =>
        items.map((item) =>
          normalizeId(item.id) === normalizeId(updated.id) ? updated : item
        )
      );

      return updated;
    });
  }, []);

  // ─── updateAttractionInfoLocaleField ───────────────────────────────────────
  const updateAttractionInfoLocaleField = useCallback((field, value) => {
    const lang =
      attractionInfoLocaleData?.[attractionInfoActiveLocale]?.lang ||
      getLocaleLang(attractionInfoActiveLocale);

    setCurrentAttractionInfo((prev) => {
      if (!prev) return prev;

      const updated = {
        ...prev,
        [field]: {
          ...(prev[field] || {}),
          [lang]: value,
        },
      };

      setAttractionInfos((items) =>
        items.map((item) =>
          normalizeId(item.id) === normalizeId(updated.id) ? updated : item
        )
      );

      return updated;
    });
  }, [
    attractionInfoActiveLocale,
    attractionInfoLocaleData,
  ]);

  // ─── saveCurrentAttractionInfo ─────────────────────────────────────────────
  const saveCurrentAttractionInfo = useCallback(async ({ silent = false } = {}) => {
    if (!currentAttractionInfo) return null;

    const assignedType = currentAttractionInfo.assigned_attraction_type ?? 'none';

    const eventId =
      currentAttractionInfo.event_id ??
      currentAttractionInfo.event ??
      currentAttractionInfo.attraction_id ??
      currentAttractionInfo.attraction ??
      null;

    const sessionAttractionId =
      currentAttractionInfo.session_attraction_id ??
      currentAttractionInfo.session_attraction ??
      null;

    if (assignedType === 'database' && !eventId) {
      const message = 'Выберите достопримечательность из базы';
      if (!silent) {
        showNote(message, 'error');
      }
      throw new Error(message);
    }

    if (assignedType === 'draft' && !sessionAttractionId) {
      const message = 'Выберите достопримечательность из сессии';
      if (!silent) {
        showNote(message, 'error');
      }
      throw new Error(message);
    }

    attractionInfoSavingRef.current = true;
    setAttractionInfoSaving(true);

    try {
      const { name, description } = collectAttractionInfoLocaleTexts(attractionInfoLocaleData);

      const res = await attractionInfosAPI.update(
        sessionId,
        currentAttractionInfo.id,
        buildAttractionInfoPayload(currentAttractionInfo, name, description)
      );

      const responseInfo = res?.data?.attraction_info || res?.data || {};

      const updatedInfo = normalizeAttractionInfo({
        ...currentAttractionInfo,
        ...responseInfo,

        name: responseInfo.name ?? name,
        description: responseInfo.description ?? description,
      });

      setAttractionInfos((prev) =>
        prev.map((item) =>
          normalizeId(item.id) === normalizeId(currentAttractionInfo.id)
            ? updatedInfo
            : item
        )
      );

      setCurrentAttractionInfo(updatedInfo);

      attractionInfoSavedSnapshotRef.current = buildAttractionInfoPersistSnapshot(
        updatedInfo,
        attractionInfoLocaleData,
      );

      if (!silent) {
        showNote('Полезная информация о достопримечательности сохранена', 'success');
      }

      return updatedInfo;
    } catch (e) {
      if (!silent) {
        showNote(
          'Ошибка при сохранении полезной информации: ' + parseApiError(e),
          'error'
        );
      }
      throw e;
    } finally {
      attractionInfoSavingRef.current = false;
      setAttractionInfoSaving(false);
    }
  }, [
    sessionId,
    currentAttractionInfo,
    attractionInfoLocaleData,
    showNote,
  ]);

  const isCurrentAttractionInfoDirty = useCallback(() => {
    if (!currentAttractionInfo?.id) return false;

    const snap = buildAttractionInfoPersistSnapshot(
      currentAttractionInfo,
      attractionInfoLocaleData,
    );

    return snap !== attractionInfoSavedSnapshotRef.current;
  }, [currentAttractionInfo, attractionInfoLocaleData]);

  const saveCurrentAttractionInfoIfDirty = useCallback(
    async (options = {}) => {
      if (!currentAttractionInfo?.id || !isCurrentAttractionInfoDirty()) {
        return true;
      }

      await saveCurrentAttractionInfo(options);
      return true;
    },
    [currentAttractionInfo, isCurrentAttractionInfoDirty, saveCurrentAttractionInfo],
  );
  useFlushOnLeave(() => saveCurrentAttractionInfoIfDirty({ silent: true }));

  // ─── deleteCurrentAttractionInfo ───────────────────────────────────────────
  const deleteCurrentAttractionInfo = useCallback(async () => {
    if (!currentAttractionInfo) return;

    const name = getAttractionInfoName(currentAttractionInfo);

    if (!(await confirm({ message: `Удалить «${name}»?`, danger: true }))) {
      return;
    }

    try {
      await attractionInfosAPI.delete(sessionId, currentAttractionInfo.id);

      setAttractionInfos((items) =>
        items.filter(
          (item) => normalizeId(item.id) !== normalizeId(currentAttractionInfo.id)
        )
      );

      setCurrentAttractionInfo(null);

      showNote('Полезная информация удалена', 'success');
    } catch (e) {
      showNote(
        'Ошибка при удалении полезной информации: ' + parseApiError(e),
        'error'
      );
    }
  }, [
    sessionId,
    currentAttractionInfo,
    confirm,
    showNote,
  ]);

  // ─── deleteAttractionInfosByIds (пакетное удаление) ────────────────────────
  const deleteAttractionInfosByIds = useCallback(
    async (ids = []) => {
      const targetIds = Array.from(
        new Set((ids || []).map((id) => normalizeId(id)).filter(Boolean)),
      );

      if (targetIds.length === 0) return { deleted: 0, failed: 0 };

      if (
        !(await confirm({
          message: `Удалить выбранную полезную информацию (${targetIds.length})?`,
          danger: true,
        }))
      ) {
        return { deleted: 0, failed: 0, cancelled: true };
      }

      const results = await Promise.allSettled(
        targetIds.map((id) => attractionInfosAPI.delete(sessionId, id)),
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
        setAttractionInfos((items) =>
          items.filter((item) => !deletedIds.has(normalizeId(item.id))),
        );
        setCurrentAttractionInfo((prev) =>
          prev && deletedIds.has(normalizeId(prev.id)) ? null : prev,
        );
      }

      if (failed === 0) {
        showNote(`Удалено блоков: ${deletedIds.size}`, 'success');
      } else if (deletedIds.size > 0) {
        showNote(
          `Удалено: ${deletedIds.size}, не удалось: ${failed}`,
          'warning',
        );
      } else {
        showNote('Не удалось удалить выбранные блоки', 'error');
      }

      return { deleted: deletedIds.size, failed };
    },
    [sessionId, confirm, showNote],
  );

  return {
    attractionInfos,
    setAttractionInfos,
    currentAttractionInfo,
    setCurrentAttractionInfo,
    attractionInfoLocaleData,
    attractionInfoActiveLocale,
    setAttractionInfoActiveLocale,
    attractionInfoSaving,
    addAttractionInfo,
    importAttractionInfoFromText,
    openAttractionInfoDetail,
    deleteCurrentAttractionInfo,
    deleteAttractionInfosByIds,
    updateCurrentAttractionInfoPatch,
    updateAttractionInfoLocaleField,
    saveCurrentAttractionInfo,
    saveCurrentAttractionInfoIfDirty,
    isCurrentAttractionInfoDirty,
    getAttractionInfoName,
  };
}
