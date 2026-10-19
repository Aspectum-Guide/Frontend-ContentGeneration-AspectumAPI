import 'leaflet/dist/leaflet.css';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import CommonsImagePicker from '../../components/generation/CommonsImagePicker';
import {
  filterCityInfosForActiveDraft,
  filterItemsForActiveAttraction,
  getAttrName,
  itemBelongsToActiveAttraction,
  itemBelongsToActiveCityDraft,
  normalizeId,
} from './session-wizard/sessionWizardShared.jsx';
import { useSessionWizardController } from './session-wizard/useSessionWizardController.ts';
import { aiAPI } from '../../api/generation';
import { FormLabel, Button, ConfirmModal as DefaultConfirmModal, DetailHeader, EmptyState, InlineAction, InlineProgressBanner as DefaultInlineProgressBanner, Modal, SessionStatusBadge as DefaultStatusBadge, Spinner, TextInput, Toast as DefaultToast, WizardStepButton, useConfirmModal } from '@aspectum/admin-ui-web';
import DefaultSessionCloseDialog from '../../components/generation/SessionCloseDialog.jsx';
import { sessionWizardStepLoaders } from './session-wizard/sessionWizardStepLoaders';
import useUnsavedChangesWarning from './session-wizard/useUnsavedChangesWarning';

const SessionWizardAttractionsStep = lazy(sessionWizardStepLoaders.attractions);
const SessionWizardInteractiveLocationsStep = lazy(sessionWizardStepLoaders.interactiveLocations);
const SessionWizardCityStep = lazy(sessionWizardStepLoaders.city);
const SessionWizardGenerateCityFull = lazy(sessionWizardStepLoaders.generateCityFull);
const SessionWizardPublishStep = lazy(sessionWizardStepLoaders.publish);
const SessionWizardTagsCatalogStep = lazy(sessionWizardStepLoaders.tagsCatalog);
const SessionWizardCityTagsPicker = lazy(sessionWizardStepLoaders.cityTags);
const SessionWizardCityInfoStep = lazy(sessionWizardStepLoaders.cityInfo);
const SessionWizardAttractionInfoStep = lazy(sessionWizardStepLoaders.attractionInfo);
const SessionWizardAttractionFeedStep = lazy(sessionWizardStepLoaders.attractionFeed);
const SessionWizardAttractionAudioGuidesBlock = lazy(sessionWizardStepLoaders.attractionAudioGuides);

export function SessionWizardStepFallback() {
  return (
    <EmptyState icon={<Spinner size="md" />} title="Загрузка шага…" />
  );
}

const STEP_LABELS = [
  'Город',
  'Теги',
  'Достопримечательности',
  'Интерактивные локации',
  'Публикация',
];

function isAutoSessionName(value) {
  return /^Сессия от \d{2}\.\d{2}\.\d{4}/.test(String(value || '').trim());
}

