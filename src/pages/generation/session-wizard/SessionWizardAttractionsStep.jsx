import { useEffect, useMemo, useRef, useState } from 'react';
import AiGenerationModal, { WizardGenerationActionFooter } from '../../../components/generation/AiGenerationModal.jsx';
import AiGenerationQualitySettings from '../../../components/generation/AiGenerationQualitySettings.jsx';
import AiGenerationDedupeToggle from '../../../components/generation/AiGenerationDedupeToggle.jsx';
import AiGenerationCountField from '../../../components/generation/AiGenerationCountField.jsx';
import { getAttrName, getFlag, getSessionEntityImagePreview, resolveSessionEntityImageOriginalUrl, resolveSessionEntityImageCopyright, normalizeId } from './sessionWizardShared.jsx';
import SessionWizardAttractionTagsPicker from './SessionWizardAttractionTagsPicker.jsx';
import UsefulInfoTextImportBox from './UsefulInfoTextImportBox.jsx';
import { createCoordinatePasteHandler } from '../../../utils/coordinates';

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

const AI_GENERATION_LANG_OPTIONS = [
  { value: 'ru', label: 'Русский (ru)' },
  { value: 'en', label: 'English (en)' },
  { value: 'it', label: 'Italiano (it)' },
  { value: 'fr', label: 'Français (fr)' },
  { value: 'de', label: 'Deutsch (de)' },
  { value: 'es', label: 'Español (es)' },
];

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
    <div className="p-3 border border-gray-200 rounded-xl bg-gray-50">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-800">
          Черновики достопримечательностей в сессии
        </p>

        <button
          type="button"
          onClick={onAddAttraction}
          className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors"
        >
          + Добавить
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {attractions.length === 0 ? (
          <span className="text-xs text-gray-500">
            Пока нет достопримечательностей
          </span>
        ) : (
          attractions.map((attr, index) => {
            const attrId = normalizeId(attr.id);
            const isActiveAttr = attrId === currentAttrId;

            return (
              <button
                key={attr.id}
                type="button"
                onClick={() => {
                  if (!isActiveAttr) {
                    onSelectAttraction(attr.id);
                  }
                }}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs transition-colors ${
                  isActiveAttr
                    ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                }`}
                title={getAttrName(attr)}
              >
                <span className="text-gray-400">{index + 1}.</span>
                <span>{getAttrName(attr)}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
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

  return (
    <aside className="w-52 shrink-0 space-y-3">
      <div className="relative aspect-[3/4] bg-gray-100 rounded-xl overflow-hidden border border-gray-200 flex items-center justify-center">
        {preview ? (
          <img
            src={preview}
            alt="Фото достопримечательности"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-gray-400 text-sm text-center px-2">
            Фото достопримечательности
          </div>
        )}

        {photoUploading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full" />
          </div>
        )}

        <button
          type="button"
          onClick={() => onOpenCommonsModal?.(currentAttr)}
          className="absolute top-2 right-2 px-2 py-1 text-xs bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors shadow-lg"
          title="Подобрать в Wikimedia Commons"
        >
          ✦ Commons
        </button>
      </div>

      <div>
        <label className="block w-full text-center text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg py-1.5 cursor-pointer hover:bg-blue-100 transition-colors">
          + Добавить фото
          <input
            ref={photoFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              onPhotoFileChange?.(e, currentAttr);
            }}
          />
        </label>
      </div>

      <div className="space-y-1.5">
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">URL</label>
          <input
            type="url"
            value={imageOriginalUrl || ''}
            onChange={(e) => {
              onUpdateAttractionPatch({
                image_original_url: e.target.value,
                imageOriginalUrl: e.target.value,
              });
            }}
            placeholder="https://upload.wikimedia.org/..."
            className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-0.5">
            Авторские права
          </label>
          <input
            type="text"
            value={imageCopyright || ''}
            onChange={(e) => {
              onUpdateAttractionPatch({
                image_copyright: e.target.value,
                imageCopyright: e.target.value,
              });
            }}
            placeholder="© Автор / Источник"
            className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
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

      const hasCoords = hasValidMapCoords(lat, lon);
      const initialLat = parseMapCoord(lat);
      const initialLon = parseMapCoord(lon);

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
        onLatChange(event.latlng.lat.toFixed(6));
        onLonChange(event.latlng.lng.toFixed(6));
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
        updateMarker(lat, lon);
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
        <label className="text-sm font-medium text-gray-700">
          Координаты
        </label>

        <span className="text-xs text-gray-400">
          Клик по карте или ввод вручную
        </span>
      </div>

      <div
        ref={setMapNode}
        className="w-full h-48 rounded-lg border border-gray-200 overflow-hidden z-0"
      />

      <div className="grid grid-cols-2 gap-2 mt-2">
        <input
          type="number"
          step="0.000001"
          value={lat ?? ''}
          onChange={(e) => onLatChange(e.target.value)}
          onPaste={handleCoordPaste}
          placeholder="Широта"
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <input
          type="number"
          step="0.000001"
          value={lon ?? ''}
          onChange={(e) => onLonChange(e.target.value)}
          onPaste={handleCoordPaste}
          placeholder="Долгота"
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}

export default function SessionWizardAttractionsStep({
  attrView,
  currentAttr,
  attrActiveLocale,
  attrLocaleData,
  attrSaving,
  attrAutoSaving = false,
  attrAutoSaved = false,
  attractions,

  attractionGenerationProgress = null,

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
  onGoToStep,

  eventFilterTree = [],
  eventFilterTreeLoading = false,
  eventFilterTreeError = '',
  onReloadEventFilters,
  onToggleCurrentAttractionTag,

  attractionGenerationOpen = false,
  attractionGenerationPrompt = '',
  attractionGenerating = false,
  attractionGenerationError = '',
  attractionGenerationAssignedCityType = 'none',
  attractionGenerationSessionCityId = '',
  attractionGenerationDatabaseCityId = '',
  attractionGenerationLang = 'ru',
  attractionGenerationCount = 5,
  attractionDedupeExistingItems = true,
  onAttractionDedupeExistingItemsChange,
  onAttractionGenerationCountChange,
  onOpenAttractionGenerationModal,
  onCloseAttractionGenerationModal,
  onAttractionGenerationPromptChange,
  onAttractionGenerationAssignedCityTypeChange,
  onAttractionGenerationSessionCityIdChange,
  onAttractionGenerationDatabaseCityIdChange,
  onAttractionGenerationLangChange,
  onGenerateAttractionsFromPrompt,
  onOpenAttractionInfoGenerateModal,
  aiGenerationMode = 'instant',
  aiUseWebSearch = false,
  aiAdvancedGenerationAvailable = true,
  onAiGenerationModeChange,
  onAiUseWebSearchChange,
}) {
  const attrCurrentLocale = attrLocaleData[attrActiveLocale] || {};
  const [selectMode, setSelectMode] = useState(false);
  const [selectedAttractionIds, setSelectedAttractionIds] = useState(() => new Set());

  const assignedCityType = currentAttr?.assigned_city_type || 'none';
  const selectedDatabaseCityId = normalizeId(currentAttr?.city_id ?? currentAttr?.city);
  const selectedDraftCityId = normalizeId(
    currentAttr?.session_city_id ?? currentAttr?.session_city
  );

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

  const sessionDraftsForAi = useMemo(
    () => (cityDrafts || []).filter((d) => d.id && d.id !== 'legacy'),
    [cityDrafts]
  );

  const attractionGenBindingHint = useMemo(() => {
    switch (attractionGenerationAssignedCityType) {
      case 'draft':
        return 'Достопримечательности будут привязаны к выбранному городу из сессии.';
      case 'database':
        return 'Достопримечательности будут привязаны к городу из базы.';
      default:
        return 'Достопримечательности будут созданы без привязки к городу.';
    }
  }, [attractionGenerationAssignedCityType]);

  const attractionGenCanSubmit = useMemo(() => {
    if (!attractionGenerationPrompt?.trim()) return false;
    if (
      attractionGenerationAssignedCityType === 'draft' &&
      !attractionGenerationSessionCityId
    ) {
      return false;
    }
    if (
      attractionGenerationAssignedCityType === 'database' &&
      !attractionGenerationDatabaseCityId
    ) {
      return false;
    }
    return true;
  }, [
    attractionGenerationPrompt,
    attractionGenerationAssignedCityType,
    attractionGenerationSessionCityId,
    attractionGenerationDatabaseCityId,
  ]);

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
            <button
              type="button"
              onClick={() => onCloseAttractionGenerationModal?.()}
              disabled={attractionGenerating}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => onGenerateAttractionsFromPrompt?.()}
              disabled={attractionGenerating || !attractionGenCanSubmit}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Сгенерировать
            </button>
          </WizardGenerationActionFooter>
        )}
      >
        <h2 id="attraction-gen-title" className="text-lg font-semibold text-gray-900">
          Сгенерировать достопримечательности
        </h2>

        <p className="text-sm text-gray-600">{attractionGenBindingHint}</p>

        <div className="space-y-3">
          <div>
            <label
              htmlFor="attraction-gen-city-binding"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Привязка к городу
            </label>
            <select
              id="attraction-gen-city-binding"
              value={attractionGenerationAssignedCityType}
              onChange={(e) =>
                onAttractionGenerationAssignedCityTypeChange?.(e.target.value)
              }
              disabled={attractionGenerating}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option value="none">Без города</option>
              <option value="draft">Город из сессии</option>
              <option value="database">Город из базы</option>
            </select>
          </div>

          {attractionGenerationAssignedCityType === 'draft' && (
            <div>
              <label
                htmlFor="attraction-gen-session-city"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Черновик города в сессии
              </label>
              <select
                id="attraction-gen-session-city"
                value={attractionGenerationSessionCityId || ''}
                onChange={(e) =>
                  onAttractionGenerationSessionCityIdChange?.(e.target.value)
                }
                disabled={attractionGenerating}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="">— Выберите —</option>
                {sessionDraftsForAi.map((draft) => (
                  <option key={String(draft.id)} value={String(draft.id)}>
                    {getDraftCityDisplayName(draft)}
                  </option>
                ))}
              </select>
              {sessionDraftsForAi.length === 0 && (
                <p className="text-xs text-amber-700 mt-1">
                  Нет черновиков города (кроме унаследованной строки). Создайте черновик на шаге «Город».
                </p>
              )}
            </div>
          )}

          {attractionGenerationAssignedCityType === 'database' && (
            <div>
              <label
                htmlFor="attraction-gen-db-city"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Город из базы
              </label>
              <select
                id="attraction-gen-db-city"
                value={attractionGenerationDatabaseCityId || ''}
                onChange={(e) =>
                  onAttractionGenerationDatabaseCityIdChange?.(e.target.value)
                }
                disabled={attractionGenerating}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="">— Выберите —</option>
                {(referenceCities || []).map((city) => (
                  <option key={normalizeId(city.id)} value={normalizeId(city.id)}>
                    {getCityDisplayName(city)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label
              htmlFor="attraction-gen-lang"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Язык генерации
            </label>
            <select
              id="attraction-gen-lang"
              value={attractionGenerationLang || 'ru'}
              onChange={(e) => onAttractionGenerationLangChange?.(e.target.value)}
              disabled={attractionGenerating}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
              {AI_GENERATION_LANG_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {attractionGenerationError && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            {attractionGenerationError}
          </div>
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

        <label className="block text-sm font-medium text-gray-700" htmlFor="attraction-gen-prompt">
          Запрос к ИИ
        </label>
        <textarea
          id="attraction-gen-prompt"
          rows={5}
          value={attractionGenerationPrompt}
          onChange={(e) => onAttractionGenerationPromptChange?.(e.target.value)}
          disabled={attractionGenerating}
          placeholder="Например: Главные музеи и архитектурные памятники центра города."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        />
      </AiGenerationModal>

      {attrView === 'list' ? (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Достопримечательности
                </h2>

                <p className="text-sm text-gray-500">
                  Добавьте объекты. Новые объекты из вставки будут привязаны к текущему городу сессии.
                </p>
              </div>

              {!selectMode && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenAttractionGenerationModal?.()}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Сгенерировать
                  </button>
                  <button
                    type="button"
                    onClick={onAddAttraction}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    + Добавить
                  </button>
                </div>
              )}
            </div>

            {attractions.length > 0 && (
              <div className="flex items-center gap-2 shrink-0">
                {selectMode ? (
                  <>
                    <button
                      type="button"
                      onClick={toggleSelectAllAttractions}
                      className="px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {allSelected ? 'Снять все' : 'Выбрать все'}
                    </button>
                    <button
                      type="button"
                      onClick={handleBulkDeleteAttractions}
                      disabled={selectedAttractionIds.size === 0}
                      className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Удалить ({selectedAttractionIds.size})
                    </button>
                    <button
                      type="button"
                      onClick={exitSelectMode}
                      className="px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Отмена
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelectMode(true)}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Выбрать
                  </button>
                )}
              </div>
            )}
          </div>

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
            <div className="text-center py-12 text-gray-400">
              <div className="text-3xl mb-2">🏛️</div>

              <p className="text-sm">
                Нет достопримечательностей. Нажмите «+ Добавить»
              </p>
            </div>
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
                    className={`flex items-center justify-between p-3 bg-white border rounded-lg cursor-pointer transition-colors ${
                      selectMode && isSelected
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                  <div className="flex items-center gap-3 min-w-0">
                    {selectMode && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectedAttraction(attr.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 accent-blue-600 shrink-0 cursor-pointer"
                      />
                    )}

                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                      {idx + 1}
                    </span>

                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {getAttrName(attr)}
                      </div>

                      <div className="text-xs text-gray-500">
                        {getAttractionCityBindingLabel(
                          attr,
                          referenceCities,
                          cityDrafts
                        )}
                      </div>

                      {hasValidMapCoords(attr?.lat, attr?.lon) && (
                        <div className="text-xs text-gray-400">
                          {attr.lat}, {attr.lon}
                        </div>
                      )}
                    </div>
                  </div>

                  {selectMode ? (
                    <span className="text-xs text-gray-400 font-medium shrink-0">
                      {isSelected ? 'Выбрано' : 'Выбрать'}
                    </span>
                  ) : (
                    <span className="text-xs text-blue-600 font-medium shrink-0">
                      Открыть →
                    </span>
                  )}
                </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => onGoToStep(2)}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              ← Назад: Теги
            </button>

            <button
              type="button"
              onClick={() => onGoToStep(4)}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Далее: Интерактивные локации →
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                onSetAttrView('list');
                onSetCurrentAttr(null);
              }}
              className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors"
            >
              ←
            </button>

            <span className="text-base font-semibold text-gray-900">
              {getAttrName(currentAttr)}
            </span>

            <button
              type="button"
              onClick={onDeleteCurrentAttr}
              className="ml-auto px-3 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
            >
              Удалить
            </button>
          </div>

          <AttractionDraftsPanel
            attractions={attractions}
            currentAttr={currentAttr}
            onSelectAttraction={onOpenAttrDetail}
            onAddAttraction={onAddAttraction}
          />

          <div className="flex items-center gap-1 flex-wrap">
            {Object.entries(attrLocaleData || {}).map(([key, loc]) => {
              const isActive = key === attrActiveLocale;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSetAttrActiveLocale(key)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  <span>{getFlag(loc.code)}</span>
                  <span>{loc.langName}</span>
                </button>
              );
            })}
          </div>

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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Название достопримечательности ({localeLabel})
                    </label>

                    <input
                      type="text"
                      value={attrCurrentLocale.name || ''}
                      onChange={(e) => onUpdateAttrLocaleField('name', e.target.value)}
                      placeholder="Название достопримечательности"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Индекс
                      </label>

                      <input
                        type="number"
                        value={currentAttr?.index ?? currentAttr?.order ?? 0}
                        onChange={(e) => {
                          const value = Number(e.target.value || 0);

                          updateAttractionPatch({
                            index: value,
                            order: value,
                          });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Ранг
                      </label>

                      <input
                        type="number"
                        value={currentAttr?.rank ?? 0}
                        onChange={(e) => {
                          updateAttractionPatch({
                            rank: Number(e.target.value || 0),
                          });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
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

                  <div className="p-3 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Привязка к городу
                      </label>

                      <select
                        value={assignedCityType}
                        onChange={(e) => {
                          const type = e.target.value;

                          updateAttractionPatch({
                            assigned_city_type: type,

                            city: null,
                            city_id: null,

                            session_city: null,
                            session_city_id: null,
                          });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="none">Без города</option>
                        <option value="database">Город из базы</option>
                        <option value="draft">Город из сессии</option>
                      </select>
                    </div>

                    {assignedCityType === 'database' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Город из базы
                        </label>

                        <select
                          value={selectedDatabaseCityId}
                          onChange={(e) => {
                            const cityId = e.target.value || null;

                            updateAttractionPatch({
                              assigned_city_type: 'database',

                              city: cityId,
                              city_id: cityId,

                              session_city: null,
                              session_city_id: null,
                            });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Выберите город из базы</option>

                          {referenceCities.map((city) => (
                            <option key={city.id} value={city.id}>
                              {getCityDisplayName(city)}
                            </option>
                          ))}
                        </select>

                        {referenceCities.length === 0 && (
                          <p className="mt-1 text-xs text-amber-600">
                            Список городов из базы не загружен.
                          </p>
                        )}
                      </div>
                    )}

                    {assignedCityType === 'draft' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Город из сессии
                        </label>

                        <select
                          value={selectedDraftCityId}
                          onChange={(e) => {
                            const draftId = e.target.value || null;

                            updateAttractionPatch({
                              assigned_city_type: 'draft',

                              session_city: draftId,
                              session_city_id: draftId,

                              city: null,
                              city_id: null,
                            });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Выберите город</option>

                          {cityDrafts.map((draft) => (
                            <option key={draft.id} value={draft.id}>
                              {getDraftCityDisplayName(draft)}
                            </option>
                          ))}
                        </select>

                        {cityDrafts.length === 0 && (
                          <p className="mt-1 text-xs text-amber-600">
                            В текущей сессии пока нет городов.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
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
                    <label className="text-sm font-medium text-gray-700">
                      Текст
                    </label>
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded font-mono">
                      {localeLabel}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenAttractionInfoGenerateModal?.()}
                    disabled={!currentAttr}
                    className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
                  >
                    Сгенерировать полезную информацию
                  </button>
                </div>

                <textarea
                  value={attrCurrentLocale.contentText || ''}
                  onChange={(e) =>
                    onUpdateAttrLocaleField('contentText', e.target.value)
                  }
                  rows={7}
                  placeholder="Подробный текст-описание, история, интересные факты..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                {(attrAutoSaving || attrAutoSaved) && !attrSaving && (
                  <div
                    className={`flex items-center gap-1.5 text-xs transition-opacity ${
                      attrAutoSaved && !attrAutoSaving
                        ? 'text-emerald-600'
                        : 'text-gray-400'
                    }`}
                  >
                    {attrAutoSaving ? (
                      <>
                        <span className="inline-block w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
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
                <button
                  type="button"
                  onClick={onSaveCurrentAttr}
                  disabled={attrSaving}
                  className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {attrSaving ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </main>
          </div>
        </div>
      )}
    </div>
  );
}
