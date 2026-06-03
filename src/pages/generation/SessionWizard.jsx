import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import CommonsImagePicker from '../../components/generation/CommonsImagePicker';
import SessionWizardAttractionsStep from './session-wizard/SessionWizardAttractionsStep';
import SessionWizardInteractiveLocationsStep from './session-wizard/SessionWizardInteractiveLocationsStep';
import SessionWizardCityStep from './session-wizard/SessionWizardCityStep';
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
import { useSessionWizardController } from './session-wizard/useSessionWizardController';
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
    cityInfoGenerateModalOpen,
    cityInfoGeneratePrompt,
    cityInfoGenerateCount,
    cityInfoGenerating,
    cityInfoGenerationError,
    cityInfoGenerationTaskId,
    cityInfoGenerationLang,
    attractions,
    interactiveLocations,
    ilView,
    currentIl,
    ilLocaleData,
    ilActiveLocale,
    ilSaving,
    ilPhotoUploading,
    ilPhotoFileRef,
    attrView,
    currentAttr,
    attrLocaleData,
    attrActiveLocale,
    attrSaving,

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
    attractionFeedPhotoUploading,
    attractionFeedPhotoFileRef,

    attractionAudioGuides,
    currentAttractionAudioGuide,
    attractionAudioGuideLocaleData,
    attractionAudioGuideActiveLocale,
    attractionAudioGuideSaving,
    attractionAudioUploading,
    audioGuideGeneratingPlan,
    audioGuideGeneratingAllMainText,
    audioGuideGeneratingItemTextById,

    attractionGenerationOpen,
    attractionGenerationPrompt,
    attractionGenerating,
    attractionGenerationTaskId,
    attractionGenerationError,
    attractionGenerationAssignedCityType,
    attractionGenerationSessionCityId,
    attractionGenerationDatabaseCityId,
    attractionGenerationLang,

    saving,
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
    handleCommonsImageSelect,
    getSessionUuid,

    toggleCityTag,
    uploadCityFilterImage,
    createCityTag,
    updateCityFilter,
    deleteCityFilter,
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
    openCityInfoGenerateModal,
    closeCityInfoGenerateModal,
    setCityInfoGeneratePrompt,
    setCityInfoGenerateCount,
    setCityInfoGenerationLang,
    generateCityInfoFromPrompt,

    openAttrDetail,
    addAttraction,
    openAttractionGenerationModal,
    closeAttractionGenerationModal,
    setAttractionGenerationPrompt,
    setAttractionGenerationAssignedCityTypeSafe,
    setAttractionGenerationSessionCityId,
    setAttractionGenerationDatabaseCityId,
    setAttractionGenerationLang,
    generateAttractionsFromPrompt,
    deleteCurrentAttr,
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
    leaveIlDetailView,
    updateIlLocaleField,
    updateCurrentIlPatch,
    toggleCurrentIlTag,
    handleIlPhotoFile,
    ilGenerationOpen,
    ilGenerationPrompt,
    ilGenerating,
    ilGenerationTaskId,
    ilGenerationError,
    ilGenerationAssignedCityType,
    ilGenerationSessionCityId,
    ilGenerationDatabaseCityId,
    ilGenerationLang,
    openIlGenerationModal,
    closeIlGenerationModal,
    setIlGenerationPrompt,
    setIlGenerationAssignedCityTypeSafe,
    setIlGenerationSessionCityId,
    setIlGenerationDatabaseCityId,
    setIlGenerationLang,
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

    setCurrentAttractionFeedItem,
    setAttractionFeedActiveLocale,

    openAttractionFeedItemDetail,
    addAttractionFeedItem,
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
    saveCurrentAttractionAudioGuide,
    deleteCurrentAttractionAudioGuide,
    uploadAttractionAudioGuideTrack,
    removeAttractionAudioGuideTrack,
    generateAttractionAudioGuidePlan,
    audioGuidePlanGenerationState,
    setAttractionAudioGuidePlanGenerationPrompt,
    setAttractionAudioGuidePlanItemsCount,
    generateAttractionAudioGuideMainText,
    generateAttractionAudioGuideMainTextItem,

    handleClose,
    handlePublish,
    handleTranslateSession,

    goToStep,
  } = controller;

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
    commonsTarget.type === 'attraction'
      ? attractions.find((attr) => String(attr.id) === String(commonsTarget.attractionId)) ||
        currentAttr
      : null;

  const openCityCommonsModal = () => {
    setCommonsTarget({
      type: 'city',
      attractionId: null,
      feedItemId: null,
    });

    setCommonsModalOpen(true);
  };

  const openAttractionCommonsModal = (attr) => {
    setCommonsTarget({
      type: 'attraction',
      attractionId: attr?.id ?? currentAttr?.id ?? null,
      feedItemId: null,
    });

    setCommonsModalOpen(true);
  };

  const openInteractiveLocationCommonsModal = (il) => {
    setCommonsTarget({
      type: 'interactive_location',
      interactiveLocationId: il?.id ?? currentIl?.id ?? null,
      feedItemId: null,
    });

    setCommonsModalOpen(true);
  };

  const openAttractionFeedCommonsModal = (item) => {
    setCommonsTarget({
      type: 'attraction_feed',
      attractionId: null,
      feedItemId: item?.id ?? currentAttractionFeedItem?.id ?? null,
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
        show={saving || publishing || closing || photoUploading || translating}
        message={[
          saving && 'Сохраняем данные города...',
          publishing && 'Публикуем сессию...',
          closing && 'Закрываем сессию...',
          photoUploading && 'Загружаем изображение...',
          translating && 'Переводим сессию на другие языки...',
        ]
          .filter(Boolean)
          .join(' ')}
      />

      <div className="flex items-start justify-between gap-4 mb-5 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {session.name || 'Сессия генерации контента'}
          </h1>

          <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
            <span>
              <span className="text-gray-400">UID:</span>{' '}
              <span className="font-mono">
                {session.uuid || session.session_uuid || session.id}
              </span>
            </span>

            {session.created_at && (
              <span>
                <span className="text-gray-400">Дата начала:</span>{' '}
                {new Date(session.created_at).toLocaleString('ru-RU', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}

            <StatusBadge status={session.status} label={session.status_display} />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => goToStep(1)}
            title="К шагу 1"
            className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            ← Шаги
          </button>

          <button
            type="button"
            onClick={() => {
              if (currentStep === 1) {
                void (async () => {
                  await saveCityForStep1?.();

                  if (currentCityInfo) {
                    await saveCurrentCityInfo?.();
                  }
                })().catch(() => {});

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
                })().catch(() => {});

                return;
              }

              if (currentStep === 4) {
                if (currentIl) {
                  void saveCurrentIlIfDirty?.().catch(() => {});
                }
                return;
              }

              if (currentStep === 5) {
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
                onGoToStep={goToStep}
                cityInfoGenerateModalOpen={cityInfoGenerateModalOpen}
                cityInfoGeneratePrompt={cityInfoGeneratePrompt}
                cityInfoGenerateCount={cityInfoGenerateCount}
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
              attractions={attractions}
              activeCityDraftId={activeCityDraftId}
              localeData={localeData}
              activeLocale={activeLocale}
              referenceCities={referenceCities || []}
              cityDrafts={cityDrafts || []}
              onUpdateCurrentAttrPatch={updateCurrentAttrPatch}
              onOpenAttrDetail={openAttrDetail}
              onOpenAttractionCommonsModal={openAttractionCommonsModal}
              onAddAttraction={addAttraction}
              attractionGenerationOpen={attractionGenerationOpen}
              attractionGenerationPrompt={attractionGenerationPrompt}
              attractionGenerating={attractionGenerating}
              attractionGenerationTaskId={attractionGenerationTaskId}
              attractionGenerationError={attractionGenerationError}
              attractionGenerationAssignedCityType={attractionGenerationAssignedCityType}
              attractionGenerationSessionCityId={attractionGenerationSessionCityId}
              attractionGenerationDatabaseCityId={attractionGenerationDatabaseCityId}
              attractionGenerationLang={attractionGenerationLang}
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
              onDeleteCurrentAttr={deleteCurrentAttr}
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
                onGoToStep={goToStep}
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
                attractionFeedPhotoUploading={attractionFeedPhotoUploading}
                attractionFeedPhotoFileRef={attractionFeedPhotoFileRef}
                referenceAttractions={referenceAttractions || []}
                attractions={attractions || []}
                onOpenAttractionFeedItemDetail={openAttractionFeedItemDetail}
                onOpenAttractionFeedCommonsModal={openAttractionFeedCommonsModal}
                onAddAttractionFeedItem={addAttractionFeedItem}
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
                attractionAudioUploading={attractionAudioUploading}
                audioGuideGeneratingPlan={audioGuideGeneratingPlan}
                audioGuideGeneratingAllMainText={audioGuideGeneratingAllMainText}
                audioGuideGeneratingItemTextById={audioGuideGeneratingItemTextById}
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
                onShowNote={showNote}
                onSaveCurrentAttractionAudioGuide={saveCurrentAttractionAudioGuide}
                onDeleteCurrentAttractionAudioGuide={deleteCurrentAttractionAudioGuide}
                onUploadAttractionAudioGuideTrack={uploadAttractionAudioGuideTrack}
                onRemoveAttractionAudioGuideTrack={removeAttractionAudioGuideTrack}
                onGenerateAttractionAudioGuidePlan={generateAttractionAudioGuidePlan}
                onSetAttractionAudioGuidePlanGenerationPrompt={
                  setAttractionAudioGuidePlanGenerationPrompt
                }
                onSetAttractionAudioGuidePlanItemsCount={
                  setAttractionAudioGuidePlanItemsCount
                }
                onGenerateAttractionAudioGuideMainText={generateAttractionAudioGuideMainText}
                onGenerateAttractionAudioGuideMainTextItem={
                  generateAttractionAudioGuideMainTextItem
                }
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
            referenceCities={referenceCities || []}
            cityDrafts={cityDrafts || []}
            eventFilterTree={eventFilterTree}
            eventFilterTreeLoading={eventFilterTreeLoading}
            eventFilterTreeError={eventFilterTreeError}
            photoUploading={ilPhotoUploading}
            photoFileRef={ilPhotoFileRef}
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
            ilGenerationPrompt={ilGenerationPrompt}
            ilGenerating={ilGenerating}
            ilGenerationTaskId={ilGenerationTaskId}
            ilGenerationError={ilGenerationError}
            ilGenerationAssignedCityType={ilGenerationAssignedCityType}
            ilGenerationSessionCityId={ilGenerationSessionCityId}
            ilGenerationDatabaseCityId={ilGenerationDatabaseCityId}
            ilGenerationLang={ilGenerationLang}
            onOpenIlGenerationModal={openIlGenerationModal}
            onCloseIlGenerationModal={closeIlGenerationModal}
            onIlGenerationPromptChange={setIlGenerationPrompt}
            onIlGenerationAssignedCityTypeChange={setIlGenerationAssignedCityTypeSafe}
            onIlGenerationSessionCityIdChange={setIlGenerationSessionCityId}
            onIlGenerationDatabaseCityIdChange={setIlGenerationDatabaseCityId}
            onIlGenerationLangChange={setIlGenerationLang}
            onGenerateInteractiveLocationsFromPrompt={generateInteractiveLocationsFromPrompt}
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
        defaultQuery={
          commonsTarget.type === 'attraction'
            ? getAttrName(commonsAttraction) || ''
            : localeData[activeLocale]?.name || ''
        }
      />
    </Layout>
  );
}