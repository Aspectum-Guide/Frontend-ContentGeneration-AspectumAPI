import SessionWizardCityStep from './SessionWizardCityStep.jsx';
import SessionWizardGenerateCityFull from './SessionWizardGenerateCityFull.jsx';
import SessionWizardCityTagsPicker from './SessionWizardCityTagsPicker.jsx';
import SessionWizardCityInfoStep from './SessionWizardCityInfoStep.jsx';

export default function SessionWizardCityStepSection({
  controller,
  sessionId,
  currentLocale,
  scopedCityDraftId,
  scopedDatabaseCityId,
  visibleCityInfos,
  openCityCommonsModal,
}) {
  const { loadSession, activeCityDraftId } = controller;

  return (
    <div className="space-y-6" onBlur={controller.onCityFormBlur}>
      <SessionWizardGenerateCityFull
        sessionId={sessionId}
        defaultLang={controller.defaultLocale || 'ru'}
        onDone={() => loadSession(activeCityDraftId)}
      />

      <SessionWizardCityStep
        cityDrafts={controller.cityDrafts}
        referenceCities={controller.referenceCities || []}
        parentCityId={controller.parentCityId}
        setParentCityId={controller.setParentCityId}
        authorIds={controller.authorIds}
        setAuthorIds={controller.setAuthorIds}
        activeCityDraftId={activeCityDraftId}
        localeData={controller.localeData}
        activeLocale={controller.activeLocale}
        defaultLocale={controller.defaultLocale}
        currentLocale={currentLocale}
        lat={controller.lat}
        lon={controller.lon}
        savedLat={controller.savedLat}
        savedLon={controller.savedLon}
        imagePreview={controller.imagePreview}
        photoUploading={controller.photoUploading}
        imageOriginalUrl={controller.imageOriginalUrl}
        imageCopyright={controller.imageCopyright}
        setMapContainerRef={controller.setMapContainerRef}
        photoFileRef={controller.photoFileRef}
        onOpenCommonsModal={openCityCommonsModal}
        onPhotoFileChange={controller.handlePhotoFile}
        onPhotoDelete={controller.handlePhotoDelete}
        onImageOriginalUrlChange={controller.setImageOriginalUrl}
        onImageCopyrightChange={controller.setImageCopyright}
        onCreateDraft={controller.handleCreateDraft}
        onSelectDraft={controller.handleSelectDraft}
        onDeleteDraft={controller.handleDeleteDraft}
        onSwitchLocale={controller.switchLocale}
        onSetDefaultLocale={controller.setDefaultLocale}
        onAddLocale={() => controller.setAddLocaleOpen(true)}
        onRemoveLocale={controller.removeLocale}
        onUpdateLocaleField={controller.updateLocaleField}
        onLatChange={controller.setLat}
        onLonChange={controller.setLon}
        onRestoreSavedCoords={() => {
          if (controller.savedLat != null && controller.savedLon != null) {
            controller.setLat(String(controller.savedLat));
            controller.setLon(String(controller.savedLon));
          }
        }}
        onGoToStep={controller.goToStep}
        saving={controller.saving}
      />

      <div className="pt-5 border-t border-gray-200">
        <SessionWizardCityTagsPicker
          cityTags={controller.cityTags}
          cityTagCatalog={controller.cityTagCatalog}
          cityTagCatalogLoading={controller.cityTagCatalogLoading}
          cityTagCatalogError={controller.cityTagCatalogError}
          onReloadCityTagCatalog={controller.loadCityTagCatalog}
          cityFilterTree={controller.cityFilterTree}
          cityFilterTreeLoading={controller.cityFilterTreeLoading}
          cityFilterTreeError={controller.cityFilterTreeError}
          onReloadCityFilters={controller.loadCityFilterTree}
          onToggleCityTag={controller.toggleCityTag}
        />
      </div>

      <div className="pt-5 border-t border-gray-200">
        <SessionWizardCityInfoStep
          embedded
          scopedToCityDraftId={scopedCityDraftId || scopedDatabaseCityId || ''}
          cityInfos={visibleCityInfos}
          currentCityInfo={controller.currentCityInfo}
          cityInfoLocaleData={controller.cityInfoLocaleData}
          cityInfoActiveLocale={controller.cityInfoActiveLocale}
          cityInfoSaving={controller.cityInfoSaving}
          cityInfoAutoSaving={controller.cityInfoAutoSaving}
          cityInfoAutoSaved={controller.cityInfoAutoSaved}
          referenceCities={controller.referenceCities || []}
          cityDrafts={controller.cityDrafts || []}
          onOpenCityInfoDetail={controller.openCityInfoDetail}
          onAddCityInfo={controller.addCityInfo}
          onSetCurrentCityInfo={controller.setCurrentCityInfo}
          onSetCityInfoActiveLocale={controller.setCityInfoActiveLocale}
          onUpdateCityInfoLocaleField={controller.updateCityInfoLocaleField}
          onUpdateCurrentCityInfoPatch={controller.updateCurrentCityInfoPatch}
          onSaveCurrentCityInfo={controller.saveCurrentCityInfo}
          onDeleteCurrentCityInfo={controller.deleteCurrentCityInfo}
          onImportCityInfoFromText={controller.importCityInfoFromText}
          onGoToStep={controller.goToStep}
          cityInfoGenerateModalOpen={controller.cityInfoGenerateModalOpen}
          cityInfoGeneratePrompt={controller.cityInfoGeneratePrompt}
          cityInfoGenerateCount={controller.cityInfoGenerateCount}
          cityInfoDedupeExistingItems={controller.cityInfoDedupeExistingItems}
          onCityInfoDedupeExistingItemsChange={controller.setCityInfoDedupeExistingItems}
          cityInfoGenerating={controller.cityInfoGenerating}
          cityInfoGenerationError={controller.cityInfoGenerationError}
          cityInfoGenerationTaskId={controller.cityInfoGenerationTaskId}
          cityInfoGenerationLang={controller.cityInfoGenerationLang}
          onOpenCityInfoGenerateModal={controller.openCityInfoGenerateModal}
          onCloseCityInfoGenerateModal={controller.closeCityInfoGenerateModal}
          onCityInfoGeneratePromptChange={controller.setCityInfoGeneratePrompt}
          onCityInfoGenerateCountChange={controller.setCityInfoGenerateCount}
          onCityInfoGenerationLangChange={controller.setCityInfoGenerationLang}
          onGenerateCityInfoFromPrompt={controller.generateCityInfoFromPrompt}
          aiGenerationMode={controller.aiGenerationMode}
          aiUseWebSearch={controller.aiUseWebSearch}
          aiAdvancedGenerationAvailable={controller.aiAdvancedGenerationAvailable}
          onAiGenerationModeChange={controller.setAiGenerationMode}
          onAiUseWebSearchChange={controller.setAiUseWebSearch}
        />
      </div>
    </div>
  );
}
