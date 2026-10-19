import { useCallback, useEffect } from 'react';
import { imagesAPI as defaultImagesAPI, sessionsAPI } from '../../../api/generation';
import { normalizeAttraction } from './attractionCore.js';
import {
  normalizeAttractionInfo,
} from './attractionInfoCore.js';
import {
  normalizeAttractionFeedItem,
} from './attractionFeedCore.js';
import { useAttractionInfoState } from './useAttractionInfoState.js';
import { useAttractionFeedState } from './useAttractionFeedState.js';
import { useAttractionGeneration } from './useAttractionGeneration.js';
import { useAttractionEditorState } from './useAttractionEditorState.js';
import { buildAttractionSessionSync } from './attractionSessionSync.js';

export function useAttractionsStep(ctx) {
  const {
    sessionId,
    showNote,
    confirm,
    localeData,
    cityDrafts,
    referenceCities,
    referenceAttractions,
    activeCityDraftIdRef,
    hasUnsavedChangesRef,
    loadSession,
    setSession,
    setCommonsTarget,
    setCommonsModalOpen,
    aiGenerationMode,
    aiUseWebSearch,
    getSessionUuid,
    imagesAPI: imagesAPIProp,
    session,
  } = ctx;

  const imagesAPI = imagesAPIProp || defaultImagesAPI;



  const {
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
  } = useAttractionEditorState({
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
  });

  const {
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
  } = useAttractionInfoState({
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
  });

  const {
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
  } = useAttractionFeedState({
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
  });



  const reloadAttractionsFromServer = useCallback(async () => {
    if (!sessionId) return null;
    try {
      const res = await sessionsAPI.get(sessionId, { skipApiGetCache: true });
      const data = res?.data || {};

      if (Array.isArray(data.attractions)) {
        setAttractions(data.attractions.map(normalizeAttraction));
      }
      if (Array.isArray(data.attraction_infos)) {
        setAttractionInfos(data.attraction_infos.map(normalizeAttractionInfo));
      }
      if (Array.isArray(data.attraction_feed_items)) {
        setAttractionFeedItems(data.attraction_feed_items.map(normalizeAttractionFeedItem));
      }

      setAttractionsLoaded(true);
      return data;
    } catch (e) {
      showNote('Не удалось загрузить достопримечательности', 'error');
      return null;
    }
  }, [
    sessionId,
    showNote,
    setAttractionInfos,
    setAttractionFeedItems,
    setAttractions,
    setAttractionsLoaded,
  ]);

  // The wizard controller already loads the complete session on mount.  Do
  // not fetch the same (potentially very large) session payload again here;
  // the effect below synchronizes this local editor state from `session`.
  // `reloadAttractionsFromServer` is retained for explicit post-mutation
  // refreshes.

  useEffect(() => {
    const saving = attrSavingRef.current || attrAutoSavingRef.current;
    const sync = buildAttractionSessionSync(session, [], {
      saving,
    });
    if (!sync) return;

    setAttractions((previous) => buildAttractionSessionSync(session, previous, {
      saving: attrSavingRef.current || attrAutoSavingRef.current,
    })?.attractions ?? previous);
    setAttractionsLoaded(true);

    if (sync.attractionInfos) {
      setAttractionInfos(sync.attractionInfos);
    }
    if (sync.attractionFeedItems) {
      setAttractionFeedItems(sync.attractionFeedItems);
    }
  }, [
    session,
    setAttractionInfos,
    setAttractionFeedItems,
    attrSavingRef,
    attrAutoSavingRef,
    setAttractions,
    setAttractionsLoaded,
  ]);

  const {
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
  } = useAttractionGeneration({
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
  });

  // ─── Return ────────────────────────────────────────────────────────────────
  return {
    attractions,
    currentAttr,
    attrView,
    attrLocaleData,
    attrActiveLocale,
    attrSaving,
    attrAutoSaving,
    attrAutoSaved,
    attractionsLoaded,
    attrLocaleDataAttractionIdRef,
    attrSavedSnapshotRef,
    attrSavingRef,
    attrAutoSaveTimerRef,
    attrAutoSavedTimerRef,

    attractionInfos,
    currentAttractionInfo,
    attractionInfoLocaleData,
    attractionInfoActiveLocale,
    attractionInfoSaving,

    attractionFeedItems,
    currentAttractionFeedItem,
    attractionFeedLocaleData,
    attractionFeedActiveLocale,
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

    attractionGenerationOpen,
    attractionGenerationPrompt,
    attractionGenerating,
    attractionGenerationTaskId,
    attractionGenerationProgress,
    attractionGenerationError,
    attractionGenerationAssignedCityType,
    attractionGenerationSessionCityId,
    attractionGenerationDatabaseCityId,
    attractionGenerationLang,
    attractionGenerationCount,
    attractionDedupeExistingItems,
    attractionGenPollCancelledRef,
    attractionGenInFlightRef,

    setAttrView,
    setCurrentAttr,
    setAttrActiveLocale,
    setAttractions,

    setCurrentAttractionInfo,
    setAttractionInfoActiveLocale,

    setCurrentAttractionFeedItem,
    setAttractionFeedActiveLocale,

    setAttractionGenerationOpen,
    setAttractionGenerationPrompt,
    setAttractionGenerationAssignedCityType,
    setAttractionGenerationSessionCityId,
    setAttractionGenerationDatabaseCityId,
    setAttractionGenerationLang,
    setAttractionGenerationCount,
    setAttractionDedupeExistingItems,

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

    openAttractionGenerationModal,
    closeAttractionGenerationModal,
    setAttractionGenerationAssignedCityTypeSafe,
    generateAttractionsFromPrompt,

    attractionInfoGenerateModalOpen,
    setAttractionInfoGenerateModalOpen,
    attractionInfoGeneratePrompt,
    setAttractionInfoGeneratePrompt,
    attractionInfoGenerateCount,
    setAttractionInfoGenerateCount,
    attractionInfoDedupeExistingItems,
    setAttractionInfoDedupeExistingItems,
    attractionInfoGenerating,
    attractionInfoGenerationTaskId,
    attractionInfoGenerationError,
    attractionInfoGenerationLang,
    setAttractionInfoGenerationLang,
    attractionInfoGenerationTargetId,
    setAttractionInfoGenerationTargetId,
    openAttractionInfoGenerateModal,
    handleOpenAttractionInfoGenerateModal,
    closeAttractionInfoGenerateModal,
    generateAttractionInfoFromPrompt,

    reloadAttractionsFromServer,
  };
}
