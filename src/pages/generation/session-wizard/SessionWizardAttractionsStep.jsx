import { useEffect, useRef, useState } from 'react';
import AiGenerationModal from '../../../components/generation/AiGenerationModal.jsx';
import { FormLabel, WizardActionFooter as WizardGenerationActionFooter, formGridClassName, Glyph } from '@aspectum/admin-ui-web';
import AiGenerationQualitySettings from '../../../components/generation/AiGenerationQualitySettings.jsx';
import AiGenerationDedupeToggle from '../../../components/generation/AiGenerationDedupeToggle.jsx';
import AiGenerationCountField from '../../../components/generation/AiGenerationCountField.jsx';
import { getAttrName, getFlag, getSessionEntityImagePreview, resolveSessionEntityImageOriginalUrl, resolveSessionEntityImageCopyright, normalizeId } from './sessionWizardShared.jsx';
import { usePasteImageOnHover } from '../../../hooks/usePasteImageOnHover';
import SessionWizardAttractionTagsPicker from './SessionWizardAttractionTagsPicker.jsx';
import SessionWizardAttractionRelatedEventsPicker from './SessionWizardAttractionRelatedEventsPicker.jsx';
import SessionAttractionCommercePanel from './SessionAttractionCommercePanel.jsx';
import SessionAttractionTourPanel from './SessionAttractionTourPanel.jsx';
import UsefulInfoTextImportBox from './UsefulInfoTextImportBox.jsx';
import { TTSProviderSettingsPanel } from './SessionWizardAttractionAudioGuidesBlock.jsx';
import { createCoordinatePasteHandler } from '../../../utils/coordinates';
import { useAppLanguages } from '../../../hooks/useAppLanguages';
import { Alert, Button, Checkbox, EmptyState, EntityDraftsPanel, LocaleEditor, MediaUploadField, Panel, ProgressBar, SectionHeader, Select, SelectableCard, Spinner, Textarea, TextInput } from '@aspectum/admin-ui-web';

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

const getAttrDatabaseCityId = (attr) => {
  return normalizeId(attr?.city_id ?? attr?.city);
};

const getAttrDraftCityId = (attr) => {
  return normalizeId(attr?.session_city_id ?? attr?.session_city);
};

const getAttractionCityBindingLabel = (attr, referenceCities = [], cityDrafts = []) => {
  const assignedCityType = attr?.assigned_city_type || 'none';

  if (assignedCityType === 'database') {
    const cityFromAttr = attr?.city && typeof attr.city === 'object' ? attr.city : null;
    const cityId = getAttrDatabaseCityId(attr);

    const city =
      cityFromAttr ||
      referenceCities.find((item) => normalizeId(item.id) === cityId);

    return city
      ? `Город из базы: ${getCityDisplayName(city)}`
      : 'Город из базы: не выбран';
  }

  if (assignedCityType === 'draft') {
    const draftFromAttr =
      attr?.session_city && typeof attr.session_city === 'object'
        ? attr.session_city
        : null;

    const draftId = getAttrDraftCityId(attr);

    const draft =
      draftFromAttr ||
      cityDrafts.find((item) => normalizeId(item.id) === draftId);

    return draft
      ? `Город из сессии: ${getDraftCityDisplayName(draft)}`
      : 'Город из сессии: не выбран';
  }

  return 'Без города';
};

function AttractionDraftsPanel({
  attractions = [],
  currentAttr,
  onSelectAttraction,
  onAddAttraction,
}) {
  const currentAttrId = normalizeId(currentAttr?.id);

  return (
    <EntityDraftsPanel
      title="Черновики достопримечательностей в сессии"
      items={attractions}
      emptyText="Пока нет достопримечательностей"
      actions={(
        <Button type="button" onClick={onAddAttraction} variant="softStrong" size="sm">
          + Добавить
        </Button>
      )}
      renderItem={(attr, index) => {
        const attrId = normalizeId(attr.id);
        const isActiveAttr = attrId === currentAttrId;
        return (
              <SelectableCard
                key={attr.id}
                onSelect={() => {
                  if (!isActiveAttr) {
                    onSelectAttraction(attr.id);
                  }
                }}
                ariaLabel={getAttrName(attr)}
                className={`flex items-center gap-1 px-2 py-1 rounded-aspectum-control border text-xs transition-colors ${
                  isActiveAttr
                    ? 'bg-aspectum-primary-soft border-aspectum-primary-border-strong text-aspectum-primary-hover font-medium'
                    : 'bg-aspectum-surface border-aspectum-border text-aspectum-text-strong hover:border-aspectum-primary-border-strong hover:bg-aspectum-primary-soft'
                }`}
                title={getAttrName(attr)}
              >
                <span className="text-aspectum-text-disabled">{index + 1}.</span>
                <span>{getAttrName(attr)}</span>
              </SelectableCard>
        );
      }}
    />
  );
}

