import 'leaflet/dist/leaflet.css';
import { useParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import CommonsImagePicker from '../../components/generation/CommonsImagePicker';
import SessionWizardAttractionsStep from './session-wizard/SessionWizardAttractionsStep';
import SessionWizardCityStep from './session-wizard/SessionWizardCityStep';
import SessionWizardContentStep from './session-wizard/SessionWizardContentStep';
import SessionWizardPublishStep from './session-wizard/SessionWizardPublishStep';
import SessionWizardTagsStep from './session-wizard/SessionWizardTagsStep';
import { StatusBadge } from './session-wizard/sessionWizardShared';
import { useSessionWizardController } from './session-wizard/useSessionWizardController';

const STEP_LABELS = ['Город', 'Теги', 'Достопримечательности', 'Контент', 'Публикация'];

function Notification({ note }) {
  if (!note) return null;

  const colorMap = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600',
    warning: 'bg-yellow-500',
  };

  return (
    <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-lg text-white text-sm shadow-lg transition-all ${colorMap[note.type] || colorMap.info}`}>
      {note.msg}
    </div>
  );
}

export default function SessionWizard() {
  const { sessionId } = useParams();
  const controller = useSessionWizardController({ sessionId });

  const {
    note,
    session,
    loading,
    cityDrafts,
    activeCityDraftId,
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
    tagInput,
    setTagInput,
    availableTags,
    attractions,
    attrView,
    currentAttr,
    attrLocaleData,
    attrActiveLocale,
    attrSaving,
    aiGenAttrId,
    aiGenLang,
    aiGenText,
    aiGenDone,
    aiGenError,
    aiGenSaving,
    saving,
    closeOpen,
    closeMode,
    closing,
    publishing,
    translating,
    setAttrView,
    setCurrentAttr,
    setAttrActiveLocale,
    setAiGenLang,
    setAiGenAttrId,
    setAiGenText,
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
    addTag,
    removeTag,
    handleTagKeyDown,
    handleTagBlur,
    openAttrDetail,
    addAttraction,
    deleteCurrentAttr,
    saveCurrentAttr,
    updateAttrLocaleField,
    startAiContent,
    saveAiContent,
    handleClose,
    handlePublish,
    handleTranslateSession,
    goToStep,
  } = controller;

  const currentLocale = localeData[activeLocale] || {};

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
      <Notification note={note} />

      {(saving || publishing || closing || photoUploading || aiGenSaving || translating) && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 flex items-center gap-2">
          <span className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
          <span>
            {saving && 'Сохраняем данные города...'}
            {publishing && 'Публикуем сессию...'}
            {closing && 'Закрываем сессию...'}
            {photoUploading && 'Загружаем изображение...'}
            {aiGenSaving && 'Сохраняем AI-контент...'}
            {translating && 'Переводим сессию на другие языки...'}
          </span>
        </div>
      )}

      <div className="flex items-start justify-between gap-4 mb-5 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{session.name || 'Сессия генерации контента'}</h1>
          <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
            <span>
              <span className="text-gray-400">UID:</span> <span className="font-mono">{session.uuid || session.session_uuid || session.id}</span>
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
            onClick={() => goToStep(1)}
            title="К шагу 1"
            className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            ← Шаги
          </button>
          <button
            onClick={() => saveCurrentAttr?.()}
            disabled={saving}
            title="Сохранить текущие данные"
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>

      <div className="flex gap-5 items-start">
        <aside className="w-52 shrink-0 space-y-3">
          <div className="relative aspect-[3/4] bg-gray-100 rounded-xl overflow-hidden border border-gray-200 flex items-center justify-center">
            {imagePreview ? (
              <img src={imagePreview} alt="Фото города" className="w-full h-full object-cover" />
            ) : (
              <span className="text-gray-400 text-sm">Фото</span>
            )}
            {photoUploading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full" />
              </div>
            )}
            <button
              type="button"
              onClick={() => setCommonsModalOpen(true)}
              className="absolute top-2 right-2 px-2 py-1 text-xs bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors shadow-lg"
              title="Подобрать в Wikimedia Commons"
            >
              ✦ Commons
            </button>
          </div>

          <div>
            <label className="block w-full text-center text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg py-1.5 cursor-pointer hover:bg-blue-100 transition-colors">
              + Добавить фото
              <input ref={photoFileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoFile} />
            </label>
          </div>

          <div className="space-y-1.5">
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">URL</label>
              <input
                type="url"
                value={imageOriginalUrl}
                onChange={(e) => setImageOriginalUrl(e.target.value)}
                placeholder="https://upload.wikimedia.org/..."
                className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Авторские права</label>
              <input
                type="text"
                value={imageCopyright}
                onChange={(e) => setImageCopyright(e.target.value)}
                placeholder="© Автор / Источник"
                className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          <div className="mb-5">
            <div className="relative h-1.5 bg-gray-200 rounded-full mb-3">
              <div
                className="absolute inset-y-0 left-0 bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${((currentStep - 1) / 4) * 100}%` }}
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
                    className={`flex-1 text-xs py-1 px-1 text-center transition-colors border-b-2 ${isActive
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
              onOpenCommonsModal={() => setCommonsModalOpen(true)}
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
          )}

          {currentStep === 2 && (
            <SessionWizardTagsStep
              tagInput={tagInput}
              cityTags={cityTags}
              availableTags={availableTags}
              saving={saving}
              onTagInputChange={setTagInput}
              onTagKeyDown={handleTagKeyDown}
              onTagBlur={handleTagBlur}
              onAddTag={addTag}
              onRemoveTag={removeTag}
              onGoToStep={goToStep}
            />
          )}

          {currentStep === 3 && (
            <SessionWizardAttractionsStep
              attrView={attrView}
              currentAttr={currentAttr}
              attrActiveLocale={attrActiveLocale}
              attrLocaleData={attrLocaleData}
              attrSaving={attrSaving}
              attractions={attractions}
              onOpenAttrDetail={openAttrDetail}
              onAddAttraction={addAttraction}
              onDeleteCurrentAttr={deleteCurrentAttr}
              onSetAttrView={setAttrView}
              onSetCurrentAttr={setCurrentAttr}
              onSetAttrActiveLocale={setAttrActiveLocale}
              onUpdateAttrLocaleField={updateAttrLocaleField}
              onSaveCurrentAttr={saveCurrentAttr}
              onGoToStep={goToStep}
            />
          )}

          {currentStep === 4 && (
            <SessionWizardContentStep
              attractions={attractions}
              aiGenAttrId={aiGenAttrId}
              aiGenLang={aiGenLang}
              aiGenText={aiGenText}
              aiGenDone={aiGenDone}
              aiGenError={aiGenError}
              aiGenSaving={aiGenSaving}
              onStartAiContent={startAiContent}
              onSetAiGenLang={setAiGenLang}
              onSetAiGenAttrId={setAiGenAttrId}
              onSetAiGenText={setAiGenText}
              onSaveAiContent={saveAiContent}
              onGoToStep={goToStep}
            />
          )}

          {currentStep === 5 && (
            <SessionWizardPublishStep
              session={session}
              attractions={attractions}
              cityTags={cityTags}
              translating={translating}
              publishing={publishing}
              onGoToStep={goToStep}
              onTranslateSession={handleTranslateSession}
              onPublish={handlePublish}
            />
          )}
        </main>
      </div>

      {addLocaleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAddLocaleOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl p-6 w-80 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">Добавить адаптацию</h3>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Код страны (2 буквы)</label>
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
              <label className="block text-sm text-gray-600 mb-1">Название языка</label>
              <input
                type="text"
                value={newLocaleLang}
                onChange={(e) => setNewLocaleLang(e.target.value)}
                placeholder="Немецкий, Испанский..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setAddLocaleOpen(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                Отмена
              </button>
              <button onClick={addLocale} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}

      {closeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => !closing && setCloseOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl p-6 w-96 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">Закрыть сессию</h3>
            <p className="text-sm text-gray-600">
              Сессия <span className="font-medium">«{session.name}»</span> будет закрыта. Выберите режим:
            </p>
            <div className="space-y-2">
              {[
                { mode: 'save', title: 'Сохранить', desc: 'Данные сессии сохранятся', cls: 'border-blue-500 bg-blue-50' },
                { mode: 'discard', title: 'Отменить', desc: 'Данные сессии будут удалены без сохранения', cls: 'border-red-500 bg-red-50' },
              ].map((opt) => (
                <label
                  key={opt.mode}
                  className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${closeMode === opt.mode ? opt.cls : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <input
                    type="radio"
                    name="closeMode"
                    value={opt.mode}
                    checked={closeMode === opt.mode}
                    onChange={() => setCloseMode(opt.mode)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{opt.title}</div>
                    <div className="text-xs text-gray-500">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setCloseOpen(false)} disabled={closing} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                Отмена
              </button>
              <button
                onClick={handleClose}
                disabled={closing}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors ${closeMode === 'discard' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {closing ? 'Закрытие...' : closeMode === 'discard' ? 'Закрыть без сохранения' : 'Закрыть с сохранением'}
              </button>
            </div>
          </div>
        </div>
      )}

      <CommonsImagePicker
        isOpen={commonsModalOpen}
        onClose={() => setCommonsModalOpen(false)}
        onImageSelected={handleCommonsImageSelect}
        getSessionUuid={getSessionUuid}
        defaultQuery={localeData[activeLocale]?.name || ''}
      />
    </Layout>
  );
}