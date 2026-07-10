import { useCallback, useEffect, useRef, useState } from 'react';
import useFlushOnLeave from './useFlushOnLeave';
import { interactiveLocationsAPI, imagesAPI as defaultImagesAPI, aiAPI, tasksAPI, sessionsAPI } from '../../../api/generation';
import {
  pollGenerationTask,
  isPollCancelledError,
  TASK_NOT_FOUND_MESSAGE,
} from '../../../utils/generationTaskPoll';
import { parseApiError } from '../../../utils/apiError';
import { clampGenerationCount } from '../../../components/generation/AiGenerationCountField.jsx';
import { formatGenerationDedupeResultMessage } from '../../../components/generation/AiGenerationDedupeToggle.jsx';
import {
  buildGenerationPayloadFields,
} from '../../../components/generation/AiGenerationQualitySettings.jsx';
import { normalizeTagIds, normalizeId } from './sessionWizardShared.jsx';
import {
  normalizeInteractiveLocation,
  buildIlPersistSnapshot,
  persistInteractiveLocationRecord,
  buildAttrLocaleDataWithPrevious,
  normalizeDraftId,
  waitForPersistenceIdle,
} from './useSessionWizardHelpers.js';

function getAttrName(attr) {
  const name = attr?.name || {};
  return name.ru || name.en || name.it || Object.values(name).find(Boolean) || '(без названия)';
}

