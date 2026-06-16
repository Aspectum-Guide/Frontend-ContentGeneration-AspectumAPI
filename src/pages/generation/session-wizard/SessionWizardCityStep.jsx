import { useMemo, useState } from 'react';
import { getCityDraftName, getFlag } from './sessionWizardShared.jsx';

// ─── helpers ──────────────────────────────────────────────────────────────────

function localeStatus(loc) {
  const filled = [loc?.name, loc?.description, loc?.country].filter(v => (v || '').trim()).length;
  if (filled === 3) return 'complete';
  if (filled > 0) return 'partial';
  return 'empty';
}

// ─── sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, children, action }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {(title || action) && (
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50">
          {title && <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</span>}
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

function LocalePills({ localeData, activeLocale, defaultLocale, onSwitch, onSetDefault, onAddLocale, onRemoveLocale }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {Object.entries(localeData).map(([key, loc]) => {
        const isActive = key === activeLocale;
        const isDefault = key === defaultLocale;
        const status = localeStatus(loc);

        const statusColor = status === 'complete'
          ? 'bg-emerald-500'
          : status === 'partial'
            ? 'bg-amber-400'
            : 'bg-red-400';

        return (
          <div key={key} className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => onSwitch(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                isActive
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-600'
              }`}
            >
              <span className="text-base leading-none">{getFlag(loc.code)}</span>
              <span>{loc.langName || (loc.lang || key).toUpperCase()}</span>
              {isDefault && (
                <span className={`text-xs ${isActive ? 'text-blue-200' : 'text-yellow-500'}`}>★</span>
              )}
              {/* Индикатор заполненности */}
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusColor} ${isActive ? 'opacity-80' : ''}`} />
            </button>

            {!loc.isDefault && (
              <button
                type="button"
                title="Удалить язык"
                onClick={() => onRemoveLocale(key)}
                className="w-5 h-5 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors text-sm"
              >
                ×
              </button>
            )}

            {!isDefault && (
              <button
                type="button"
                title="Сделать основным"
                onClick={() => onSetDefault(key)}
                className="w-5 h-5 flex items-center justify-center text-gray-300 hover:text-yellow-400 transition-colors text-sm"
              >
                ★
              </button>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={onAddLocale}
        title="Добавить язык"
        className="w-8 h-8 rounded-lg border-2 border-dashed border-gray-200 text-gray-400 hover:border-blue-400 hover:text-blue-500 flex items-center justify-center transition-colors text-lg font-light"
      >
        +
      </button>
    </div>
  );
}

function CoordinatesPanel({ lat, lon, savedLat, savedLon, setMapContainerRef, onLatChange, onLonChange, onRestoreSavedCoords }) {
  return (
    <div className="w-56 shrink-0 space-y-2">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Координаты</div>
      <div ref={setMapContainerRef} className="w-full h-44 rounded-xl border border-gray-200 overflow-hidden z-0" />
      <div className="grid grid-cols-2 gap-1.5">
        <input
          type="number" step="0.000001" value={lat}
          onChange={(e) => onLatChange(e.target.value)}
          placeholder="Широта"
          className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <input
          type="number" step="0.000001" value={lon}
          onChange={(e) => onLonChange(e.target.value)}
          placeholder="Долгота"
          className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>
      <button
        type="button"
        onClick={onRestoreSavedCoords}
        disabled={savedLat == null || savedLon == null}
        className="w-full px-2 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
      >
        Вернуть сохранённые
      </button>
      <p className="text-[10px] text-gray-400 text-center">кликните по карте для выбора</p>
    </div>
  );
}

function PhotoPanel({
  imagePreview, photoUploading, imageOriginalUrl, imageCopyright,
  photoFileRef, onOpenCommonsModal, onPhotoFileChange, onPhotoDelete,
  onImageOriginalUrlChange, onImageCopyrightChange,
}) {
  return (
    <div className="w-48 shrink-0 space-y-2">
      <div className="relative aspect-[3/4] bg-gray-100 rounded-xl overflow-hidden border border-gray-200 flex items-center justify-center">
        {imagePreview
          ? <img src={imagePreview} alt="Фото" className="w-full h-full object-cover" />
          : <span className="text-gray-400 text-xs">Нет фото</span>
        }
        {photoUploading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
          </div>
        )}
        {imagePreview && onPhotoDelete && (
          <button
            type="button" onClick={onPhotoDelete}
            className="absolute top-2 left-2 px-1.5 py-0.5 text-[10px] bg-red-600 text-white rounded hover:bg-red-700 shadow transition-colors"
          >
            ✕ Удалить
          </button>
        )}
        <button
          type="button" onClick={onOpenCommonsModal}
          className="absolute top-2 right-2 px-1.5 py-0.5 text-[10px] bg-purple-600 text-white rounded hover:bg-purple-700 shadow transition-colors"
        >
          ✦ Commons
        </button>
      </div>

      <label className="block w-full text-center text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg py-1.5 cursor-pointer hover:bg-blue-100 transition-colors">
        + Добавить фото
        <input ref={photoFileRef} type="file" accept="image/*" className="hidden" onChange={onPhotoFileChange} />
      </label>

      <input
        type="url" value={imageOriginalUrl || ''}
        onChange={(e) => onImageOriginalUrlChange(e.target.value)}
        placeholder="URL источника"
        className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
      <input
        type="text" value={imageCopyright || ''}
        onChange={(e) => onImageCopyrightChange(e.target.value)}
        placeholder="© Автор / Источник"
        className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
    </div>
  );
}

// ─── main ────────────────────────────────────────────────────────────────────

export default function SessionWizardCityStep({
  cityDrafts, activeCityDraftId,
  localeData, activeLocale, defaultLocale, currentLocale,
  lat, lon, savedLat, savedLon,
  imagePreview, photoUploading, imageOriginalUrl, imageCopyright,
  setMapContainerRef, photoFileRef,
  onOpenCommonsModal, onPhotoFileChange, onPhotoDelete,
  onImageOriginalUrlChange, onImageCopyrightChange,
  onCreateDraft, onSelectDraft, onDeleteDraft,
  onSwitchLocale, onSetDefaultLocale, onAddLocale, onRemoveLocale,
  onUpdateLocaleField,
  onLatChange, onLonChange, onRestoreSavedCoords,
  onGoToStep, saving,
}) {
  const [showValidation, setShowValidation] = useState(false);

  const localeLabel = (currentLocale.lang || activeLocale.split('-')[0]).toUpperCase();

  const localeStatuses = useMemo(() => {
    const out = {};
    Object.entries(localeData || {}).forEach(([k, loc]) => { out[k] = localeStatus(loc); });
    return out;
  }, [localeData]);

  const defaultLocaleStatus = localeStatuses[defaultLocale];
  const incompleteLocales = useMemo(() =>
    Object.entries(localeStatuses)
      .filter(([, s]) => s !== 'complete')
      .map(([k]) => {
        const loc = localeData[k];
        return (loc?.langName || loc?.lang || k).toUpperCase();
      }),
    [localeStatuses, localeData]
  );

  const canProceed = defaultLocaleStatus !== 'empty';

  const handleNext = () => {
    if (!canProceed) { setShowValidation(true); return; }
    onGoToStep(2);
  };

  const currentStatus = localeStatuses[activeLocale];

  return (
    <div className="space-y-4">

      {/* Черновики */}
      <SectionCard
        title="Города в сессии"
        action={
          <button
            type="button" onClick={onCreateDraft}
            className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors"
          >
            + Добавить город
          </button>
        }
      >
        <div className="flex flex-wrap gap-2">
          {cityDrafts.length === 0
            ? <span className="text-sm text-gray-400">Нет черновиков — добавьте первый город</span>
            : cityDrafts.map((draft) => {
              const isActive = String(draft.id) === String(activeCityDraftId);
              return (
                <div key={draft.id} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                  isActive ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300'
                }`}>
                  <button type="button" onClick={() => onSelectDraft(draft.id)} className="font-medium">
                    {getCityDraftName(draft)}
                  </button>
                  {draft.id !== 'legacy' && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onDeleteDraft(draft.id); }}
                      className={`text-sm ml-0.5 ${isActive ? 'text-blue-200 hover:text-white' : 'text-gray-300 hover:text-red-500'} transition-colors`}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })
          }
        </div>
      </SectionCard>

      {/* Языки */}
      <SectionCard title="Язык редактирования">
        <div className="space-y-2">
          <LocalePills
            localeData={localeData}
            activeLocale={activeLocale}
            defaultLocale={defaultLocale}
            onSwitch={onSwitchLocale}
            onSetDefault={onSetDefaultLocale}
            onAddLocale={onAddLocale}
            onRemoveLocale={onRemoveLocale}
          />
          {currentStatus !== 'complete' && (
            <p className={`text-xs ${currentStatus === 'empty' ? 'text-red-500' : 'text-amber-600'}`}>
              {currentStatus === 'empty'
                ? `Для ${localeLabel} не заполнено ни одно поле`
                : `Для ${localeLabel} заполнено не всё — проверьте название, страну и описание`
              }
            </p>
          )}
        </div>
      </SectionCard>

      {/* Данные города + координаты */}
      <SectionCard title={`Данные города · ${localeLabel}`}>
        <div className="flex gap-5 items-start">
          <PhotoPanel
            imagePreview={imagePreview}
            photoUploading={photoUploading}
            imageOriginalUrl={imageOriginalUrl}
            imageCopyright={imageCopyright}
            photoFileRef={photoFileRef}
            onOpenCommonsModal={onOpenCommonsModal}
            onPhotoFileChange={onPhotoFileChange}
            onPhotoDelete={onPhotoDelete}
            onImageOriginalUrlChange={onImageOriginalUrlChange}
            onImageCopyrightChange={onImageCopyrightChange}
          />

          <div className="flex-1 min-w-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={currentLocale.name || ''}
                  onChange={(e) => onUpdateLocaleField('name', e.target.value)}
                  placeholder="Например, Москва"
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    showValidation && activeLocale === defaultLocale && !(currentLocale.name || '').trim()
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-200'
                  }`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Страна</label>
                <input
                  type="text"
                  value={currentLocale.country || ''}
                  onChange={(e) => onUpdateLocaleField('country', e.target.value)}
                  placeholder="Россия"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
              <textarea
                value={currentLocale.description || ''}
                onChange={(e) => onUpdateLocaleField('description', e.target.value)}
                rows={5}
                placeholder={`Описание города на ${currentLocale.langName || localeLabel}`}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          <CoordinatesPanel
            lat={lat} lon={lon}
            savedLat={savedLat} savedLon={savedLon}
            setMapContainerRef={setMapContainerRef}
            onLatChange={onLatChange}
            onLonChange={onLonChange}
            onRestoreSavedCoords={onRestoreSavedCoords}
          />
        </div>
      </SectionCard>

      {/* Футер */}
      <div className="flex items-center justify-between pt-1">
        <div className="text-sm">
          {showValidation && !canProceed && (
            <p className="text-red-600">
              Заполните название для основного языка ({(localeData[defaultLocale]?.lang || defaultLocale || '').toUpperCase()})
            </p>
          )}
          {canProceed && incompleteLocales.length > 0 && (
            <p className="text-amber-600">
              ⚠ Не все языки заполнены: {incompleteLocales.join(', ')}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleNext}
          disabled={saving}
          className={`px-6 py-2 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 ${
            canProceed
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-red-500 text-white hover:bg-red-600'
          }`}
        >
          {saving ? 'Сохранение...' : 'Далее: Теги →'}
        </button>
      </div>
    </div>
  );
}