function wizardTitle({ session, cityDrafts, activeCityDraftId, localeData, activeLocale, defaultLocale }) {
  const typed = String(localeData?.[defaultLocale]?.name || localeData?.[activeLocale]?.name || '').trim();
  if (typed) return typed;

  const draft = (cityDrafts || []).find((item) => String(item?.id) === String(activeCityDraftId));
  const fromDraft = normalizeCommonsQuery(draft?.display_name || draft?.name);
  if (fromDraft) return fromDraft;

  const fromSession = normalizeCommonsQuery(session?.city_display_name);
  if (fromSession) return fromSession;

  const name = String(session?.name || '').trim();
  if (name && !isAutoSessionName(name)) return name;
  return 'Новый город';
}

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
    parentCityId,
    setParentCityId,
    authorIds,
    setAuthorIds,
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
    batchAudioGenerating,
    batchAudioProgress,
    batchAudioCurrentStep,
    batchAudioResult,

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
    onCityFormBlur,
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
    addCurrentAttractionRelatedEvent,
    removeCurrentAttractionRelatedEvent,

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
    removeIlIcon,
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
    prepareMissingAttractionAudio,
    generateMissingAttractionAudio,
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
    ttsSettingsLoading,
    ttsSettingsError,
    ttsSettings,
    audioGuideTtsProvider,
    audioGuideTtsVoiceId,
    audioGuideTtsModelId,
    loadElevenLabsSettings,
    loadTtsSettings,
    updateAudioGuideTtsProvider,
    updateAudioGuideTtsVoiceId,
    updateAudioGuideTtsModelId,

    handleClose,
    handlePublish,
    handleTranslateSession,

    goToStep,
    navigatingStep,
  } = controller;

  useUnsavedChangesWarning(hasUnsavedChangesRef);

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

  // Контекст для «Библиотеки»: координаты объекта включают гео-источники
  // (pastvu/mapillary/commons-geo), город — Минкульт и точность поиска.
  const commonsCoords = useMemo(() => {
    const src = (commonsTarget.type === 'attraction' || commonsTarget.type === 'attraction_feed')
      ? commonsAttraction
      : commonsTarget.type === 'interactive_location'
        ? commonsInteractiveLocation
        : { lat, lon };
    const la = parseFloat(src?.lat);
    const lo = parseFloat(src?.lon);
    return Number.isFinite(la) && Number.isFinite(lo) ? { lat: la, lon: lo } : null;
  }, [commonsTarget.type, commonsAttraction, commonsInteractiveLocation, lat, lon]);

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
        <EmptyState icon={<Spinner size="md" className="h-6 w-6 border-aspectum-primary" />} title="Загрузка сессии..." className="py-24" />
      </Layout>
    );
  }

  if (!session) {
    return (
      <Layout>
        <EmptyState icon="⚠️" title="Сессия не найдена" tone="danger" className="py-24" />
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

      <DetailHeader
        leading={(
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={async () => {
              if (hasUnsavedChangesRef.current) {
                const confirmed = await confirm({
                  title: 'Покинуть страницу?',
                  message: 'Есть несохранённые изменения. Покинуть страницу?',
                  confirmLabel: 'Покинуть',
                  danger: true,
                });
                if (!confirmed) return;
              }
              navigate('/generation');
            }}
            title="Вернуться к списку сессий"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Button>
        )}
        className="mb-3 pb-3"
        title={wizardTitle({ session, cityDrafts, activeCityDraftId, localeData, activeLocale, defaultLocale })}
        titleAdornment={<StatusBadge status={session.status} label={session.status_display} />}
        metadata={session.created_at ? (
          <>
            <span>
              {new Date(session.created_at).toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <InlineAction
              title="Скопировать UID"
              onClick={() => navigator.clipboard?.writeText(session.uuid || session.session_uuid || session.id)}
              variant="link"
              className="font-mono truncate max-w-[180px] hover:text-aspectum-text-subtle transition-colors cursor-copy"
            >
              {(session.uuid || session.session_uuid || String(session.id)).slice(0, 8)}…
            </InlineAction>
          </>
        ) : null}
        status={currentStep === 1 && (autoSaving || autoSaved) ? (
          <div className={`flex items-center gap-1.5 text-xs transition-opacity ${autoSaved && !autoSaving ? 'text-aspectum-success' : 'text-aspectum-text-disabled'}`}>
            {autoSaving ? (
              <>
                <Spinner size="xs" className="border-2 border-aspectum-border-strong" />
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
        ) : null}
        actions={(
          <div className="flex items-center gap-2">
          {currentStep !== 2 && currentStep !== 5 && (
          <Button
            type="button"
            variant="primary"
            size="md"
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

            }}
            disabled={
              saving ||
              cityInfoSaving ||
              attrSaving ||
              ilSaving ||
              attractionInfoSaving ||
              attractionFeedSaving ||
              attractionAudioGuideSaving
            }
            title="Сохранить текущие данные"
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
          </Button>
          )}
          {!session.closed_with_save && (
            <Button
              type="button"
              variant="outline"
              size="md"
              disabled={publishing}
              onClick={() => { if (!publishing) handlePublish(); }}
            >
              {publishing ? 'Публикация...' : 'Опубликовать'}
            </Button>
          )}
          {(session.status === 'draft' || session.status === 'in_progress') && (
            <Button
              type="button"
              variant="outlineDanger"
              size="md"
              onClick={() => { setCloseMode('save'); setCloseOpen(true); }}
            >
              Закрыть
            </Button>
          )}
          </div>
        )}
      />

      <main className="min-w-0 w-full">
        <div className="mb-4">
          <div className="flex">
            {STEP_LABELS.map((label, index) => {
              const step = index + 1;
              const isCompleted = step < currentStep;
              const isActive = step === currentStep;

              return (
                <WizardStepButton
                  key={step}
                  onClick={() => goToStep(step)}
                  disabled={navigatingStep}
                  step={step} label={label} active={isActive} completed={isCompleted}
                />
              );
            })}
          </div>
        </div>

        <Suspense
          fallback={<SessionWizardStepFallback />}
        >
        {currentStep === 1 && (
          /* onBlur: сейв города при уходе фокуса из формы — вместо таймера
             2.5с, который дёргал сервер и сбрасывал курсор при наборе */
          <div onBlur={onCityFormBlur}>
            <SessionWizardCityStep
              headerEnd={(
                <SessionWizardGenerateCityFull
                  sessionId={sessionId}
                  defaultLang={defaultLocale || 'ru'}
                  onDone={() => controller.loadSession(activeCityDraftId)}
                />
              )}
              cityDrafts={cityDrafts}
              referenceCities={referenceCities || []}
              parentCityId={parentCityId}
              setParentCityId={setParentCityId}
              authorIds={authorIds}
              setAuthorIds={setAuthorIds}
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

            <div className="pt-5 border-t border-aspectum-border">
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

            <div className="pt-5 border-t border-aspectum-border">
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
              sessionId={sessionId}
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
              batchAudioGenerating={batchAudioGenerating}
              batchAudioProgress={batchAudioProgress}
              batchAudioCurrentStep={batchAudioCurrentStep}
              batchAudioResult={batchAudioResult}
              onPrepareMissingAttractionAudio={prepareMissingAttractionAudio}
              onGenerateMissingAttractionAudio={generateMissingAttractionAudio}
              elevenLabsSettingsLoading={elevenLabsSettingsLoading}
              elevenLabsSettingsError={elevenLabsSettingsError}
              elevenLabsSettings={elevenLabsSettings}
              ttsSettingsLoading={ttsSettingsLoading}
              ttsSettingsError={ttsSettingsError}
              ttsSettings={ttsSettings}
              audioGuideTtsProvider={audioGuideTtsProvider}
              audioGuideTtsVoiceId={audioGuideTtsVoiceId}
              audioGuideTtsModelId={audioGuideTtsModelId}
              onLoadTtsSettings={loadTtsSettings}
              onSetAudioGuideTtsProvider={updateAudioGuideTtsProvider}
              onLoadElevenLabsSettings={loadElevenLabsSettings}
              onSetAudioGuideTtsVoiceId={updateAudioGuideTtsVoiceId}
              onSetAudioGuideTtsModelId={updateAudioGuideTtsModelId}
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
              onAddCurrentAttractionRelatedEvent={addCurrentAttractionRelatedEvent}
              onRemoveCurrentAttractionRelatedEvent={removeCurrentAttractionRelatedEvent}
            />

            <div className="pt-5 border-t border-aspectum-border">
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

            <div className="pt-5 border-t border-aspectum-border">
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

            <div className="pt-5 border-t border-aspectum-border">
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
                ttsSettingsLoading={ttsSettingsLoading}
                ttsSettingsError={ttsSettingsError}
                ttsSettings={ttsSettings}
                audioGuideTtsProvider={audioGuideTtsProvider}
                audioGuideTtsVoiceId={audioGuideTtsVoiceId}
                audioGuideTtsModelId={audioGuideTtsModelId}
                onLoadTtsSettings={loadTtsSettings}
                onSetAudioGuideTtsProvider={updateAudioGuideTtsProvider}
                onLoadElevenLabsSettings={loadElevenLabsSettings}
                onSetAudioGuideTtsVoiceId={updateAudioGuideTtsVoiceId}
                onSetAudioGuideTtsModelId={updateAudioGuideTtsModelId}
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
            onRemoveIcon={removeIlIcon}
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
        </Suspense>
      </main>

      <Modal
        open={addLocaleOpen}
        onClose={() => setAddLocaleOpen(false)}
        title="Добавить адаптацию"
        size="sm"
        footer={(
          <>
            <Button type="button" variant="outline" size="md" onClick={() => setAddLocaleOpen(false)}>
              Отмена
            </Button>
            <Button type="button" variant="primary" size="md" onClick={addLocale}>
              Добавить
            </Button>
          </>
        )}
      >
        <div className="space-y-4">
            <div>
              <FormLabel  layout="block" size="sm" tone="subtle" spacing="xs">
                Код страны (2 буквы)
              </FormLabel>
              <TextInput type="text" maxLength={2} value={newLocaleCode} onChange={(e) => setNewLocaleCode(e.target.value.toUpperCase())} placeholder="RU, US, DE..." />
            </div>

            <div>
              <FormLabel  layout="block" size="sm" tone="subtle" spacing="xs">
                Название языка
              </FormLabel>
              <TextInput type="text" value={newLocaleLang} onChange={(e) => setNewLocaleLang(e.target.value)} placeholder="Немецкий, Испанский..." />
            </div>
        </div>
      </Modal>

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
        coords={commonsCoords}
        cityName={cityCommonsQuery || ''}
        countryName={localeData[activeLocale]?.country || ''}
      />
    </Layout>
  );
}