function AttractionPhotoPanel({
  currentAttr,
  photoUploading,
  photoFileRef,
  onOpenCommonsModal,
  onPhotoFileChange,
  onUpdateAttractionPatch,
}) {
  const preview = getSessionEntityImagePreview(currentAttr);
  const imageOriginalUrl = resolveSessionEntityImageOriginalUrl(currentAttr);
  const imageCopyright = resolveSessionEntityImageCopyright(currentAttr);

  const photoPaste = usePasteImageOnHover((file) =>
    onPhotoFileChange?.({ target: { files: [file], value: '' } }, currentAttr),
  );

  return (
    <aside className="w-52 shrink-0 space-y-3">
      <MediaUploadField
        previewUrl={preview}
        alt="Фото достопримечательности"
        placeholder="Фото достопримечательности"
        previewProps={{ ...photoPaste, title: 'Наведите и нажмите Ctrl+V, чтобы вставить фото из буфера' }}
        previewClassName="w-full h-full object-cover"
        previewContainerClassName="relative aspect-[3/4] w-full overflow-hidden rounded-aspectum-card border border-aspectum-border bg-aspectum-surface-muted flex items-center justify-center"
        uploadLabel="+ Добавить фото"
        uploadVariant="soft"
        uploadSize="md"
        uploadClassName="w-full"
        inputRef={photoFileRef}
        onChange={(e) => onPhotoFileChange?.(e, currentAttr)}
        previewOverlay={photoUploading && (
          <div className="absolute inset-0 bg-aspectum-overlay-medium flex items-center justify-center">
            <Spinner size="md" className="w-6 h-6 border-aspectum-on-accent" />
          </div>
        )}
        previewActions={(
          <Button
            type="button"
            onClick={() => onOpenCommonsModal?.(currentAttr)}
            title="Библиотека изображений: Commons, Минкульт, Openverse, Pastvu, Mapillary"
            variant="purple"
            size="sm"
            className="shadow-aspectum-elevated"
          >
            ⊞ Библиотека
          </Button>
        )}
        className="w-full"
      />

      <div className="space-y-1.5">
        <div>
          <FormLabel  layout="block" size="xs" tone="muted" spacing="xxs">URL</FormLabel>
          <TextInput type="url" value={imageOriginalUrl || ''} onChange={(e) => { onUpdateAttractionPatch({ image_original_url: e.target.value, imageOriginalUrl: e.target.value, }); }} placeholder="https://upload.wikimedia.org/..." />
        </div>

        <div>
          <FormLabel  layout="block" size="xs" tone="muted" spacing="xxs">
            Авторские права
          </FormLabel>
          <TextInput type="text" value={imageCopyright || ''} onChange={(e) => { onUpdateAttractionPatch({ image_copyright: e.target.value, imageCopyright: e.target.value, }); }} placeholder="© Автор / Источник" />
        </div>
      </div>
    </aside>
  );
}

function AttractionMapPanel({
  lat,
  lon,
  onLatChange,
  onLonChange,
  onCoordsChange,
}) {
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
        hasCoords ? 12 : 3
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
    <div>
      <div className="flex items-center justify-between mb-1">
        <FormLabel  size="sm" weight="medium" tone="default">
          Координаты
        </FormLabel>

        <span className="text-xs text-aspectum-text-muted">
          Клик по карте или ввод вручную
        </span>
      </div>

      <div
        ref={setMapNode}
        className="w-full h-48 rounded-aspectum-card border border-aspectum-border overflow-hidden z-0"
      />

      <div className="grid grid-cols-2 gap-2 mt-2">
        <TextInput type="number" step="0.000001" value={lat ?? ''} onChange={(e) => onLatChange(e.target.value)} onPaste={handleCoordPaste} placeholder="Широта" />

        <TextInput type="number" step="0.000001" value={lon ?? ''} onChange={(e) => onLonChange(e.target.value)} onPaste={handleCoordPaste} placeholder="Долгота" />
      </div>
    </div>
  );
}

// Суммарная готовность по нескольким языкам — те же поля, что у одного языка.
function sumBatchAudioStatuses(byLanguage) {
  const statuses = Object.values(byLanguage || {});
  const sum = (field) => statuses.reduce((total, item) => total + Number(item?.[field] || 0), 0);
  return {
    ready_count: sum('ready_count'),
    already_voiced_count: sum('already_voiced_count'),
    missing_text_count: sum('missing_text_count'),
    missing_guide_count: sum('missing_guide_count'),
    active_task: statuses.find((item) => item?.active_task)?.active_task || null,
    language_code: Object.keys(byLanguage || {}).join(','),
  };
}

