import { useCallback, useRef, useState } from 'react';
import { aiAPI, attractionsAPI, tasksAPI } from '../../../api/generation';
import {
  pollGenerationTask,
  isPollCancelledError,
  TASK_NOT_FOUND_MESSAGE,
} from '../../../utils/generationTaskPoll';
import { parseApiError } from '../../../utils/apiError';
import {
  clampGenerationCount,
  buildGenerationPayloadFields,
  formatGenerationDedupeResultMessage,
} from '../../../components/generation/generationUtils';
import {
  filterPersistedSessionAttractions,
  isPersistedSessionAttractionId,
  normalizeId,
} from './sessionWizardShared.jsx';
import { normalizeDraftId, upsertById } from './useSessionWizardHelpers.js';
import {
  buildAttractionPayload,
  buildAttractionPersistSnapshot as buildAttrPersistSnapshot,
  collectAttractionLocaleTexts as collectAttrLocaleTexts,
  normalizeAttraction,
} from './attractionCore.js';
import { normalizeAttractionInfo } from './attractionInfoCore.js';
import { resolveDefaultAttractionAiLang } from './attractionLocaleCore.js';

export function useAttractionGeneration({
  sessionId,
  localeData,
  cityDrafts,
  activeCityDraftIdRef,
  aiGenerationMode,
  aiUseWebSearch,
  loadSession,
  showNote,
  reloadAttractionsFromServer,
  attractions,
  setAttractions,
  currentAttr,
  setCurrentAttr,
  attrLocaleData,
  saveCurrentAttrIfDirty,
  setSession,
  setAttractionInfos,
  attrSavedSnapshotRef,
}) {
  const [attractionGenerationOpen, setAttractionGenerationOpen] = useState(false);
  const [attractionGenerationPrompt, setAttractionGenerationPrompt] = useState('');
  const [attractionGenerating, setAttractionGenerating] = useState(false);
  const [attractionGenerationTaskId, setAttractionGenerationTaskId] = useState(null);
  const [attractionGenerationProgress, setAttractionGenerationProgress] = useState(null);
  const [attractionGenerationError, setAttractionGenerationError] = useState('');
  const [attractionGenerationAssignedCityType, setAttractionGenerationAssignedCityType] =
    useState('none');
  const [attractionGenerationSessionCityId, setAttractionGenerationSessionCityId] = useState('');
  const [attractionGenerationDatabaseCityId, setAttractionGenerationDatabaseCityId] = useState('');
  const [attractionGenerationLang, setAttractionGenerationLang] = useState('ru');
  const [attractionGenerationCount, setAttractionGenerationCount] = useState(5);
  const [attractionDedupeExistingItems, setAttractionDedupeExistingItems] = useState(true);
  const attractionGenPollCancelledRef = useRef(false);
  const attractionGenInFlightRef = useRef(false);

  const [attractionInfoGenerateModalOpen, setAttractionInfoGenerateModalOpen] = useState(false);
  const [attractionInfoGeneratePrompt, setAttractionInfoGeneratePrompt] = useState('');
  const [attractionInfoGenerateCount, setAttractionInfoGenerateCount] = useState(5);
  const [attractionInfoDedupeExistingItems, setAttractionInfoDedupeExistingItems] = useState(true);
  const [attractionInfoGenerating, setAttractionInfoGenerating] = useState(false);
  const [attractionInfoGenerationTaskId, setAttractionInfoGenerationTaskId] = useState(null);
  const [attractionInfoGenerationError, setAttractionInfoGenerationError] = useState('');
  const [attractionInfoGenerationLang, setAttractionInfoGenerationLang] = useState('ru');
  const [attractionInfoGenerationTargetId, setAttractionInfoGenerationTargetId] = useState('');
  const attractionInfoGenPollCancelledRef = useRef(false);
  const attractionInfoGenInFlightRef = useRef(false);

  // ─── Attraction generation functions ───────────────────────────────────────
  const openAttractionGenerationModal = useCallback(() => {
    attractionGenPollCancelledRef.current = false;
    setAttractionGenerationError('');
    setAttractionGenerationPrompt('');
    setAttractionGenerationTaskId(null);

    const draftId = normalizeDraftId(activeCityDraftIdRef.current);
    if (draftId && draftId !== 'legacy') {
      setAttractionGenerationAssignedCityType('draft');
      setAttractionGenerationSessionCityId(draftId);
      setAttractionGenerationDatabaseCityId('');
    } else {
      setAttractionGenerationAssignedCityType('none');
      setAttractionGenerationSessionCityId('');
      setAttractionGenerationDatabaseCityId('');
    }

    setAttractionGenerationLang(resolveDefaultAttractionAiLang(
      localeData,
      activeCityDraftIdRef.current,
      cityDrafts,
    ));
    setAttractionGenerationOpen(true);
  }, [localeData, cityDrafts, activeCityDraftIdRef]);

  const closeAttractionGenerationModal = useCallback(() => {
    attractionGenPollCancelledRef.current = true;
    attractionGenInFlightRef.current = false;
    setAttractionGenerationOpen(false);
    setAttractionGenerating(false);
    setAttractionGenerationTaskId(null);
    setAttractionGenerationError('');
  }, []);

  const setAttractionGenerationAssignedCityTypeSafe = useCallback((value) => {
    setAttractionGenerationAssignedCityType(value);
    if (value !== 'draft') {
      setAttractionGenerationSessionCityId('');
    }
    if (value !== 'database') {
      setAttractionGenerationDatabaseCityId('');
    }
  }, []);

  const generateAttractionsFromPrompt = useCallback(async () => {
    if (attractionGenerating || attractionGenInFlightRef.current) return;

    const prompt = attractionGenerationPrompt.trim();
    if (!prompt) {
      setAttractionGenerationError('Введите запрос');
      return;
    }

    const assigned_city_type = attractionGenerationAssignedCityType || 'none';
    let session_city_id = null;
    let city_id = null;

    const activeDraftId = normalizeDraftId(activeCityDraftIdRef.current);
    if (assigned_city_type === 'draft') {
      const sid = normalizeDraftId(attractionGenerationSessionCityId) || activeDraftId;
      if (!sid || sid === 'legacy') {
        setAttractionGenerationError('Выберите город сессии');
        return;
      }
      session_city_id = sid;
    } else if (assigned_city_type === 'database') {
      const cid = (attractionGenerationDatabaseCityId || '').trim();
      if (!cid) {
        setAttractionGenerationError('Выберите город из базы');
        return;
      }
      city_id = cid;
    } else if (activeDraftId && activeDraftId !== 'legacy') {
      session_city_id = activeDraftId;
    }

    const langRaw = (attractionGenerationLang || 'ru').trim().toLowerCase();
    const lang = (langRaw.split('-')[0] || 'ru').slice(0, 8) || 'ru';

    attractionGenPollCancelledRef.current = false;
    attractionGenInFlightRef.current = true;
    setAttractionGenerating(true);
    setAttractionGenerationError('');
    setAttractionGenerationTaskId(null);

    try {
      const startRes = await aiAPI.attractionsJsonStart({
        session_id: sessionId,
        prompt,
        requested_count: clampGenerationCount(attractionGenerationCount, 'attractions'),
        dedupe_existing_items: attractionDedupeExistingItems,
        lang,
        assigned_city_type: session_city_id
          ? 'draft'
          : city_id
            ? 'database'
            : 'none',
        session_city_id: session_city_id || null,
        city_id: city_id || null,
        ...buildGenerationPayloadFields(aiGenerationMode, aiUseWebSearch),
      });
      const taskId = startRes?.data?.task_id;
      if (!taskId) {
        throw new Error('Сервер не вернул task_id');
      }
      setAttractionGenerationTaskId(taskId);

      await pollGenerationTask(taskId, {
        tasksAPI,
        maxWaitMs: 20 * 60 * 1000,
        isCancelled: () => attractionGenPollCancelledRef.current,
        onProgress: (task) => {
          setAttractionGenerationProgress({
            status: task?.status,
            progress: task?.progress || 0,
            step: task?.current_step || '',
          });
        },
      });

      if (attractionGenPollCancelledRef.current) {
        return;
      }

      const createRes = await aiAPI.attractionsCreateFromTask(taskId, {
        session_id: sessionId,
        dedupe_existing_items: attractionDedupeExistingItems,
      });
      const createData = createRes?.data || {};
      if (createData.success === false) {
        throw new Error(createData.error || 'Не удалось добавить достопримечательности в сессию');
      }

      const createdList = (createData.attractions || []).map(normalizeAttraction);
      if (createdList.length > 0) {
        setAttractions((prev) => {
          const existingIds = new Set(prev.map((item) => String(item.id)));
          const toAdd = createdList.filter(
            (item) => item.id && !existingIds.has(String(item.id)),
          );
          return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
        });
      }

      const n =
        typeof createData.created_count === 'number'
          ? createData.created_count
          : createdList.length;

      const keepDraft = normalizeDraftId(activeCityDraftIdRef.current);
      await reloadAttractionsFromServer();
      await loadSession(keepDraft);

      if (!attractionGenPollCancelledRef.current) {
        if (createData.partial && createData.warning) {
          showNote(createData.warning, 'warning');
        }
        showNote(
          formatGenerationDedupeResultMessage(createData, { dedupeField: 'dedupe_existing_items' })
            || `Сгенерировано достопримечательностей: ${n}`,
          createData.partial ? 'warning' : 'success',
        );
        setAttractionGenerationOpen(false);
        setAttractionGenerationPrompt('');
        setAttractionGenerationTaskId(null);
      }
    } catch (e) {
      if (!attractionGenPollCancelledRef.current && !isPollCancelledError(e)) {
        const msg = e?.message || parseApiError(e, TASK_NOT_FOUND_MESSAGE);
        setAttractionGenerationError(msg);
        showNote(msg, 'error');
      }
      setAttractionGenerationTaskId(null);
    } finally {
      attractionGenInFlightRef.current = false;
      setAttractionGenerating(false);
    }
  }, [
    sessionId,
    attractionGenerationPrompt,
    attractionGenerationAssignedCityType,
    attractionGenerationSessionCityId,
    attractionGenerationDatabaseCityId,
    attractionGenerationLang,
    attractionGenerationCount,
    attractionDedupeExistingItems,
    aiGenerationMode,
    aiUseWebSearch,
    loadSession,
    showNote,
    activeCityDraftIdRef,
    reloadAttractionsFromServer,
    attractionGenerating,
    setAttractions,
  ]);

  // ─── Attraction useful info generation ─────────────────────────────────────
  const resolveDefaultAttractionInfoAiLang = useCallback(() => {
    const entries = Object.values(attrLocaleData || {});
    if (entries.length > 0) {
      const locLang = (entries[0]?.lang || '').trim().toLowerCase();
      if (locLang) {
        const base = locLang.split('-')[0];
        return base || 'ru';
      }
    }
    return 'ru';
  }, [attrLocaleData]);

  const openAttractionInfoGenerateModal = useCallback(() => {
    attractionInfoGenPollCancelledRef.current = false;
    setAttractionInfoGenerationError('');
    setAttractionInfoGeneratePrompt('');
    setAttractionInfoGenerateCount(5);
    setAttractionInfoGenerationTaskId(null);
    setAttractionInfoGenerationLang(resolveDefaultAttractionInfoAiLang());

    const persistedAttractions = filterPersistedSessionAttractions(attractions);
    let targetId = '';
    const currentAttrId = normalizeId(currentAttr?.id);

    if (
      currentAttrId &&
      persistedAttractions.some((item) => normalizeId(item.id) === currentAttrId)
    ) {
      targetId = currentAttrId;
    } else if (persistedAttractions.length === 1) {
      targetId = normalizeId(persistedAttractions[0]?.id);
    }

    setAttractionInfoGenerationTargetId(targetId);
    setAttractionInfoGenerateModalOpen(true);
  }, [
    resolveDefaultAttractionInfoAiLang,
    currentAttr,
    attractions,
  ]);

  const handleOpenAttractionInfoGenerateModal = useCallback(() => {
    const persistedAttractions = filterPersistedSessionAttractions(attractions);
    if (!persistedAttractions.length) {
      showNote('Сначала добавьте достопримечательность.', 'warning');
      return;
    }
    openAttractionInfoGenerateModal();
  }, [attractions, showNote, openAttractionInfoGenerateModal]);

  const closeAttractionInfoGenerateModal = useCallback(() => {
    attractionInfoGenPollCancelledRef.current = true;
    attractionInfoGenInFlightRef.current = false;
    setAttractionInfoGenerateModalOpen(false);
    setAttractionInfoGenerating(false);
    setAttractionInfoGenerationTaskId(null);
    setAttractionInfoGenerationError('');
  }, []);

  const ensureAttractionSavedForInfoGeneration = useCallback(async () => {
    const targetId = normalizeId(attractionInfoGenerationTargetId);
    if (!targetId || !isPersistedSessionAttractionId(targetId)) {
      throw new Error('Выберите достопримечательность.');
    }

    const currentAttrId = normalizeId(currentAttr?.id);
    if (currentAttr && currentAttrId === targetId) {
      await saveCurrentAttrIfDirty({ silent: true });

      const sessionAttractionId = normalizeId(currentAttr?.id);
      if (sessionAttractionId && isPersistedSessionAttractionId(sessionAttractionId)) {
        return sessionAttractionId;
      }

      const { name, description } = collectAttrLocaleTexts(attrLocaleData);
      const res = await attractionsAPI.create(
        sessionId,
        buildAttractionPayload(currentAttr, name, description),
      );
      const rawAttr = res?.data?.attraction || res?.data;
      const attr = normalizeAttraction(rawAttr || {});
      const createdId = normalizeId(attr?.id);

      if (!createdId || !isPersistedSessionAttractionId(createdId)) {
        throw new Error('Не удалось сохранить достопримечательность перед генерацией');
      }

      setAttractions((prev) => upsertById(prev, attr));
      setCurrentAttr(attr);
      setAttractionInfoGenerationTargetId(createdId);
      attrSavedSnapshotRef.current = buildAttrPersistSnapshot(attr, attrLocaleData);

      if (setSession) {
        setSession((prev) =>
          prev
            ? { ...prev, attractions: upsertById(prev.attractions || [], attr) }
            : prev,
        );
      }

      await Promise.all(
        Object.values(attrLocaleData).map((d) =>
          attractionsAPI.saveContent(sessionId, createdId, {
            language: d.lang,
            text: d.contentText || '',
          }),
        ),
      );

      return createdId;
    }

    const exists = attractions.some(
      (item) => normalizeId(item?.id) === targetId,
    );
    if (exists) {
      return targetId;
    }

    throw new Error('Выбранная достопримечательность не найдена в сессии');
  }, [
    attractionInfoGenerationTargetId,
    currentAttr,
    attrLocaleData,
    sessionId,
    attractions,
    saveCurrentAttrIfDirty,
    setSession,
    setAttractions,
    setCurrentAttr,
    attrSavedSnapshotRef,
  ]);

  const generateAttractionInfoFromPrompt = useCallback(async () => {
    if (attractionInfoGenerating || attractionInfoGenInFlightRef.current) return;

    if (!normalizeId(attractionInfoGenerationTargetId)) {
      const msg = 'Выберите достопримечательность.';
      setAttractionInfoGenerationError(msg);
      showNote(msg, 'warning');
      return;
    }

    const prompt = attractionInfoGeneratePrompt.trim();
    const userPrompt = prompt || 'Сгенерируй полезную информацию для туристов о достопримечательности';

    const langRaw = (attractionInfoGenerationLang || 'ru').trim().toLowerCase();
    const lang = (langRaw.split('-')[0] || 'ru').slice(0, 8) || 'ru';

    const requested_count = clampGenerationCount(attractionInfoGenerateCount, 'attraction_info');

    attractionInfoGenPollCancelledRef.current = false;
    attractionInfoGenInFlightRef.current = true;
    setAttractionInfoGenerating(true);
    setAttractionInfoGenerationError('');
    setAttractionInfoGenerationTaskId(null);

    try {
      const sessionAttractionId = await ensureAttractionSavedForInfoGeneration();

      const startRes = await aiAPI.attractionInfoJsonStart({
        session_id: sessionId,
        prompt: userPrompt,
        lang,
        requested_count,
        dedupe_existing_items: attractionInfoDedupeExistingItems,
        assigned_attraction_type: 'draft',
        session_attraction_id: sessionAttractionId,
        event_id: null,
        ...buildGenerationPayloadFields(aiGenerationMode, aiUseWebSearch),
      });
      const taskId = startRes?.data?.task_id;
      if (!taskId) {
        throw new Error('Сервер не вернул task_id');
      }
      setAttractionInfoGenerationTaskId(taskId);

      await pollGenerationTask(taskId, {
        tasksAPI,
        maxWaitMs: 20 * 60 * 1000,
        isCancelled: () => attractionInfoGenPollCancelledRef.current,
      });

      if (attractionInfoGenPollCancelledRef.current) {
        return;
      }

      const createRes = await aiAPI.attractionInfoCreateFromTask(taskId, {
        session_id: sessionId,
        dedupe_existing_items: attractionInfoDedupeExistingItems,
      });
      const createData = createRes?.data || {};
      const createdRaw = createData.attraction_infos || [];
      const created = (Array.isArray(createdRaw) ? createdRaw : []).map(normalizeAttractionInfo);
      const n = typeof createData.created_count === 'number'
        ? createData.created_count
        : created.length;

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

      if (!attractionInfoGenPollCancelledRef.current) {
        if (createData.partial && createData.warning) {
          showNote(createData.warning, 'warning');
        }
        showNote(
          formatGenerationDedupeResultMessage(createData, { dedupeField: 'dedupe_existing_items' })
            || `Сгенерировано блоков полезной информации: ${n}`,
          createData.partial ? 'warning' : 'success',
        );
        setAttractionInfoGenerateModalOpen(false);
        setAttractionInfoGeneratePrompt('');
        setAttractionInfoGenerationTaskId(null);
      }
    } catch (e) {
      if (!attractionInfoGenPollCancelledRef.current && !isPollCancelledError(e)) {
        const msg = e?.message || parseApiError(e, TASK_NOT_FOUND_MESSAGE);
        setAttractionInfoGenerationError(msg);
        showNote(msg, 'error');
      }
      setAttractionInfoGenerationTaskId(null);
    } finally {
      attractionInfoGenInFlightRef.current = false;
      setAttractionInfoGenerating(false);
    }
  }, [
    sessionId,
    attractionInfoGeneratePrompt,
    attractionInfoGenerateCount,
    attractionInfoDedupeExistingItems,
    attractionInfoGenerationLang,
    aiGenerationMode,
    aiUseWebSearch,
    showNote,
    setSession,
    ensureAttractionSavedForInfoGeneration,
    attractionInfoGenerating,
    attractionInfoGenerationTargetId,
    setAttractionInfos,
  ]);

  return {
    attractionGenerationOpen, setAttractionGenerationOpen,
    attractionGenerationPrompt, setAttractionGenerationPrompt,
    attractionGenerating,
    attractionGenerationTaskId,
    attractionGenerationProgress,
    attractionGenerationError,
    attractionGenerationAssignedCityType, setAttractionGenerationAssignedCityType,
    attractionGenerationSessionCityId, setAttractionGenerationSessionCityId,
    attractionGenerationDatabaseCityId, setAttractionGenerationDatabaseCityId,
    attractionGenerationLang, setAttractionGenerationLang,
    attractionGenerationCount, setAttractionGenerationCount,
    attractionDedupeExistingItems, setAttractionDedupeExistingItems,
    attractionGenPollCancelledRef, attractionGenInFlightRef,
    openAttractionGenerationModal,
    closeAttractionGenerationModal,
    setAttractionGenerationAssignedCityTypeSafe,
    generateAttractionsFromPrompt,
    attractionInfoGenerateModalOpen, setAttractionInfoGenerateModalOpen,
    attractionInfoGeneratePrompt, setAttractionInfoGeneratePrompt,
    attractionInfoGenerateCount, setAttractionInfoGenerateCount,
    attractionInfoDedupeExistingItems, setAttractionInfoDedupeExistingItems,
    attractionInfoGenerating,
    attractionInfoGenerationTaskId,
    attractionInfoGenerationError,
    attractionInfoGenerationLang, setAttractionInfoGenerationLang,
    attractionInfoGenerationTargetId, setAttractionInfoGenerationTargetId,
    openAttractionInfoGenerateModal,
    handleOpenAttractionInfoGenerateModal,
    closeAttractionInfoGenerateModal,
    generateAttractionInfoFromPrompt,
  };
}