export default function useInteractiveLocationsStep({
  sessionId,
  showNote,
  confirm,
  localeData,
  cityDrafts,
  referenceCities,
  activeCityDraftIdRef,
  hasUnsavedChangesRef,
  loadSession,
  aiGenerationMode,
  aiUseWebSearch,
  getSessionUuid,
  imagesAPI: imagesApiOverride,
  collectWizardLanguageCodes,
  session,
}) {
  const imagesAPI = imagesApiOverride || defaultImagesAPI;

  const [interactiveLocations, setInteractiveLocations] = useState([]);
  const [currentIl, setCurrentIl] = useState(null);
  const [ilView, setIlView] = useState('list');
  const [ilLocaleData, setIlLocaleData] = useState({});
  const [ilActiveLocale, setIlActiveLocale] = useState('ru-RU');
  const [ilSaving, setIlSaving] = useState(false);
  const [ilAutoSaving, setIlAutoSaving] = useState(false);
  const [ilAutoSaved, setIlAutoSaved] = useState(false);
  const [ilPhotoUploading, setIlPhotoUploading] = useState(false);
  const ilPhotoFileRef = useRef(null);
  const [ilIconUploading, setIlIconUploading] = useState(false);
  const ilIconFileRef = useRef(null);

  const ilLocaleDataIlIdRef = useRef(null);
  const ilSavedSnapshotRef = useRef(null);
  const ilSavingRef = useRef(false);
  const ilAutoSavingRef = useRef(false);
  const ilPhotoUploadingRef = useRef(false);

  const ilAutoSaveTimerRef = useRef(null);
  const ilAutoSavedTimerRef = useRef(null);

  const [ilGenerationOpen, setIlGenerationOpen] = useState(false);
  const [ilGenerationPrompt, setIlGenerationPrompt] = useState('');
  const [ilGenerating, setIlGenerating] = useState(false);
  const [ilGenerationTaskId, setIlGenerationTaskId] = useState(null);
  const [ilGenerationProgress, setIlGenerationProgress] = useState(null);
  const [ilGenerationError, setIlGenerationError] = useState('');
  const [ilGenerationAssignedCityType, setIlGenerationAssignedCityType] = useState('none');
  const [ilGenerationSessionCityId, setIlGenerationSessionCityId] = useState('');
  const [ilGenerationDatabaseCityId, setIlGenerationDatabaseCityId] = useState('');
  const [ilGenerationLang, setIlGenerationLang] = useState('ru');
  const [ilGenerationCount, setIlGenerationCount] = useState(5);
  const [ilDedupeExistingLocations, setIlDedupeExistingLocations] = useState(true);
  const ilGenPollCancelledRef = useRef(false);
  const ilGenInFlightRef = useRef(false);

  useEffect(() => {
    return () => {
      clearTimeout(ilAutoSaveTimerRef.current);
      clearTimeout(ilAutoSavedTimerRef.current);
    };
  }, []);

  const reloadInteractiveLocationsFromServer = useCallback(async () => {
    if (!sessionId) return null;
    try {
      const res = await sessionsAPI.get(sessionId, { skipApiGetCache: true });
      const list = res?.data?.interactive_locations;
      if (Array.isArray(list)) {
        setInteractiveLocations(list.map(normalizeInteractiveLocation));
      }
      return res?.data || null;
    } catch (e) {
      showNote('Не удалось загрузить интерактивные локации', 'error');
      return null;
    }
  }, [sessionId, showNote]);

  useEffect(() => {
    if (!sessionId) return;
    reloadInteractiveLocationsFromServer();
  }, [sessionId, reloadInteractiveLocationsFromServer]);

  useEffect(() => {
    if (!session?.id || !Array.isArray(session.interactive_locations)) return;
    if (ilSavingRef.current || ilAutoSaving) return;
    setInteractiveLocations(session.interactive_locations.map(normalizeInteractiveLocation));
  }, [session?.id, session?.interactive_locations, ilAutoSaving]);

  useEffect(() => {
    ilSavingRef.current = ilSaving;
  }, [ilSaving]);

  useEffect(() => {
    ilAutoSavingRef.current = ilAutoSaving;
  }, [ilAutoSaving]);

  useEffect(() => {
    ilPhotoUploadingRef.current = ilPhotoUploading;
  }, [ilPhotoUploading]);

  const buildIlLocaleDataInternal = useCallback(
    (attr = {}, previousData = null) => {
      return buildAttrLocaleDataWithPrevious(attr, previousData, {
        localeData,
        cityDrafts,
        referenceCities,
        activeCityDraftIdRef,
      });
    },
    [localeData, cityDrafts, referenceCities, activeCityDraftIdRef],
  );

  useEffect(() => {
    if (!currentIl) return;

    const currentIlId = normalizeId(currentIl.id);

    setIlLocaleData((prev) => {
      const shouldPreserveValues =
        ilLocaleDataIlIdRef.current === currentIlId;

      const next = buildIlLocaleDataInternal(
        currentIl,
        shouldPreserveValues ? prev : null,
      );

      ilLocaleDataIlIdRef.current = currentIlId;

      return next;
    });
  }, [currentIl, buildIlLocaleDataInternal]);

  useEffect(() => {
    const availableKeys = Object.keys(ilLocaleData || {});

    if (availableKeys.length === 0) return;

    if (!availableKeys.includes(ilActiveLocale)) {
      setIlActiveLocale(availableKeys[0]);
    }
  }, [ilLocaleData, ilActiveLocale]);

  const isCurrentIlDirty = useCallback(() => {
    if (!currentIl?.id) return false;

    const snap = buildIlPersistSnapshot(currentIl, ilLocaleData);

    return snap !== ilSavedSnapshotRef.current;
  }, [currentIl, ilLocaleData]);

  const saveCurrentIl = useCallback(
    async ({ silent = false } = {}) => {
      if (!currentIl?.id) return null;

      setIlSaving(true);

      try {
        const updatedIl = await persistInteractiveLocationRecord(
          sessionId,
          currentIl,
          ilLocaleData,
        );

        setInteractiveLocations((prev) =>
          prev.map((item) => (item.id === currentIl.id ? updatedIl : item)),
        );
        setCurrentIl(updatedIl);
        ilSavedSnapshotRef.current = buildIlPersistSnapshot(updatedIl, ilLocaleData);

        if (!silent) {
          showNote('Интерактивная локация сохранена', 'success');
        }

        return updatedIl;
      } catch (e) {
        if (!silent) {
          showNote(
            'Ошибка при сохранении: ' + parseApiError(e, e.message),
            'error',
          );
        }
        throw e;
      } finally {
        setIlSaving(false);
      }
    },
    [sessionId, currentIl, ilLocaleData, showNote],
  );

  const saveCurrentIlIfDirty = useCallback(
    async (options = {}) => {
      clearTimeout(ilAutoSaveTimerRef.current);
      await waitForPersistenceIdle(
        () => ilSavingRef.current || ilAutoSavingRef.current,
      );

      if (!currentIl?.id || !isCurrentIlDirty()) {
        return true;
      }

      await saveCurrentIl(options);
      return true;
    },
    [currentIl, isCurrentIlDirty, saveCurrentIl],
  );
  // Уход со страницы отменяет debounce-таймер — правки дожимаются немедленно.
  useFlushOnLeave(() => saveCurrentIlIfDirty({ silent: true }));

  useEffect(() => {
    clearTimeout(ilAutoSaveTimerRef.current);

    if (!sessionId || !currentIl?.id) return;
    if (ilView !== 'detail') return;

    if (!isCurrentIlDirty()) return;

    hasUnsavedChangesRef.current = true;
    ilAutoSaveTimerRef.current = setTimeout(async () => {
      if (ilSavingRef.current || ilPhotoUploadingRef.current) return;

      setIlAutoSaving(true);
      setIlAutoSaved(false);

      try {
        await saveCurrentIl({ silent: true });

        setIlAutoSaved(true);
        hasUnsavedChangesRef.current = false;

        clearTimeout(ilAutoSavedTimerRef.current);
        ilAutoSavedTimerRef.current = setTimeout(() => {
          setIlAutoSaved(false);
        }, 2500);
      } catch (e) {
        showNote('Ошибка автосохранения локации: ' + parseApiError(e, 'Неизвестная ошибка'), 'error');
      } finally {
        setIlAutoSaving(false);
      }
    }, 2500);

    return () => {
      clearTimeout(ilAutoSaveTimerRef.current);
    };
  }, [
    sessionId,
    currentIl,
    ilLocaleData,
    ilView,
    isCurrentIlDirty,
    saveCurrentIl,
    hasUnsavedChangesRef,
    showNote,
  ]);

  const openIlDetail = useCallback(async (ilId) => {
    const currentId = normalizeId(currentIl?.id);
    const nextId = normalizeId(ilId);

    if (currentId && nextId && currentId !== nextId) {
      try {
        await saveCurrentIlIfDirty({ silent: true });
      } catch {
        return;
      }
    }

    try {
      const cached = interactiveLocations.find((item) => String(item.id) === String(ilId));
      const res = await interactiveLocationsAPI.get(sessionId, ilId, {
        skipApiGetCache: true,
      });
      const responseIl = res?.data?.interactive_location || res?.data || null;

      if (!responseIl && !cached) return;

      const mergedIl = {
        ...(cached || {}),
        ...(responseIl || {}),

        image_id:
          responseIl?.image_id ??
          responseIl?.image?.id ??
          cached?.image_id ??
          cached?.image?.id ??
          null,

        image_url:
          responseIl?.image_url ??
          responseIl?.image?.url ??
          responseIl?.image?.file ??
          cached?.image_url ??
          cached?.imagePreview ??
          cached?.image?.url ??
          cached?.image?.file ??
          null,

        image_original_url:
          responseIl?.image_original_url ??
          responseIl?.imageOriginalUrl ??
          cached?.image_original_url ??
          cached?.imageOriginalUrl ??
          '',

        image_copyright:
          responseIl?.image_copyright ??
          responseIl?.imageCopyright ??
          cached?.image_copyright ??
          cached?.imageCopyright ??
          '',

        assigned_city_type:
          responseIl?.assigned_city_type ?? cached?.assigned_city_type,
        city_id:
          responseIl?.city_id ?? responseIl?.city ?? cached?.city_id ?? cached?.city,
        city: responseIl?.city_id ?? responseIl?.city ?? cached?.city_id ?? cached?.city,
        session_city_id:
          responseIl?.session_city_id ??
          responseIl?.session_city ??
          cached?.session_city_id ??
          cached?.session_city,
        session_city:
          responseIl?.session_city_id ??
          responseIl?.session_city ??
          cached?.session_city_id ??
          cached?.session_city,

        tags: responseIl?.tags ?? cached?.tags ?? [],
      };

      const il = normalizeInteractiveLocation(mergedIl);

      const openedIlId = normalizeId(il.id);
      if (ilLocaleDataIlIdRef.current !== openedIlId) {
        ilLocaleDataIlIdRef.current = null;
      }

      setInteractiveLocations((items) =>
        items.map((item) => (String(item.id) === String(il.id) ? il : item)),
      );

      const nextLocaleData = buildIlLocaleDataInternal(il);
      const nextLocaleKeys = Object.keys(nextLocaleData);

      setCurrentIl(il);
      setIlLocaleData(nextLocaleData);
      setIlActiveLocale(nextLocaleKeys[0] || 'ru-RU');
      ilSavedSnapshotRef.current = buildIlPersistSnapshot(il, nextLocaleData);
      setIlView('detail');
    } catch (e) {
      showNote(
        'Не удалось открыть интерактивную локацию: ' + parseApiError(e, e.message),
        'error',
      );
    }
  }, [
    sessionId,
    interactiveLocations,
    buildIlLocaleDataInternal,
    showNote,
    currentIl,
    saveCurrentIlIfDirty,
  ]);

  const addInteractiveLocation = useCallback(async () => {
    try {
      const nextIndex = interactiveLocations.length;

      const activeDraftId = normalizeDraftId(activeCityDraftIdRef.current);
      const shouldAttachToDraft =
        activeDraftId && activeDraftId !== 'legacy';

      const createPayload = {
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
      };

      const res = await interactiveLocationsAPI.create(sessionId, createPayload);
      const raw = res?.data?.interactive_location || res?.data || {};

      const il = normalizeInteractiveLocation({
        ...raw,
        assigned_city_type:
          raw.assigned_city_type ?? createPayload.assigned_city_type,
        session_city_id:
          raw.session_city_id ??
          raw.session_city ??
          createPayload.session_city_id,
        session_city:
          raw.session_city_id ??
          raw.session_city ??
          createPayload.session_city_id,
        city_id: raw.city_id ?? raw.city ?? createPayload.city_id,
        city: raw.city_id ?? raw.city ?? createPayload.city_id,
      });

      if (il?.id) {
        const nextIlId = normalizeId(il.id);
        if (ilLocaleDataIlIdRef.current !== nextIlId) {
          ilLocaleDataIlIdRef.current = null;
        }

        const nextLocaleData = buildIlLocaleDataInternal(il);
        const nextLocaleKeys = Object.keys(nextLocaleData);

        setInteractiveLocations((prev) => [...prev, il]);
        setCurrentIl(il);
        setIlLocaleData(nextLocaleData);
        setIlActiveLocale(nextLocaleKeys[0] || 'ru-RU');
        ilSavedSnapshotRef.current = buildIlPersistSnapshot(il, nextLocaleData);
        setIlView('detail');

        showNote(
          shouldAttachToDraft
            ? 'Интерактивная локация добавлена и привязана к текущему городу'
            : 'Интерактивная локация добавлена',
          'success',
        );
      }
    } catch (e) {
      showNote('Ошибка при добавлении: ' + parseApiError(e, e.message), 'error');
    }
  }, [
    sessionId,
    interactiveLocations.length,
    buildIlLocaleDataInternal,
    showNote,
    activeCityDraftIdRef,
  ]);

  const deleteCurrentIl = useCallback(async () => {
    if (!currentIl) return;
    const name = getAttrName(currentIl) || 'без названия';
    if (!(await confirm({ message: `Удалить «${name}»?`, danger: true }))) return;
    try {
      await interactiveLocationsAPI.delete(sessionId, currentIl.id);
      setInteractiveLocations((prev) => prev.filter((item) => item.id !== currentIl.id));
      setIlView('list');
      setCurrentIl(null);
      showNote('Удалено', 'success');
    } catch (e) {
      showNote('Ошибка при удалении: ' + e.message, 'error');
    }
  }, [sessionId, currentIl, showNote, confirm]);

  const updateIlLocaleField = useCallback((field, value) => {
    setIlLocaleData((prev) => ({
      ...prev,
      [ilActiveLocale]: { ...prev[ilActiveLocale], [field]: value },
    }));
  }, [ilActiveLocale]);

  const updateCurrentIlPatch = useCallback((patch) => {
    setCurrentIl((prev) => (prev ? normalizeInteractiveLocation({ ...prev, ...patch }) : prev));
  }, []);

  const persistInteractiveLocationImage = useCallback(
    async (patch, { silent = true } = {}) => {
      if (!currentIl?.id) return null;

      const merged = normalizeInteractiveLocation({ ...currentIl, ...patch });

      setInteractiveLocations((prev) =>
        prev.map((item) => (item.id === merged.id ? merged : item)),
      );
      setCurrentIl(merged);

      setIlSaving(true);

      try {
        const updatedIl = await persistInteractiveLocationRecord(
          sessionId,
          merged,
          ilLocaleData,
        );

        setInteractiveLocations((prev) =>
          prev.map((item) => (item.id === merged.id ? updatedIl : item)),
        );
        setCurrentIl(updatedIl);
        ilSavedSnapshotRef.current = buildIlPersistSnapshot(updatedIl, ilLocaleData);

        if (!silent) {
          showNote('Изображение интерактивной локации сохранено', 'success');
        }

        return updatedIl;
      } catch (e) {
        if (!silent) {
          showNote(
            'Ошибка при сохранении изображения: ' + parseApiError(e, e.message),
            'error',
          );
        }
        throw e;
      } finally {
        setIlSaving(false);
      }
    },
    [sessionId, currentIl, ilLocaleData, showNote],
  );

  const leaveIlDetailView = useCallback(async () => {
    try {
      await saveCurrentIlIfDirty({ silent: true });
    } catch {
      return false;
    }

    setIlView('list');
    setCurrentIl(null);
    ilSavedSnapshotRef.current = null;

    return true;
  }, [saveCurrentIlIfDirty]);

  const toggleCurrentIlTag = useCallback((tagId) => {
    setCurrentIl((prev) => {
      if (!prev) return prev;
      const tags = normalizeTagIds(prev.tags ?? []);
      const id = String(tagId);
      const next = tags.includes(id) ? tags.filter((t) => t !== id) : [...tags, id];
      const updated = normalizeInteractiveLocation({ ...prev, tags: next });
      setInteractiveLocations((items) =>
        items.map((item) => (item.id === updated.id ? updated : item)),
      );
      return updated;
    });
  }, []);

  const handleIlPhotoFile = useCallback(
    async (e, il) => {
      const file = e.target.files?.[0];
      if (!file || !il?.id) return;
      setIlPhotoUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('session_uuid', getSessionUuid() || '');
        formData.append('temp', '1');

        const copyright =
          il.image_copyright ||
          il.imageCopyright ||
          '';

        if (copyright) {
          formData.append('copyright', copyright);
        }

        const res = await imagesAPI.upload(formData);
        const imageId = res?.data?.image_id ?? res?.data?.id;
        const imageUrl = res?.data?.url ?? res?.data?.image_url;
        const patch = {
          image_id: imageId,
          image_url: imageUrl,
          imagePreview: imageUrl,
        };
        const merged = normalizeInteractiveLocation({ ...il, ...patch });
        const localeDataForSave =
          currentIl?.id === il.id ? ilLocaleData : {};
        const updatedIl = await persistInteractiveLocationRecord(
          sessionId,
          merged,
          localeDataForSave,
        );
        setInteractiveLocations((prev) =>
          prev.map((item) => (item.id === il.id ? updatedIl : item)),
        );
        if (currentIl?.id === il.id) {
          setCurrentIl(updatedIl);
          ilSavedSnapshotRef.current = buildIlPersistSnapshot(
            updatedIl,
            ilLocaleData,
          );
        }
        showNote('Фото загружено', 'success');
      } catch (err) {
        showNote('Ошибка загрузки фото: ' + parseApiError(err, err.message), 'error');
      } finally {
        setIlPhotoUploading(false);
        if (ilPhotoFileRef.current) {
          ilPhotoFileRef.current.value = '';
        }
      }
    },
    [sessionId, currentIl, ilLocaleData, getSessionUuid, showNote, imagesAPI],
  );

  const handleIlIconFile = useCallback(
    async (e, il) => {
      const file = e.target.files?.[0];
      if (!file || !il?.id) return;
      setIlIconUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await imagesAPI.upload(formData);
        const iconId = res?.data?.id ?? res?.data?.image_id;
        const iconUrl = res?.data?.url ?? res?.data?.image_url;
        const patch = { icon_id: iconId, icon_url: iconUrl };
        const merged = normalizeInteractiveLocation({ ...il, ...patch });
        const localeDataForSave = currentIl?.id === il.id ? ilLocaleData : {};
        const updatedIl = await persistInteractiveLocationRecord(sessionId, merged, localeDataForSave);
        setInteractiveLocations((prev) =>
          prev.map((item) => (item.id === il.id ? updatedIl : item)),
        );
        if (currentIl?.id === il.id) {
          setCurrentIl(updatedIl);
          ilSavedSnapshotRef.current = buildIlPersistSnapshot(updatedIl, ilLocaleData);
        }
        showNote('Иконка загружена', 'success');
      } catch (err) {
        showNote('Ошибка загрузки иконки: ' + parseApiError(err, err.message), 'error');
      } finally {
        setIlIconUploading(false);
        if (ilIconFileRef.current) ilIconFileRef.current.value = '';
      }
    },
    [sessionId, currentIl, ilLocaleData, showNote, imagesAPI],
  );

  const openIlGenerationModal = useCallback(() => {
    ilGenPollCancelledRef.current = false;
    setIlGenerationError('');
    setIlGenerationPrompt('');
    setIlGenerationTaskId(null);

    const draftId = normalizeDraftId(activeCityDraftIdRef.current);
    if (draftId && draftId !== 'legacy') {
      setIlGenerationAssignedCityType('draft');
      setIlGenerationSessionCityId(draftId);
      setIlGenerationDatabaseCityId('');
    } else {
      setIlGenerationAssignedCityType('none');
      setIlGenerationSessionCityId('');
      setIlGenerationDatabaseCityId('');
    }

    const loc = ilLocaleData[ilActiveLocale] || localeData[activeCityDraftIdRef?.current ? Object.keys(localeData)[0] : 'ru-RU'];
    const locLang = (loc?.lang || '').trim().toLowerCase();
    if (locLang) {
      setIlGenerationLang(locLang.split('-')[0] || 'ru');
    } else {
      setIlGenerationLang(collectWizardLanguageCodes()[0] || 'ru');
    }

    setIlGenerationOpen(true);
  }, [ilLocaleData, ilActiveLocale, localeData, collectWizardLanguageCodes, activeCityDraftIdRef]);

  const closeIlGenerationModal = useCallback(() => {
    ilGenPollCancelledRef.current = true;
    ilGenInFlightRef.current = false;
    setIlGenerationOpen(false);
    setIlGenerating(false);
    setIlGenerationTaskId(null);
    setIlGenerationError('');
  }, []);

  const setIlGenerationAssignedCityTypeSafe = useCallback((value) => {
    setIlGenerationAssignedCityType(value);
    if (value !== 'draft') setIlGenerationSessionCityId('');
    if (value !== 'database') setIlGenerationDatabaseCityId('');
  }, []);

  const generateInteractiveLocationsFromPrompt = useCallback(async () => {
    if (ilGenerating || ilGenInFlightRef.current) return;

    const prompt = ilGenerationPrompt.trim();
    if (!prompt) {
      setIlGenerationError('Введите запрос');
      return;
    }

    const assigned_city_type = ilGenerationAssignedCityType || 'none';
    let session_city_id = null;
    let city_id = null;

    const activeDraftId = normalizeDraftId(activeCityDraftIdRef.current);
    if (assigned_city_type === 'draft') {
      const sid = normalizeDraftId(ilGenerationSessionCityId) || activeDraftId;
      if (!sid || sid === 'legacy') {
        setIlGenerationError('Выберите город сессии');
        return;
      }
      session_city_id = sid;
    } else if (assigned_city_type === 'database') {
      const cid = (ilGenerationDatabaseCityId || '').trim();
      if (!cid) {
        setIlGenerationError('Выберите город из базы');
        return;
      }
      city_id = cid;
    } else if (activeDraftId && activeDraftId !== 'legacy') {
      session_city_id = activeDraftId;
    }

    const langRaw = (ilGenerationLang || 'ru').trim().toLowerCase();
    const lang = (langRaw.split('-')[0] || 'ru').slice(0, 8) || 'ru';
    const languages = collectWizardLanguageCodes();

    ilGenPollCancelledRef.current = false;
    ilGenInFlightRef.current = true;
    setIlGenerating(true);
    setIlGenerationError('');
    setIlGenerationTaskId(null);

    try {
      await saveCurrentIlIfDirty({ silent: true });

      const startRes = await aiAPI.interactiveLocationsJsonStart({
        session_id: sessionId,
        prompt,
        requested_count: clampGenerationCount(ilGenerationCount, 'interactive_locations'),
        lang,
        languages,
        assigned_city_type: session_city_id
          ? 'draft'
          : city_id
            ? 'database'
            : 'none',
        session_city_id: session_city_id || null,
        city_id: city_id || null,
        dedupe_existing_locations: ilDedupeExistingLocations,
        ...buildGenerationPayloadFields(aiGenerationMode, aiUseWebSearch),
      });
      const taskId = startRes?.data?.task_id;
      if (!taskId) {
        throw new Error('Сервер не вернул task_id');
      }
      setIlGenerationTaskId(taskId);

      await pollGenerationTask(taskId, {
        tasksAPI,
        maxWaitMs: 20 * 60 * 1000,
        isCancelled: () => ilGenPollCancelledRef.current,
        onProgress: (task) => {
          setIlGenerationProgress({
            status: task?.status,
            progress: task?.progress || 0,
            step: task?.current_step || '',
          });
        },
      });

      if (ilGenPollCancelledRef.current) return;

      const createRes = await aiAPI.interactiveLocationsCreateFromTask(taskId, {
        session_id: sessionId,
        dedupe_existing_locations: ilDedupeExistingLocations,
      });
      const createData = createRes?.data || {};
      if (createData.success === false) {
        throw new Error(createData.error || 'Не удалось добавить интерактивные локации в сессию');
      }

      const list = (createData.interactive_locations || []).map(normalizeInteractiveLocation);
      const createdCount =
        typeof createData.created_count === 'number'
          ? createData.created_count
          : list.length;

      if (list.length > 0) {
        setInteractiveLocations((prev) => {
          const existingIds = new Set(prev.map((item) => String(item.id)));
          const toAdd = list.filter((item) => item.id && !existingIds.has(String(item.id)));
          return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
        });
      }

      const keepDraft = normalizeDraftId(activeCityDraftIdRef.current);
      await reloadInteractiveLocationsFromServer();
      await loadSession(keepDraft);

      if (!ilGenPollCancelledRef.current) {
        if (createdCount > 0 && list[0]?.id) {
          await openIlDetail(list[0].id);
        }

        if (createData.partial && createData.warning) {
          showNote(createData.warning, 'warning');
        }
        const successMsg = formatGenerationDedupeResultMessage(createData, {
          dedupeField: 'dedupe_existing_locations',
        });
        showNote(successMsg, createData.partial ? 'warning' : 'success');

        setIlGenerationOpen(false);
        setIlGenerationPrompt('');
        setIlGenerationTaskId(null);
      }
    } catch (e) {
      if (!ilGenPollCancelledRef.current && !isPollCancelledError(e)) {
        const msg = e?.message || parseApiError(e, TASK_NOT_FOUND_MESSAGE);
        setIlGenerationError(msg);
        showNote(msg, 'error');
      }
      setIlGenerationTaskId(null);
    } finally {
      ilGenInFlightRef.current = false;
      setIlGenerating(false);
    }
  }, [
    sessionId,
    ilGenerationPrompt,
    ilGenerationAssignedCityType,
    ilGenerationSessionCityId,
    ilGenerationDatabaseCityId,
    ilGenerationLang,
    ilGenerationCount,
    ilDedupeExistingLocations,
    aiGenerationMode,
    aiUseWebSearch,
    collectWizardLanguageCodes,
    saveCurrentIlIfDirty,
    loadSession,
    openIlDetail,
    showNote,
    activeCityDraftIdRef,
    reloadInteractiveLocationsFromServer,
  ]);

  return {
    interactiveLocations,
    currentIl,
    ilView,
    ilLocaleData,
    ilActiveLocale,
    ilSaving,
    ilAutoSaving,
    ilAutoSaved,
    ilPhotoUploading,
    ilPhotoFileRef,
    ilIconUploading,
    ilIconFileRef,

    ilLocaleDataIlIdRef,
    ilSavedSnapshotRef,
    ilSavingRef,
    ilPhotoUploadingRef,

    ilGenerationOpen,
    ilGenerationPrompt,
    ilGenerating,
    ilGenerationTaskId,
    ilGenerationProgress,
    ilGenerationError,
    ilGenerationAssignedCityType,
    ilGenerationSessionCityId,
    ilGenerationDatabaseCityId,
    ilGenerationLang,
    ilGenerationCount,
    ilDedupeExistingLocations,

    setIlView,
    setCurrentIl,
    setIlActiveLocale,
    setIlGenerationPrompt,
    setIlGenerationSessionCityId,
    setIlGenerationDatabaseCityId,
    setIlGenerationLang,
    setIlGenerationCount,
    setIlDedupeExistingLocations,

    openIlDetail,
    addInteractiveLocation,
    deleteCurrentIl,
    saveCurrentIl,
    saveCurrentIlIfDirty,
    isCurrentIlDirty,
    updateIlLocaleField,
    updateCurrentIlPatch,
    persistInteractiveLocationImage,
    toggleCurrentIlTag,
    handleIlPhotoFile,
    handleIlIconFile,
    leaveIlDetailView,

    openIlGenerationModal,
    closeIlGenerationModal,
    setIlGenerationAssignedCityTypeSafe,
    generateInteractiveLocationsFromPrompt,
  };
}