export default function SessionWizardAttractionsStep({
  sessionId,
  attrView,
  currentAttr,
  attrActiveLocale,
  attrLocaleData,
  attrSaving,
  attrAutoSaving = false,
  attrAutoSaved = false,
  attractions,

  attractionGenerationProgress = null,
  batchAudioGenerating = false,
  batchAudioProgress = 0,
  batchAudioCurrentStep = '',
  batchAudioResult = null,
  onPrepareMissingAttractionAudio,
  onGenerateMissingAttractionAudio,
  elevenLabsSettingsLoading = false,
  elevenLabsSettingsError = '',
  elevenLabsSettings = null,
  ttsSettingsLoading = false,
  ttsSettingsError = '',
  ttsSettings = null,
  audioGuideTtsProvider = 'fish_audio',
  audioGuideTtsVoiceId = '',
  audioGuideTtsModelId = '',
  onLoadTtsSettings,
  onSetAudioGuideTtsProvider,
  onLoadElevenLabsSettings,
  onSetAudioGuideTtsVoiceId,
  onSetAudioGuideTtsModelId,

  referenceCities = [],
  cityDrafts = [],
  onUpdateCurrentAttrPatch,

  attractionPhotoUploading = false,
  attractionPhotoFileRef,
  onOpenAttractionCommonsModal,
  onAttractionPhotoFileChange,

  onOpenAttrDetail,
  onAddAttraction,
  onImportAttractionsFromText,
  onDeleteCurrentAttr,
  onDeleteAttractionsByIds,
  onSetAttrView,
  onSetCurrentAttr,
  onSetAttrActiveLocale,
  onUpdateAttrLocaleField,
  onSaveCurrentAttr,
  onRegenerateAttractionDetail,
  onGoToStep,

  eventFilterTree = [],
  eventFilterTreeLoading = false,
  eventFilterTreeError = '',
  onReloadEventFilters,
  onToggleCurrentAttractionTag,
  onAddCurrentAttractionRelatedEvent,
  onRemoveCurrentAttractionRelatedEvent,

  attractionGenerationOpen = false,
  attractionGenerationPrompt = '',
  attractionGenerating = false,
  attractionGenerationError = '',
  attractionGenerationLang = 'ru',
  attractionGenerationCount = 5,
  attractionDedupeExistingItems = true,
  onAttractionDedupeExistingItemsChange,
  onAttractionGenerationCountChange,
  onOpenAttractionGenerationModal,
  onCloseAttractionGenerationModal,
  onAttractionGenerationPromptChange,
  onAttractionGenerationLangChange,
  onGenerateAttractionsFromPrompt,
  onOpenAttractionInfoGenerateModal,
  aiGenerationMode = 'instant',
  aiUseWebSearch = false,
  aiAdvancedGenerationAvailable = true,
  onAiGenerationModeChange,
  onAiUseWebSearchChange,
}) {
  const { languages: appLanguages } = useAppLanguages();
  const aiGenerationLangOptions = appLanguages.map((language) => ({ value: language.code, label: `${language.label || language.name || language.code} (${language.code})` }));
  const attrCurrentLocale = attrLocaleData[attrActiveLocale] || {};
  const batchAudioLanguageOptions = Object.entries(attrLocaleData || {}).reduce(
    (options, [key, loc]) => {
      const lang = loc?.lang || key.split('-')[0];
      if (lang && !options.some((item) => item.lang === lang)) {
        options.push({ lang, label: `${getFlag(loc?.code)} ${loc?.langName || lang.toUpperCase()}` });
      }
      return options;
    },
    [],
  );
  const [selectMode, setSelectMode] = useState(false);
  const [selectedAttractionIds, setSelectedAttractionIds] = useState(() => new Set());
  const [regenDetailLoading, setRegenDetailLoading] = useState(false);
  const [batchAudioModalOpen, setBatchAudioModalOpen] = useState(false);
  const [batchAudioStatusLoading, setBatchAudioStatusLoading] = useState(false);
  const [batchAudioStatusError, setBatchAudioStatusError] = useState('');
  const [batchAudioStatus, setBatchAudioStatus] = useState(null);
  // Языки пакетной озвучки: по умолчанию — язык открытой вкладки.
  const [batchAudioLanguages, setBatchAudioLanguages] = useState([]);
  const [batchAudioStatusByLanguage, setBatchAudioStatusByLanguage] = useState({});
  // Перезапись существующего аудио. По умолчанию выключена: пакетная озвучка
  // задумана как «добить недостающее», а замена стоит денег у провайдера.
  const [batchAudioReplaceExisting, setBatchAudioReplaceExisting] = useState(false);
  const batchTotal = Number(
    batchAudioResult?.total ?? batchAudioResult?.ready_count ?? 0,
  );
  const batchProcessed = Number(batchAudioResult?.processed ?? 0);
  const displayedBatchProgress = Math.max(
    0,
    Math.min(100, Number(batchAudioProgress || 0)),
  );
  const selectedTtsProvider = (ttsSettings?.providers || []).find(
    (provider) => provider?.id === audioGuideTtsProvider,
  );
  const readyForBatchAudio = Number(batchAudioStatus?.ready_count || 0);
  const alreadyVoicedCount = Number(batchAudioStatus?.already_voiced_count || 0);
  // ready_count уже рассчитан backend с учётом выбранного режима.
  const batchAudioTargetCount = readyForBatchAudio;
  const batchAudioCanStart =
    !batchAudioStatusLoading &&
    batchAudioLanguages.length > 0 &&
    selectedTtsProvider?.configured !== false &&
    (batchAudioStatus === null ||
      batchAudioTargetCount > 0 ||
      batchAudioStatus?.active_task);

  const loadBatchAudioStatus = async (languages, replaceExisting) => {
    setBatchAudioStatusLoading(true);
    setBatchAudioStatusError('');
    try {
      const entries = await Promise.all(languages.map(async (languageCode) => [
        languageCode,
        (await onPrepareMissingAttractionAudio?.({ replaceExisting, languageCode })) || {},
      ]));
      const byLanguage = Object.fromEntries(entries);
      setBatchAudioStatusByLanguage(byLanguage);
      setBatchAudioStatus(languages.length ? sumBatchAudioStatuses(byLanguage) : null);
    } catch (error) {
      setBatchAudioStatusError(
        error?.response?.data?.error ||
          error?.message ||
          'Не удалось проверить готовность ОЛ к озвучке',
      );
    } finally {
      setBatchAudioStatusLoading(false);
    }
  };

  const openBatchAudioModal = async () => {
    if (batchAudioGenerating) return;
    const languages = [attrCurrentLocale.lang || attrActiveLocale.split('-')[0] || 'ru'];
    setBatchAudioLanguages(languages);
    setBatchAudioModalOpen(true);
    setBatchAudioStatus(null);
    setBatchAudioStatusByLanguage({});
    await loadBatchAudioStatus(languages, batchAudioReplaceExisting);
  };

  const changeBatchAudioReplaceMode = async (replaceExisting) => {
    setBatchAudioReplaceExisting(replaceExisting);
    await loadBatchAudioStatus(batchAudioLanguages, replaceExisting);
  };

  const changeBatchAudioLanguages = async (languages) => {
    setBatchAudioLanguages(languages);
    await loadBatchAudioStatus(languages, batchAudioReplaceExisting);
  };

  const startBatchAudio = async () => {
    if (!batchAudioCanStart) return;
    setBatchAudioModalOpen(false);
    await onGenerateMissingAttractionAudio?.({
      skipConfirmation: true,
      replaceExisting: batchAudioReplaceExisting,
      languageCodes: batchAudioLanguages.filter(
        (lang) => Number(batchAudioStatusByLanguage[lang]?.ready_count || 0) > 0 ||
          batchAudioStatusByLanguage[lang]?.active_task,
      ),
    });
  };

  const localeLabel =
    attrCurrentLocale.lang?.toUpperCase() ||
    attrActiveLocale.split('-')[0].toUpperCase();

  const updateAttractionPatch = (patch) => {
    if (typeof onUpdateCurrentAttrPatch === 'function') {
      onUpdateCurrentAttrPatch(patch);
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedAttractionIds(new Set());
  };

  const attractionIds = attractions.map((attr) => normalizeId(attr.id)).filter(Boolean);
  const allSelected =
    attractionIds.length > 0 &&
    attractionIds.every((id) => selectedAttractionIds.has(id));

  const toggleSelectedAttraction = (id) => {
    const key = normalizeId(id);
    if (!key) return;

    setSelectedAttractionIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectAllAttractions = () => {
    setSelectedAttractionIds(allSelected ? new Set() : new Set(attractionIds));
  };

  const handleBulkDeleteAttractions = async () => {
    const ids = Array.from(selectedAttractionIds);
    if (ids.length === 0) return;

    const res = await onDeleteAttractionsByIds?.(ids);
    if (!res?.cancelled) exitSelectMode();
  };

  const attractionGenCanSubmit = Boolean(attractionGenerationPrompt?.trim());

  return (
    <div>
      <AiGenerationModal
        open={attractionGenerationOpen}
        onBackdropClick={() => {
          if (!attractionGenerating) onCloseAttractionGenerationModal?.();
        }}
        titleId="attraction-gen-title"
        busy={attractionGenerating}
        progress={attractionGenerationProgress?.progress}
        footer={(
          <WizardGenerationActionFooter>
            <Button
              type="button"
              onClick={() => onCloseAttractionGenerationModal?.()}
              disabled={attractionGenerating}
              variant="outline"
              size="md"
            >
              Отмена
            </Button>
            <Button
              type="button"
              onClick={() => onGenerateAttractionsFromPrompt?.()}
              disabled={attractionGenerating || !attractionGenCanSubmit}
              variant="primary"
              size="md"
            >
              Сгенерировать
            </Button>
          </WizardGenerationActionFooter>
        )}
      >
        <SectionHeader headingId="attraction-gen-title" title="Сгенерировать достопримечательности" />

        <p className="text-sm text-aspectum-text-subtle">
          Все созданные достопримечательности автоматически привязываются к городу сессии.
        </p>

        <div className="space-y-3">
          <div>
            <FormLabel
              htmlFor="attraction-gen-lang"
               layout="block" size="sm" weight="medium" tone="strong" spacing="xs"
            >
              Язык генерации
            </FormLabel>
            <Select className="disabled:bg-aspectum-surface-subtle" id="attraction-gen-lang" value={attractionGenerationLang || 'ru'} onChange={(e) => onAttractionGenerationLangChange?.(e.target.value)} disabled={attractionGenerating}>
              {aiGenerationLangOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {attractionGenerationError && (
          <Alert tone="error">{attractionGenerationError}</Alert>
        )}

        <AiGenerationCountField
          id="attraction-gen-count"
          label="Количество достопримечательностей"
          value={attractionGenerationCount}
          onChange={onAttractionGenerationCountChange}
          generationType="attractions"
          disabled={attractionGenerating}
        />

        <AiGenerationQualitySettings
          generationMode={aiGenerationMode}
          onGenerationModeChange={onAiGenerationModeChange}
          useWebSearch={aiUseWebSearch}
          onUseWebSearchChange={onAiUseWebSearchChange}
          disabled={attractionGenerating}
          advancedDisabled={!aiAdvancedGenerationAvailable}
        />

        <AiGenerationDedupeToggle
          checked={attractionDedupeExistingItems}
          onChange={onAttractionDedupeExistingItemsChange}
          disabled={attractionGenerating}
          entityType="attractions"
        />

        <FormLabel  layout="block" size="sm" weight="medium" tone="strong" htmlFor="attraction-gen-prompt">
          Запрос к ИИ
        </FormLabel>
        <Textarea className="disabled:bg-aspectum-surface-subtle" id="attraction-gen-prompt" rows={5} value={attractionGenerationPrompt} onChange={(e) => onAttractionGenerationPromptChange?.(e.target.value)} disabled={attractionGenerating} placeholder="Например: Главные музеи и архитектурные памятники центра города." />
      </AiGenerationModal>

      <AiGenerationModal
        open={batchAudioModalOpen}
        onBackdropClick={() => {
          if (!batchAudioGenerating) setBatchAudioModalOpen(false);
        }}
        titleId="batch-attraction-audio-title"
        busy={batchAudioGenerating}
        busyLabel="Запускаем озвучку…"
        maxWidthClass="max-w-xl"
        footer={(
          <WizardGenerationActionFooter>
            <Button
              type="button"
              onClick={() => setBatchAudioModalOpen(false)}
              disabled={batchAudioGenerating}
              variant="outline"
              size="md"
            >
              Отмена
            </Button>
            <Button
              type="button"
              onClick={startBatchAudio}
              disabled={batchAudioGenerating || !batchAudioCanStart}
              variant="primary"
              size="md"
            >
              Запустить озвучку
            </Button>
          </WizardGenerationActionFooter>
        )}
      >
        <SectionHeader headingId="batch-attraction-audio-title" title="Озвучить основные локации" />

        <Panel tone="info" className="px-3 py-2 text-sm">
          {batchAudioStatusLoading ? (
            'Проверяем готовность аудиогидов…'
          ) : batchAudioStatus ? (
            <>
              Готово к озвучке: <strong>{batchAudioTargetCount}</strong>.
              {' '}{batchAudioLanguages.length > 1 ? 'Языки' : 'Язык'}:{' '}
              <strong>
                {batchAudioLanguages
                  .map((lang) => {
                    const count = batchAudioStatusByLanguage[lang]?.ready_count;
                    return batchAudioLanguages.length > 1 && count !== undefined
                      ? `${lang.toUpperCase()} (${count})`
                      : lang.toUpperCase();
                  })
                  .join(', ')}
              </strong>.
              {' '}{batchAudioReplaceExisting
                ? 'Существующее аудио будет заменено, старые файлы удалятся.'
                : 'Существующее аудио не будет перезаписано.'}
            </>
          ) : (
            'Будут озвучены только ОЛ с полным текстом и без готовой аудиодорожки.'
          )}
        </Panel>

        <Panel className="px-3 py-2 text-sm text-aspectum-text">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="font-medium">Языки озвучки</span>
            {batchAudioLanguageOptions.length > 1 ? (
              <Button
                type="button"
                variant="link"
                size="sm"
                disabled={batchAudioGenerating || batchAudioStatusLoading}
                onClick={() => changeBatchAudioLanguages(
                  batchAudioLanguages.length === batchAudioLanguageOptions.length
                    ? []
                    : batchAudioLanguageOptions.map((item) => item.lang),
                )}
              >
                {batchAudioLanguages.length === batchAudioLanguageOptions.length
                  ? 'Снять все'
                  : 'Все языки'}
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {batchAudioLanguageOptions.map((item) => (
              <FormLabel key={item.lang}  layout="rowTight">
                <Checkbox
                  checked={batchAudioLanguages.includes(item.lang)}
                  disabled={batchAudioGenerating || batchAudioStatusLoading}
                  onChange={(event) => changeBatchAudioLanguages(
                    event.target.checked
                      ? batchAudioLanguageOptions
                        .map((option) => option.lang)
                        .filter((lang) => lang === item.lang || batchAudioLanguages.includes(lang))
                      : batchAudioLanguages.filter((lang) => lang !== item.lang),
                  )}
                />
                <span>{item.label}</span>
              </FormLabel>
            ))}
          </div>
          {batchAudioLanguages.length > 1 ? (
            <p className="mt-1 text-xs text-aspectum-text-muted">
              Языки озвучиваются по очереди, у каждого свой голос проекта.
            </p>
          ) : null}
        </Panel>

        <FormLabel  size="sm" tone="emphasis"  layout="start" className="rounded-aspectum-control border border-aspectum-border px-3 py-2">
          <Checkbox
            className="mt-0.5"
            checked={batchAudioReplaceExisting}
            disabled={batchAudioGenerating || batchAudioStatusLoading}
            onChange={(event) => changeBatchAudioReplaceMode(event.target.checked)}
          />
          <span>
            Перезаписать существующее аудио
            {alreadyVoicedCount > 0 ? ` (${alreadyVoicedCount} уже озвучено)` : ''}
            <span className="block text-xs text-aspectum-text-muted">
              Старые файлы удаляются, чтобы не занимать место. Озвучка платная —
              включайте, только если нужна именно замена.
            </span>
          </span>
        </FormLabel>

        {batchAudioStatus && batchAudioTargetCount === 0 && !batchAudioStatus.active_task ? (
          <Alert tone="warning" className="text-sm">
            Новых ОЛ для озвучки нет. Уже озвучено: {Number(batchAudioStatus.already_voiced_count || 0)},
            {' '}без полного текста: {Number(batchAudioStatus.missing_text_count || 0)},
            {' '}без аудиогида: {Number(batchAudioStatus.missing_guide_count || 0)}.
          </Alert>
        ) : null}

        {batchAudioStatusError ? (
          <Alert tone="error">{batchAudioStatusError}</Alert>
        ) : null}

        <TTSProviderSettingsPanel
          provider={audioGuideTtsProvider}
          providerSettings={ttsSettings}
          providerSettingsLoading={ttsSettingsLoading}
          providerSettingsError={ttsSettingsError}
          elevenLabsSettings={elevenLabsSettings}
          elevenLabsLoading={elevenLabsSettingsLoading}
          elevenLabsError={elevenLabsSettingsError}
          voiceId={audioGuideTtsVoiceId}
          modelId={audioGuideTtsModelId}
          onProviderChange={onSetAudioGuideTtsProvider}
          onVoiceChange={onSetAudioGuideTtsVoiceId}
          onModelChange={onSetAudioGuideTtsModelId}
          onLoadProviderSettings={onLoadTtsSettings}
          onLoadElevenLabsSettings={onLoadElevenLabsSettings}
          disabled={batchAudioGenerating}
        />
      </AiGenerationModal>

      {attrView === 'list' ? (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <SectionHeader
                title="Достопримечательности"
                description="Добавьте объекты. Новые объекты из вставки будут привязаны к текущему городу сессии."
              />

              {!selectMode && (
                <div className="flex items-center gap-2">
                  {onGenerateMissingAttractionAudio ? (
                    <Button
                      type="button"
                      onClick={openBatchAudioModal}
                      disabled={batchAudioGenerating || attractions.length === 0}
                      variant="soft"
                      size="md"
                    >
                      {batchAudioGenerating
                        ? 'Озвучиваем ОЛ...'
                        : 'Озвучить все ОЛ без аудио'}
                    </Button>
                  ) : null}
                    <Button
                    type="button"
                    onClick={() => onOpenAttractionGenerationModal?.()}
                    variant="primary"
                    size="md"
                  >
                    Сгенерировать
                    </Button>
                  <Button
                    type="button"
                    onClick={onAddAttraction}
                    variant="primary"
                    size="md"
                  >
                    + Добавить
                  </Button>
                </div>
              )}
            </div>

            {attractions.length > 0 && (
              <div className="flex items-center gap-2 shrink-0">
                {selectMode ? (
                  <>
                    <Button
                      type="button"
                      onClick={toggleSelectAllAttractions}
                      variant="outline"
                      size="md"
                    >
                      {allSelected ? 'Снять все' : 'Выбрать все'}
                    </Button>
                    <Button
                      type="button"
                      onClick={handleBulkDeleteAttractions}
                      disabled={selectedAttractionIds.size === 0}
                      variant="danger"
                      size="md"
                    >
                      Удалить ({selectedAttractionIds.size})
                    </Button>
                    <Button
                      type="button"
                      onClick={exitSelectMode}
                      variant="outline"
                      size="md"
                    >
                      Отмена
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    onClick={() => setSelectMode(true)}
                    variant="outline"
                    size="md"
                  >
                    Выбрать
                  </Button>
                )}
              </div>
            )}
          </div>

          {(batchAudioGenerating || batchAudioResult || batchAudioCurrentStep) ? (
            <Panel tone="info" className="space-y-2 p-3">
              <div className="flex items-center justify-between gap-3 text-xs text-aspectum-text-muted">
                <span className="truncate">
                  {batchAudioCurrentStep || 'Пакетная озвучка завершена'}
                </span>
                <span className="shrink-0 tabular-nums">
                  {batchAudioGenerating && batchTotal > 0
                    ? `${batchProcessed}/${batchTotal}`
                    : `${Math.round(displayedBatchProgress)}%`}
                </span>
              </div>
              <ProgressBar value={displayedBatchProgress} label="Прогресс озвучки основных локаций" />
              {!batchAudioGenerating && batchAudioResult ? (
                <p className="text-xs text-aspectum-text-muted">
                  Озвучено: {Number(batchAudioResult.generated_count || 0)}.
                  {' '}Уже было готово: {Number(batchAudioResult.already_voiced_count || 0)}.
                  {' '}Без полного текста: {Number(batchAudioResult.missing_text_count || 0)}.
                  {' '}Без аудиогида: {Number(batchAudioResult.missing_guide_count || 0)}.
                  {Number(batchAudioResult.failed_count || 0) > 0
                    ? ` Ошибок: ${Number(batchAudioResult.failed_count)}.`
                    : ''}
                </p>
              ) : null}
            </Panel>
          ) : null}

          <UsefulInfoTextImportBox
            title="Вставить готовые достопримечательности"
            description="Каждая достопримечательность начинается с «# Название». Поля: координаты, индекс, ранг, описание. Привязка к городу берётся из текущего города сессии."
            buttonLabel="Создать достопримечательности"
            defaultLanguage={attractionGenerationLang || 'ru'}
            disabled={attractionGenerating}
            emptyError="Не удалось распознать достопримечательности. Каждый объект должен начинаться с «# Название»."
            errorFallback="Не удалось создать достопримечательности"
            placeholder={
              '# Колизей\n' +
              'координаты: 41.890210, 12.492231\n' +
              'индекс: 1\n' +
              'ранг: 10\n' +
              'описание:\n' +
              'Крупнейший амфитеатр Древнего Рима и один из главных символов города.\n\n' +
              '# Пантеон\n' +
              'координаты: 41.898610, 12.476873\n' +
              'индекс: 1\n' +
              'ранг: 9\n' +
              'описание:\n' +
              'Античный храм с куполом и окулюсом, позже превращённый в церковь.'
            }
            onImport={onImportAttractionsFromText}
          />

          {attractions.length === 0 ? (
            <EmptyState icon="🏛️" title="Нет достопримечательностей. Нажмите «+ Добавить»" />
          ) : (
            <div className="space-y-2">
              {attractions.map((attr, idx) => {
                const attrId = normalizeId(attr.id);
                const isSelected = selectedAttractionIds.has(attrId);

                return (
                  <div
                    key={attr.id}
                    onClick={() =>
                      selectMode
                        ? toggleSelectedAttraction(attr.id)
                        : onOpenAttrDetail(attr.id)
                    }
                    className={`flex items-center justify-between p-3 bg-aspectum-surface border rounded-aspectum-control cursor-pointer transition-colors ${
                      selectMode && isSelected
                        ? 'border-aspectum-primary-light bg-aspectum-primary-soft'
                        : 'border-aspectum-border hover:border-aspectum-primary-border-strong hover:bg-aspectum-primary-soft'
                    }`}
                  >
                  <div className="flex items-center gap-3 min-w-0">
                    {selectMode && (
                      <Checkbox
                        checked={isSelected}
                        onChange={() => toggleSelectedAttraction(attr.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0 cursor-pointer"
                      />
                    )}

                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-aspectum-surface-subtle text-xs font-medium text-aspectum-text-subtle">
                      {idx + 1}
                    </span>

                    <div className="min-w-0">
                      <div className="text-sm font-medium text-aspectum-text truncate">
                        {getAttrName(attr)}
                      </div>

                      <div className="text-xs text-aspectum-text-muted">
                        {getAttractionCityBindingLabel(
                          attr,
                          referenceCities,
                          cityDrafts
                        )}
                      </div>

                      {hasValidMapCoords(attr?.lat, attr?.lon) && (
                        <div className="text-xs text-aspectum-text-disabled">
                          {attr.lat}, {attr.lon}
                        </div>
                      )}
                    </div>
                  </div>

                  {selectMode ? (
                    <span className="text-xs text-aspectum-text-disabled font-medium shrink-0">
                      {isSelected ? 'Выбрано' : 'Выбрать'}
                    </span>
                  ) : (
                    <span className="text-xs text-aspectum-primary font-medium shrink-0">
                      Открыть →
                    </span>
                  )}
                </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button
              type="button"
              onClick={() => onGoToStep(2)}
              variant="outline"
              size="md"
            >
              ← Назад: Теги
            </Button>

            <Button
              type="button"
              onClick={() => onGoToStep(4)}
              variant="primary"
              size="md"
            >
              Далее: Интерактивные локации →
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              onClick={() => {
                onSetAttrView('list');
                onSetCurrentAttr(null);
              }}
              variant="outline"
              size="sm"
              className="w-8 h-8 p-0"
            >
              ←
            </Button>

            <span className="text-base font-semibold text-aspectum-text">
              {getAttrName(currentAttr)}
            </span>

            <Button
              type="button"
              variant="softDanger"
              size="sm"
              onClick={onDeleteCurrentAttr}
              className="ml-auto"
            >
              Удалить
            </Button>
          </div>

          <AttractionDraftsPanel
            attractions={attractions}
            currentAttr={currentAttr}
            onSelectAttraction={onOpenAttrDetail}
            onAddAttraction={onAddAttraction}
          />

          <LocaleEditor
            localeData={attrLocaleData}
            activeLocale={attrActiveLocale}
            onSwitch={onSetAttrActiveLocale}
            showStatus={false}
          />

          <div className="flex gap-5 items-start">
            <AttractionPhotoPanel
              currentAttr={currentAttr}
              photoUploading={attractionPhotoUploading}
              photoFileRef={attractionPhotoFileRef}
              onOpenCommonsModal={onOpenAttractionCommonsModal}
              onPhotoFileChange={onAttractionPhotoFileChange}
              onUpdateAttractionPatch={updateAttractionPatch}
            />

            <main className="flex-1 min-w-0 space-y-4">
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-3">
                  <div>
                    <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="xs">
                      Название достопримечательности ({localeLabel})
                    </FormLabel>

                    <TextInput type="text" value={attrCurrentLocale.name || ''} onChange={(e) => onUpdateAttrLocaleField('name', e.target.value)} placeholder="Название достопримечательности" />
                  </div>

                  <div className={formGridClassName({ responsive: false })}>
                    <div>
                      <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="xs">
                        Индекс
                      </FormLabel>

                      <TextInput type="number" value={currentAttr?.index ?? currentAttr?.order ?? 0} onChange={(e) => { const value = Number(e.target.value || 0); updateAttractionPatch({ index: value, order: value, }); }} />
                    </div>

                    <div>
                      <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="xs">
                        Ранг
                      </FormLabel>

                      <TextInput type="number" value={currentAttr?.rank ?? 0} onChange={(e) => { updateAttractionPatch({ rank: Number(e.target.value || 0), }); }} />
                    </div>
                  </div>

                  <SessionWizardAttractionTagsPicker
                    selectedTags={currentAttr?.tags || []}
                    eventFilterTree={eventFilterTree}
                    eventFilterTreeLoading={eventFilterTreeLoading}
                    eventFilterTreeError={eventFilterTreeError}
                    onToggleTag={onToggleCurrentAttractionTag}
                    onReloadEventFilters={onReloadEventFilters}
                  />

                  <SessionWizardAttractionRelatedEventsPicker
                    currentAttrId={currentAttr?.id}
                    relatedEvents={currentAttr?.related_events || []}
                    attractions={attractions}
                    onAdd={onAddCurrentAttractionRelatedEvent}
                    onRemove={onRemoveCurrentAttractionRelatedEvent}
                  />
                  <SessionAttractionTourPanel
                    sessionId={sessionId}
                    attractionId={currentAttr?.id}
                    attractionName={currentAttr?.name}
                    externalProduct={currentAttr?.external_product}
                    publishedEventId={currentAttr?.published_event_id}
                  />
                  <SessionAttractionCommercePanel sessionId={sessionId} attractionId={currentAttr?.id} />

                  <Panel tone="muted" className="p-3">
                    <p className="text-sm text-aspectum-text-strong">
                      Город: {getAttractionCityBindingLabel(
                        currentAttr,
                        referenceCities,
                        cityDrafts
                      )}. Привязка управляется автоматически.
                    </p>
                  </Panel>
                </div>

                <AttractionMapPanel
                  lat={currentAttr?.lat ?? ''}
                  lon={currentAttr?.lon ?? ''}
                  onLatChange={(value) => {
                    updateAttractionPatch({
                      lat: value,
                    });
                  }}
                  onLonChange={(value) => {
                    updateAttractionPatch({
                      lon: value,
                    });
                  }}
                  onCoordsChange={({ lat, lon }) => {
                    updateAttractionPatch({ lat, lon });
                  }}
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-3 mb-1">
                  <div className="flex items-center gap-2">
                    <FormLabel  size="sm" weight="medium" tone="strong">
                      Описание
                    </FormLabel>
                    <span className="px-1.5 py-0.5 bg-aspectum-primary-muted text-aspectum-primary-hover text-xs rounded font-mono">
                      {localeLabel}
                    </span>
                  </div>
                  <Button
                    type="button"
                    onClick={() => onOpenAttractionInfoGenerateModal?.()}
                    disabled={!currentAttr}
                    variant="soft"
                    size="sm"
                  >
                    Сгенерировать полезную информацию
                  </Button>
                </div>

                {typeof onRegenerateAttractionDetail === 'function' && currentAttr?.id && (
                  <div className="flex justify-end mb-1">
                    <Button
                      type="button"
                      disabled={regenDetailLoading}
                      onClick={async () => {
                        setRegenDetailLoading(true);
                        try {
                          await onRegenerateAttractionDetail(currentAttr.id, attrActiveLocale);
                        } finally {
                          setRegenDetailLoading(false);
                        }
                      }}
                      title="Перегенерировать описание этой достопримечательности через ИИ"
                      variant="softIndigoStrong"
                      size="sm"
                    >
                      {regenDetailLoading ? <><Glyph name="↻" /> Генерирую…</> : <><Glyph name="↻" /> Перегенерировать ИИ</>}
                    </Button>
                  </div>
                )}
                <Textarea value={attrCurrentLocale.description || ''} onChange={(e) => onUpdateAttrLocaleField('description', e.target.value) } rows={7} placeholder="Описание достопримечательности: история, интересные факты — то, что увидит пользователь в приложении." />
              </div>

              <div className="flex items-center justify-end gap-3">
                {(attrAutoSaving || attrAutoSaved) && !attrSaving && (
                  <div
                    className={`flex items-center gap-1.5 text-xs transition-opacity ${
                      attrAutoSaved && !attrAutoSaving
                        ? 'text-aspectum-success'
                        : 'text-aspectum-text-disabled'
                    }`}
                  >
                    {attrAutoSaving ? (
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
                  onClick={onSaveCurrentAttr}
                  disabled={attrSaving}
                  variant="primary"
                  size="md"
                >
                  {attrSaving ? 'Сохранение...' : 'Сохранить'}
                </Button>
              </div>
            </main>
          </div>
        </div>
      )}
    </div>
  );
}
