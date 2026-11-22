import { useEffect, useMemo, useState } from 'react';
import { contentAuthorsAPI } from '../../../api/generation';
import { createCoordinatePasteHandler } from '../../../utils/coordinates';
import { usePasteImageOnHover } from '../../../hooks/usePasteImageOnHover';
import { FormLabel, Button, Chip, FileButton, LoadingOverlay, LocaleEditor, Panel, Select, Textarea, TextInput, Glyph } from '@aspectum/admin-ui-web';

// ─── helpers ──────────────────────────────────────────────────────────────────

function cityOptionLabel(city) {
  if (!city) return 'Без названия';
  if (typeof city.name === 'string' && city.name.trim()) return city.name.trim();
  if (city.name && typeof city.name === 'object') {
    const value = city.name.ru || city.name.en || city.name.it || Object.values(city.name).find((item) => typeof item === 'string' && item.trim());
    if (value) return value;
  }
  return city.display_name || city.title || 'Без названия';
}

function localeStatus(loc) {
  const filled = [loc?.name, loc?.description, loc?.country].filter(v => (v || '').trim()).length;
  if (filled === 3) return 'complete';
  if (filled > 0) return 'partial';
  return 'empty';
}

// ─── sub-components ───────────────────────────────────────────────────────────

function CoordinatesPanel({ lat, lon, savedLat, savedLon, setMapContainerRef, onLatChange, onLonChange, onRestoreSavedCoords }) {
  // Вставка пары "55.7558, 37.6173" в любое из полей заполняет оба
  const handleCoordPaste = createCoordinatePasteHandler(({ lat: pLat, lon: pLon }) => {
    onLatChange(String(pLat));
    onLonChange(String(pLon));
  });

  return (
    <div className="w-56 shrink-0 space-y-2">
      <div className="text-xs font-semibold text-aspectum-text-muted uppercase tracking-wide">Координаты</div>
      <div ref={setMapContainerRef} className="w-full h-44 rounded-aspectum-card border border-aspectum-border overflow-hidden z-0" />
      <div className="grid grid-cols-2 gap-1.5">
        <TextInput type="number" step="0.000001" value={lat} onChange={(e) => onLatChange(e.target.value)} onPaste={handleCoordPaste} placeholder="Широта" />
        <TextInput type="number" step="0.000001" value={lon} onChange={(e) => onLonChange(e.target.value)} onPaste={handleCoordPaste} placeholder="Долгота" />
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRestoreSavedCoords}
        disabled={savedLat == null || savedLon == null}
        className="w-full"
      >
        Вернуть сохранённые
      </Button>
      <p className="text-[10px] text-aspectum-text-disabled text-center">кликните по карте для выбора</p>
    </div>
  );
}

function PhotoPanel({
  imagePreview, photoUploading, imageOriginalUrl, imageCopyright,
  photoFileRef, onOpenCommonsModal, onPhotoFileChange, onPhotoDelete,
  onImageOriginalUrlChange, onImageCopyrightChange,
}) {
  const photoPaste = usePasteImageOnHover((file) =>
    onPhotoFileChange?.({ target: { files: [file], value: '' } }),
  );
  return (
    <div className="w-48 shrink-0 space-y-2">
      <div
        {...photoPaste}
        title="Наведите и нажмите Ctrl+V, чтобы вставить фото из буфера"
        className="relative aspect-square bg-aspectum-surface-subtle rounded-aspectum-card overflow-hidden border border-aspectum-border flex items-center justify-center">
        {imagePreview
          ? <img src={imagePreview} alt="Фото" className="w-full h-full object-cover" />
          : <span className="text-aspectum-text-disabled text-xs">Нет фото</span>
        }
        <LoadingOverlay loading={photoUploading} label="Загрузка фото…" className="absolute inset-0" />
        {imagePreview && onPhotoDelete && (
          <Button
            type="button" onClick={onPhotoDelete}
            variant="danger"
            size="sm"
            className="absolute top-2 left-2 shadow text-[10px]"
          >
            <Glyph name="✕" /> Удалить
          </Button>
        )}
        <Button
          type="button" onClick={onOpenCommonsModal}
          variant="purple"
          size="sm"
          className="absolute top-2 right-2 shadow text-[10px]"
        >
          ⊞ Библиотека
        </Button>
      </div>

      <FileButton inputRef={photoFileRef} accept="image/*" variant="soft" size="md" onChange={onPhotoFileChange} className="w-full">
        + Добавить фото
      </FileButton>

      <TextInput type="url" value={imageOriginalUrl || ''} onChange={(e) => onImageOriginalUrlChange(e.target.value)} placeholder="URL источника" />
      <TextInput type="text" value={imageCopyright || ''} onChange={(e) => onImageCopyrightChange(e.target.value)} placeholder="© Автор / Источник" />
    </div>
  );
}

