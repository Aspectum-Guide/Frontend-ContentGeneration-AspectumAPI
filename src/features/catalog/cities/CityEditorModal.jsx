import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import CommonsImagePicker from '../../../components/generation/CommonsImagePicker';
import { FormLabel, Alert, BusyOverlay, Button, Chip, Field, FileButton, FormActions, FormGrid, IconButton, LoadingOverlay, MediaPreview, Modal, Panel, Select, Spinner, Switch, Tabs, TextInput } from '@aspectum/ui';
import { createCoordinatePasteHandler, parseCoord } from '../../../utils/coordinates';
import { buildLangOptions, getMultiLangValue } from '../shared/i18n';
import { LangBlock, LangTabs } from '../shared/LangFields';
import InformationBlocksEditor from '../shared/InformationBlocksEditor';
import { citiesCatalogAPI } from './api';
import { contentAuthorsAPI } from '../../../api/generation';

const cityUsefulInfoApi = {
  list: (id) => citiesCatalogAPI.listUsefulInformation(id),
  create: (id, data) => citiesCatalogAPI.createUsefulInformation(id, data),
  update: (id, infoId, data) => citiesCatalogAPI.updateUsefulInformation(id, infoId, data),
  remove: (id, infoId) => citiesCatalogAPI.deleteUsefulInformation(id, infoId),
};

const CITY_EDIT_TABS = [
  { key: 'content', label: 'Контент' },
  { key: 'media', label: 'Обложка' },
  { key: 'geo', label: 'Карта и теги' },
  { key: 'useful', label: 'Полезное' },
  { key: 'iap', label: 'IAP' },
];

const IAP_STATUS_LABELS = {
  not_created: 'Не создан',
  pending_review: 'На модерации',
  approved: 'Одобрен',
  active: 'Активен',
  error: 'Ошибка',
};

