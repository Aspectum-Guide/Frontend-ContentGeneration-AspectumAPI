import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import CommonsImagePicker from '../../../components/generation/CommonsImagePicker';
import { Field, FormActions, TextInput } from '../../../components/ui/FormField';
import Modal from '../../../components/ui/Modal';
import { buildLangOptions, getMultiLangValue } from '../shared/i18n';
import { LangBlock, LangTabs } from '../shared/LangFields';

const CITY_EDIT_TABS = [
  { key: 'content', label: 'Контент' },
  { key: 'media', label: 'Обложка' },
  { key: 'geo', label: 'Карта и теги' },
];

export default function CityEditorModal({
  open,
  onClose,
  city,
  setCity,
  preparing,
  activeLang,
  setActiveLang,
  activeTab,
  setActiveTab,
  saving,
  saveError,
  onSave,
  imageInputRef,
  imageUploading,
  commonsModalOpen,
  setCommonsModalOpen,
  onImageUpload,
  onCommonsSelect,
  allFilters,
  toggleFilter,
}) {
  const cityMapElRef = useRef(null);
  const cityMapRef = useRef(null);
  const cityMarkerRef = useRef(null);
  const leafletRef = useRef(null);

  const nameVal = typeof city?.name === 'object' ? city.name : {};
  const descVal = typeof city?.description === 'object' ? city.description : {};
  const countryVal = typeof city?.country === 'object' ? city.country : {};
  const langOptions = buildLangOptions([nameVal, descVal, countryVal]);

  useEffect(() => {
    if (!open || !city || langOptions.length === 0) return;
    const hasActive = langOptions.some((lang) => lang.code === activeLang);
    if (!hasActive) setActiveLang(langOptions[0].code);
  }, [open, city, langOptions, activeLang, setActiveLang]);

  useEffect(() => {
    const parseCoord = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const initMap = async () => {
      if (!open || !city || activeTab !== 'geo' || !cityMapElRef.current || cityMapRef.current) return;
      const { default: L } = await import('leaflet');
      leafletRef.current = L;

      if (L.Icon?.Default) {
        L.Icon.Default.mergeOptions({
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });
      }

      const lat = parseCoord(city?.lat);
      const lon = parseCoord(city?.lon);
      const map = L.map(cityMapElRef.current).setView(
        lat != null && lon != null ? [lat, lon] : [48.8566, 2.3522],
        lat != null && lon != null ? 9 : 4
      );

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      map.on('click', (e) => {
        const nextLat = Number(e.latlng.lat.toFixed(6));
        const nextLon = Number(e.latlng.lng.toFixed(6));
        setCity((prev) => ({ ...prev, lat: nextLat, lon: nextLon }));
      });

      cityMapRef.current = map;

      if (lat != null && lon != null) {
        cityMarkerRef.current = L.marker([lat, lon]).addTo(map);
      }

      setTimeout(() => map.invalidateSize(), 50);
    };

    initMap();
  }, [open, city, activeTab, setCity]);

  useEffect(() => {
    const map = cityMapRef.current;
    const L = leafletRef.current;
    if (!open || !map || !L || activeTab !== 'geo') return;

    const lat = Number(city?.lat);
    const lon = Number(city?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      if (cityMarkerRef.current) {
        map.removeLayer(cityMarkerRef.current);
        cityMarkerRef.current = null;
      }
      return;
    }

    if (!cityMarkerRef.current) {
      cityMarkerRef.current = L.marker([lat, lon]).addTo(map);
    } else {
      cityMarkerRef.current.setLatLng([lat, lon]);
    }

    map.setView([lat, lon], Math.max(map.getZoom(), 9));
  }, [open, city?.lat, city?.lon, activeTab]);

  useEffect(() => {
    if (open) return;
    if (cityMapRef.current) {
      cityMapRef.current.remove();
      cityMapRef.current = null;
      cityMarkerRef.current = null;
    }
  }, [open]);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={`Редактировать город${city ? ` — ${getMultiLangValue(city.name) || ''}` : ''}`}
        size="xl"
      >
        {city && (
          <form onSubmit={onSave} className="space-y-5">
            {saveError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {saveError}
              </div>
            )}

            <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
              {CITY_EDIT_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeTab === tab.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'content' && (
              <div className="space-y-5">
                {langOptions.length > 0 ? (
                  <>
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                      <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Активный язык</p>
                      <LangTabs
                        active={activeLang}
                        onSwitch={setActiveLang}
                        value={nameVal}
                        langOptions={langOptions}
                        onAddLang={(code) => {
                          setCity((p) => ({
                            ...p,
                            name: { ...(p?.name || {}), [code]: p?.name?.[code] ?? '' },
                            description: { ...(p?.description || {}), [code]: p?.description?.[code] ?? '' },
                            country: { ...(p?.country || {}), [code]: p?.country?.[code] ?? '' },
                          }));
                        }}
                        onRemoveLang={(code) => {
                          setCity((p) => {
                            const nextName = { ...(p?.name || {}) };
                            const nextDesc = { ...(p?.description || {}) };
                            const nextCountry = { ...(p?.country || {}) };
                            delete nextName[code];
                            delete nextDesc[code];
                            delete nextCountry[code];
                            return { ...p, name: nextName, description: nextDesc, country: nextCountry };
                          });
                        }}
                      />
                    </div>

                    <LangBlock
                      label="Название"
                      value={nameVal}
                      onChange={(v) => setCity((p) => ({ ...p, name: v }))}
                      activeLang={activeLang}
                      required
                    />

                    <LangBlock
                      label="Описание"
                      value={descVal}
                      onChange={(v) => setCity((p) => ({ ...p, description: v }))}
                      activeLang={activeLang}
                      multiline
                      rows={4}
                    />

                    <LangBlock
                      label="Страна"
                      value={countryVal}
                      onChange={(v) => setCity((p) => ({ ...p, country: v }))}
                      activeLang={activeLang}
                    />
                  </>
                ) : (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                    Для этого города бэкенд не прислал переводы. Языки отображаются строго из JSON-ключей ответа.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'media' && (
              <Field label="Обложка города">
                <div className="space-y-3 overflow-hidden">
                  {city?.image_url ? (
                    <div className="relative w-full h-[240px] md:h-[300px] rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                      <img src={city.image_url} alt="Обложка города" className="w-full h-full object-contain" />
                      <button
                        type="button"
                        onClick={() => setCity((p) => ({ ...p, image_id: null, image_url: null }))}
                        className="absolute top-2 right-2 w-7 h-7 bg-black/60 text-white rounded-full text-sm flex items-center justify-center hover:bg-black/80"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="w-full h-[240px] md:h-[300px] rounded-xl border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-sm text-gray-400">
                      Обложка не выбрана
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 items-center">
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      onChange={onImageUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={imageUploading}
                      className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    >
                      {imageUploading ? (
                        <span className="flex items-center gap-1.5">
                          <span className="animate-spin w-3 h-3 border border-gray-500 border-t-transparent rounded-full inline-block" />
                          Загрузка...
                        </span>
                      ) : '📷 Загрузить фото'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCommonsModalOpen(true)}
                      disabled={imageUploading}
                      className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
                    >
                      🖼️ Выбрать из Wikimedia Commons
                    </button>
                    {city?.image_id && (
                      <span className="px-2 py-2 text-xs text-gray-400 font-mono">
                        ID: {String(city.image_id).slice(0, 8)}…
                      </span>
                    )}
                  </div>

                  {city?.image_id && (
                    <TextInput
                      value={city?.image_copyright || ''}
                      onChange={(e) => setCity((p) => ({ ...p, image_copyright: e.target.value }))}
                      placeholder="Авторские права (copyright)"
                    />
                  )}
                </div>
              </Field>
            )}

            {activeTab === 'geo' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Широта (lat)">
                    <TextInput
                      type="number"
                      step="any"
                      value={city?.lat ?? ''}
                      onChange={(e) => setCity((p) => ({ ...p, lat: e.target.value }))}
                      placeholder="55.7558"
                    />
                  </Field>
                  <Field label="Долгота (lon)">
                    <TextInput
                      type="number"
                      step="any"
                      value={city?.lon ?? ''}
                      onChange={(e) => setCity((p) => ({ ...p, lon: e.target.value }))}
                      placeholder="37.6173"
                    />
                  </Field>
                </div>

                <div>
                  <div className="text-xs text-gray-500 mb-2">Карта города (кликните, чтобы выставить координаты)</div>
                  <div ref={cityMapElRef} className="w-full h-72 rounded-xl border border-gray-200 overflow-hidden" />
                </div>

                {allFilters?.length > 0 && (
                  <Field label="Теги города">
                    <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 border border-gray-200 rounded-lg bg-gray-50">
                      {allFilters.map((f) => {
                        const fid = String(f.id);
                        const selected = (city?.city_filter_ids || []).includes(fid);
                        const label = getMultiLangValue(f.name) || f.display_name || fid;
                        return (
                          <button
                            key={fid}
                            type="button"
                            onClick={() => toggleFilter(fid)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                              selected
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                            }`}
                          >
                            {f.emoji && <span>{f.emoji}</span>}
                            {label}
                            {selected && <span className="ml-0.5">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      Выбрано: {(city?.city_filter_ids || []).length} тегов
                    </p>
                  </Field>
                )}
              </div>
            )}

            <div className="hidden md:block">
              <FormActions saving={saving} onCancel={onClose} />
            </div>
            <div className="md:hidden text-xs text-gray-500 border border-dashed border-gray-300 rounded-lg p-3">
              Кнопки формы перенесены в верхнее меню «Действия».
            </div>
          </form>
        )}
      </Modal>

      <CommonsImagePicker
        isOpen={commonsModalOpen}
        onClose={() => setCommonsModalOpen(false)}
        onImageSelected={onCommonsSelect}
        getSessionUuid={() => ''}
        defaultQuery={getMultiLangValue(city?.name || '')}
      />

      {preparing && (
        <div className="fixed inset-0 z-[70] bg-white/75 backdrop-blur-sm flex items-center justify-center">
          <div className="px-4 py-3 rounded-xl border border-gray-200 bg-white shadow-sm flex items-center gap-2 text-sm text-gray-700">
            <span className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full inline-block" />
            Загружаем данные города...
          </div>
        </div>
      )}
    </>
  );
}