// ─── main ────────────────────────────────────────────────────────────────────

export default function SessionWizardCityStep({
  localeData, activeLocale, defaultLocale, currentLocale,
  lat, lon, savedLat, savedLon,
  imagePreview, photoUploading, imageOriginalUrl, imageCopyright,
  setMapContainerRef, photoFileRef,
  onOpenCommonsModal, onPhotoFileChange, onPhotoDelete,
  onImageOriginalUrlChange, onImageCopyrightChange,
  onSwitchLocale, onSetDefaultLocale, onAddLocale, onRemoveLocale,
  onUpdateLocaleField,
  onLatChange, onLonChange, onRestoreSavedCoords,
  headerEnd = null,
  parentCityId, setParentCityId, referenceCities = [],
  authorIds = [], setAuthorIds,
  onGoToStep, saving,
}) {
  const [showValidation, setShowValidation] = useState(false);
  const [authors, setAuthors] = useState([]);
  useEffect(() => { contentAuthorsAPI.list().then((r) => setAuthors(r.data?.data || r.data || [])).catch(() => setAuthors([])); }, []);

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <LocaleEditor
            localeData={localeData}
            activeLocale={activeLocale}
            defaultLocale={defaultLocale}
            onSwitch={onSwitchLocale}
            onSetDefault={onSetDefaultLocale}
            onAddLocale={onAddLocale}
            onRemoveLocale={onRemoveLocale}
          />
          {currentStatus !== 'complete' && (
            <p className={`text-xs ${currentStatus === 'empty' ? 'text-aspectum-danger-subtle' : 'text-aspectum-warning'}`}>
              {currentStatus === 'empty'
                ? `Для ${localeLabel} не заполнено ни одно поле`
                : `Для ${localeLabel} заполнено не всё — проверьте название, страну и описание`
              }
            </p>
          )}
        </div>
        {headerEnd}
      </div>

      <Panel className="p-4">
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
                <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="xs">
                  Название <span className="text-aspectum-danger-subtle">*</span>
                </FormLabel>
                <TextInput
                  className={
                    showValidation && activeLocale === defaultLocale && !(currentLocale.name || '').trim()
                      ? 'border-aspectum-danger-border-strong bg-aspectum-danger-soft'
                      : ''
                  }
                  type="text"
                  value={currentLocale.name || ''}
                  onChange={(e) => onUpdateLocaleField('name', e.target.value)}
                  placeholder="Например, Москва"
                />
              </div>
              <div>
                <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="xs">Страна</FormLabel>
                <TextInput type="text" value={currentLocale.country || ''} onChange={(e) => onUpdateLocaleField('country', e.target.value)} placeholder="Россия" />
              </div>
            </div>

            <div>
              <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="xs">Описание</FormLabel>
              <Textarea value={currentLocale.description || ''} onChange={(e) => onUpdateLocaleField('description', e.target.value)} rows={5} placeholder={`Описание города на ${currentLocale.langName || localeLabel}`} />
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

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-aspectum-border-subtle pt-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-aspectum-text-muted">Спецгид</span>
          <Select value={parentCityId || ''} onChange={(e) => setParentCityId(e.target.value)} className="max-w-xs">
            <option value="">Обычный город</option>
            {referenceCities.filter((city) => !city.parent_city).map((city) => <option key={city.id} value={city.id}>{cityOptionLabel(city)}</option>)}
          </Select>
          <span className="text-xs text-aspectum-text-muted">Родительский город, если сессия — спецгид.</span>
        </div>
        {parentCityId && (
          <div className="mt-3 flex flex-wrap gap-2">
            {authors.map((author) => {
              const id = String(author.id);
              const active = authorIds.includes(id);
              return (
                <Chip key={id} selected={active} onClick={() => setAuthorIds(active ? authorIds.filter((value) => value !== id) : [...authorIds, id])}>
                  {author.name}{active ? ' ✓' : ''}
                </Chip>
              );
            })}
          </div>
        )}
      </Panel>

      {/* Футер */}
      <div className="flex items-center justify-between pt-1">
        <div className="text-sm">
          {showValidation && !canProceed && (
            <p className="text-aspectum-danger">
              Заполните название для основного языка ({(localeData[defaultLocale]?.lang || defaultLocale || '').toUpperCase()})
            </p>
          )}
          {canProceed && incompleteLocales.length > 0 && (
            <p className="text-aspectum-warning">
              <Glyph name="⚠" /> Не все языки заполнены: {incompleteLocales.join(', ')}
            </p>
          )}
        </div>

        <Button
          type="button"
          variant={canProceed ? 'primary' : 'danger'}
          size="md"
          onClick={handleNext}
          disabled={saving}
        >
          {saving ? 'Сохранение...' : 'Далее: Теги →'}
        </Button>
      </div>
    </div>
  );
}
