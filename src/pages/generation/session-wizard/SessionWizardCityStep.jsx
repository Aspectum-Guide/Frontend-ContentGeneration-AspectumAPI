import { getCityDraftName, getFlag } from './sessionWizardShared.jsx';

function LocalePills({ localeData, activeLocale, defaultLocale, onSwitch, onSetDefault, onAddLocale, onRemoveLocale }) {
  return (
    <div className="flex items-center gap-1 flex-wrap mb-4">
      {Object.keys(localeData).map((key) => {
        const loc = localeData[key];
        const isActive = key === activeLocale;
        const isDefault = key === defaultLocale;

        return (
          <div key={key} className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => onSwitch(key)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${isActive
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                }`}
            >
              <span>{getFlag(loc.code)}</span>
              <span>{loc.langName}</span>
            </button>
            <button
              type="button"
              title={isDefault ? 'Язык по умолчанию' : 'Установить как язык по умолчанию'}
              onClick={() => onSetDefault(key)}
              className={`text-xs px-1 transition-colors ${isDefault ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'}`}
            >
              ★
            </button>
            {!loc.isDefault && (
              <button
                type="button"
                title="Удалить адаптацию"
                onClick={() => onRemoveLocale(key)}
                className="text-xs text-gray-300 hover:text-red-400 transition-colors px-0.5"
              >
                ×
              </button>
            )}
          </div>
        );
      })}
      <button
        type="button"
        title="Добавить адаптацию"
        onClick={onAddLocale}
        className="w-6 h-6 rounded-full border-2 border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500 text-sm font-bold flex items-center justify-center transition-colors"
      >
        +
      </button>
    </div>
  );
}

export default function SessionWizardCityStep({
  cityDrafts,
  activeCityDraftId,
  localeData,
  activeLocale,
  defaultLocale,
  currentLocale,
  lat,
  lon,
  savedLat,
  savedLon,
  imagePreview,
  photoUploading,
  imageOriginalUrl,
  imageCopyright,
  setMapContainerRef,
  photoFileRef,
  onOpenCommonsModal,
  onPhotoFileChange,
  onImageOriginalUrlChange,
  onImageCopyrightChange,
  onCreateDraft,
  onSelectDraft,
  onDeleteDraft,
  onSwitchLocale,
  onSetDefaultLocale,
  onAddLocale,
  onRemoveLocale,
  onUpdateLocaleField,
  onLatChange,
  onLonChange,
  onRestoreSavedCoords,
  onGoToStep,
  saving,
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Город</h2>
        <p className="text-sm text-gray-500">Название, описание, страна и координаты</p>
      </div>

      <div className="p-3 border border-gray-200 rounded-xl bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-800">Черновики городов в сессии</p>
          <button
            type="button"
            onClick={onCreateDraft}
            className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors"
          >
            + Добавить город
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {cityDrafts.length === 0 ? (
            <span className="text-xs text-gray-500">Пока нет черновиков</span>
          ) : cityDrafts.map((draft) => {
            const isActiveDraft = String(draft.id) === String(activeCityDraftId);
            return (
              <div
                key={draft.id}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg border ${isActiveDraft ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200'}`}
              >
                <button
                  type="button"
                  onClick={() => onSelectDraft(draft.id)}
                  className={`text-xs ${isActiveDraft ? 'text-blue-700 font-medium' : 'text-gray-700'}`}
                >
                  {getCityDraftName(draft)}
                </button>
                {draft.id !== 'legacy' && (
                  <button
                    type="button"
                    onClick={() => onDeleteDraft(draft.id)}
                    className="text-xs text-red-500 hover:text-red-700"
                    title="Удалить черновик"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <LocalePills
        localeData={localeData}
        activeLocale={activeLocale}
        defaultLocale={defaultLocale}
        onSwitch={onSwitchLocale}
        onSetDefault={onSetDefaultLocale}
        onAddLocale={onAddLocale}
        onRemoveLocale={onRemoveLocale}
      />

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
              onClick={onOpenCommonsModal}
              className="absolute top-2 right-2 px-2 py-1 text-xs bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors shadow-lg"
              title="Подобрать в Wikimedia Commons"
            >
              ✦ Commons
            </button>
          </div>
          <div>
            <label className="block w-full text-center text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg py-1.5 cursor-pointer hover:bg-blue-100 transition-colors">
              + Добавить фото
              <input ref={photoFileRef} type="file" accept="image/*" className="hidden" onChange={onPhotoFileChange} />
            </label>
          </div>
          <div className="space-y-1.5">
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">URL</label>
              <input
                type="url"
                value={imageOriginalUrl}
                onChange={(e) => onImageOriginalUrlChange(e.target.value)}
                placeholder="https://upload.wikimedia.org/..."
                className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Авторские права</label>
              <input
                type="text"
                value={imageCopyright}
                onChange={(e) => onImageCopyrightChange(e.target.value)}
                placeholder="© Автор / Источник"
                className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </div>
        </aside>

        <main className="flex-1 min-w-0 space-y-4">
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название города ({currentLocale.lang?.toUpperCase() || activeLocale.split('-')[0].toUpperCase()})
                </label>
                <input
                  type="text"
                  value={currentLocale.name || ''}
                  onChange={(e) => onUpdateLocaleField('name', e.target.value)}
                  placeholder={`Например, ${currentLocale.name || 'название'}`}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Описание ({currentLocale.lang?.toUpperCase() || activeLocale.split('-')[0].toUpperCase()})
                </label>
                <textarea
                  value={currentLocale.description || ''}
                  onChange={(e) => onUpdateLocaleField('description', e.target.value)}
                  rows={4}
                  placeholder={`Описание города на ${currentLocale.langName?.toLowerCase() || 'языке'}`}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Страна ({currentLocale.lang?.toUpperCase() || activeLocale.split('-')[0].toUpperCase()})
                </label>
                <input
                  type="text"
                  value={currentLocale.country || ''}
                  onChange={(e) => onUpdateLocaleField('country', e.target.value)}
                  placeholder={currentLocale.lang === 'ru' ? 'Россия' : currentLocale.lang === 'en' ? 'Russia' : ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-gray-700">Координаты</label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Клик по карте или ввод вручную</span>
                  <button
                    type="button"
                    onClick={onRestoreSavedCoords}
                    disabled={savedLat == null || savedLon == null}
                    className="px-2 py-0.5 text-xs text-gray-500 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 transition-colors"
                  >
                    Вернуть
                  </button>
                </div>
              </div>
              <div ref={setMapContainerRef} className="w-full h-48 rounded-lg border border-gray-200 overflow-hidden z-0" />
              <div className="grid grid-cols-2 gap-2 mt-2">
                <input
                  type="number"
                  step="0.000001"
                  value={lat}
                  onChange={(e) => onLatChange(e.target.value)}
                  placeholder="Широта"
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  step="0.000001"
                  value={lon}
                  onChange={(e) => onLonChange(e.target.value)}
                  placeholder="Долгота"
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => onGoToStep(2)}
              disabled={saving}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Сохранение...' : 'Далее: Теги →'}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}