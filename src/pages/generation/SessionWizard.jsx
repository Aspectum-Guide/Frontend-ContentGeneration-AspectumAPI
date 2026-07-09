import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import CommonsImagePicker from '../../components/generation/CommonsImagePicker';
import SessionWizardAttractionsStep from './session-wizard/SessionWizardAttractionsStep';
import SessionWizardInteractiveLocationsStep from './session-wizard/SessionWizardInteractiveLocationsStep';
import SessionWizardCityStep from './session-wizard/SessionWizardCityStep';
import SessionWizardGenerateCityFull from './session-wizard/SessionWizardGenerateCityFull';
import SessionWizardPublishStep from './session-wizard/SessionWizardPublishStep';
import SessionWizardTagsCatalogStep from './session-wizard/SessionWizardTagsCatalogStep';
import SessionWizardCityTagsPicker from './session-wizard/SessionWizardCityTagsPicker';
import SessionWizardCityInfoStep from './session-wizard/SessionWizardCityInfoStep';
import SessionWizardAttractionInfoStep from './session-wizard/SessionWizardAttractionInfoStep';
import SessionWizardAttractionFeedStep from './session-wizard/SessionWizardAttractionFeedStep.jsx';
import SessionWizardAttractionAudioGuidesBlock from './session-wizard/SessionWizardAttractionAudioGuidesBlock.jsx';
import {
  StatusBadge as DefaultStatusBadge,
  filterCityInfosForActiveDraft,
  filterItemsForActiveAttraction,
  getAttrName,
  itemBelongsToActiveAttraction,
  itemBelongsToActiveCityDraft,
  normalizeId,
} from './session-wizard/sessionWizardShared.jsx';
import { useSessionWizardController } from './session-wizard/useSessionWizardController.ts';
import { aiAPI } from '../../api/generation';
import DefaultToast from '../../components/ui/Toast.jsx';
import DefaultInlineProgressBanner from '../../components/ui/InlineProgressBanner.jsx';
import { ConfirmModal as DefaultConfirmModal } from '../../components/ui/Modal.jsx';
import { useConfirmModal } from '../../components/ui/useConfirmModal.jsx';
import DefaultSessionCloseDialog from '../../components/generation/SessionCloseDialog.jsx';

const STEP_LABELS = [
  'Город',
  'Теги',
  'Достопримечательности',
  'Интерактивные локации',
  'Публикация',
];

function normalizeCommonsQuery(value) {
  if (value == null) return '';

  const normalizeText = (text) => {
    const normalized = String(text || '').trim();

    return normalized && normalized !== '(без названия)' && normalized !== 'без названия'
      ? normalized
      : '';
  };

  if (typeof value === 'string') {
    return normalizeText(value);
  }

  if (typeof value === 'object') {
    return normalizeText(
      value.ru ||
      value.en ||
      value.it ||
      Object.values(value).find((item) => item != null && String(item).trim())
    );
  }

  return normalizeText(value);
}

