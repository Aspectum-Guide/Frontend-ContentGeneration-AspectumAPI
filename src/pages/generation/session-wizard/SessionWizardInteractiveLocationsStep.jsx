import { useEffect, useMemo, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { usePasteImageOnHover } from '../../../hooks/usePasteImageOnHover';
import AiGenerationModal, { WizardGenerationActionFooter } from '../../../components/generation/AiGenerationModal.jsx';
import AiGenerationQualitySettings from '../../../components/generation/AiGenerationQualitySettings.jsx';
import AiGenerationDedupeToggle from '../../../components/generation/AiGenerationDedupeToggle.jsx';
import AiGenerationCountField from '../../../components/generation/AiGenerationCountField.jsx';
import { getAttrName, getFlag, getSessionEntityImagePreview, resolveSessionEntityImageOriginalUrl, resolveSessionEntityImageCopyright, normalizeId } from './sessionWizardShared.jsx';
import SessionWizardAttractionTagsPicker from './SessionWizardAttractionTagsPicker.jsx';
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
    <div className="p-3 border border-gray-200 rounded-xl bg-gray-50">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-800">
          Интерактивные локации в сессии
        </p>

        <button
          type="button"
          onClick={onAddLocation}
          className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors"
        >
          + Добавить
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {interactiveLocations.length === 0 ? (
          <span className="text-xs text-gray-500">
            Пока нет интерактивных локаций
          </span>
        ) : (
          interactiveLocations.map((item, index) => {
            const itemId = normalizeId(item.id);
            const isActive = itemId === currentIlId;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (!isActive) {
                    onSelectLocation(item.id);
                  }
                }}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs transition-colors ${
                  isActive
                    ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                }`}
                title={getAttrName(item) || 'без названия'}
              >
                <span className="text-gray-400">{index + 1}.</span>
                <span>{getAttrName(item) || 'без названия'}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function IlPhotoPanel({
  currentIl,
  photoUploading,
  photoFileRef,
  iconUploading,
  iconFileRef,
  onOpenCommonsModal,
  onPhotoFileChange,
  onIconFileChange,
  onUpdateIlPatch,
}) {
  const preview = getSessionEntityImagePreview(currentIl);
  const imageOriginalUrl = resolveSessionEntityImageOriginalUrl(currentIl);
  const imageCopyright = resolveSessionEntityImageCopyright(currentIl);

  const photoPaste = usePasteImageOnHover((file) =>
    onPhotoFileChange?.({ target: { files: [file], value: '' } }, currentIl),
  );

  return (
    <aside className="w-52 shrink-0 space-y-3">
      <div
        {...photoPaste}
        title="Наведите и нажмите Ctrl+V, чтобы вставить фото из буфера"
        className="relative aspect-[3/4] bg-gray-100 rounded-xl overflow-hidden border border-gray-200 flex items-center justify-center">
        {preview ? (
          <img
            src={preview}
            alt="Фото интерактивной локации"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-gray-400 text-sm text-center px-2">
            Фото интерактивной локации
          </div>
        )}

        {photoUploading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full" />
          </div>
        )}

        <button
          type="button"
          onClick={() => onOpenCommonsModal?.(currentIl)}
          className="absolute top-2 right-2 px-2 py-1 text-xs bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors shadow-lg"
          title="Библиотека изображений: Commons, Минкульт, Openverse, Pastvu, Mapillary"
        >
          ⊞ Библиотека
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
              onPhotoFileChange?.(e, currentIl);
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
              onUpdateIlPatch?.({
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
              onUpdateIlPatch?.({
                image_copyright: e.target.value,
                imageCopyright: e.target.value,
              });
            }}
            placeholder="© Автор / Источник"
            className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
      </div>

      <div className="border-t border-gray-100 pt-3 space-y-2">
        <p className="text-xs text-gray-500 font-medium">Иконка на карте</p>
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0 overflow-hidden">
            {currentIl?.icon_url
              ? <img src={currentIl.icon_url} alt="" className="w-full h-full object-contain" />
              : <span className="text-base">📍</span>
            }
            {iconUploading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-lg">
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              </div>
            )}
          </div>
          <label className="flex-1 text-center text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg py-1.5 cursor-pointer hover:bg-blue-100 transition-colors">
            {iconUploading ? 'Загрузка…' : '+ Иконка'}
            <input
              ref={iconFileRef}
              type="file"
              accept="image/*,.svg"
              className="hidden"
              onChange={(e) => onIconFileChange?.(e, currentIl)}
            />
          </label>
        </div>
      </div>
    </aside>
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
  ilGenerationAssignedCityType = 'none',
  ilGenerationSessionCityId = '',
  ilGenerationDatabaseCityId = '',
  ilGenerationLang = 'ru',
  ilDedupeExistingLocations = true,
  onIlDedupeExistingLocationsChange,
  ilGenerationCount = 5,
  onIlGenerationCountChange,
  onOpenIlGenerationModal,
  onCloseIlGenerationModal,
  onIlGenerationPromptChange,
  onIlGenerationAssignedCityTypeChange,
  onIlGenerationSessionCityIdChange,
  onIlGenerationDatabaseCityIdChange,
  onIlGenerationLangChange,
  onGenerateInteractiveLocationsFromPrompt,
  aiGenerationMode = 'instant',
  aiUseWebSearch = false,
  aiAdvancedGenerationAvailable = true,
  onAiGenerationModeChange,
  onAiUseWebSearchChange,
  onGoToStep,
}) {
  const ilCurrentLocale = ilLocaleData[ilActiveLocale] || {};

  const sessionDraftsForAi = (cityDrafts || []).filter(
    (draft) => normalizeId(draft.id) && normalizeId(draft.id) !== 'legacy',
  );

  const ilGenBindingHint = (() => {
    switch (ilGenerationAssignedCityType) {
      case 'draft':
        return 'Новые локации будут привязаны к выбранному городу сессии.';
      case 'database':
        return 'Новые локации будут привязаны к городу из базы.';
      default:
        return 'Новые локации будут без привязки к городу (можно изменить в карточке).';
    }
  })();

  const canSubmitIlGeneration = useMemo(() => {
    if (!ilGenerationPrompt?.trim()) return false;
    if (
      ilGenerationAssignedCityType === 'draft' &&
      !ilGenerationSessionCityId
    ) {
      return false;
    }
    if (
      ilGenerationAssignedCityType === 'database' &&
      !ilGenerationDatabaseCityId
    ) {
      return false;
    }
    return true;
  }, [
    ilGenerationPrompt,
    ilGenerationAssignedCityType,
    ilGenerationSessionCityId,
    ilGenerationDatabaseCityId,
  ]);

  const assignedCityType = currentIl?.assigned_city_type || 'none';
  const selectedDatabaseCityId = normalizeId(currentIl?.city_id ?? currentIl?.city);
  const selectedDraftCityId = normalizeId(
    currentIl?.session_city_id ?? currentIl?.session_city,
  );

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
              <button
                type="button"
                onClick={() => onCloseIlGenerationModal?.()}
                disabled={ilGenerating}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => onGenerateInteractiveLocationsFromPrompt?.()}
                disabled={ilGenerating || !canSubmitIlGeneration}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Сгенерировать
              </button>
            </WizardGenerationActionFooter>
          )}
        >
          <h2 id="il-gen-title" className="text-lg font-semibold text-gray-900">
            Сгенерировать интерактивные локации
          </h2>

          <p className="text-sm text-gray-600">{ilGenBindingHint}</p>

          <div className="space-y-3">
            <div>
              <label
                htmlFor="il-gen-city-binding"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Привязка к городу
              </label>
              <select
                id="il-gen-city-binding"
                value={ilGenerationAssignedCityType}
                onChange={(e) => onIlGenerationAssignedCityTypeChange?.(e.target.value)}
                disabled={ilGenerating}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="none">Без города</option>
                <option value="draft">Город из сессии</option>
                <option value="database">Город из базы</option>
              </select>
            </div>

            {ilGenerationAssignedCityType === 'draft' && (
              <div>
                <label
                  htmlFor="il-gen-session-city"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Черновик города в сессии
                </label>
                <select
                  id="il-gen-session-city"
                  value={ilGenerationSessionCityId || ''}
                  onChange={(e) => onIlGenerationSessionCityIdChange?.(e.target.value)}
                  disabled={ilGenerating}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                >
                  <option value="">— Выберите —</option>
                  {sessionDraftsForAi.map((draft) => (
                    <option key={String(draft.id)} value={String(draft.id)}>
                      {getDraftCityDisplayName(draft)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {ilGenerationAssignedCityType === 'database' && (
              <div>
                <label
                  htmlFor="il-gen-db-city"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Город из базы
                </label>
                <select
                  id="il-gen-db-city"
                  value={ilGenerationDatabaseCityId || ''}
                  onChange={(e) => onIlGenerationDatabaseCityIdChange?.(e.target.value)}
                  disabled={ilGenerating}
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
                htmlFor="il-gen-lang"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Основной язык запроса
              </label>
              <select
                id="il-gen-lang"
                value={ilGenerationLang || 'ru'}
                onChange={(e) => onIlGenerationLangChange?.(e.target.value)}
                disabled={ilGenerating}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                {AI_GENERATION_LANG_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                В карточках будут заполнены все языки, настроенные на шаге «Город».
              </p>
            </div>
          </div>

          {ilGenerationError && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              {ilGenerationError}
            </div>
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

          <label className="block text-sm font-medium text-gray-700" htmlFor="il-gen-prompt">
            Запрос к ИИ
          </label>
          <textarea
            id="il-gen-prompt"
            rows={5}
            value={ilGenerationPrompt}
            onChange={(e) => onIlGenerationPromptChange?.(e.target.value)}
            disabled={ilGenerating}
            placeholder="Например: Необычные места для прогулок с координатами и описанием."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
        </AiGenerationModal>

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Интерактивные локации
            </h2>

            <p className="text-sm text-gray-500">
              Добавьте объекты и при необходимости привяжите их к городу
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenIlGenerationModal?.()}
              className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Сгенерировать
            </button>
            <button
              type="button"
              onClick={onAddInteractiveLocation}
              className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              + Добавить
            </button>
          </div>
        </div>

        {interactiveLocations.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-3xl mb-2">📍</div>

            <p className="text-sm">
              Нет интерактивных локаций. Нажмите «+ Добавить»
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {interactiveLocations.map((item, idx) => (
              <div
                key={item.id}
                onClick={() => onOpenIlDetail?.(item.id)}
                className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                    {idx + 1}
                  </span>

                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {getAttrName(item) || 'без названия'}
                    </div>

                    <div className="text-xs text-gray-500">
                      {getIlCityBindingLabel(item, referenceCities, cityDrafts)}
                    </div>

                    {hasValidMapCoords(item?.lat, item?.lon) && (
                      <div className="text-xs text-gray-400">
                        {item.lat}, {item.lon}
                      </div>
                    )}
                  </div>
                </div>

                <span className="text-xs text-blue-600 font-medium">
                  Открыть →
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-between pt-2">
          <button
            type="button"
            onClick={() => {
              void onGoToStep?.(3);
            }}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            ← Назад: Достопримечательности
          </button>

          <button
            type="button"
            onClick={() => {
              void onGoToStep?.(5);
            }}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Далее: Публикация →
          </button>
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
        <button
          type="button"
          onClick={() => {
            void onLeaveIlDetailView?.();
          }}
          className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors"
        >
          ←
        </button>

        <span className="text-base font-semibold text-gray-900">
          {getAttrName(currentIl) || 'без названия'}
        </span>

        <button
          type="button"
          onClick={onDeleteCurrentIl}
          className="ml-auto px-3 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
        >
          Удалить
        </button>
      </div>

      <IlDraftsPanel
        interactiveLocations={interactiveLocations}
        currentIl={currentIl}
        onSelectLocation={onOpenIlDetail}
        onAddLocation={onAddInteractiveLocation}
      />

      <div className="flex items-center gap-1 flex-wrap">
        {Object.entries(ilLocaleData || {}).map(([key, loc]) => {
          const isActive = key === ilActiveLocale;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSetIlActiveLocale?.(key)}
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
        <IlPhotoPanel
          currentIl={currentIl}
          photoUploading={photoUploading}
          photoFileRef={photoFileRef}
          iconUploading={iconUploading}
          iconFileRef={iconFileRef}
          onOpenCommonsModal={onOpenCommonsModal}
          onPhotoFileChange={onPhotoFileChange}
          onIconFileChange={onIconFileChange}
          onUpdateIlPatch={updateIlPatch}
        />

        <main className="flex-1 min-w-0 space-y-4">
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название интерактивной локации ({localeLabel})
                </label>

                <input
                  type="text"
                  value={ilCurrentLocale.name || ''}
                  onChange={(e) => onUpdateIlLocaleField?.('name', e.target.value)}
                  placeholder="Название интерактивной локации"
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
                    value={currentIl?.index ?? currentIl?.order ?? 0}
                    onChange={(e) => {
                      const value = Number(e.target.value || 0);

                      updateIlPatch({
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
                    value={currentIl?.rank ?? 0}
                    onChange={(e) => {
                      updateIlPatch({
                        rank: Number(e.target.value || 0),
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
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

              <div className="p-3 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Привязка к городу
                  </label>

                  <select
                    value={assignedCityType}
                    onChange={(e) => {
                      const type = e.target.value;

                      updateIlPatch({
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

                        updateIlPatch({
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

                        updateIlPatch({
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
              <label className="text-sm font-medium text-gray-700">
                Описание
              </label>

              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded font-mono">
                {localeLabel}
              </span>
            </div>

            <textarea
              value={ilCurrentLocale.description || ''}
              onChange={(e) =>
                onUpdateIlLocaleField?.('description', e.target.value)
              }
              rows={7}
              placeholder="Краткое описание интерактивной локации..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3">
            {(ilAutoSaving || ilAutoSaved) && !ilSaving && (
              <div
                className={`flex items-center gap-1.5 text-xs transition-opacity ${
                  ilAutoSaved && !ilAutoSaving
                    ? 'text-emerald-600'
                    : 'text-gray-400'
                }`}
              >
                {ilAutoSaving ? (
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
              onClick={onSaveCurrentIl}
              disabled={ilSaving}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {ilSaving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
