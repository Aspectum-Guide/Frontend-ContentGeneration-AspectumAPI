import { useEffect, useRef, useState } from 'react';
import { DEFAULT_LOCALE_DEFS, getAttrName, getFlag } from './sessionWizardShared.jsx';

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

const normalizeId = (value) => {
  if (value == null) return '';

  if (typeof value === 'object') {
    return String(value.id ?? value.uuid ?? value.pk ?? '');
  }

  return String(value);
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

const getAttractionImagePreview = (attr) => {
  const image =
    attr?.image_preview ||
    attr?.imagePreview ||
    attr?.image_url ||
    attr?.imageUrl ||
    attr?.photo_url ||
    attr?.photoUrl ||
    attr?.image ||
    attr?.photo ||
    '';

  if (!image) return '';

  if (typeof image === 'string') return image;

  if (typeof image === 'object') {
    return (
      image.preview_url ||
      image.previewUrl ||
      image.url ||
      image.file ||
      image.src ||
      ''
    );
  }

  return '';
};

const getAttractionImageOriginalUrl = (attr) => {
  return (
    attr?.image_original_url ||
    attr?.imageOriginalUrl ||
    attr?.original_image_url ||
    attr?.originalImageUrl ||
    ''
  );
};

const getAttractionImageCopyright = (attr) => {
  return (
    attr?.image_copyright ||
    attr?.imageCopyright ||
    attr?.copyright ||
    attr?.photo_copyright ||
    attr?.photoCopyright ||
    ''
  );
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
  const imagePreview = getAttractionImagePreview(currentAttr);
  const imageOriginalUrl = getAttractionImageOriginalUrl(currentAttr);
  const imageCopyright = getAttractionImageCopyright(currentAttr);

  return (
    <aside className="w-52 shrink-0 space-y-3">
      <div className="relative aspect-[3/4] bg-gray-100 rounded-xl overflow-hidden border border-gray-200 flex items-center justify-center">
        {imagePreview ? (
          <img
            src={imagePreview}
            alt="Фото достопримечательности"
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-gray-400 text-sm text-center px-2">
            Фото достопримечательности
          </span>
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
}) {
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
          placeholder="Широта"
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <input
          type="number"
          step="0.000001"
          value={lon ?? ''}
          onChange={(e) => onLonChange(e.target.value)}
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
  attractions,

  referenceCities = [],
  cityDrafts = [],
  onUpdateCurrentAttrPatch,

  attractionPhotoUploading = false,
  attractionPhotoFileRef,
  onOpenAttractionCommonsModal,
  onAttractionPhotoFileChange,

  onOpenAttrDetail,
  onAddAttraction,
  onDeleteCurrentAttr,
  onSetAttrView,
  onSetCurrentAttr,
  onSetAttrActiveLocale,
  onUpdateAttrLocaleField,
  onSaveCurrentAttr,
  onGoToStep,
}) {
  const attrCurrentLocale = attrLocaleData[attrActiveLocale] || {};

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

  return (
    <div>
      {attrView === 'list' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Достопримечательности
              </h2>

              <p className="text-sm text-gray-500">
                Добавьте объекты и при необходимости привяжите их к городу
              </p>
            </div>

            <button
              type="button"
              onClick={onAddAttraction}
              className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              + Добавить
            </button>
          </div>

          {attractions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-3xl mb-2">🏛️</div>

              <p className="text-sm">
                Нет достопримечательностей. Нажмите «+ Добавить»
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {attractions.map((attr, idx) => (
                <div
                  key={attr.id}
                  onClick={() => onOpenAttrDetail(attr.id)}
                  className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                      {idx + 1}
                    </span>

                    <div>
                      <div className="text-sm font-medium text-gray-900">
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
              onClick={() => onGoToStep(2)}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              ← Назад
            </button>

            <button
              type="button"
              onClick={() => onGoToStep(4)}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Далее: Полезная информация →
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
            {DEFAULT_LOCALE_DEFS.map((loc) => {
              const isActive = loc.key === attrActiveLocale;

              return (
                <button
                  key={loc.key}
                  type="button"
                  onClick={() => onSetAttrActiveLocale(loc.key)}
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
                />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="text-sm font-medium text-gray-700">
                    Текст
                  </label>

                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded font-mono">
                    {localeLabel}
                  </span>
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

              <div className="flex justify-end">
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