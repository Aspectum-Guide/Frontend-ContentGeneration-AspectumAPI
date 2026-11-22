import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import EventMediaPanel from './EventMediaPanel';
import { FormLabel, Alert, Chip, ConfirmModal, Field, FormActions, FormGrid, Modal, Panel, Select, Spinner, Switch, Tabs, TextInput, Glyph } from '@aspectum/admin-ui-web';
import { createCoordinatePasteHandler, parseCoord } from '../../../utils/coordinates';
import { buildLangOptions, getMultiLangValue } from '../shared/i18n';
import { LangBlock, LangTabs } from '../shared/LangFields';
import InformationBlocksEditor from '../shared/InformationBlocksEditor';
import PublishedFeedEditor from '../shared/PublishedFeedEditor';
import EventItineraryTab from './EventItineraryTab';
import EventInclusionsTab from './EventInclusionsTab';
import RelatedEventsField from './RelatedEventsField';
import ExternalProductField from './ExternalProductField';
import { eventsCatalogAPI } from './api';

const eventInformationApi = {
  list: (id) => eventsCatalogAPI.listInformation(id),
  create: (id, data) => eventsCatalogAPI.createInformation(id, data),
  update: (id, infoId, data) => eventsCatalogAPI.updateInformation(id, infoId, data),
  remove: (id, infoId) => eventsCatalogAPI.deleteInformation(id, infoId),
};

const eventFeedApi = {
  list: (id) => eventsCatalogAPI.listFeed(id),
  create: (id, data) => eventsCatalogAPI.createFeedItem(id, data),
  update: (id, feedId, data) => eventsCatalogAPI.updateFeedItem(id, feedId, data),
  remove: (id, feedId) => eventsCatalogAPI.deleteFeedItem(id, feedId),
};