function IapStatusBadge({ status }) {
  const color = status === 'error' ? 'bg-aspectum-danger-soft text-aspectum-danger-strong border-aspectum-danger-border'
    : (status === 'approved' || status === 'active') ? 'bg-aspectum-positive-soft text-aspectum-positive-strong border-aspectum-positive-border'
    : status === 'pending_review' ? 'bg-aspectum-caution-soft text-aspectum-caution-strong border-aspectum-caution-border'
    : 'bg-aspectum-surface-muted text-aspectum-text-subtle border-aspectum-border';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-aspectum-compact text-xs font-medium border ${color}`}>
      {IAP_STATUS_LABELS[status] || status || '—'}
    </span>
  );
}

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
  allCities,
  syncIap,
  syncingIap,
  syncIapNote,
}) {
  const cityMapElRef = useRef(null);
  const cityMapRef = useRef(null);
  const cityMarkerRef = useRef(null);
  const leafletRef = useRef(null);
  const [authors, setAuthors] = useState([]);

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

  useEffect(() => {
    if (!open) return;
    contentAuthorsAPI.list()
      .then((response) => {
        const data = response?.data;
        setAuthors(Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []);
      })
      .catch(() => setAuthors([]));
  }, [open]);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={city?.id
          ? `Редактировать город — ${getMultiLangValue(city.name) || ''}`
          : 'Создать город'}
        size="xl"
      >
        {city && (
          <form onSubmit={onSave} className="space-y-5">
            {saveError && (
              <Alert tone="error">{saveError}</Alert>
            )}

            <div className="border-b border-aspectum-border pb-3">
              <Tabs
                items={CITY_EDIT_TABS.map(({ key, label }) => ({ id: key, label }))}
                value={activeTab}
                onChange={setActiveTab}
              />
            </div>

            {activeTab === 'content' && (
              <div className="space-y-5">
                {langOptions.length > 0 ? (
                  <>
                    <Panel tone="muted" className="p-3">
                      <p className="text-xs font-medium text-aspectum-text-muted mb-2 uppercase tracking-wide">Активный язык</p>
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
                    </Panel>

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
                  <Alert tone="warning">
                    Для этого города бэкенд не прислал переводы. Языки отображаются строго из JSON-ключей ответа.
                  </Alert>
                )}
              </div>
            )}

            {activeTab === 'media' && (
              <Field label="Обложка города">
                <div className="space-y-3 overflow-hidden">
                  {city?.image_url ? (
                    <LoadingOverlay loading={imageUploading} label="Загрузка обложки…">
                      <MediaPreview src={city.image_url} alt="Обложка города" fit="contain" className="h-[240px] w-full md:h-[300px]">
                      <IconButton
                        label="Убрать изображение города"
                        onClick={() => setCity((p) => ({ ...p, image_id: null, image_url: null }))}
                        variant="overlay"
                        size="iconOverlay"
                        className="absolute top-2 right-2"
                      >
                        ×
                      </IconButton>
                      </MediaPreview>
                    </LoadingOverlay>
                  ) : (
                    <MediaPreview placeholder="Обложка не выбрана" className="h-[240px] w-full md:h-[300px]" />
                  )}

                  <div className="flex flex-wrap gap-2 items-center">
                    <FileButton
                      inputRef={imageInputRef}
                      accept="image/*"
                      onChange={onImageUpload}
                      variant="secondary"
                      size="md"
                      disabled={imageUploading}
                    >
                      {imageUploading ? (
                        <span className="flex items-center gap-1.5">
                          <Spinner size="xs" className="border border-aspectum-border-muted" />
                          Загрузка...
                        </span>
                      ) : '📷 Загрузить фото'}
                    </FileButton>
                    <Button
                      type="button"
                      variant="soft"
                      size="md"
                      onClick={() => setCommonsModalOpen(true)}
                      disabled={imageUploading}
                    >
                      🖼️ Выбрать из Wikimedia Commons
                    </Button>
                    {city?.image_id && (
                      <span className="px-2 py-2 text-xs text-aspectum-text-disabled font-mono">
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
                <FormGrid>
                  <Field label="Широта (lat)">
                    <TextInput
                      type="number"
                      step="any"
                      min="-90"
                      max="90"
                      value={city?.lat ?? ''}
                      onChange={(e) => setCity((p) => ({ ...p, lat: parseFloat(e.target.value) }))}
                      onPaste={createCoordinatePasteHandler(({ lat, lon }) => setCity((p) => ({ ...p, lat, lon })))}
                      placeholder="55.7558"
                    />
                  </Field>
                  <Field label="Долгота (lon)">
                    <TextInput
                      type="number"
                      step="any"
                      min="-180"
                      max="180"
                      value={city?.lon ?? ''}
                      onChange={(e) => setCity((p) => ({ ...p, lon: parseFloat(e.target.value) }))}
                      onPaste={createCoordinatePasteHandler(({ lat, lon }) => setCity((p) => ({ ...p, lat, lon })))}
                      placeholder="37.6173"
                    />
                  </Field>
                </FormGrid>

                <div>
                  <div className="text-xs text-aspectum-text-muted mb-2">Карта города (кликните, чтобы выставить координаты)</div>
                  <div ref={cityMapElRef} className="w-full h-72 rounded-aspectum-card border border-aspectum-border overflow-hidden" />
                </div>

                {allFilters?.length > 0 && (
                  <Field label="Теги города">
                    <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 border border-aspectum-border rounded-aspectum-control bg-aspectum-surface-muted">
                      {allFilters.map((f) => {
                        const fid = String(f.id);
                        const selected = (city?.city_filter_ids || []).includes(fid);
                        const label = getMultiLangValue(f.name) || f.display_name || fid;
                        return (
                          <Chip
                            key={fid}
                            selected={selected}
                            variant="primary"
                            onClick={() => toggleFilter(fid)}
                          >
                            {f.emoji && <span>{f.emoji}</span>}
                            {label}
                            {selected && <span className="ml-0.5">✓</span>}
                          </Chip>
                        );
                      })}
                    </div>
                    <p className="mt-1 text-xs text-aspectum-text-disabled">
                      Выбрано: {(city?.city_filter_ids || []).length} тегов
                    </p>
                  </Field>
                )}
              </div>
            )}

            {activeTab === 'useful' && (
              <InformationBlocksEditor
                parentId={city?.id}
                api={cityUsefulInfoApi}
                showVisibility
                disabled={preparing || saving}
              />
            )}

            {activeTab === 'iap' && (
              <div className="space-y-4">
                <Field label="Видимость">
                  <div className="flex items-center h-full pt-1">
                    <FormLabel  layout="row" interactive unselectable>
                      <Switch
                        checked={!!city?.is_show}
                        aria-label="Видимость города"
                        onChange={(next) => setCity((p) => ({ ...p, is_show: next }))}
                      />
                      <span className="text-sm text-aspectum-text-strong">
                        {city?.is_show ? 'Показывается в приложении' : 'Скрыт'}
                      </span>
                    </FormLabel>
                  </div>
                </Field>

                <Field
                  label="Родительский город (Спец. гид)"
                  hint="Если выбрано — этот город скрыт с карты и из «ближайших городов»/«ближайших эвентов», но показывается в блоке «Гиды от партнеров» на странице выбранного родительского города."
                >
                  <Select
                    value={city?.parent_city || ''}
                    onChange={(e) => setCity((p) => ({
                      ...p,
                      parent_city: e.target.value,
                      author_ids: e.target.value ? p.author_ids : [],
                    }))}
                  >
                    <option value="">Не привязан</option>
                    {(allCities || [])
                      .filter((c) => String(c.id) !== String(city?.id) && !c.parent_city)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {getMultiLangValue(c.name) || c.id}
                        </option>
                      ))}
                  </Select>
                </Field>

                {city?.parent_city && (
                  <Field label="Авторы спецгида" hint="Можно выбрать нескольких авторов из справочника.">
                    {authors.length === 0 ? (
                      <p className="text-sm text-aspectum-text-disabled">Сначала добавьте автора в разделе «Контент → Авторы».</p>
                    ) : (
                      <div className="flex flex-wrap gap-2 rounded-aspectum-control border border-aspectum-border bg-aspectum-surface-muted p-2">
                        {authors.map((author) => {
                          const id = String(author.id);
                          const selected = (city?.author_ids || []).includes(id);
                          return (
                            <Chip key={id} selected={selected} onClick={() => setCity((p) => ({
                              ...p,
                              author_ids: selected
                                ? (p.author_ids || []).filter((value) => value !== id)
                                : [...(p.author_ids || []), id],
                            }))}>
                              {author.name}{selected ? ' ✓' : ''}
                            </Chip>
                          );
                        })}
                      </div>
                    )}
                  </Field>
                )}

                <FormGrid>
                  <Field
                    label="IAP SKU"
                    hint={!city?.iap_sku ? 'Пусто — SKU ещё не сгенерирован для этого города' : undefined}
                  >
                    <TextInput
                      value={city?.iap_sku || ''}
                      onChange={(e) => setCity((p) => ({ ...p, iap_sku: e.target.value }))}
                      placeholder="напр. city_rome"
                    />
                  </Field>
                  <Field label="Цена (USD)">
                    <TextInput
                      type="number"
                      step="0.01"
                      min="0"
                      value={city?.iap_price_usd ?? ''}
                      onChange={(e) => setCity((p) => ({ ...p, iap_price_usd: e.target.value }))}
                      placeholder="2.99"
                    />
                  </Field>
                </FormGrid>

                <Panel tone="muted" className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3">
                  <div>
                    <p className="text-xs text-aspectum-text-muted mb-1">Apple</p>
                    <IapStatusBadge status={city?.iap_apple_status} />
                  </div>
                  <div>
                    <p className="text-xs text-aspectum-text-muted mb-1">Google</p>
                    <IapStatusBadge status={city?.iap_google_status} />
                  </div>
                  <div>
                    <p className="text-xs text-aspectum-text-muted mb-1">Синк</p>
                    <p className="text-sm text-aspectum-text-strong">
                      {city?.iap_synced_at ? new Date(city.iap_synced_at).toLocaleString('ru-RU') : 'Ещё не синкался'}
                    </p>
                  </div>
                </Panel>

                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="soft"
                    size="md"
                    onClick={syncIap}
                    disabled={syncingIap}
                  >
                    {syncingIap ? (
                      <span className="flex items-center gap-1.5">
                        <Spinner size="xs" className="border border-aspectum-focus" />
                        Синкаем...
                      </span>
                    ) : '🔄 Синхронизировать с App Store / Google Play'}
                  </Button>
                </div>

                {syncIapNote && (
                  <div className={`p-3 rounded-aspectum-control text-sm border ${
                    syncIapNote.type === 'error'
                      ? 'bg-aspectum-danger-soft border-aspectum-danger-border text-aspectum-danger-strong'
                      : 'bg-aspectum-positive-soft border-aspectum-positive-border text-aspectum-positive-strong'
                  }`}>
                    {syncIapNote.text}
                  </div>
                )}

                <p className="text-xs text-aspectum-text-disabled">
                  Изменение цены и SKU применится после сохранения города. Синхронизация с App Store / Google Play
                  запускается отдельно — статусы выше могут не обновиться сразу после нажатия.
                </p>
              </div>
            )}

            <FormActions
              saving={saving}
              onCancel={onClose}
              saveLabel={city?.id ? 'Сохранить' : 'Создать'}
            />
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

      <BusyOverlay open={preparing} label="Загружаем данные города..." priority />
    </>
  );
}
