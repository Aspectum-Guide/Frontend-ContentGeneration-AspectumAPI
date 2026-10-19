import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { usePasteImageOnHover } from '../../../hooks/usePasteImageOnHover';
import AiGenerationModal from '../../../components/generation/AiGenerationModal.jsx';
import { FormLabel, WizardActionFooter as WizardGenerationActionFooter, formGridClassName } from '@aspectum/ui';
import AiGenerationQualitySettings from '../../../components/generation/AiGenerationQualitySettings.jsx';
import AiGenerationDedupeToggle from '../../../components/generation/AiGenerationDedupeToggle.jsx';
import AiGenerationCountField from '../../../components/generation/AiGenerationCountField.jsx';
import { getAttrName, getSessionEntityImagePreview, resolveSessionEntityImageOriginalUrl, resolveSessionEntityImageCopyright, normalizeId } from './sessionWizardShared.jsx';
import SessionWizardAttractionTagsPicker from './SessionWizardAttractionTagsPicker.jsx';
import { createCoordinatePasteHandler } from '../../../utils/coordinates';
import { useAppLanguages } from '../../../hooks/useAppLanguages';
import { Alert, Button, EmptyState, FileButton, IconButton, LoadingOverlay, LocaleEditor, Panel, SectionHeader, Select, Spinner, Textarea, TextInput } from '@aspectum/ui';

const getCityDisplayName = (city) => {
  if (!city) return 'Без названия';

  if (typeof city.name === 'string') return city.name;

  if (city.name && typeof city.name === 'object') {
    return (
      city.name.ru ||
      city.name.en ||
      city.name.it ||
      Object.values(city.name).find(Boolean) ||
      city.id
    );
  }

  return city.display_name || city.title || city.id || 'Без названия';
};

const getDraftCityDisplayName = (draft) => {
  if (!draft) return 'Без названия';

  if (typeof draft.name === 'string') return draft.name;

  if (draft.name && typeof draft.name === 'object') {
    return (
      draft.name.ru ||
      draft.name.en ||
      draft.name.it ||
      Object.values(draft.name).find(Boolean) ||
      draft.id
    );
  }

  return draft.display_name || draft.id || 'Без названия';
};


const getIlDatabaseCityId = (item) => normalizeId(item?.city_id ?? item?.city);

const getIlDraftCityId = (item) => normalizeId(item?.session_city_id ?? item?.session_city);

const getIlCityBindingLabel = (item, referenceCities = [], cityDrafts = []) => {
  const assignedCityType = item?.assigned_city_type || 'none';

  if (assignedCityType === 'database') {
    const cityId = getIlDatabaseCityId(item);
    const city =
      (item?.city && typeof item.city === 'object' ? item.city : null) ||
      referenceCities.find((c) => normalizeId(c.id) === cityId);
    return city
      ? `Город из базы: ${getCityDisplayName(city)}`
      : 'Город из базы: не выбран';
  }

  if (assignedCityType === 'draft') {
    const draftId = getIlDraftCityId(item);
    const draft =
      (item?.session_city && typeof item.session_city === 'object'
        ? item.session_city
        : null) || cityDrafts.find((d) => normalizeId(d.id) === draftId);
    return draft
      ? `Город из сессии: ${getDraftCityDisplayName(draft)}`
      : 'Город из сессии: не выбран';
  }

  return 'Без города';
};

const parseMapCoord = (value) => {
  if (value === null || value === undefined || value === '') return NaN;

  return parseFloat(String(value).trim().replace(',', '.'));
};

const hasValidMapCoords = (latValue, lonValue) => {
  const parsedLat = parseMapCoord(latValue);
  const parsedLon = parseMapCoord(lonValue);

  return (
    Number.isFinite(parsedLat) &&
    Number.isFinite(parsedLon) &&
    parsedLat >= -90 &&
    parsedLat <= 90 &&
    parsedLon >= -180 &&
    parsedLon <= 180
  );
};