export default function EventEditorModal({
  open,
  onClose,
  event,
  setEvent,
  editLoading,
  activeLang,
  setActiveLang,
  saving,
  saveError,
  onSave,
  cityOptions,
  allEventFilters,
  toggleTag,
  onPatchMedia,
  mediaSaving,
  mediaError,
  onPatchExternalProduct,
  externalProductSaving,
  externalProductError,
}) {
  const [activeTab, setActiveTab] = useState('content');
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const leafletRef = useRef(null);
  const snapshotRef = useRef(null);
  const eventRef = useRef(event);
  const setEventRef = useRef(setEvent);
  eventRef.current = event;
  setEventRef.current = setEvent;

  // Сбрасываем таб при смене ивента
  useEffect(() => {
    if (open) setActiveTab('content');
  }, [open, event?.id]);

  // Снимок берём только после завершения загрузки, иначе ложный dirty при закрытии
  useEffect(() => {
    if (open && !editLoading) snapshotRef.current = JSON.stringify(eventRef.current);
  }, [open, event?.id, editLoading]);

  const handleClose = () => {
    if (snapshotRef.current && JSON.stringify(event) !== snapshotRef.current) {
      setShowDiscardConfirm(true);
      return;
    }
    onClose();
  };

  const handleConfirmDiscard = () => {
    setShowDiscardConfirm(false);
    onClose();
  };

  // Инициализация карты при переходе на вкладку «Карта»
  useEffect(() => {
    const initMap = async () => {
      if (!open || activeTab !== 'map' || !mapElRef.current || mapRef.current) return;
      const { default: L } = await import('leaflet');
      leafletRef.current = L;
      if (L.Icon?.Default) {
        L.Icon.Default.mergeOptions({
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });
      }
      const currentEvent = eventRef.current;
      const lat = parseCoord(currentEvent?.lat);
      const lon = parseCoord(currentEvent?.lon);
      const map = L.map(mapElRef.current).setView(
        lat != null && lon != null ? [lat, lon] : [41.9028, 12.4964],
        lat != null && lon != null ? 13 : 5
      );
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);
      map.on('click', (e) => {
        setEventRef.current((p) => ({
          ...p,
          lat: Number(e.latlng.lat.toFixed(6)),
          lon: Number(e.latlng.lng.toFixed(6)),
        }));
      });
      mapRef.current = map;
      if (lat != null && lon != null) {
        markerRef.current = L.marker([lat, lon]).addTo(map);
      }
      setTimeout(() => map.invalidateSize(), 50);
    };
    initMap();
  }, [open, activeTab]);

  // Обновляем маркер при изменении координат
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || activeTab !== 'map') return;
    const lat = parseCoord(event?.lat);
    const lon = parseCoord(event?.lon);
    if (lat == null || lon == null) {
      if (markerRef.current) { map.removeLayer(markerRef.current); markerRef.current = null; }
      return;
    }
    if (!markerRef.current) {
      markerRef.current = L.marker([lat, lon]).addTo(map);
    } else {
      markerRef.current.setLatLng([lat, lon]);
    }
    map.setView([lat, lon], Math.max(map.getZoom(), 13));
  }, [event?.lat, event?.lon, activeTab]);

  // Уничтожаем карту при закрытии
  useEffect(() => {
    if (open) return;
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; markerRef.current = null; }
  }, [open]);

  const titleVal = typeof event?.title === 'object' ? event.title : {};
  const descVal = typeof event?.description === 'object' ? event.description : {};
  const langOptions = buildLangOptions([titleVal, descVal]);

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title={event?.id ? 'Редактировать событие' : 'Создать событие'}
        size="xl"
      >
        {event && (
          <form onSubmit={onSave} className="space-y-5">
            {saveError && (
              <Alert tone="error">{saveError}</Alert>
            )}

            {editLoading && (
              <div className="flex items-center gap-2 text-sm text-aspectum-text-disabled py-1">
                <Spinner className="border-aspectum-focus" />
                Загрузка данных события...
              </div>
            )}

            <div className="border-b border-aspectum-border pb-3">
              <Tabs
                items={[
                { key: 'content', label: 'Контент' },
                { key: 'media', label: 'Обложка' },
                { key: 'meta', label: 'Связи' },
                { key: 'information', label: 'Инфо' },
                { key: 'feed', label: 'Лента' },
                // Shop-only content (BookingAPI.EventItineraryStep/EventInclusion,
                // see ARCHITECTURE.md) — meaningless before the event is saved or
                // for events not open for sale.
                ...(event?.id && event?.is_bookable ? [
                  { key: 'itinerary', label: 'Маршрут' },
                  { key: 'inclusions', label: 'Что включено' },
                ] : []),
                { key: 'map', label: 'Карта' },
                ].map(({ key, label }) => ({ id: key, label }))}
                value={activeTab}
                onChange={setActiveTab}
              />
            </div>

            {activeTab === 'content' && (langOptions.length > 0 ? (
              <>
                <Panel tone="muted" className="p-3">
                  <p className="text-xs font-medium text-aspectum-text-muted mb-2 uppercase tracking-wide">Активный язык</p>
                  <LangTabs
                    active={activeLang}
                    onSwitch={setActiveLang}
                    value={titleVal}
                    langOptions={langOptions}
                    onAddLang={(code) => {
                      setEvent((p) => ({
                        ...p,
                        title: { ...(p?.title || {}), [code]: p?.title?.[code] ?? '' },
                        description: { ...(p?.description || {}), [code]: p?.description?.[code] ?? '' },
                      }));
                    }}
                    onRemoveLang={(code) => {
                      setEvent((p) => {
                        const nextTitle = { ...(p?.title || {}) };
                        const nextDesc = { ...(p?.description || {}) };
                        delete nextTitle[code];
                        delete nextDesc[code];
                        return { ...p, title: nextTitle, description: nextDesc };
                      });
                    }}
                  />
                </Panel>

                <LangBlock
                  label="Название"
                  value={titleVal}
                  onChange={(v) => setEvent((p) => ({ ...p, title: v }))}
                  activeLang={activeLang}
                  required
                />

                <LangBlock
                  label="Описание"
                  value={descVal}
                  onChange={(v) => setEvent((p) => ({ ...p, description: v }))}
                  activeLang={activeLang}
                  multiline
                  rows={4}
                />
              </>
            ) : (
              <Alert tone="warning">
                Для этого события бэкенд не прислал переводы. Языки отображаются строго из JSON-ключей ответа.
              </Alert>
            ))}

            {activeTab === 'media' && (
              <EventMediaPanel
                event={event}
                disabled={editLoading || saving}
                mediaSaving={mediaSaving}
                mediaError={mediaError}
                onPatchMedia={onPatchMedia}
              />
            )}

            {activeTab === 'meta' && (
              <FormGrid responsive={false}>
                <Field label="Город">
                  <Select value={event?.city_id || ''} onChange={(e) => setEvent((p) => ({ ...p, city_id: e.target.value }))}>
                    <option value="">— Без города —</option>
                    {cityOptions.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {getMultiLangValue(c.name) || c.display_name || c.display_country || c.id}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Индекс (index)">
                  <TextInput
                    type="number"
                    value={event?.index ?? ''}
                    onChange={(e) => setEvent((p) => ({
                      ...p,
                      index: e.target.value === '' ? null : Number(e.target.value),
                    }))}
                    placeholder="авто"
                  />
                </Field>

                <Field label="Ранг (rank)">
                  <TextInput
                    type="number"
                    value={event?.rank ?? ''}
                    onChange={(e) => setEvent((p) => ({
                      ...p,
                      rank: e.target.value === '' ? null : Number(e.target.value),
                    }))}
                    placeholder="авто"
                  />
                </Field>

                <Field label="Видимость">
                  <div className="flex items-center h-full pt-1">
                    <FormLabel  layout="row" interactive unselectable>
                      <Switch
                        checked={!!event?.is_show}
                        aria-label="Видимость события"
                        onChange={(next) => setEvent((p) => ({ ...p, is_show: next }))}
                      />
                      <span className="text-sm text-aspectum-text-strong">
                        {event?.is_show ? 'Показывается' : 'Скрыто'}
                      </span>
                    </FormLabel>
                  </div>
                </Field>

                <Field label="В сторе">
                  <div className="flex items-center h-full pt-1">
                    <FormLabel  layout="row" interactive unselectable>
                      <Switch
                        checked={!!event?.is_bookable}
                        color="green"
                        aria-label="Доступность в сторе"
                        onChange={(next) => setEvent((p) => ({ ...p, is_bookable: next }))}
                      />
                      <span className="text-sm text-aspectum-text-strong">
                        {event?.is_bookable ? 'Продажи открыты' : 'Не в продаже'}
                      </span>
                    </FormLabel>
                  </div>
                </Field>

                <div className="col-span-2">
                <Field label="Адрес начала тура">
                  <TextInput
                    value={event?.start_address || ''}
                    onChange={(e) => setEvent((p) => ({ ...p, start_address: e.target.value }))}
                    placeholder="Например: Москва, Театральная площадь, у памятника Карлу Марксу"
                  />
                  <p className="mt-1 text-xs text-aspectum-text-disabled">
                    Показывается покупателю при бронировании и в письме-подтверждении. Координаты на вкладке «Карта» остаются отдельными.
                  </p>
                </Field>
                </div>
              </FormGrid>
            )}

            {activeTab === 'meta' && allEventFilters?.length > 0 && (
              <Field label="Теги / категории события">
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 border border-aspectum-border rounded-aspectum-control bg-aspectum-surface-muted">
                  {allEventFilters.map((f) => {
                    const fid = String(f.id);
                    const selected = (event?.tag_ids || []).includes(fid);
                    const label = f.display_name || f.slug || fid;
                    return (
                      <Chip
                        key={fid}
                        selected={selected}
                        variant="purple"
                        onClick={() => toggleTag(fid)}
                      >
                        {label}
                        {selected && <span className="ml-0.5"><Glyph name="✓" /></span>}
                      </Chip>
                    );
                  })}
                </div>
                <p className="mt-1 text-xs text-aspectum-text-disabled">
                  Выбрано: {(event?.tag_ids || []).length} тегов
                </p>
              </Field>
            )}

            {activeTab === 'meta' && (
              <RelatedEventsField
                eventId={event?.id}
                relatedEvents={event?.related_events}
                onAdd={(row) =>
                  setEvent((p) => {
                    const ids = new Set(p?.related_event_ids || []);
                    ids.add(String(row.id));
                    return {
                      ...p,
                      related_event_ids: Array.from(ids),
                      related_events: [
                        ...(p?.related_events || []),
                        { id: String(row.id), title: row.title },
                      ],
                    };
                  })
                }
                onRemove={(id) =>
                  setEvent((p) => ({
                    ...p,
                    related_event_ids: (p?.related_event_ids || []).filter((x) => x !== String(id)),
                    related_events: (p?.related_events || []).filter(
                      (r) => String(r.id) !== String(id)
                    ),
                  }))
                }
              />
            )}

            {activeTab === 'meta' && event?.id && (
              <ExternalProductField
                eventId={event.id}
                externalProduct={event?.external_product}
                onPick={(row) => onPatchExternalProduct?.(row.id)}
                onClear={() => onPatchExternalProduct?.(null)}
                onSetOwnership={(productId, syncEventContent) => onPatchExternalProduct?.(productId, { syncEventContent })}
                saving={externalProductSaving}
                error={externalProductError}
              />
            )}

            {activeTab === 'information' && (
              <InformationBlocksEditor
                parentId={event?.id}
                api={eventInformationApi}
                disabled={editLoading || saving}
              />
            )}

            {activeTab === 'feed' && (
              <PublishedFeedEditor
                parentId={event?.id}
                api={eventFeedApi}
                disabled={editLoading || saving}
              />
            )}

            {activeTab === 'itinerary' && event?.id && (
              <EventItineraryTab eventId={event.id} activeLang={activeLang} />
            )}

            {activeTab === 'inclusions' && event?.id && (
              <EventInclusionsTab eventId={event.id} activeLang={activeLang} />
            )}

            {activeTab === 'map' && (
              <div className="space-y-4">
                <FormGrid>
                  <Field label="Широта (lat)">
                    <TextInput
                      type="number"
                      step="any"
                      min="-90"
                      max="90"
                      value={event?.lat ?? ''}
                      onChange={(e) => setEvent((p) => ({ ...p, lat: parseFloat(e.target.value) }))}
                      onPaste={createCoordinatePasteHandler(({ lat, lon }) => setEvent((p) => ({ ...p, lat, lon })))}
                      placeholder="41.902782"
                    />
                  </Field>
                  <Field label="Долгота (lon)">
                    <TextInput
                      type="number"
                      step="any"
                      min="-180"
                      max="180"
                      value={event?.lon ?? ''}
                      onChange={(e) => setEvent((p) => ({ ...p, lon: parseFloat(e.target.value) }))}
                      onPaste={createCoordinatePasteHandler(({ lat, lon }) => setEvent((p) => ({ ...p, lat, lon })))}
                      placeholder="12.496366"
                    />
                  </Field>
                </FormGrid>

                <div>
                  <div className="text-xs text-aspectum-text-muted mb-2">Кликните по карте, чтобы выставить координаты</div>
                  <div ref={mapElRef} className="w-full h-72 rounded-aspectum-card border border-aspectum-border overflow-hidden" />
                </div>
              </div>
            )}

            <FormActions saving={saving} onCancel={handleClose} saveLabel={event?.id ? 'Сохранить' : 'Создать'} />
          </form>
        )}
      </Modal>

      <ConfirmModal
        open={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        onConfirm={handleConfirmDiscard}
        title="Закрыть без сохранения?"
        message="Есть несохранённые изменения. Закрыть без сохранения?"
        confirmLabel="Закрыть"
        danger
      />
    </>
  );
}