export default function SessionWizard({ components = {} } = {}) {
  const StatusBadge = components.StatusBadge ?? DefaultStatusBadge;
  const ToastComp = components.Toast ?? DefaultToast;
  const ConfirmModalComp = components.ConfirmModal ?? DefaultConfirmModal;
  const ProgressBanner = components.ProgressBanner ?? DefaultInlineProgressBanner;

  const dialogs = components.dialogs || {};
  const SessionCloseDialogComp =
    components.SessionCloseDialog ?? dialogs.SessionCloseDialog ?? DefaultSessionCloseDialog;

  const { confirm, confirmModal } = useConfirmModal(ConfirmModalComp);
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const controller = useSessionWizardController({ sessionId, confirm });

  const {
    note,
    showNote,
    session,
    loading,

    cityDrafts,
    activeCityDraftId,
    referenceCities,
    referenceAttractions,
    currentStep,

    localeData,
    activeLocale,
    defaultLocale,
    setDefaultLocale,

    addLocaleOpen,
    setAddLocaleOpen,
    newLocaleCode,
    setNewLocaleCode,
    newLocaleLang,
    setNewLocaleLang,

    lat,
    lon,
    savedLat,
    savedLon,

    imagePreview,
    imageOriginalUrl,
    imageCopyright,
    setImageOriginalUrl,
    setImageCopyright,
    photoUploading,
    photoFileRef,

    commonsModalOpen,
    setCommonsModalOpen,

    cityTags,
    cityFilterTree,
    cityFilterTreeLoading,
    cityFilterTreeError,
    loadCityFilterTree,
    eventFilterTree,
    eventFilterTreeLoading,
    eventFilterTreeError,
    loadEventFilterTree,
    cityTagCatalog,
    cityTagCatalogLoading,
    cityTagCatalogError,
    loadCityTagCatalog,
    deletingCityFilterIds,
    deletingEventFilterIds,
    cityInfos,
    currentCityInfo,
    cityInfoLocaleData,
    cityInfoActiveLocale,
    cityInfoSaving,
    cityInfoAutoSaving,
    cityInfoAutoSaved,
    cityInfoGenerateModalOpen,
    cityInfoGeneratePrompt,
    cityInfoGenerateCount,
    cityInfoDedupeExistingItems,
    setCityInfoDedupeExistingItems,
    cityInfoGenerating,
    cityInfoGenerationError,
    cityInfoGenerationTaskId,
    cityInfoGenerationLang,
    aiGenerationMode,
    aiUseWebSearch,
    aiAdvancedGenerationAvailable,
    setAiGenerationMode,
    setAiUseWebSearch,
    attractions,
    interactiveLocations,
    ilView,
    currentIl,
    ilLocaleData,
    ilActiveLocale,
    ilSaving,
    ilAutoSaving,
    ilAutoSaved,
    ilPhotoUploading,
    ilPhotoFileRef,
    ilIconUploading,
    ilIconFileRef,
    attrView,
    currentAttr,
    attrLocaleData,
    attrActiveLocale,
    attrSaving,
    attrAutoSaving,
    attrAutoSaved,

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

    attractionAudioGuides,
    currentAttractionAudioGuide,
    attractionAudioGuideLocaleData,
    attractionAudioGuideActiveLocale,
    attractionAudioGuideSaving,
    attractionAudioGuideAutoSaving,
    attractionAudioGuideAutoSaved,
    attractionAudioUploading,
    audioGuideGeneratingPlan,
    audioGuideGeneratingAllMainText,
    audioGuideMainTextGenerateModalOpen,
    audioGuideMainTextGeneratePrompt,
    audioGuideMainTextGenerationError,
    audioGuideGeneratingItemTextById,
    generatingAudioGuideTrack,
    audioGuideTrackGenerationError,

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
    setAttractionGenerationCount,
    attractionDedupeExistingItems,
    setAttractionDedupeExistingItems,

    saving,
    autoSaving,
    autoSaved,
    hasUnsavedChangesRef,
    preparingPublishStep,
    closeOpen,
    closeMode,
    closing,
    publishing,
    translating,

    setAttrView,
    setCurrentAttr,
    setAttrActiveLocale,
    setCloseOpen,
    setCloseMode,
    setMapContainerRef,

    switchLocale,
    addLocale,
    removeLocale,
    updateLocaleField,

    handleSelectDraft,
    handleCreateDraft,
    handleDeleteDraft,

    handlePhotoFile,
    handlePhotoDelete,
    handleCommonsImageSelect,
    getSessionUuid,

    toggleCityTag,
    uploadCityFilterImage,
    createCityTag,
    updateCityFilter,
    deleteCityFilter,
    bulkDeleteCityTags,
    bulkDeleteEventTags,
    translateSelectedTags,
    uploadEventFilterImage,
    createEventFilterFolder,
    createEventFilterTag,
    updateEventFilter,
    deleteEventFilter,

    setCurrentCityInfo,
    setCityInfoActiveLocale,
    openCityInfoDetail,
    addCityInfo,
    updateCurrentCityInfoPatch,
    updateCityInfoLocaleField,
    saveCurrentCityInfo,
    deleteCurrentCityInfo,
    importCityInfoFromText,
    openCityInfoGenerateModal,
    closeCityInfoGenerateModal,
    setCityInfoGeneratePrompt,
    setCityInfoGenerateCount,
    setCityInfoGenerationLang,
    generateCityInfoFromPrompt,

    openAttrDetail,
    addAttraction,
    importAttractionsFromText,
    openAttractionGenerationModal,
    closeAttractionGenerationModal,
    setAttractionGenerationPrompt,
    setAttractionGenerationAssignedCityTypeSafe,
    setAttractionGenerationSessionCityId,
    setAttractionGenerationDatabaseCityId,
    setAttractionGenerationLang,
    generateAttractionsFromPrompt,
    attractionInfoGenerateModalOpen,
    attractionInfoGeneratePrompt,
    attractionInfoGenerateCount,
    attractionInfoDedupeExistingItems,
    setAttractionInfoDedupeExistingItems,
    attractionInfoGenerating,
    attractionInfoGenerationError,
    attractionInfoGenerationLang,
    setAttractionInfoGenerationLang,
    attractionInfoGenerationTargetId,
    setAttractionInfoGenerationTargetId,
    openAttractionInfoGenerateModal,
    handleOpenAttractionInfoGenerateModal,
    closeAttractionInfoGenerateModal,
    setAttractionInfoGeneratePrompt,
    setAttractionInfoGenerateCount,
    generateAttractionInfoFromPrompt,
    deleteCurrentAttr,
    deleteAttractionsByIds,
    saveCurrentAttr,
    saveCurrentAttrIfDirty,
    saveCityForStep1,
    updateAttrLocaleField,
    updateCurrentAttrPatch,
    toggleCurrentAttractionTag,

    openIlDetail,
    addInteractiveLocation,
    deleteCurrentIl,
    saveCurrentIl,
    saveCurrentIlIfDirty,
    persistInteractiveLocationImage,
    persistAttractionImage,
    handleAttractionPhotoFile,
    leaveIlDetailView,
    updateIlLocaleField,
    updateCurrentIlPatch,
    toggleCurrentIlTag,
    handleIlPhotoFile,
    handleIlIconFile,
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
    ilDedupeExistingLocations,
    ilGenerationCount,
    openIlGenerationModal,
    closeIlGenerationModal,
    setIlGenerationPrompt,
    setIlGenerationAssignedCityTypeSafe,
    setIlGenerationSessionCityId,
    setIlGenerationDatabaseCityId,
    setIlGenerationLang,
    setIlDedupeExistingLocations,
    setIlGenerationCount,
    generateInteractiveLocationsFromPrompt,
    setIlView,
    setCurrentIl,
    setIlActiveLocale,

    setCurrentAttractionInfo,
    setAttractionInfoActiveLocale,
    openAttractionInfoDetail,
    addAttractionInfo,
    updateCurrentAttractionInfoPatch,
    updateAttractionInfoLocaleField,
    saveCurrentAttractionInfo,
    deleteCurrentAttractionInfo,
    deleteAttractionInfosByIds,
    importAttractionInfoFromText,

    setCurrentAttractionFeedItem,
    setAttractionFeedActiveLocale,

    openAttractionFeedItemDetail,
    addAttractionFeedItem,
    addAttractionFeedBlock,
    reorderAttractionFeedItems,
    deleteAttractionFeedItemsByIds,
    updateCurrentAttractionFeedItemPatch,
    updateAttractionFeedLocaleField,
    saveCurrentAttractionFeedItem,
    deleteCurrentAttractionFeedItem,
    handleAttractionFeedPhotoFile,

    setCurrentAttractionAudioGuide,
    setAttractionAudioGuideActiveLocale,
    addAttractionAudioGuide,
    openAttractionAudioGuideDetail,
    updateCurrentAttractionAudioGuidePatch,
    updateAttractionAudioGuideLocaleField,
    updateAttractionAudioGuidePlanPoint,
    addAttractionAudioGuidePlanPoint,
    removeAttractionAudioGuidePlanPoint,
    updateAttractionAudioGuidePlanItemText,
    importAttractionAudioGuidePlanFromText,
    saveCurrentAttractionAudioGuide,
    deleteCurrentAttractionAudioGuide,
    uploadAttractionAudioGuideTrack,
    removeAttractionAudioGuideTrack,
    generateAttractionAudioGuidePlan,
    openAttractionAudioGuidePlanGenerateModal,
    closeAttractionAudioGuidePlanGenerateModal,
    setAudioGuidePlanGeneratePrompt,
    audioGuidePlanGenerateModalOpen,
    audioGuidePlanGeneratePrompt,
    audioGuidePlanGenerationError,
    audioGuidePlanGenerationState,
    setAttractionAudioGuidePlanItemsCount,
    generateAttractionAudioGuideMainText,
    openAttractionAudioGuideMainTextGenerateModal,
    closeAttractionAudioGuideMainTextGenerateModal,
    setAudioGuideMainTextGeneratePrompt,
    generateAttractionAudioGuideMainTextItem,
    openAttractionAudioGuideMainTextItemGenerateModal,
    closeAttractionAudioGuideMainTextItemGenerateModal,
    setAudioGuideItemTextGeneratePrompt,
    audioGuideItemTextGenerateModalOpen,
    audioGuideItemTextGenerateItemId,
    audioGuideItemTextGenerateItemTitle,
    audioGuideItemTextGeneratePrompt,
    audioGuideItemTextGenerationError,
    generateAttractionAudioGuideTrackAudio,
    regenerateAttractionAudioGuideChapter,
    audioGuideRegeneratingChapterId,
    generateAttractionAudioGuideTtsStress,
    setAttractionAudioGuideStressText,
    audioGuideStressBusyId,
    buildSessionStressDictionary,
    buildingStressDictionary,
    elevenLabsSettingsLoading,
    elevenLabsSettingsError,
    elevenLabsSettings,
    audioGuideTtsVoiceId,
    loadElevenLabsSettings,
    updateAudioGuideTtsVoiceId,

    handleClose,
    handlePublish,
    handleTranslateSession,

    goToStep,
  } = controller;

  // Предупреждение при закрытии вкладки если есть несохранённые изменения
  useEffect(() => {
    const handler = (e) => {
      if (hasUnsavedChangesRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChangesRef]);

  const currentLocale = localeData[activeLocale] || {};

  const openedCityDraftFilter = useMemo(() => {
    const activeCityDraftIdNormalized = normalizeId(activeCityDraftId);

    if (!activeCityDraftIdNormalized || activeCityDraftIdNormalized === 'legacy') {
      return { activeCityDraftId: '', activeDatabaseCityId: '' };
    }

    const activeDraft = (cityDrafts || []).find(
      (draft) => normalizeId(draft.id) === activeCityDraftIdNormalized
    );

    return {
      activeCityDraftId: activeCityDraftIdNormalized,
      activeDatabaseCityId: normalizeId(activeDraft?.city_id ?? activeDraft?.city),
    };
  }, [activeCityDraftId, cityDrafts]);

  const { activeCityDraftId: scopedCityDraftId, activeDatabaseCityId: scopedDatabaseCityId } =
    openedCityDraftFilter;

  const visibleCityInfos = useMemo(
    () => filterCityInfosForActiveDraft(cityInfos, openedCityDraftFilter),
    [cityInfos, openedCityDraftFilter]
  );

  useEffect(() => {
    if (!scopedCityDraftId && !scopedDatabaseCityId) return;

    if (
      currentCityInfo &&
      !itemBelongsToActiveCityDraft(currentCityInfo, openedCityDraftFilter)
    ) {
      setCurrentCityInfo(null);
    }
  }, [
    scopedCityDraftId,
    scopedDatabaseCityId,
    openedCityDraftFilter,
    currentCityInfo,
    setCurrentCityInfo,
  ]);

  const openedAttractionFilter = useMemo(() => {
    if (attrView !== 'detail' || !currentAttr) {
      return { activeAttractionId: '', activeEventId: '' };
    }

    return {
      activeAttractionId: normalizeId(currentAttr.id),
      activeEventId: normalizeId(
        currentAttr.event_id ??
          currentAttr.event ??
          currentAttr.source_event_id ??
          currentAttr.sourceEventId
      ),
    };
  }, [attrView, currentAttr]);

  const { activeAttractionId, activeEventId } = openedAttractionFilter;

  const visibleAttractionInfos = useMemo(
    () =>
      filterItemsForActiveAttraction(attractionInfos, openedAttractionFilter),
    [attractionInfos, openedAttractionFilter]
  );

  const visibleAttractionFeedItems = useMemo(
    () =>
      filterItemsForActiveAttraction(attractionFeedItems, openedAttractionFilter),
    [attractionFeedItems, openedAttractionFilter]
  );

  const visibleAttractionAudioGuides = useMemo(
    () =>
      filterItemsForActiveAttraction(
        attractionAudioGuides,
        openedAttractionFilter
      ),
    [attractionAudioGuides, openedAttractionFilter]
  );

  useEffect(() => {
    if (!activeAttractionId && !activeEventId) return;

    if (
      currentAttractionInfo &&
      !itemBelongsToActiveAttraction(currentAttractionInfo, openedAttractionFilter)
    ) {
      setCurrentAttractionInfo(null);
    }

    if (
      currentAttractionFeedItem &&
      !itemBelongsToActiveAttraction(currentAttractionFeedItem, openedAttractionFilter)
    ) {
      setCurrentAttractionFeedItem(null);
    }

    if (
      currentAttractionAudioGuide &&
      !itemBelongsToActiveAttraction(
        currentAttractionAudioGuide,
        openedAttractionFilter
      )
    ) {
      setCurrentAttractionAudioGuide(null);
    }
  }, [
    activeAttractionId,
    activeEventId,
    openedAttractionFilter,
    currentAttractionInfo,
    currentAttractionFeedItem,
    currentAttractionAudioGuide,
    setCurrentAttractionInfo,
    setCurrentAttractionFeedItem,
    setCurrentAttractionAudioGuide,
  ]);

  const [commonsTarget, setCommonsTarget] = useState({
    type: 'city',
    attractionId: null,
    feedItemId: null,
  });
  const commonsAttraction =
    commonsTarget.type === 'attraction' || commonsTarget.type === 'attraction_feed'
      ? attractions.find((attr) => String(attr.id) === String(commonsTarget.attractionId)) ||
        currentAttr
      : null;
  const commonsInteractiveLocation =
    commonsTarget.type === 'interactive_location'
      ? interactiveLocations.find(
          (item) => String(item.id) === String(commonsTarget.interactiveLocationId),
        ) || currentIl
      : null;

  const cityCommonsQuery = normalizeCommonsQuery(localeData[activeLocale]?.name);
  const commonsDefaultQuery = useMemo(() => {
    if (commonsTarget.type === 'attraction' || commonsTarget.type === 'attraction_feed') {
      return normalizeCommonsQuery(getAttrName(commonsAttraction)) || cityCommonsQuery;
    }

    if (commonsTarget.type === 'interactive_location') {
      return normalizeCommonsQuery(getAttrName(commonsInteractiveLocation)) || cityCommonsQuery;
    }

    return cityCommonsQuery;
  }, [
    commonsTarget.type,
    commonsAttraction,
    commonsInteractiveLocation,
    cityCommonsQuery,
  ]);

  const commonsDescription = useMemo(() => {
    if (commonsTarget.type === 'attraction' || commonsTarget.type === 'attraction_feed') {
      return 'Выберите изображение соответствующего события с указанием лицензии и автора';
    }

    if (commonsTarget.type === 'interactive_location') {
      return 'Выберите изображение интерактивной локации с указанием лицензии и автора';
    }

    return 'Выберите изображение города с указанием лицензии и автора';
  }, [commonsTarget.type]);

  const openCityCommonsModal = () => {
    setCommonsTarget({
      type: 'city',
      attractionId: null,
      feedItemId: null,
      interactiveLocationId: null,
    });

    setCommonsModalOpen(true);
  };

  const openAttractionCommonsModal = (attr) => {
    setCommonsTarget({
      type: 'attraction',
      attractionId: attr?.id ?? currentAttr?.id ?? null,
      feedItemId: null,
      interactiveLocationId: null,
    });

    setCommonsModalOpen(true);
  };

  const openInteractiveLocationCommonsModal = (il) => {
    setCommonsTarget({
      type: 'interactive_location',
      attractionId: null,
      interactiveLocationId: il?.id ?? currentIl?.id ?? null,
      feedItemId: null,
    });

    setCommonsModalOpen(true);
  };

  const openAttractionFeedCommonsModal = (item) => {
    setCommonsTarget({
      type: 'attraction_feed',
      attractionId: currentAttr?.id ?? null,
      feedItemId: item?.id ?? currentAttractionFeedItem?.id ?? null,
      interactiveLocationId: null,
    });

    setCommonsModalOpen(true);
  };

  const handleCommonsImageSelected = (image) => {
    const selectedImageId =
      image?.imageId ??
      image?.image_id ??
      image?.image?.id ??
      image?.id ??
      null;

    const localUrl =
      image?.localUrl ||
      image?.local_url ||
      image?.url ||
      image?.image_url ||
      image?.image?.url ||
      '';

    const originalUrl =
      image?.originalUrl ||
      image?.original_url ||
      image?.originalImageUrl ||
      image?.original_image_url ||
      image?.sourceUrl ||
      image?.source_url ||
      image?.image?.original_image_url ||
      image?.image?.source_url ||
      '';

    const copyright =
      image?.copyright ||
      image?.image_copyright ||
      image?.imageCopyright ||
      image?.image?.copyright ||
      '';

    if (commonsTarget.type === 'interactive_location') {
      void (async () => {
        try {
          await persistInteractiveLocationImage?.({
            image_id: selectedImageId,
            image: selectedImageId,
            image_url: localUrl,
            imageUrl: localUrl,
            imagePreview: localUrl,
            image_original_url: originalUrl,
            imageOriginalUrl: originalUrl,
            image_copyright: copyright,
            imageCopyright: copyright,
          });

          setCommonsModalOpen(false);
          showNote?.(
            'Изображение интерактивной локации загружено из Wikimedia Commons',
            'success',
          );
        } catch {
          // persistInteractiveLocationImage already shows an error note
        }
      })();

      return;
    }

    if (commonsTarget.type === 'attraction') {
      void (async () => {
        try {
          await persistAttractionImage?.({
            image_id: selectedImageId,
            image: selectedImageId,
            image_url: localUrl,
            imageUrl: localUrl,
            imagePreview: localUrl,
            image_original_url: originalUrl,
            imageOriginalUrl: originalUrl,
            image_copyright: copyright,
            imageCopyright: copyright,
          });

          setCommonsModalOpen(false);
          showNote?.(
            'Изображение достопримечательности загружено из Wikimedia Commons',
            'success',
          );
        } catch {
          // persistAttractionImage already shows an error note
        }
      })();

      return;
    }

    if (commonsTarget.type === 'attraction_feed') {
      const targetFeedItemId =
        commonsTarget.feedItemId ?? currentAttractionFeedItem?.id ?? null;

      if (!targetFeedItemId) {
        setCommonsModalOpen(false);
        showNote?.('Не удалось определить элемент ленты для изображения', 'error');
        return;
      }

      updateCurrentAttractionFeedItemPatch?.({
        item_type: 'image',

        image_id: selectedImageId,
        image: selectedImageId,

        image_url: localUrl,
        imageUrl: localUrl,
        imagePreview: localUrl,

        image_original_url: originalUrl,
        imageOriginalUrl: originalUrl,

        image_copyright: copyright,
        imageCopyright: copyright,

        text: {},
      });

      setCommonsModalOpen(false);
      showNote?.('Изображение ленты загружено из Wikimedia Commons', 'success');
      return;
    }

    handleCommonsImageSelect(image);
    setCommonsModalOpen(false);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-24">
          <div className="flex items-center gap-3 text-gray-500">
            <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
            <span>Загрузка сессии...</span>
          </div>
        </div>
      </Layout>
    );
  }

  if (!session) {
    return (
      <Layout>
        <div className="text-center py-24 text-red-600">Сессия не найдена</div>
      </Layout>
    );
  }

  return (
    <Layout>
      {confirmModal}

      <ToastComp note={note} />

      <ProgressBanner
        show={saving || publishing || closing || photoUploading || translating || preparingPublishStep}
        message={[
          saving && 'Сохраняем данные города...',
          preparingPublishStep && 'Обновляем данные перед публикацией...',
          publishing && 'Публикуем сессию...',
          closing && 'Закрываем сессию...',
          photoUploading && 'Загружаем изображение...',
          translating && 'Переводим сессию на другие языки...',
        ]
          .filter(Boolean)
          .join(' ')}
      />

      <div className="flex items-center justify-between gap-4 mb-5 pb-4 border-b border-gray-200">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              if (hasUnsavedChangesRef.current) {
                if (!window.confirm('Есть несохранённые изменения. Покинуть страницу?')) return;
              }
              navigate('/generation');
            }}
            title="Вернуться к списку сессий"
            className="shrink-0 p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-gray-900 truncate">
                {session.name || 'Сессия генерации контента'}
              </h1>
              <StatusBadge status={session.status} label={session.status_display} />
            </div>

            {session.created_at && (
              <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                <span>
                  {new Date(session.created_at).toLocaleString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <button
                  type="button"
                  title="Скопировать UID"
                  onClick={() => navigator.clipboard?.writeText(session.uuid || session.session_uuid || session.id)}
                  className="font-mono truncate max-w-[180px] hover:text-gray-600 transition-colors cursor-copy"
                >
                  {(session.uuid || session.session_uuid || String(session.id)).slice(0, 8)}…
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">

          {/* Индикатор авто-сохранения */}
          {currentStep === 1 && (autoSaving || autoSaved) && (
            <div className={`flex items-center gap-1.5 text-xs transition-opacity ${autoSaved && !autoSaving ? 'text-emerald-600' : 'text-gray-400'}`}>
              {autoSaving ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                  <span>Сохранение...</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Сохранено</span>
                </>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              if (currentStep === 1) {
                void (async () => {
                  await saveCityForStep1?.();

                  if (currentCityInfo) {
                    await saveCurrentCityInfo?.();
                  }
                })().catch((err) => {
                  showNote('Ошибка сохранения шага 1: ' + (err?.message || 'Неизвестная ошибка'), 'error');
                });

                return;
              }

              if (currentStep === 2) {
                return;
              }

              if (currentStep === 3) {
                void (async () => {
                  if (currentAttr) {
                    await saveCurrentAttrIfDirty?.();
                    return;
                  }

                  if (currentAttractionInfo) {
                    await saveCurrentAttractionInfo?.();
                    return;
                  }

                  if (currentAttractionFeedItem) {
                    await saveCurrentAttractionFeedItem?.();
                    return;
                  }

                  if (currentAttractionAudioGuide) {
                    await saveCurrentAttractionAudioGuide?.();
                  }
                })().catch((err) => {
                  showNote('Ошибка сохранения: ' + (err?.message || 'Неизвестная ошибка'), 'error');
                });

                return;
              }

              if (currentStep === 4) {
                if (currentIl) {
                  void saveCurrentIlIfDirty?.().catch((err) => {
                    showNote('Ошибка сохранения локации: ' + (err?.message || 'Неизвестная ошибка'), 'error');
                  });
                }
                return;
              }

              if (currentStep === 5) {
                return;
              }
            }}
            disabled={
              currentStep === 2 || currentStep === 5 ||
              saving ||
              cityInfoSaving ||
              attrSaving ||
              ilSaving ||
              attractionInfoSaving ||
              attractionFeedSaving ||
              attractionAudioGuideSaving
            }
            style={currentStep === 2 || currentStep === 5 ? { visibility: 'hidden' } : undefined}
            title={currentStep === 2 || currentStep === 5 ? '' : 'Сохранить текущие данные'}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ||
            cityInfoSaving ||
            attrSaving ||
            ilSaving ||
            attractionInfoSaving ||
            attractionFeedSaving ||
            attractionAudioGuideSaving
              ? 'Сохранение...'
              : 'Сохранить'}
          </button>
        </div>
      </div>

      <main className="min-w-0 w-full">
        <div className="mb-5">
          <div className="relative h-1.5 bg-gray-200 rounded-full mb-3">
            <div
              className="absolute inset-y-0 left-0 bg-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep - 1) / (STEP_LABELS.length - 1)) * 100}%` }}
            />
          </div>

          <div className="flex">
            {STEP_LABELS.map((label, index) => {
              const step = index + 1;
              const isCompleted = step < currentStep;
              const isActive = step === currentStep;

              return (
                <button
                  key={step}
                  type="button"
                  onClick={() => goToStep(step)}
                  className={`flex-1 text-xs py-1 px-1 text-center transition-colors border-b-2 ${
                    isActive
                      ? 'border-blue-600 text-blue-700 font-semibold'
                      : isCompleted
                        ? 'border-blue-300 text-blue-500 hover:text-blue-700 cursor-pointer'
                        : 'border-transparent text-gray-400 hover:text-gray-600 cursor-pointer'
                  }`}
                >
                  {step}. {label}
                </button>
              );
            })}
          </div>
        </div>

        {currentStep === 1 && (
          <div className="space-y-6">
            <SessionWizardGenerateCityFull
              sessionId={sessionId}
              defaultLang={defaultLocale || 'ru'}
              onDone={() => controller.loadSession(activeCityDraftId)}
            />

            <SessionWizardCityStep
              cityDrafts={cityDrafts}
              activeCityDraftId={activeCityDraftId}
              localeData={localeData}
              activeLocale={activeLocale}
              defaultLocale={defaultLocale}
              currentLocale={currentLocale}
              lat={lat}
              lon={lon}
              savedLat={savedLat}
              savedLon={savedLon}
              imagePreview={imagePreview}
              photoUploading={photoUploading}
              imageOriginalUrl={imageOriginalUrl}
              imageCopyright={imageCopyright}
              setMapContainerRef={setMapContainerRef}
              photoFileRef={photoFileRef}
              onOpenCommonsModal={openCityCommonsModal}
              onPhotoFileChange={handlePhotoFile}
              onPhotoDelete={handlePhotoDelete}
              onImageOriginalUrlChange={setImageOriginalUrl}
              onImageCopyrightChange={setImageCopyright}
              onCreateDraft={handleCreateDraft}
              onSelectDraft={handleSelectDraft}
              onDeleteDraft={handleDeleteDraft}
              onSwitchLocale={switchLocale}
              onSetDefaultLocale={setDefaultLocale}
              onAddLocale={() => setAddLocaleOpen(true)}
              onRemoveLocale={removeLocale}
              onUpdateLocaleField={updateLocaleField}
              onLatChange={controller.setLat}
              onLonChange={controller.setLon}
              onRestoreSavedCoords={() => {
                if (savedLat != null && savedLon != null) {
                  controller.setLat(String(savedLat));
                  controller.setLon(String(savedLon));
                }
              }}
              onGoToStep={goToStep}
              saving={saving}
            />

            <div className="pt-5 border-t border-gray-200">
              <SessionWizardCityTagsPicker
                cityTags={cityTags}
                cityTagCatalog={cityTagCatalog}
                cityTagCatalogLoading={cityTagCatalogLoading}
                cityTagCatalogError={cityTagCatalogError}
                onReloadCityTagCatalog={loadCityTagCatalog}
                cityFilterTree={cityFilterTree}
                cityFilterTreeLoading={cityFilterTreeLoading}
                cityFilterTreeError={cityFilterTreeError}
                onReloadCityFilters={loadCityFilterTree}
                onToggleCityTag={toggleCityTag}
              />
            </div>

            <div className="pt-5 border-t border-gray-200">
              <SessionWizardCityInfoStep
                embedded
                scopedToCityDraftId={scopedCityDraftId || scopedDatabaseCityId || ''}
                cityInfos={visibleCityInfos}
                currentCityInfo={currentCityInfo}
                cityInfoLocaleData={cityInfoLocaleData}
                cityInfoActiveLocale={cityInfoActiveLocale}
                cityInfoSaving={cityInfoSaving}
                cityInfoAutoSaving={cityInfoAutoSaving}
                cityInfoAutoSaved={cityInfoAutoSaved}
                referenceCities={referenceCities || []}
                cityDrafts={cityDrafts || []}
                onOpenCityInfoDetail={openCityInfoDetail}
                onAddCityInfo={addCityInfo}
                onSetCurrentCityInfo={setCurrentCityInfo}
                onSetCityInfoActiveLocale={setCityInfoActiveLocale}
                onUpdateCityInfoLocaleField={updateCityInfoLocaleField}
                onUpdateCurrentCityInfoPatch={updateCurrentCityInfoPatch}
                onSaveCurrentCityInfo={saveCurrentCityInfo}
                onDeleteCurrentCityInfo={deleteCurrentCityInfo}
                onImportCityInfoFromText={importCityInfoFromText}
                onGoToStep={goToStep}
                cityInfoGenerateModalOpen={cityInfoGenerateModalOpen}
                cityInfoGeneratePrompt={cityInfoGeneratePrompt}
                cityInfoGenerateCount={cityInfoGenerateCount}
                cityInfoDedupeExistingItems={cityInfoDedupeExistingItems}
                onCityInfoDedupeExistingItemsChange={setCityInfoDedupeExistingItems}
                cityInfoGenerating={cityInfoGenerating}
                cityInfoGenerationError={cityInfoGenerationError}
                cityInfoGenerationTaskId={cityInfoGenerationTaskId}
                cityInfoGenerationLang={cityInfoGenerationLang}
                onOpenCityInfoGenerateModal={openCityInfoGenerateModal}
                onCloseCityInfoGenerateModal={closeCityInfoGenerateModal}
                onCityInfoGeneratePromptChange={setCityInfoGeneratePrompt}
                onCityInfoGenerateCountChange={setCityInfoGenerateCount}
                onCityInfoGenerationLangChange={setCityInfoGenerationLang}
                onGenerateCityInfoFromPrompt={generateCityInfoFromPrompt}
                aiGenerationMode={aiGenerationMode}
                aiUseWebSearch={aiUseWebSearch}
                aiAdvancedGenerationAvailable={aiAdvancedGenerationAvailable}
                onAiGenerationModeChange={setAiGenerationMode}
                onAiUseWebSearchChange={setAiUseWebSearch}
              />
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <SessionWizardTagsCatalogStep
            cityTagCatalog={cityTagCatalog}
            cityTagCatalogLoading={cityTagCatalogLoading}
            cityTagCatalogError={cityTagCatalogError}
            onReloadCityTagCatalog={loadCityTagCatalog}
            saving={saving}
            onCreateCityTag={createCityTag}
            onUpdateCityFilter={updateCityFilter}
            onDeleteCityFilter={deleteCityFilter}
            onBulkDeleteCityTags={bulkDeleteCityTags}
            onBulkDeleteEventTags={bulkDeleteEventTags}
            onTranslateSelectedTags={translateSelectedTags}
            onUploadCityFilterImage={uploadCityFilterImage}
            deletingCityFilterIds={deletingCityFilterIds}
            eventFilterTree={eventFilterTree}
            eventFilterTreeLoading={eventFilterTreeLoading}
            eventFilterTreeError={eventFilterTreeError}
            onReloadEventFilters={loadEventFilterTree}
            onCreateEventFilterFolder={createEventFilterFolder}
            onCreateEventFilterTag={createEventFilterTag}
            onUpdateEventFilter={updateEventFilter}
            onDeleteEventFilter={deleteEventFilter}
            onUploadEventFilterImage={uploadEventFilterImage}
            deletingEventFilterIds={deletingEventFilterIds}
            onGoToStep={goToStep}
          />
        )}

        {currentStep === 3 && (
          <div className="space-y-6">
            <SessionWizardAttractionsStep
              attrView={attrView}
              currentAttr={currentAttr}
              attrActiveLocale={attrActiveLocale}
              attrLocaleData={attrLocaleData}
              attrSaving={attrSaving}
              attrAutoSaving={attrAutoSaving}
              attrAutoSaved={attrAutoSaved}
              attractions={attractions}
              activeCityDraftId={activeCityDraftId}
              localeData={localeData}
              activeLocale={activeLocale}
              referenceCities={referenceCities || []}
              cityDrafts={cityDrafts || []}
              onUpdateCurrentAttrPatch={updateCurrentAttrPatch}
              onRegenerateAttractionDetail={async (attrId, locale) => {
                await aiAPI.regenerateAttractionDetail(sessionId, attrId, {
                  lang: locale || activeLocale || 'ru',
                });
                await controller.loadSession(activeCityDraftId);
              }}
              onOpenAttrDetail={openAttrDetail}
              onOpenAttractionCommonsModal={openAttractionCommonsModal}
              onAttractionPhotoFileChange={handleAttractionPhotoFile}
              onAddAttraction={addAttraction}
              onImportAttractionsFromText={importAttractionsFromText}
              attractionGenerationOpen={attractionGenerationOpen}
              attractionGenerationProgress={attractionGenerationProgress}
              attractionGenerationPrompt={attractionGenerationPrompt}
              attractionGenerating={attractionGenerating}
              attractionGenerationTaskId={attractionGenerationTaskId}
              attractionGenerationError={attractionGenerationError}
              attractionGenerationAssignedCityType={attractionGenerationAssignedCityType}
              attractionGenerationSessionCityId={attractionGenerationSessionCityId}
              attractionGenerationDatabaseCityId={attractionGenerationDatabaseCityId}
              attractionGenerationLang={attractionGenerationLang}
              attractionGenerationCount={attractionGenerationCount}
              onAttractionGenerationCountChange={setAttractionGenerationCount}
              attractionDedupeExistingItems={attractionDedupeExistingItems}
              onAttractionDedupeExistingItemsChange={setAttractionDedupeExistingItems}
              onOpenAttractionGenerationModal={openAttractionGenerationModal}
              onCloseAttractionGenerationModal={closeAttractionGenerationModal}
              onAttractionGenerationPromptChange={setAttractionGenerationPrompt}
              onAttractionGenerationAssignedCityTypeChange={
                setAttractionGenerationAssignedCityTypeSafe
              }
              onAttractionGenerationSessionCityIdChange={setAttractionGenerationSessionCityId}
              onAttractionGenerationDatabaseCityIdChange={setAttractionGenerationDatabaseCityId}
              onAttractionGenerationLangChange={setAttractionGenerationLang}
              onGenerateAttractionsFromPrompt={generateAttractionsFromPrompt}
              onOpenAttractionInfoGenerateModal={handleOpenAttractionInfoGenerateModal}
              aiGenerationMode={aiGenerationMode}
              aiUseWebSearch={aiUseWebSearch}
              aiAdvancedGenerationAvailable={aiAdvancedGenerationAvailable}
              onAiGenerationModeChange={setAiGenerationMode}
              onAiUseWebSearchChange={setAiUseWebSearch}
              onDeleteCurrentAttr={deleteCurrentAttr}
              onDeleteAttractionsByIds={deleteAttractionsByIds}
              onSetAttrView={setAttrView}
              onSetCurrentAttr={setCurrentAttr}
              onSetAttrActiveLocale={setAttrActiveLocale}
              onUpdateAttrLocaleField={updateAttrLocaleField}
              onSaveCurrentAttr={saveCurrentAttr}
              onGoToStep={goToStep}
              eventFilterTree={eventFilterTree}
              eventFilterTreeLoading={eventFilterTreeLoading}
              eventFilterTreeError={eventFilterTreeError}
              onReloadEventFilters={loadEventFilterTree}
              onToggleCurrentAttractionTag={toggleCurrentAttractionTag}
            />

            <div className="pt-5 border-t border-gray-200">
              <SessionWizardAttractionInfoStep
                embedded
                scopedToAttractionId={activeAttractionId || activeEventId || ''}
                attractionInfos={visibleAttractionInfos}
                currentAttractionInfo={currentAttractionInfo}
                attractionInfoLocaleData={attractionInfoLocaleData}
                attractionInfoActiveLocale={attractionInfoActiveLocale}
                attractionInfoSaving={attractionInfoSaving}
                referenceAttractions={referenceAttractions || []}
                attractions={attractions || []}
                onOpenAttractionInfoDetail={openAttractionInfoDetail}
                onAddAttractionInfo={addAttractionInfo}
                onSetCurrentAttractionInfo={setCurrentAttractionInfo}
                onSetAttractionInfoActiveLocale={setAttractionInfoActiveLocale}
                onUpdateAttractionInfoLocaleField={updateAttractionInfoLocaleField}
                onUpdateCurrentAttractionInfoPatch={updateCurrentAttractionInfoPatch}
                onSaveCurrentAttractionInfo={saveCurrentAttractionInfo}
                onDeleteCurrentAttractionInfo={deleteCurrentAttractionInfo}
                onDeleteAttractionInfosByIds={deleteAttractionInfosByIds}
                onImportAttractionInfoFromText={importAttractionInfoFromText}
                onGoToStep={goToStep}
                attractionInfoGenerateModalOpen={attractionInfoGenerateModalOpen}
                attractionInfoGeneratePrompt={attractionInfoGeneratePrompt}
                attractionInfoGenerateCount={attractionInfoGenerateCount}
                attractionInfoDedupeExistingItems={attractionInfoDedupeExistingItems}
                onAttractionInfoDedupeExistingItemsChange={setAttractionInfoDedupeExistingItems}
                attractionInfoGenerating={attractionInfoGenerating}
                attractionInfoGenerationError={attractionInfoGenerationError}
                attractionInfoGenerationLang={attractionInfoGenerationLang}
                attractionInfoGenerationTargetId={attractionInfoGenerationTargetId}
                onOpenAttractionInfoGenerateModal={handleOpenAttractionInfoGenerateModal}
                onCloseAttractionInfoGenerateModal={closeAttractionInfoGenerateModal}
                onAttractionInfoGeneratePromptChange={setAttractionInfoGeneratePrompt}
                onAttractionInfoGenerateCountChange={setAttractionInfoGenerateCount}
                onAttractionInfoGenerationLangChange={setAttractionInfoGenerationLang}
                onAttractionInfoGenerationTargetIdChange={setAttractionInfoGenerationTargetId}
                onGenerateAttractionInfoFromPrompt={generateAttractionInfoFromPrompt}
                aiGenerationMode={aiGenerationMode}
                aiUseWebSearch={aiUseWebSearch}
                aiAdvancedGenerationAvailable={aiAdvancedGenerationAvailable}
                onAiGenerationModeChange={setAiGenerationMode}
                onAiUseWebSearchChange={setAiUseWebSearch}
              />
            </div>

            <div className="pt-5 border-t border-gray-200">
              <SessionWizardAttractionFeedStep
                embedded
                scopedToAttractionId={activeAttractionId || activeEventId || ''}
                attractionFeedItems={visibleAttractionFeedItems}
                currentAttractionFeedItem={currentAttractionFeedItem}
                attractionFeedLocaleData={attractionFeedLocaleData}
                attractionFeedActiveLocale={attractionFeedActiveLocale}
                attractionFeedSaving={attractionFeedSaving}
                attractionFeedAutoSaving={attractionFeedAutoSaving}
                attractionFeedAutoSaved={attractionFeedAutoSaved}
                attractionFeedPhotoUploading={attractionFeedPhotoUploading}
                attractionFeedPhotoFileRef={attractionFeedPhotoFileRef}
                referenceAttractions={referenceAttractions || []}
                attractions={attractions || []}
                onOpenAttractionFeedItemDetail={openAttractionFeedItemDetail}
                onOpenAttractionFeedCommonsModal={openAttractionFeedCommonsModal}
                onAddAttractionFeedItem={addAttractionFeedItem}
                onAddAttractionFeedBlock={addAttractionFeedBlock}
                onReorderAttractionFeedItems={reorderAttractionFeedItems}
                onDeleteAttractionFeedItemsByIds={deleteAttractionFeedItemsByIds}
                onSetCurrentAttractionFeedItem={setCurrentAttractionFeedItem}
                onSetAttractionFeedActiveLocale={setAttractionFeedActiveLocale}
                onUpdateAttractionFeedLocaleField={updateAttractionFeedLocaleField}
                onUpdateCurrentAttractionFeedItemPatch={updateCurrentAttractionFeedItemPatch}
                onSaveCurrentAttractionFeedItem={saveCurrentAttractionFeedItem}
                onDeleteCurrentAttractionFeedItem={deleteCurrentAttractionFeedItem}
                onAttractionFeedPhotoFileChange={handleAttractionFeedPhotoFile}
                onGoToStep={goToStep}
              />
            </div>

            <div className="pt-5 border-t border-gray-200">
              <SessionWizardAttractionAudioGuidesBlock
                embedded
                scopedToAttractionId={activeAttractionId || activeEventId || ''}
                attractionAudioGuides={visibleAttractionAudioGuides}
                currentAttractionAudioGuide={currentAttractionAudioGuide}
                attractionAudioGuideLocaleData={attractionAudioGuideLocaleData}
                attractionAudioGuideActiveLocale={attractionAudioGuideActiveLocale}
                attractionAudioGuideSaving={attractionAudioGuideSaving}
                attractionAudioGuideAutoSaving={attractionAudioGuideAutoSaving}
                attractionAudioGuideAutoSaved={attractionAudioGuideAutoSaved}
                attractionAudioUploading={attractionAudioUploading}
                audioGuideGeneratingPlan={audioGuideGeneratingPlan}
                audioGuidePlanGenerateModalOpen={audioGuidePlanGenerateModalOpen}
                audioGuidePlanGeneratePrompt={audioGuidePlanGeneratePrompt}
                audioGuidePlanGenerationError={audioGuidePlanGenerationError}
                audioGuideGeneratingAllMainText={audioGuideGeneratingAllMainText}
                audioGuideMainTextGenerateModalOpen={audioGuideMainTextGenerateModalOpen}
                audioGuideMainTextGeneratePrompt={audioGuideMainTextGeneratePrompt}
                audioGuideMainTextGenerationError={audioGuideMainTextGenerationError}
                audioGuideGeneratingItemTextById={audioGuideGeneratingItemTextById}
                generatingAudioGuideTrack={generatingAudioGuideTrack}
                audioGuideTrackGenerationError={audioGuideTrackGenerationError}
                audioGuidePlanGenerationState={audioGuidePlanGenerationState}
                referenceAttractions={referenceAttractions || []}
                attractions={attractions || []}
                onOpenAttractionAudioGuideDetail={openAttractionAudioGuideDetail}
                onAddAttractionAudioGuide={addAttractionAudioGuide}
                onSetCurrentAttractionAudioGuide={setCurrentAttractionAudioGuide}
                onSetAttractionAudioGuideActiveLocale={setAttractionAudioGuideActiveLocale}
                onUpdateAttractionAudioGuideLocaleField={updateAttractionAudioGuideLocaleField}
                onUpdateCurrentAttractionAudioGuidePatch={updateCurrentAttractionAudioGuidePatch}
                onUpdateAttractionAudioGuidePlanPoint={updateAttractionAudioGuidePlanPoint}
                onAddAttractionAudioGuidePlanPoint={addAttractionAudioGuidePlanPoint}
                onRemoveAttractionAudioGuidePlanPoint={removeAttractionAudioGuidePlanPoint}
                onUpdateAttractionAudioGuidePlanItemText={updateAttractionAudioGuidePlanItemText}
                onImportAttractionAudioGuidePlanFromText={importAttractionAudioGuidePlanFromText}
                onShowNote={showNote}
                onSaveCurrentAttractionAudioGuide={saveCurrentAttractionAudioGuide}
                onDeleteCurrentAttractionAudioGuide={deleteCurrentAttractionAudioGuide}
                onUploadAttractionAudioGuideTrack={uploadAttractionAudioGuideTrack}
                onRemoveAttractionAudioGuideTrack={removeAttractionAudioGuideTrack}
                onGenerateAttractionAudioGuidePlan={generateAttractionAudioGuidePlan}
                onOpenAttractionAudioGuidePlanGenerateModal={
                  openAttractionAudioGuidePlanGenerateModal
                }
                onCloseAttractionAudioGuidePlanGenerateModal={
                  closeAttractionAudioGuidePlanGenerateModal
                }
                onSetAudioGuidePlanGeneratePrompt={setAudioGuidePlanGeneratePrompt}
                onSetAttractionAudioGuidePlanItemsCount={
                  setAttractionAudioGuidePlanItemsCount
                }
                onOpenAttractionAudioGuideMainTextGenerateModal={
                  openAttractionAudioGuideMainTextGenerateModal
                }
                onCloseAttractionAudioGuideMainTextGenerateModal={
                  closeAttractionAudioGuideMainTextGenerateModal
                }
                onSetAudioGuideMainTextGeneratePrompt={setAudioGuideMainTextGeneratePrompt}
                onGenerateAttractionAudioGuideMainText={generateAttractionAudioGuideMainText}
                onGenerateAttractionAudioGuideMainTextItem={
                  generateAttractionAudioGuideMainTextItem
                }
                onOpenAttractionAudioGuideMainTextItemGenerateModal={
                  openAttractionAudioGuideMainTextItemGenerateModal
                }
                onCloseAttractionAudioGuideMainTextItemGenerateModal={
                  closeAttractionAudioGuideMainTextItemGenerateModal
                }
                onSetAudioGuideItemTextGeneratePrompt={setAudioGuideItemTextGeneratePrompt}
                audioGuideItemTextGenerateModalOpen={audioGuideItemTextGenerateModalOpen}
                audioGuideItemTextGenerateItemId={audioGuideItemTextGenerateItemId}
                audioGuideItemTextGenerateItemTitle={audioGuideItemTextGenerateItemTitle}
                audioGuideItemTextGeneratePrompt={audioGuideItemTextGeneratePrompt}
                audioGuideItemTextGenerationError={audioGuideItemTextGenerationError}
                aiGenerationMode={aiGenerationMode}
                aiUseWebSearch={aiUseWebSearch}
                aiAdvancedGenerationAvailable={aiAdvancedGenerationAvailable}
                onAiGenerationModeChange={setAiGenerationMode}
                onAiUseWebSearchChange={setAiUseWebSearch}
                onGenerateAttractionAudioGuideTrackAudio={
                  generateAttractionAudioGuideTrackAudio
                }
                onRegenerateAttractionAudioGuideChapter={
                  regenerateAttractionAudioGuideChapter
                }
                audioGuideRegeneratingChapterId={audioGuideRegeneratingChapterId}
                onGenerateAttractionAudioGuideTtsStress={
                  generateAttractionAudioGuideTtsStress
                }
                onSetAttractionAudioGuideStressText={
                  setAttractionAudioGuideStressText
                }
                audioGuideStressBusyId={audioGuideStressBusyId}
                onBuildSessionStressDictionary={buildSessionStressDictionary}
                buildingStressDictionary={buildingStressDictionary}
                elevenLabsSettingsLoading={elevenLabsSettingsLoading}
                elevenLabsSettingsError={elevenLabsSettingsError}
                elevenLabsSettings={elevenLabsSettings}
                audioGuideTtsVoiceId={audioGuideTtsVoiceId}
                onLoadElevenLabsSettings={loadElevenLabsSettings}
                onSetAudioGuideTtsVoiceId={updateAudioGuideTtsVoiceId}
                onGoToStep={goToStep}
              />
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <SessionWizardInteractiveLocationsStep
            ilView={ilView}
            interactiveLocations={interactiveLocations}
            currentIl={currentIl}
            ilActiveLocale={ilActiveLocale}
            ilLocaleData={ilLocaleData}
            ilSaving={ilSaving}
            ilAutoSaving={ilAutoSaving}
            ilAutoSaved={ilAutoSaved}
            referenceCities={referenceCities || []}
            cityDrafts={cityDrafts || []}
            eventFilterTree={eventFilterTree}
            eventFilterTreeLoading={eventFilterTreeLoading}
            eventFilterTreeError={eventFilterTreeError}
            photoUploading={ilPhotoUploading}
            photoFileRef={ilPhotoFileRef}
            iconUploading={ilIconUploading}
            iconFileRef={ilIconFileRef}
            onIconFileChange={handleIlIconFile}
            onOpenIlDetail={openIlDetail}
            onAddInteractiveLocation={addInteractiveLocation}
            onDeleteCurrentIl={deleteCurrentIl}
            onLeaveIlDetailView={leaveIlDetailView}
            onSetIlView={setIlView}
            onSetCurrentIl={setCurrentIl}
            onSetIlActiveLocale={setIlActiveLocale}
            onUpdateIlLocaleField={updateIlLocaleField}
            onSaveCurrentIl={saveCurrentIl}
            onUpdateCurrentIlPatch={updateCurrentIlPatch}
            onToggleCurrentIlTag={toggleCurrentIlTag}
            onReloadEventFilters={loadEventFilterTree}
            onOpenCommonsModal={openInteractiveLocationCommonsModal}
            onPhotoFileChange={handleIlPhotoFile}
            ilGenerationOpen={ilGenerationOpen}
            ilGenerationProgress={ilGenerationProgress}
            ilGenerationPrompt={ilGenerationPrompt}
            ilGenerating={ilGenerating}
            ilGenerationTaskId={ilGenerationTaskId}
            ilGenerationError={ilGenerationError}
            ilGenerationAssignedCityType={ilGenerationAssignedCityType}
            ilGenerationSessionCityId={ilGenerationSessionCityId}
            ilGenerationDatabaseCityId={ilGenerationDatabaseCityId}
            ilGenerationLang={ilGenerationLang}
            ilDedupeExistingLocations={ilDedupeExistingLocations}
            ilGenerationCount={ilGenerationCount}
            onIlGenerationCountChange={setIlGenerationCount}
            onIlDedupeExistingLocationsChange={setIlDedupeExistingLocations}
            onOpenIlGenerationModal={openIlGenerationModal}
            onCloseIlGenerationModal={closeIlGenerationModal}
            onIlGenerationPromptChange={setIlGenerationPrompt}
            onIlGenerationAssignedCityTypeChange={setIlGenerationAssignedCityTypeSafe}
            onIlGenerationSessionCityIdChange={setIlGenerationSessionCityId}
            onIlGenerationDatabaseCityIdChange={setIlGenerationDatabaseCityId}
            onIlGenerationLangChange={setIlGenerationLang}
            onGenerateInteractiveLocationsFromPrompt={generateInteractiveLocationsFromPrompt}
            aiGenerationMode={aiGenerationMode}
            aiUseWebSearch={aiUseWebSearch}
            aiAdvancedGenerationAvailable={aiAdvancedGenerationAvailable}
            onAiGenerationModeChange={setAiGenerationMode}
            onAiUseWebSearchChange={setAiUseWebSearch}
            onGoToStep={goToStep}
          />
        )}

        {currentStep === 5 && (
          <SessionWizardPublishStep
            session={session}
            cityDrafts={cityDrafts}
            cityInfos={cityInfos}
            attractions={attractions}
            interactiveLocations={interactiveLocations}
            attractionInfos={attractionInfos}
            attractionFeedItems={attractionFeedItems}
            attractionAudioGuides={attractionAudioGuides}
            cityTags={cityTags}
            translating={translating}
            publishing={publishing}
            components={{ StatusBadge }}
            onGoToStep={goToStep}
            onTranslateSession={handleTranslateSession}
            onPublish={handlePublish}
          />
        )}
      </main>

      {addLocaleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setAddLocaleOpen(false)}
          />

          <div className="relative bg-white rounded-xl shadow-xl p-6 w-80 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">
              Добавить адаптацию
            </h3>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Код страны (2 буквы)
              </label>
              <input
                type="text"
                maxLength={2}
                value={newLocaleCode}
                onChange={(e) => setNewLocaleCode(e.target.value.toUpperCase())}
                placeholder="RU, US, DE..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Название языка
              </label>
              <input
                type="text"
                value={newLocaleLang}
                onChange={(e) => setNewLocaleLang(e.target.value)}
                placeholder="Немецкий, Испанский..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setAddLocaleOpen(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Отмена
              </button>

              <button
                type="button"
                onClick={addLocale}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}

      <SessionCloseDialogComp
        open={closeOpen}
        session={session}
        closeMode={closeMode}
        onCloseModeChange={setCloseMode}
        closing={closing}
        onBackdropClick={() => !closing && setCloseOpen(false)}
        onCancel={() => setCloseOpen(false)}
        onConfirm={handleClose}
      />

      <CommonsImagePicker
        isOpen={commonsModalOpen}
        onClose={() => setCommonsModalOpen(false)}
        onImageSelected={handleCommonsImageSelected}
        getSessionUuid={getSessionUuid}
        defaultQuery={commonsDefaultQuery}
        description={commonsDescription}
      />
    </Layout>
  );
}