function IlDraftsPanel({
  interactiveLocations = [],
  currentIl,
  onSelectLocation,
  onAddLocation,
}) {
  const currentIlId = normalizeId(currentIl?.id);

  return (
    <Panel tone="muted" className="p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-aspectum-text-emphasis">
          Интерактивные локации в сессии
        </p>

        <Button
          type="button"
          onClick={onAddLocation}
          variant="softStrong"
          size="sm"
        >
          + Добавить
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {interactiveLocations.length === 0 ? (
          <EmptyState title="Пока нет интерактивных локаций" className="py-3" />
        ) : (
          interactiveLocations.map((item, index) => {
            const itemId = normalizeId(item.id);
            const isActive = itemId === currentIlId;

            return (
              <Button
                key={item.id}
                type="button"
                onClick={() => {
                  if (!isActive) {
                    onSelectLocation(item.id);
                  }
                }}
                variant={isActive ? 'selectableActive' : 'selectable'}
                size="sm"
                className="gap-1"
                title={getAttrName(item) || 'без названия'}
              >
                <span className="text-aspectum-text-disabled">{index + 1}.</span>
                <span>{getAttrName(item) || 'без названия'}</span>
              </Button>
            );
          })
        )}
      </div>
    </Panel>
  );
}

export function IlPhotoPanel({
  currentIl,
  photoUploading,
  photoFileRef,
  iconUploading,
  iconFileRef,
  onOpenCommonsModal,
  onPhotoFileChange,
  onIconFileChange,
  onRemoveIcon,
  onUpdateIlPatch,
}) {
  const preview = getSessionEntityImagePreview(currentIl);
  const imageOriginalUrl = resolveSessionEntityImageOriginalUrl(currentIl);
  const imageCopyright = resolveSessionEntityImageCopyright(currentIl);
  const hasMapIcon = Boolean(currentIl?.icon_id || currentIl?.icon_url);

  const photoPaste = usePasteImageOnHover((file) =>
    onPhotoFileChange?.({ target: { files: [file], value: '' } }, currentIl),
  );

  return (
    <Panel as="aside" tone="muted" className="w-52 shrink-0 space-y-3 p-3">
      <div
        {...photoPaste}
        title="Наведите и нажмите Ctrl+V, чтобы вставить фото из буфера"
        className="relative aspect-[3/4] bg-aspectum-surface-subtle rounded-aspectum-card overflow-hidden border border-aspectum-border flex items-center justify-center">
        {preview ? (
          <img
            src={preview}
            alt="Фото интерактивной локации"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-aspectum-text-disabled text-sm text-center px-2">
            Фото интерактивной локации
          </div>
        )}

        <LoadingOverlay loading={photoUploading} label="Загрузка фото…" className="absolute inset-0" />

        <Button
          type="button"
          onClick={() => onOpenCommonsModal?.(currentIl)}
          title="Библиотека изображений: Commons, Минкульт, Openverse, Pastvu, Mapillary"
          variant="purple"
          size="sm"
          className="absolute top-2 right-2 shadow-aspectum-elevated"
        >
          ⊞ Библиотека
        </Button>
      </div>

      <div>
        <FileButton
          inputRef={photoFileRef}
          accept="image/*"
          variant="soft"
          size="md"
          className="w-full"
          onChange={(e) => onPhotoFileChange?.(e, currentIl)}
        >
          + Добавить фото
        </FileButton>
      </div>

      <div className="space-y-1.5">
        <div>
          <FormLabel  layout="block" size="xs" tone="muted" spacing="xxs">URL</FormLabel>
          <TextInput type="url" value={imageOriginalUrl || ''} onChange={(e) => { onUpdateIlPatch?.({ image_original_url: e.target.value, imageOriginalUrl: e.target.value, }); }} placeholder="https://upload.wikimedia.org/..." />
        </div>

        <div>
          <FormLabel  layout="block" size="xs" tone="muted" spacing="xxs">
            Авторские права
          </FormLabel>
          <TextInput type="text" value={imageCopyright || ''} onChange={(e) => { onUpdateIlPatch?.({ image_copyright: e.target.value, imageCopyright: e.target.value, }); }} placeholder="© Автор / Источник" />
        </div>
      </div>

      <div className="border-t border-aspectum-border-subtle pt-3 space-y-2">
        <p className="text-xs text-aspectum-text-muted font-medium">Иконка на карте</p>
        <div className="flex items-center gap-2">
          <div className="relative w-10 h-10 rounded-aspectum-control border border-aspectum-border bg-aspectum-surface-muted flex items-center justify-center shrink-0 overflow-hidden">
            {currentIl?.icon_url
              ? <img src={currentIl.icon_url} alt="Иконка на карте" className="w-full h-full object-contain" />
              : <span className="text-base">📍</span>
            }
            {iconUploading && (
              <div className="absolute inset-0 bg-aspectum-overlay-medium flex items-center justify-center rounded-aspectum-control">
                <Spinner size="sm" className="border-aspectum-on-accent" />
              </div>
            )}
          </div>
          <div className="flex-1 flex flex-col gap-1.5">
            <FileButton
              inputRef={iconFileRef}
              accept="image/*,.svg"
              variant="soft"
              size="sm"
              disabled={iconUploading}
              onChange={(e) => onIconFileChange?.(e, currentIl)}
              className="w-full"
            >
              {iconUploading ? 'Сохранение…' : hasMapIcon ? 'Заменить' : '+ Добавить'}
            </FileButton>
            {hasMapIcon && (
              <Button
                type="button"
                variant="softDanger"
                size="sm"
                disabled={iconUploading}
                onClick={() => onRemoveIcon?.(currentIl)}
                className="w-full"
              >
                Удалить
              </Button>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function IlMapPanel({ lat, lon, onLatChange, onLonChange, onCoordsChange }) {
  // Вставка пары "55.7558, 37.6173" в любое из полей заполняет оба
  const handleCoordPaste = createCoordinatePasteHandler(({ lat: pLat, lon: pLon }) => {
    if (onCoordsChange) {
      onCoordsChange({ lat: String(pLat), lon: String(pLon) });
    } else {
      onLatChange(String(pLat));
      onLonChange(String(pLon));
    }
  });

  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const [mapNode, setMapNode] = useState(null);
  const latestMapPropsRef = useRef({ lat, lon, onLatChange, onLonChange });
  latestMapPropsRef.current = { lat, lon, onLatChange, onLonChange };

  useEffect(() => {
    if (!mapNode) return;

    if (mapInstanceRef.current?.map) {
      requestAnimationFrame(() => {
        mapInstanceRef.current?.map?.invalidateSize();
      });
      return;
    }

    let cancelled = false;

    import('leaflet').then(({ default: L }) => {
      if (cancelled || !mapNode || mapInstanceRef.current?.map) return;

      delete L.Icon.Default.prototype._getIconUrl;

      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const initialProps = latestMapPropsRef.current;
      const hasCoords = hasValidMapCoords(initialProps.lat, initialProps.lon);
      const initialLat = parseMapCoord(initialProps.lat);
      const initialLon = parseMapCoord(initialProps.lon);

      const map = L.map(mapNode, {
        zoomControl: true,
        attributionControl: true,
      }).setView(
        hasCoords ? [initialLat, initialLon] : [55.75, 37.62],
        hasCoords ? 12 : 3,
      );

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        minZoom: 2,
      }).addTo(map);

      const updateMarker = (latValue, lonValue) => {
        const parsedLat = parseMapCoord(latValue);
        const parsedLon = parseMapCoord(lonValue);

        if (
          !Number.isFinite(parsedLat) ||
          !Number.isFinite(parsedLon) ||
          parsedLat < -90 ||
          parsedLat > 90 ||
          parsedLon < -180 ||
          parsedLon > 180
        ) {
          if (markerRef.current) {
            map.removeLayer(markerRef.current);
            markerRef.current = null;
          }

          return;
        }

        const nextLatLng = [parsedLat, parsedLon];

        if (markerRef.current) {
          markerRef.current.setLatLng(nextLatLng);
        } else {
          markerRef.current = L.marker(nextLatLng).addTo(map);
        }

        map.setView(nextLatLng, 12);
        requestAnimationFrame(() => map.invalidateSize());
      };

      map.on('click', (event) => {
        const { onLatChange: handleLatChange, onLonChange: handleLonChange } = latestMapPropsRef.current;
        handleLatChange(event.latlng.lat.toFixed(6));
        handleLonChange(event.latlng.lng.toFixed(6));
      });

      mapInstanceRef.current = {
        map,
        updateMarker,
      };

      setTimeout(() => {
        map.invalidateSize();
      }, 0);

      setTimeout(() => {
        map.invalidateSize();
      }, 250);

      if (hasCoords) {
        updateMarker(initialProps.lat, initialProps.lon);
      }
    });

    return () => {
      cancelled = true;

      if (mapInstanceRef.current?.map) {
        mapInstanceRef.current.map.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, [mapNode]);

  useEffect(() => {
    if (!mapInstanceRef.current?.updateMarker) return;

    mapInstanceRef.current.updateMarker(lat, lon);
  }, [lat, lon]);

  return (
    <Panel className="p-3">
      <div className="flex items-center justify-between mb-1">
        <FormLabel  size="sm" weight="medium" tone="strong">
          Координаты
        </FormLabel>

        <span className="text-xs text-aspectum-text-disabled">
          Клик по карте или ввод вручную
        </span>
      </div>

      <div
        ref={setMapNode}
        className="w-full h-48 rounded-aspectum-control border border-aspectum-border overflow-hidden z-0"
      />

      <div className="grid grid-cols-2 gap-2 mt-2">
        <TextInput type="number" step="0.000001" value={lat ?? ''} onChange={(e) => onLatChange(e.target.value)} onPaste={handleCoordPaste} placeholder="Широта" />

        <TextInput type="number" step="0.000001" value={lon ?? ''} onChange={(e) => onLonChange(e.target.value)} onPaste={handleCoordPaste} placeholder="Долгота" />
      </div>
    </Panel>
  );
}

export default function SessionWizardInteractiveLocationsStep({
  ilView,
  interactiveLocations = [],
  currentIl,
  ilActiveLocale,
  ilLocaleData = {},
  ilSaving,
  ilAutoSaving = false,
  ilAutoSaved = false,
  referenceCities = [],
  cityDrafts = [],
  ilGenerationProgress = null,
  eventFilterTree,
  eventFilterTreeLoading,
  eventFilterTreeError,
  photoUploading,
  photoFileRef,
  iconUploading,
  iconFileRef,
  onIconFileChange,
  onRemoveIcon,
  onOpenIlDetail,
  onAddInteractiveLocation,
  onDeleteCurrentIl,
  onLeaveIlDetailView,
  onSetIlActiveLocale,
  onUpdateIlLocaleField,
  onSaveCurrentIl,
  onUpdateCurrentIlPatch,
  onToggleCurrentIlTag,
  onReloadEventFilters,
  onOpenCommonsModal,
  onPhotoFileChange,
  ilGenerationOpen = false,
  ilGenerationPrompt = '',
  ilGenerating = false,
  ilGenerationError = '',
  ilGenerationLang = 'ru',
  ilDedupeExistingLocations = true,
  onIlDedupeExistingLocationsChange,
  ilGenerationCount = 5,
  onIlGenerationCountChange,
  onOpenIlGenerationModal,
  onCloseIlGenerationModal,
  onIlGenerationPromptChange,
  onIlGenerationLangChange,
  onGenerateInteractiveLocationsFromPrompt,
  aiGenerationMode = 'instant',
  aiUseWebSearch = false,
  aiAdvancedGenerationAvailable = true,
  onAiGenerationModeChange,
  onAiUseWebSearchChange,
  onGoToStep,
}) {
  const { languages: appLanguages } = useAppLanguages();
  const aiGenerationLangOptions = appLanguages.map((language) => ({ value: language.code, label: `${language.label || language.name || language.code} (${language.code})` }));
  const ilCurrentLocale = ilLocaleData[ilActiveLocale] || {};
  const canSubmitIlGeneration = Boolean(ilGenerationPrompt?.trim());

  const localeLabel =
    ilCurrentLocale.lang?.toUpperCase() ||
    ilActiveLocale.split('-')[0].toUpperCase();

  const updateIlPatch = (patch) => {
    if (typeof onUpdateCurrentIlPatch === 'function') {
      onUpdateCurrentIlPatch(patch);
    }
  };

  if (ilView === 'list') {
    return (
      <div className="space-y-4">
        <AiGenerationModal
          open={ilGenerationOpen}
          onBackdropClick={() => {
            if (!ilGenerating) onCloseIlGenerationModal?.();
          }}
          titleId="il-gen-title"
          busy={ilGenerating}
          progress={ilGenerationProgress?.progress}
          footer={(
            <WizardGenerationActionFooter>
              <Button
                type="button"
                onClick={() => onCloseIlGenerationModal?.()}
                disabled={ilGenerating}
                variant="outline"
                size="md"
              >
                Отмена
              </Button>
              <Button
                type="button"
                onClick={() => onGenerateInteractiveLocationsFromPrompt?.()}
                disabled={ilGenerating || !canSubmitIlGeneration}
                variant="primary"
                size="md"
              >
                Сгенерировать
              </Button>
            </WizardGenerationActionFooter>
          )}
        >
          <SectionHeader headingId="il-gen-title" title="Сгенерировать интерактивные локации" />

          <p className="text-sm text-aspectum-text-subtle">
            Все созданные интерактивные локации автоматически привязываются к городу сессии.
          </p>

          <div className="space-y-3">
            <div>
              <FormLabel
                htmlFor="il-gen-lang"
                 layout="block" size="sm" weight="medium" tone="strong" spacing="xs"
              >
                Основной язык запроса
              </FormLabel>
              <Select className="disabled:bg-aspectum-surface-subtle" id="il-gen-lang" value={ilGenerationLang || 'ru'} onChange={(e) => onIlGenerationLangChange?.(e.target.value)} disabled={ilGenerating}>
                {aiGenerationLangOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-aspectum-text-muted mt-1">
                В карточках будут заполнены все языки, настроенные на шаге «Город».
              </p>
            </div>
          </div>

          {ilGenerationError && (
            <Alert tone="error">{ilGenerationError}</Alert>
          )}

          <AiGenerationCountField
            id="il-gen-count"
            label="Количество интерактивных локаций"
            value={ilGenerationCount}
            onChange={onIlGenerationCountChange}
            generationType="interactive_locations"
            disabled={ilGenerating}
          />
          
          <AiGenerationQualitySettings
            generationMode={aiGenerationMode}
            onGenerationModeChange={onAiGenerationModeChange}
            useWebSearch={aiUseWebSearch}
            onUseWebSearchChange={onAiUseWebSearchChange}
            disabled={ilGenerating}
            advancedDisabled={!aiAdvancedGenerationAvailable}
          />


          <AiGenerationDedupeToggle
            checked={Boolean(ilDedupeExistingLocations)}
            onChange={onIlDedupeExistingLocationsChange}
            disabled={ilGenerating}
            entityType="interactive_locations"
          />

          <FormLabel  layout="block" size="sm" weight="medium" tone="strong" htmlFor="il-gen-prompt">
            Запрос к ИИ
          </FormLabel>
          <Textarea className="disabled:bg-aspectum-surface-subtle" id="il-gen-prompt" rows={5} value={ilGenerationPrompt} onChange={(e) => onIlGenerationPromptChange?.(e.target.value)} disabled={ilGenerating} placeholder="Например: Необычные места для прогулок с координатами и описанием." />
        </AiGenerationModal>

        <SectionHeader title="Интерактивные локации" description="Добавьте объекты — они будут привязаны к городу сессии автоматически" actions={<>
            <Button
              type="button"
              onClick={() => onOpenIlGenerationModal?.()}
              variant="primary"
              size="md"
            >
              Сгенерировать
            </Button>
            <Button
              type="button"
              onClick={onAddInteractiveLocation}
              variant="primary"
              size="md"
            >
              + Добавить
            </Button>
          </>} />

        {interactiveLocations.length === 0 ? (
          <EmptyState icon="📍" title="Нет интерактивных локаций. Нажмите «+ Добавить»" />
        ) : (
          <div className="space-y-2">
            {interactiveLocations.map((item, idx) => (
              <div
                key={item.id}
                onClick={() => onOpenIlDetail?.(item.id)}
                className="flex items-center justify-between p-3 bg-aspectum-surface border border-aspectum-border rounded-aspectum-control hover:border-aspectum-primary-border-strong hover:bg-aspectum-primary-soft cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 flex items-center justify-center rounded-full bg-aspectum-surface-subtle text-xs font-medium text-aspectum-text-subtle">
                    {idx + 1}
                  </span>

                  <div>
                    <div className="text-sm font-medium text-aspectum-text">
                      {getAttrName(item) || 'без названия'}
                    </div>

                    <div className="text-xs text-aspectum-text-muted">
                      {getIlCityBindingLabel(item, referenceCities, cityDrafts)}
                    </div>

                    {hasValidMapCoords(item?.lat, item?.lon) && (
                      <div className="text-xs text-aspectum-text-disabled">
                        {item.lat}, {item.lon}
                      </div>
                    )}
                  </div>
                </div>

                <span className="text-xs text-aspectum-primary font-medium">
                  Открыть →
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-between pt-2">
          <Button
            type="button"
            onClick={() => {
              void onGoToStep?.(3);
            }}
            variant="outline"
            size="md"
          >
            ← Назад: Достопримечательности
          </Button>

          <Button
            type="button"
            onClick={() => {
              void onGoToStep?.(5);
            }}
            variant="primary"
            size="md"
          >
            Далее: Публикация →
          </Button>
        </div>
      </div>
    );
  }

  if (!currentIl) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <IconButton
          onClick={() => {
            void onLeaveIlDetailView?.();
          }}
          variant="outline"
          className="w-8 h-8"
          label="Вернуться к списку интерактивных локаций"
        >
          ←
        </IconButton>

        <span className="text-base font-semibold text-aspectum-text">
          {getAttrName(currentIl) || 'без названия'}
        </span>

        <Button
          type="button"
          onClick={onDeleteCurrentIl}
          variant="softDanger"
          size="sm"
          className="ml-auto"
        >
          Удалить
        </Button>
      </div>

      <IlDraftsPanel
        interactiveLocations={interactiveLocations}
        currentIl={currentIl}
        onSelectLocation={onOpenIlDetail}
        onAddLocation={onAddInteractiveLocation}
      />

      <LocaleEditor
        localeData={ilLocaleData}
        activeLocale={ilActiveLocale}
        onSwitch={onSetIlActiveLocale}
        showStatus={false}
      />

      <div className="flex gap-5 items-start">
        <IlPhotoPanel
          currentIl={currentIl}
          photoUploading={photoUploading}
          photoFileRef={photoFileRef}
          iconUploading={iconUploading}
          iconFileRef={iconFileRef}
          onOpenCommonsModal={onOpenCommonsModal}
          onPhotoFileChange={onPhotoFileChange}
          onIconFileChange={onIconFileChange}
          onRemoveIcon={onRemoveIcon}
          onUpdateIlPatch={updateIlPatch}
        />

        <main className="flex-1 min-w-0 space-y-4">
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-3">
              <div>
                <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="xs">
                  Название интерактивной локации ({localeLabel})
                </FormLabel>

                <TextInput type="text" value={ilCurrentLocale.name || ''} onChange={(e) => onUpdateIlLocaleField?.('name', e.target.value)} placeholder="Название интерактивной локации" />
              </div>

              <div className={formGridClassName({ responsive: false })}>
                <div>
                  <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="xs">
                    Индекс
                  </FormLabel>

                  <TextInput type="number" value={currentIl?.index ?? currentIl?.order ?? 0} onChange={(e) => { const value = Number(e.target.value || 0); updateIlPatch({ index: value, order: value, }); }} />
                </div>

                <div>
                  <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="xs">
                    Ранг
                  </FormLabel>

                  <TextInput type="number" value={currentIl?.rank ?? 0} onChange={(e) => { updateIlPatch({ rank: Number(e.target.value || 0), }); }} />
                </div>
              </div>

              <SessionWizardAttractionTagsPicker
                selectedTags={currentIl?.tags || []}
                eventFilterTree={eventFilterTree}
                eventFilterTreeLoading={eventFilterTreeLoading}
                eventFilterTreeError={eventFilterTreeError}
                onToggleTag={onToggleCurrentIlTag}
                onReloadEventFilters={onReloadEventFilters}
              />

              <Panel tone="muted" className="p-3">
                <p className="text-sm font-medium text-aspectum-text-emphasis">
                  {getIlCityBindingLabel(
                    currentIl,
                    referenceCities,
                    cityDrafts,
                  )}
                </p>
                <p className="mt-1 text-xs text-aspectum-text-muted">
                  Привязка к городу сессии управляется автоматически.
                </p>
              </Panel>
            </div>

            <IlMapPanel
              lat={currentIl?.lat ?? ''}
              lon={currentIl?.lon ?? ''}
              onLatChange={(value) => {
                updateIlPatch({ lat: value });
              }}
              onLonChange={(value) => {
                updateIlPatch({ lon: value });
              }}
              onCoordsChange={({ lat, lon }) => {
                updateIlPatch({ lat, lon });
              }}
            />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <FormLabel  size="sm" weight="medium" tone="strong">
                Описание
              </FormLabel>

              <span className="px-1.5 py-0.5 bg-aspectum-primary-muted text-aspectum-primary-hover text-xs rounded font-mono">
                {localeLabel}
              </span>
            </div>

            <Textarea value={ilCurrentLocale.description || ''} onChange={(e) => onUpdateIlLocaleField?.('description', e.target.value) } rows={7} placeholder="Краткое описание интерактивной локации..." />
          </div>

          <div className="flex items-center justify-end gap-3">
            {(ilAutoSaving || ilAutoSaved) && !ilSaving && (
              <div
                className={`flex items-center gap-1.5 text-xs transition-opacity ${
                  ilAutoSaved && !ilAutoSaving
                    ? 'text-aspectum-success'
                    : 'text-aspectum-text-disabled'
                }`}
              >
                {ilAutoSaving ? (
                  <>
                    <Spinner size="xs" className="border-2 border-aspectum-border-strong" />
                    <span>Сохранение...</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>Сохранено</span>
                  </>
                )}
              </div>
            )}
            <Button
              type="button"
              onClick={onSaveCurrentIl}
              disabled={ilSaving}
              variant="primary"
              size="md"
            >
              {ilSaving ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
}
