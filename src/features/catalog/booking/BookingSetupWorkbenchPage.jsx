import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  eventSlotAvailabilitiesAPI,
  eventSlotPricingAPI,
  eventTicketTypePricesAPI,
  pricingRulesAPI,
  ticketPricesAPI,
  ticketTypesAPI,
} from '../../../api/booking';
import Layout from '../../../components/Layout';
import Modal, { ConfirmModal } from '../../../components/ui/Modal';
import { Field, TextInput } from '../../../components/ui/FormField';
import { parseApiError } from '../../../utils/apiError';
import { useEventOptions } from '../shared/bookingOptions';
import EventSelect from '../shared/components/EventSelect';
import { DEFAULT_CURRENCY, normalizeCurrency } from '../shared/currencies';
import { getTicketTypeLabel, filterTicketTypesForEvent, resolveTicketTypeEventId } from '../shared/labels';
import { normalizeListResponse } from '../shared/normalize';
import {
  buildFromInterval,
  buildFromList,
  buildFromSchedule,
  formatSlot as fmtSlot,
  parseInputToIso,
} from '../shared/scheduleParsers';
import {
  PricePreviewPanel,
  PriceStatusBadge,
  ReadinessChecklist,
  SlotPriceOverrideMatrix,
} from './BookingSetupPricingPanels';
import {
  buildReadinessItems,
  buildRulesCountByType,
  buildSlotPriceMap,
  collectDirtyPriceEntries,
  countSlotOnlyPrices,
  getPriceRowStatus,
  isSlotBookable,
} from './bookingSetupPricingHelpers';

// ─── sub-components ──────────────────────────────────────────────────────────

function SectionCard({ title, badge, children, action }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
          {badge != null && (
            <span className="px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">{badge}</span>
          )}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Spinner() {
  return <span className="inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
}

function Err({ msg }) {
  return msg ? <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1 mt-1">{msg}</p> : null;
}

function Ok({ msg }) {
  return msg ? <p className="text-xs text-emerald-700 bg-emerald-50 rounded px-2 py-1 mt-1">{msg}</p> : null;
}

/** Подставляет цены из базовых и уже назначенных на слоты (не затирает ручной ввод). */
function hydratePriceByType(types, basePrices, slotPrices, prev, editedIds, defaultCurrency) {
  const baseByType = Object.fromEntries(
    (basePrices || []).map((bp) => [String(bp.ticket_type), bp]),
  );
  const sampleSlotByType = {};
  for (const p of slotPrices || []) {
    const tid = String(p.ticket_type);
    if (!sampleSlotByType[tid]) sampleSlotByType[tid] = p;
  }
  const next = { ...prev };
  for (const tt of types || []) {
    const id = String(tt.id);
    if (editedIds.has(id)) continue;
    const bp = baseByType[id];
    const sp = sampleSlotByType[id];
    next[id] = {
      price: bp ? String(bp.base_price) : sp ? String(sp.price) : (next[id]?.price ?? ''),
      currency: normalizeCurrency(bp?.currency || sp?.currency || next[id]?.currency || defaultCurrency),
    };
  }
  return next;
}

/** Типы, применимые к событию: глобальные + событийные + привязанные к слотам (API ?event=). */
async function fetchTicketTypesForEvent(_evId) {
  const r = await ticketTypesAPI.list({
    page_size: 1000,
    ordering: 'sort_order',
  });
  return normalizeListResponse(r?.data, ['results', 'data']);
}

function extractCityMeta(eventItem) {
  const cityObj = eventItem?.city && typeof eventItem.city === 'object' ? eventItem.city : null;
  const cityId = String(
    eventItem?.city_id
      || cityObj?.id
      || (typeof eventItem?.city === 'string' ? eventItem.city : '')
      || ''
  );
  const cityNameValue = cityObj?.name ?? cityObj?.title ?? cityObj?.label ?? null;
  const cityLabel =
    eventItem?.city_display_name
    || eventItem?.city_name
    || (typeof cityNameValue === 'string'
      ? cityNameValue
      : cityNameValue?.ru || cityNameValue?.en || cityNameValue?.de || cityNameValue?.it || null)
    || cityId;
  return { cityId, cityLabel: String(cityLabel || '') };
}

// ─── SlotsManagerModal ───────────────────────────────────────────────────────

const SLOTS_PAGE = 20;

/** Converts ISO datetime string to datetime-local input value (YYYY-MM-DDTHH:mm). */
function toDatetimeLocalValue(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return ''; }
}

function SlotsManagerModal({ open, eventId, onClose, onChanged }) {
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(null); // slotId being saved
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [rowError, setRowError] = useState({}); // slotId → msg

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkForm, setBulkForm] = useState({ available_seats: '', booking_closes_minutes_before: '' });
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState('');

  const loadSlots = useCallback(async (p = 1, from = dateFrom, to = dateTo) => {
    if (!eventId) return;
    setLoading(true);
    try {
      const params = {
        event: eventId, page: p, page_size: SLOTS_PAGE,
        ordering: 'slot_datetime',
        ...(from ? { slot_datetime_after: new Date(from).toISOString() } : {}),
        ...(to ? { slot_datetime_before: new Date(to + 'T23:59:59').toISOString() } : {}),
      };
      const r = await eventSlotAvailabilitiesAPI.list(params);
      const data = r?.data;
      setSlots(normalizeListResponse(data, ['results', 'data']));
      setTotal(data?.count ?? data?.total ?? 0);
      setPage(p);
    } catch {
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [eventId, dateFrom, dateTo]);

  useEffect(() => {
    if (open) { setPage(1); setEditingId(null); setRowError({}); setSelectedIds(new Set()); setBulkError(''); loadSlots(1, dateFrom, dateTo); }
  }, [open, eventId]);

  const handleToggle = async (slot) => {
    setSaving(slot.id);
    try {
      await eventSlotAvailabilitiesAPI.update(slot.id, { is_active: !slot.is_active });
      setSlots((prev) => prev.map((s) => s.id === slot.id ? { ...s, is_active: !slot.is_active } : s));
      onChanged?.();
    } catch (e) {
      setRowError((p) => ({ ...p, [slot.id]: parseApiError(e, 'Ошибка') }));
    } finally { setSaving(null); }
  };

  const openEdit = (slot) => {
    setEditingId(slot.id);
    setEditForm({
      available_seats: slot.available_seats,
      booking_closes_minutes_before: slot.booking_closes_minutes_before,
      slot_datetime: toDatetimeLocalValue(slot.slot_datetime),
    });
    setRowError((p) => { const n = { ...p }; delete n[slot.id]; return n; });
  };

  const handleSaveEdit = async (slot) => {
    setSaving(slot.id);
    try {
      const newDatetime = editForm.slot_datetime
        ? new Date(editForm.slot_datetime).toISOString()
        : slot.slot_datetime;
      await eventSlotAvailabilitiesAPI.update(slot.id, {
        available_seats: Number(editForm.available_seats ?? 0),
        booking_closes_minutes_before: Number(editForm.booking_closes_minutes_before ?? 0),
        slot_datetime: newDatetime,
      });
      setSlots((prev) => prev.map((s) => s.id === slot.id
        ? { ...s, available_seats: Number(editForm.available_seats), booking_closes_minutes_before: Number(editForm.booking_closes_minutes_before), slot_datetime: newDatetime }
        : s));
      setEditingId(null);
      onChanged?.();
    } catch (e) {
      setRowError((p) => ({ ...p, [slot.id]: parseApiError(e, 'Ошибка сохранения') }));
    } finally { setSaving(null); }
  };

  const toggleSelect = (id) => setSelectedIds((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleSelectAll = () => setSelectedIds((prev) =>
    prev.size === slots.length ? new Set() : new Set(slots.map((s) => s.id))
  );

  const handleBulkSave = async () => {
    if (!selectedIds.size) return;
    setBulkSaving(true); setBulkError('');
    const patch = {};
    if (bulkForm.available_seats !== '') patch.available_seats = Number(bulkForm.available_seats);
    if (bulkForm.booking_closes_minutes_before !== '') patch.booking_closes_minutes_before = Number(bulkForm.booking_closes_minutes_before);
    if (!Object.keys(patch).length) { setBulkError('Заполните хотя бы одно поле'); setBulkSaving(false); return; }
    try {
      await Promise.all([...selectedIds].map((id) => eventSlotAvailabilitiesAPI.update(id, patch)));
      setSlots((prev) => prev.map((s) => selectedIds.has(s.id) ? { ...s, ...patch } : s));
      setSelectedIds(new Set());
      setBulkForm({ available_seats: '', booking_closes_minutes_before: '' });
      onChanged?.();
    } catch (e) {
      setBulkError(parseApiError(e, 'Ошибка массового сохранения'));
    } finally { setBulkSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await eventSlotAvailabilitiesAPI.delete(deleteTarget.id);
      setDeleteTarget(null);
      const newPage = slots.length === 1 && page > 1 ? page - 1 : page;
      await loadSlots(newPage);
      onChanged?.();
    } catch (e) {
      setRowError((p) => ({ ...p, [deleteTarget.id]: parseApiError(e, 'Ошибка удаления') }));
      setDeleteTarget(null);
    } finally { setDeleting(false); }
  };

  const totalPages = Math.ceil(total / SLOTS_PAGE);

  return (
    <>
      <Modal open={open} onClose={onClose} title={`Слоты (${total})`} size="xl">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">С</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">По</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <button onClick={() => loadSlots(1, dateFrom, dateTo)}
            className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
            Применить
          </button>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); loadSlots(1, '', ''); }}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
              Сбросить
            </button>
          )}
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 mb-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-sm">
            <span className="text-blue-700 font-medium">{selectedIds.size} выбрано</span>
            <input type="number" min={0} placeholder="Мест" value={bulkForm.available_seats}
              onChange={(e) => setBulkForm((p) => ({ ...p, available_seats: e.target.value }))}
              className="w-24 px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input type="number" min={0} placeholder="Закрытие (мин)" value={bulkForm.booking_closes_minutes_before}
              onChange={(e) => setBulkForm((p) => ({ ...p, booking_closes_minutes_before: e.target.value }))}
              className="w-36 px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={handleBulkSave} disabled={bulkSaving}
              className="px-3 py-1 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {bulkSaving ? '…' : 'Применить'}
            </button>
            <button onClick={() => setSelectedIds(new Set())}
              className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 transition-colors">Сбросить</button>
            {bulkError && <span className="text-xs text-red-600">{bulkError}</span>}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-3 py-2 text-center w-8">
                  <input type="checkbox" checked={slots.length > 0 && selectedIds.size === slots.length}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                </th>
                <th className="px-3 py-2 text-left">Дата и время</th>
                <th className="px-3 py-2 text-right">Мест</th>
                <th className="px-3 py-2 text-right">Закрытие (мин)</th>
                <th className="px-3 py-2 text-center">Активен</th>
                <th className="px-3 py-2 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                  <Spinner /> Загрузка...
                </td></tr>
              ) : slots.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400 text-sm">Слотов не найдено</td></tr>
              ) : slots.map((slot) => {
                const isEditing = editingId === slot.id;
                const isSaving = saving === slot.id;
                const err = rowError[slot.id];
                return (
                  <tr key={slot.id} className={`hover:bg-gray-50 ${!slot.is_active ? 'opacity-50' : ''} ${selectedIds.has(slot.id) ? 'bg-blue-50' : ''}`}>
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" checked={selectedIds.has(slot.id)}
                        onChange={() => toggleSelect(slot.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-700 whitespace-nowrap">
                      {isEditing
                        ? <input type="datetime-local" value={editForm.slot_datetime ?? ''}
                            onChange={(e) => setEditForm((p) => ({ ...p, slot_datetime: e.target.value }))}
                            className="px-2 py-1 border border-blue-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        : fmtSlot(slot.slot_datetime)
                      }
                    </td>
                    <td className="px-3 py-2 text-right">
                      {isEditing
                        ? <input type="number" min={0} value={editForm.available_seats} onChange={(e) => setEditForm((p) => ({ ...p, available_seats: e.target.value }))}
                            className="w-20 px-2 py-1 border border-blue-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        : <span className="text-gray-700">{slot.available_seats}</span>
                      }
                    </td>
                    <td className="px-3 py-2 text-right">
                      {isEditing
                        ? <input type="number" min={0} value={editForm.booking_closes_minutes_before} onChange={(e) => setEditForm((p) => ({ ...p, booking_closes_minutes_before: e.target.value }))}
                            className="w-20 px-2 py-1 border border-blue-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        : <span className="text-gray-700">{slot.booking_closes_minutes_before}</span>
                      }
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => handleToggle(slot)} disabled={isSaving}
                        className={`relative w-8 h-4 rounded-full transition-colors focus:outline-none disabled:opacity-50 ${slot.is_active ? 'bg-green-500' : 'bg-gray-300'}`}>
                        <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all ${slot.is_active ? 'left-4' : 'left-0.5'}`} />
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {err && <span className="text-xs text-red-500 mr-1">{err}</span>}
                        {isEditing ? (
                          <>
                            <button onClick={() => handleSaveEdit(slot)} disabled={isSaving}
                              className="px-2 py-1 text-xs text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 transition-colors">
                              {isSaving ? '…' : 'OK'}
                            </button>
                            <button onClick={() => setEditingId(null)}
                              className="px-2 py-1 text-xs text-gray-500 bg-gray-100 rounded hover:bg-gray-200 transition-colors">
                              ✕
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => openEdit(slot)} disabled={!!saving}
                              className="px-2 py-1 text-xs text-blue-600 bg-blue-50 rounded hover:bg-blue-100 disabled:opacity-40 transition-colors">
                              Ред.
                            </button>
                            <button onClick={() => setDeleteTarget(slot)} disabled={!!saving}
                              className="px-2 py-1 text-xs text-red-500 bg-red-50 rounded hover:bg-red-100 disabled:opacity-40 transition-colors">
                              Удалить
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-3 text-sm text-gray-500">
            <span>Страница {page} из {totalPages} · всего {total}</span>
            <div className="flex gap-1">
              <button onClick={() => loadSlots(page - 1)} disabled={page <= 1 || loading}
                className="px-3 py-1 rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-40 transition-colors">←</button>
              <button onClick={() => loadSlots(page + 1)} disabled={page >= totalPages || loading}
                className="px-3 py-1 rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-40 transition-colors">→</button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Удалить слот?"
        message={deleteTarget ? `${fmtSlot(deleteTarget.slot_datetime)} · ${deleteTarget.available_seats} мест` : ''}
        confirmLabel="Удалить"
        danger
        loading={deleting}
      />
    </>
  );
}

// ─── main ────────────────────────────────────────────────────────────────────

export default function BookingSetupWorkbenchPage() {
  const { eventOptions, cityOptions: refCityOptions, eventsLoading, eventsError, reloadEvents } = useEventOptions();
  const [cityFilter, setCityFilter] = useState('');
  const [eventId, setEventId] = useState('');
  const cityOptions = useMemo(() => {
    if (refCityOptions?.length) return refCityOptions;
    const unique = new Map();
    for (const ev of eventOptions || []) {
      const { cityId, cityLabel } = extractCityMeta(ev);
      if (!cityId) continue;
      if (!unique.has(cityId)) unique.set(cityId, cityLabel || cityId);
    }
    return Array.from(unique.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'ru'));
  }, [refCityOptions, eventOptions]);
  const filteredEventOptions = useMemo(() => {
    if (!cityFilter) return eventOptions;
    return (eventOptions || []).filter((ev) => extractCityMeta(ev).cityId === cityFilter);
  }, [eventOptions, cityFilter]);

  // ── state per section ────────────────────────────────────────────────────
  const [ticketTypes, setTicketTypes] = useState([]);
  const [ttLoading, setTtLoading] = useState(false);
  const [ttLoadError, setTtLoadError] = useState('');

  const [slotsTotal, setSlotsTotal] = useState(null);
  const [recentSlots, setRecentSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // ── ticket type form ─────────────────────────────────────────────────────
  const [showTtForm, setShowTtForm] = useState(false);
  const [ttForm, setTtForm] = useState({ name_ru: '', code: '', sort_order: 0, initial_price: '' });
  const [ttSaving, setTtSaving] = useState(false);
  const [ttError, setTtError] = useState('');
  const [ttOk, setTtOk] = useState('');
  const [editingTt, setEditingTt] = useState(null); // tt object being edited
  const [editTtForm, setEditTtForm] = useState({ name_ru: '', code: '', sort_order: 0 });
  const [editTtSaving, setEditTtSaving] = useState(false);
  const [editTtError, setEditTtError] = useState('');

  // ── slots form ───────────────────────────────────────────────────────────
  const [showSlotForm, setShowSlotForm] = useState(false);
  const [showSlotsManager, setShowSlotsManager] = useState(false);
  const [slotMode, setSlotMode] = useState('schedule');
  const [slotForm, setSlotForm] = useState({
    start_datetime: '', end_datetime: '', step_minutes: 60,
    datetimes_text: '',
    schedule_start_date: '', schedule_end_date: '',
    schedule_days: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false },
    schedule_times_text: '10:00\n12:00\n14:00',
    booking_closes_minutes_before: 60, available_seats: 0,
    ticket_type_ids: [],
    also_create_prices: false,
  });
  const [slotSaving, setSlotSaving] = useState(false);
  const [slotError, setSlotError] = useState('');
  const [slotOk, setSlotOk] = useState('');

  // ── prices (unified matrix) ───────────────────────────────────────────────
  const [priceByType, setPriceByType] = useState({});
  const [priceCurrency, setPriceCurrency] = useState(DEFAULT_CURRENCY);
  const [assignSlotPrices, setAssignSlotPrices] = useState(false);
  const [priceSaving, setPriceSaving] = useState(false);
  const [priceError, setPriceError] = useState('');
  const [priceOk, setPriceOk] = useState('');
  const [priceConfirm, setPriceConfirm] = useState(null);
  const [uniformPrice, setUniformPrice] = useState('');
  const priceEditsRef = useRef(new Set());
  const autoProvisionRef = useRef(new Set());
  const [savingRowId, setSavingRowId] = useState(null);
  const [matrixSavingKey, setMatrixSavingKey] = useState(null);

  const [pricingRules, setPricingRules] = useState([]);
  const [pricingRulesLoading, setPricingRulesLoading] = useState(false);
  const [slotPricesList, setSlotPricesList] = useState([]);
  const [allActiveSlots, setAllActiveSlots] = useState([]);
  const [slotsMetaLoading, setSlotsMetaLoading] = useState(false);

  const [pricePreview, setPricePreview] = useState(null);
  const [pricePreviewLoading, setPricePreviewLoading] = useState(false);
  const [pricePreviewError, setPricePreviewError] = useState('');
  const [priceDirtyTick, setPriceDirtyTick] = useState(0);

  const [basePrices, setBasePrices] = useState([]);
  const [basePricesLoading, setBasePricesLoading] = useState(false);

  // ── loaders ──────────────────────────────────────────────────────────────

  const loadTicketTypes = useCallback(async (evId) => {
    if (!evId) { setTicketTypes([]); setTtLoadError(''); return; }
    setTtLoading(true);
    setTtLoadError('');
    try {
      const list = await fetchTicketTypesForEvent(evId);
      setTicketTypes(list);
    } catch (err) {
      setTicketTypes([]);
      setTtLoadError(parseApiError(err, 'Не удалось загрузить типы билетов'));
    } finally { setTtLoading(false); }
  }, []);

  const loadSlots = useCallback(async (evId) => {
    if (!evId) {
      setSlotsTotal(null);
      setRecentSlots([]);
      setAllActiveSlots([]);
      return;
    }
    setSlotsLoading(true);
    setSlotsMetaLoading(true);
    try {
      const [recentR, allR] = await Promise.all([
        eventSlotAvailabilitiesAPI.list({ event: evId, page_size: 5, ordering: 'slot_datetime' }),
        eventSlotAvailabilitiesAPI.list({
          event: evId,
          page_size: 500,
          ordering: 'slot_datetime',
          is_active: 'true',
        }),
      ]);
      const recentData = recentR?.data;
      setSlotsTotal(recentData?.count ?? recentData?.total ?? normalizeListResponse(recentData, ['results', 'data']).length);
      setRecentSlots(normalizeListResponse(recentData, ['results', 'data']).slice(0, 5));
      setAllActiveSlots(normalizeListResponse(allR?.data, ['results', 'data']));
    } catch {
      setSlotsTotal(null);
      setRecentSlots([]);
      setAllActiveSlots([]);
    } finally {
      setSlotsLoading(false);
      setSlotsMetaLoading(false);
    }
  }, []);

  const loadPricingRules = useCallback(async (evId) => {
    if (!evId) {
      setPricingRules([]);
      return;
    }
    setPricingRulesLoading(true);
    try {
      const r = await pricingRulesAPI.list({
        event: evId,
        page_size: 500,
        is_active: 'true',
      });
      setPricingRules(normalizeListResponse(r?.data, ['results', 'data']));
    } catch {
      setPricingRules([]);
    } finally {
      setPricingRulesLoading(false);
    }
  }, []);

  const loadPricePreview = useCallback(async (evId, slots, tts, { refetchSlots = false } = {}) => {
    if (!evId || !tts?.length) {
      setPricePreview(null);
      setPricePreviewError('');
      return;
    }
    let slotList = slots;
    if (refetchSlots || !slotList?.length) {
      try {
        const r = await eventSlotAvailabilitiesAPI.list({
          event: evId,
          page_size: 500,
          ordering: 'slot_datetime',
          is_active: 'true',
        });
        slotList = normalizeListResponse(r?.data, ['results', 'data']);
      } catch {
        slotList = [];
      }
    }
    const openSlots = (slotList || []).filter(isSlotBookable);
    const target = openSlots.find((s) => {
      const linked = s.ticket_types;
      return Array.isArray(linked) && linked.length > 0;
    }) || openSlots[0];
    if (!target?.id) {
      setPricePreview(null);
      setPricePreviewError(openSlots.length ? 'У слотов нет привязанных типов билетов' : '');
      return;
    }
    setPricePreviewLoading(true);
    setPricePreviewError('');
    try {
      const r = await eventSlotPricingAPI.get(evId, { slot_id: target.id });
      setPricePreview({
        slotDatetime: target.slot_datetime,
        prices: r?.data?.prices || [],
      });
    } catch (err) {
      setPricePreview(null);
      setPricePreviewError(parseApiError(err, 'Не удалось загрузить превью цен'));
    } finally {
      setPricePreviewLoading(false);
    }
  }, []);

  const loadPricingData = useCallback(async (evId, tts, currency = DEFAULT_CURRENCY) => {
    if (!evId || !tts.length) {
      setBasePrices([]);
      setSlotPricesList([]);
      return;
    }
    setBasePricesLoading(true);
    try {
      const [pricesR, baseR] = await Promise.all([
        ticketPricesAPI.list({ event: evId, page_size: 1000, is_active: 'true' }),
        eventTicketTypePricesAPI.list({ event: evId, page_size: 100 }),
      ]);
      const prices = normalizeListResponse(pricesR?.data, ['results', 'data']);
      const bps = normalizeListResponse(baseR?.data, ['results', 'data']);

      setBasePrices(bps);
      setSlotPricesList(prices);

      setPriceByType((prev) => hydratePriceByType(tts, bps, prices, prev, priceEditsRef.current, currency));
      if (!priceEditsRef.current.size) {
        const cur = bps.find((b) => b.currency)?.currency || prices.find((p) => p.currency)?.currency;
        if (cur) setPriceCurrency(normalizeCurrency(cur));
      }
    } catch {
      setBasePrices([]);
      setSlotPricesList([]);
    } finally {
      setBasePricesLoading(false);
    }
  }, []);

  const loadAll = useCallback(async (evId) => {
    if (!evId) return;
    await Promise.all([
      loadTicketTypes(evId),
      loadSlots(evId),
      loadPricingRules(evId),
    ]);
  }, [loadTicketTypes, loadSlots, loadPricingRules]);

  const eventTicketTypes = useMemo(
    () => filterTicketTypesForEvent(ticketTypes, eventId),
    [ticketTypes, eventId],
  );

  // Slots only accept global types (event-owned ones are invisible to
  // customers on the public API, and the backend now rejects attaching
  // them) — used for the slot-creation picker below, not for pricing.
  const globalEventTicketTypes = useMemo(
    () => eventTicketTypes.filter((tt) => !resolveTicketTypeEventId(tt)),
    [eventTicketTypes],
  );

  const basePriceByType = useMemo(
    () => Object.fromEntries(basePrices.map((bp) => [String(bp.ticket_type), bp])),
    [basePrices],
  );

  const selectedEvent = useMemo(
    () => (eventOptions || []).find((ev) => String(ev.id) === String(eventId)) || null,
    [eventOptions, eventId],
  );

  const rulesCountByType = useMemo(
    () => buildRulesCountByType(pricingRules),
    [pricingRules],
  );

  const slotPriceMap = useMemo(
    () => buildSlotPriceMap(slotPricesList),
    [slotPricesList],
  );

  const openSlots = useMemo(
    () => (allActiveSlots || []).filter(isSlotBookable),
    [allActiveSlots],
  );

  const slotsWithoutTypesCount = useMemo(
    () => openSlots.filter((s) => !Array.isArray(s.ticket_types) || !s.ticket_types.length).length,
    [openSlots],
  );

  const usedTicketTypeIdsInOpenSlots = useMemo(() => {
    const set = new Set();
    for (const slot of openSlots || []) {
      for (const id of slot?.ticket_types || []) {
        if (!id) continue;
        set.add(String(id));
      }
    }
    return set;
  }, [openSlots]);

  const savedBaseForUsed = useMemo(() => {
    return basePrices.filter((bp) => usedTicketTypeIdsInOpenSlots.has(String(bp.ticket_type))).length;
  }, [basePrices, usedTicketTypeIdsInOpenSlots]);

  const dirtyPriceIds = useMemo(() => {
    void priceDirtyTick;
    return new Set(priceEditsRef.current);
  }, [priceDirtyTick]);

  const dirtyPriceCount = dirtyPriceIds.size;

  const readinessItems = useMemo(
    () => buildReadinessItems({
      selectedEvent,
      usedTypesCount: usedTicketTypeIdsInOpenSlots.size,
      savedBaseCount: savedBaseForUsed,
      openSlotsCount: openSlots.length,
      slotsWithoutTypesCount,
      loading: ttLoading || slotsMetaLoading || basePricesLoading,
    }),
    [
      selectedEvent,
      usedTicketTypeIdsInOpenSlots.size,
      savedBaseForUsed,
      openSlots.length,
      slotsWithoutTypesCount,
      ttLoading,
      slotsMetaLoading,
      basePricesLoading,
    ],
  );

  const readinessReadyCount = useMemo(
    () => readinessItems.filter((item) => item.ok).length,
    [readinessItems],
  );

  const allPricesSaved = useMemo(
    () => usedTicketTypeIdsInOpenSlots.size > 0 && savedBaseForUsed >= usedTicketTypeIdsInOpenSlots.size,
    [usedTicketTypeIdsInOpenSlots.size, savedBaseForUsed],
  );

  useEffect(() => {
    if (!eventId) {
      setTicketTypes([]);
      setTtLoadError('');
      return;
    }
    let cancelled = false;
    (async () => {
      await loadAll(eventId);
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [eventId, loadAll]);
  useEffect(() => {
    if (eventTicketTypes.length) loadPricingData(eventId, eventTicketTypes, priceCurrency);
  }, [eventTicketTypes, eventId, loadPricingData]);
  useEffect(() => {
    if (eventId && eventTicketTypes.length) {
      loadPricePreview(eventId, allActiveSlots, eventTicketTypes);
    }
  }, [eventId, eventTicketTypes, allActiveSlots, loadPricePreview]);

  useEffect(() => {
    priceEditsRef.current = new Set();
    autoProvisionRef.current = new Set();
    setPriceByType({});
    setPriceError('');
    setPriceOk('');
    setPricePreview(null);
    setPricePreviewError('');
    setPriceDirtyTick((t) => t + 1);
  }, [eventId]);

  useEffect(() => {
    const ids = globalEventTicketTypes.map((tt) => String(tt.id));
    setSlotForm((prev) => ({
      ...prev,
      ticket_type_ids: prev.ticket_type_ids?.length
        ? prev.ticket_type_ids.filter((id) => ids.includes(String(id)))
        : ids,
    }));
  }, [globalEventTicketTypes]);
  useEffect(() => {
    if (!eventId) return;
    const stillVisible = filteredEventOptions.some((ev) => String(ev.id) === String(eventId));
    if (!stillVisible) setEventId('');
  }, [filteredEventOptions, eventId]);

  const setPriceForType = useCallback((typeId, patch) => {
    const id = String(typeId);
    priceEditsRef.current.add(id);
    setPriceDirtyTick((t) => t + 1);
    setPriceByType((prev) => ({
      ...prev,
      [id]: { price: '', currency: priceCurrency, ...prev[id], ...patch },
    }));
  }, [priceCurrency]);

  const applyUniformPrice = useCallback((price) => {
    const value = String(price ?? '');
    setPriceByType((prev) => {
      const next = { ...prev };
      for (const tt of eventTicketTypes) {
        const id = String(tt.id);
        priceEditsRef.current.add(id);
        next[id] = { ...(next[id] || {}), price: value, currency: priceCurrency };
      }
      return next;
    });
    setPriceDirtyTick((t) => t + 1);
  }, [eventTicketTypes, priceCurrency]);

  const upsertBasePrices = useCallback(async (entries) => {
    for (const entry of entries) {
      const existing = basePriceByType[entry.id];
      if (existing) {
        await eventTicketTypePricesAPI.update(existing.id, {
          base_price: entry.price,
          currency: entry.currency,
          is_active: true,
        });
      } else {
        await eventTicketTypePricesAPI.create({
          event: eventId,
          ticket_type: entry.id,
          base_price: entry.price,
          currency: entry.currency,
          is_active: true,
        });
      }
    }
  }, [basePriceByType, eventId]);

  const assignPricesToSlots = useCallback(async (entries, slotIds) => {
    if (!slotIds.length) return;
    for (const entry of entries) {
      await ticketPricesAPI.bulkCreate({
        event: eventId,
        slot_ids: slotIds,
        ticket_types: [entry.id],
        price: entry.price,
        currency: entry.currency,
        is_active: true,
      });
    }
  }, [eventId]);

  const collectPriceEntries = useCallback(() => {
    const entries = [];
    const errors = [];
    for (const tt of eventTicketTypes) {
      const id = String(tt.id);
      const row = priceByType[id] || {};
      const price = Number(row.price);
      if (!Number.isFinite(price) || price < 0) {
        errors.push(getTicketTypeLabel(tt));
        continue;
      }
      entries.push({
        id,
        tt,
        price,
        currency: normalizeCurrency(row.currency || priceCurrency),
      });
    }
    return { entries, errors };
  }, [eventTicketTypes, priceByType, priceCurrency]);

  const saveRowPrice = useCallback(async (typeId, { quiet = false } = {}) => {
    const id = String(typeId);
    const row = priceByType[id] || {};
    const price = Number(row.price);
    if (!Number.isFinite(price) || price < 0) return false;
    const tt = eventTicketTypes.find((t) => String(t.id) === id);
    setSavingRowId(id);
    setPriceError('');
    try {
      await upsertBasePrices([{
        id,
        price,
        currency: normalizeCurrency(row.currency || priceCurrency),
      }]);
      priceEditsRef.current.delete(id);
      setPriceDirtyTick((t) => t + 1);
      await loadPricingData(eventId, eventTicketTypes, priceCurrency);
      await loadPricePreview(eventId, allActiveSlots, eventTicketTypes);
      if (!quiet) setPriceOk(`Сохранена цена: ${getTicketTypeLabel(tt || { id })}`);
      return true;
    } catch (err) {
      setPriceError(parseApiError(err, 'Ошибка сохранения цены'));
      return false;
    } finally {
      setSavingRowId(null);
    }
  }, [
    priceByType,
    eventTicketTypes,
    upsertBasePrices,
    loadPricingData,
    eventId,
    priceCurrency,
    loadPricePreview,
    allActiveSlots,
  ]);

  const handlePriceBlur = useCallback((typeId) => {
    const id = String(typeId);
    if (!priceEditsRef.current.has(id)) return;
    const row = priceByType[id] || {};
    const price = Number(row.price);
    if (!Number.isFinite(price) || price < 0) return;
    saveRowPrice(id, { quiet: true });
  }, [priceByType, saveRowPrice]);

  const handleSaveChangedPrices = async (e) => {
    e.preventDefault();
    setPriceError('');
    setPriceOk('');
    const { entries, errors } = collectDirtyPriceEntries(
      eventTicketTypes,
      priceByType,
      priceCurrency,
      dirtyPriceIds,
    );
    if (!entries.length) {
      setPriceError(errors.length
        ? `Исправьте цены: ${errors.join(', ')}`
        : 'Нет несохранённых изменений');
      return;
    }
    if (errors.length) {
      setPriceError(`Некорректные цены: ${errors.join(', ')}`);
      return;
    }
    try {
      setPriceSaving(true);
      await upsertBasePrices(entries);
      for (const entry of entries) priceEditsRef.current.delete(entry.id);
      setPriceDirtyTick((t) => t + 1);
      setPriceOk(`Сохранено изменений: ${entries.length}`);
      await loadPricingData(eventId, eventTicketTypes, priceCurrency);
      await loadPricePreview(eventId, allActiveSlots, eventTicketTypes);
    } catch (err) {
      setPriceError(parseApiError(err, 'Ошибка сохранения цен'));
    } finally {
      setPriceSaving(false);
    }
  };

  const handleMatrixCellSave = useCallback(async ({
    slotId,
    typeId,
    price,
    currency,
    existingId,
  }) => {
    const key = `${slotId}:${typeId}`;
    setMatrixSavingKey(key);
    setPriceError('');
    try {
      if (existingId) {
        await ticketPricesAPI.update(existingId, {
          price,
          currency: normalizeCurrency(currency),
          is_active: true,
        });
      } else {
        await ticketPricesAPI.bulkCreate({
          event: eventId,
          slot_ids: [slotId],
          ticket_types: [typeId],
          price,
          currency: normalizeCurrency(currency),
          is_active: true,
        });
      }
      await loadPricingData(eventId, eventTicketTypes, priceCurrency);
      await loadPricePreview(eventId, allActiveSlots, eventTicketTypes);
      setPriceOk('Цена на слоте сохранена');
    } catch (err) {
      setPriceError(parseApiError(err, 'Ошибка сохранения цены на слоте'));
    } finally {
      setMatrixSavingKey(null);
    }
  }, [
    eventId,
    eventTicketTypes,
    priceCurrency,
    loadPricingData,
    loadPricePreview,
    allActiveSlots,
  ]);


  const handleCreateTt = async (e) => {
    e.preventDefault();
    setTtError(''); setTtOk('');
    const nameRu = ttForm.name_ru.trim();
    const code = ttForm.code.trim().toLowerCase();
    if (!nameRu) { setTtError('Введите название'); return; }
    try {
      setTtSaving(true);
      const createRes = await ticketTypesAPI.create({
        event: null,
        code,
        name: nameRu ? { ru: nameRu } : {},
        sort_order: Number(ttForm.sort_order || 0),
        is_active: true,
      });
      const newTypeId = createRes?.data?.id;
      const initialPrice = Number(ttForm.initial_price);
      if (newTypeId && Number.isFinite(initialPrice) && initialPrice >= 0) {
        await eventTicketTypePricesAPI.create({
          event: eventId,
          ticket_type: newTypeId,
          base_price: initialPrice,
          currency: normalizeCurrency(priceCurrency),
          is_active: true,
        });
        priceEditsRef.current.add(String(newTypeId));
        setPriceByType((prev) => ({
          ...prev,
          [String(newTypeId)]: { price: String(initialPrice), currency: normalizeCurrency(priceCurrency) },
        }));
      }
      setTtOk(`Создан: ${nameRu}`);
      setTtForm({ name_ru: '', code: '', sort_order: Number(ttForm.sort_order || 0) + 10, initial_price: '' });
      await loadTicketTypes(eventId);
    } catch (err) { setTtError(parseApiError(err, 'Ошибка создания')); }
    finally { setTtSaving(false); }
  };

  const handleDeleteTt = async (tt) => {
    if (!confirm(`Удалить тип «${getTicketTypeLabel(tt)}»?`)) return;
    try {
      await ticketTypesAPI.delete(tt.id);
      await loadTicketTypes(eventId);
    } catch (err) { setTtError(parseApiError(err, 'Ошибка удаления типа билета')); setShowTtForm(true); }
  };

  const openEditTt = (tt) => {
    const nameRu = tt.name?.ru || tt.name_ru || '';
    setEditTtForm({ name_ru: nameRu, code: tt.code || '', sort_order: tt.sort_order ?? 0 });
    setEditTtError('');
    setEditingTt(tt);
  };

  const handleSaveEditTt = async (e) => {
    e.preventDefault();
    const nameRu = editTtForm.name_ru.trim();
    if (!nameRu) { setEditTtError('Введите название'); return; }
    setEditTtSaving(true); setEditTtError('');
    try {
      await ticketTypesAPI.update(editingTt.id, {
        name: { ...(editingTt.name || {}), ru: nameRu },
        code: editTtForm.code.trim().toLowerCase(),
        sort_order: Number(editTtForm.sort_order || 0),
      });
      setEditingTt(null);
      await loadTicketTypes(eventId);
    } catch (err) { setEditTtError(parseApiError(err, 'Ошибка сохранения')); }
    finally { setEditTtSaving(false); }
  };

  const handleCreateSlots = async (e) => {
    e.preventDefault();
    setSlotError(''); setSlotOk('');
    const datetimes = slotMode === 'interval'
      ? buildFromInterval({ startIso: parseInputToIso(slotForm.start_datetime), endIso: parseInputToIso(slotForm.end_datetime), stepMinutes: slotForm.step_minutes })
      : slotMode === 'schedule'
        ? buildFromSchedule({ startDate: slotForm.schedule_start_date, endDate: slotForm.schedule_end_date, days: slotForm.schedule_days, timesText: slotForm.schedule_times_text })
        : buildFromList(slotForm.datetimes_text);
    if (!datetimes.length) { setSlotError('Нет корректных дат'); return; }
    const selectedTypeIds = (slotForm.ticket_type_ids || []).filter(Boolean);
    if (!selectedTypeIds.length) {
      setSlotError('Выберите хотя бы один тип билета для слотов');
      return;
    }
    try {
      setSlotSaving(true);
      const r = await eventSlotAvailabilitiesAPI.bulkCreate({
        event: eventId, slot_datetimes: datetimes,
        ticket_types: selectedTypeIds,
        booking_closes_minutes_before: Number(slotForm.booking_closes_minutes_before || 0),
        available_seats: Number(slotForm.available_seats || 0),
        is_active: true,
      });
      const res = r?.data;
      const overlapCount = Array.isArray(res?.overlap_warnings) ? res.overlap_warnings.length : 0;
      setSlotOk(
        `Создано: ${res?.created_count ?? 0}, пропущено: ${res?.skipped_existing ?? 0}`
        + (overlapCount ? ` · ⚠️ ${overlapCount} слот(ов) близко друг к другу (<30 мин)` : ''),
      );
      await loadSlots(eventId);
      await loadPricePreview(eventId, null, eventTicketTypes, { refetchSlots: true });
      if (slotForm.also_create_prices) {
        const selectedEntries = selectedTypeIds
          .map((typeId) => {
            const row = priceByType[String(typeId)] || {};
            const price = Number(row.price);
            if (!Number.isFinite(price) || price < 0) return null;
            return {
              id: String(typeId),
              price,
              currency: normalizeCurrency(row.currency || priceCurrency),
            };
          })
          .filter(Boolean);
        if (selectedEntries.length) {
          await upsertBasePrices(selectedEntries);
          const slotIds = Array.isArray(res?.created_ids) ? res.created_ids : [];
          if (slotIds.length) await assignPricesToSlots(selectedEntries, slotIds);
        }
      }
      await loadPricingData(eventId, eventTicketTypes, priceCurrency);
    } catch (err) { setSlotError(parseApiError(err, 'Ошибка создания слотов')); }
    finally { setSlotSaving(false); }
  };

  const handleSaveAllPrices = async (e) => {
    e.preventDefault();
    setPriceError(''); setPriceOk('');
    const { entries, errors } = collectPriceEntries();
    if (!entries.length) {
      setPriceError(errors.length
        ? `Укажите корректные цены для: ${errors.join(', ')}`
        : 'Добавьте типы билетов и укажите цены');
      return;
    }
    if (errors.length) {
      setPriceError(`Не для всех типов указана цена: ${errors.join(', ')}`);
      return;
    }
    try {
      setPriceSaving(true);
      const slotsR = await eventSlotAvailabilitiesAPI.list({ event: eventId, page_size: 1000, is_active: 'true' });
      const activeSlots = normalizeListResponse(slotsR?.data, ['results', 'data']);
      setPriceConfirm({
        entries,
        slotCount: activeSlots.length,
        slotIds: activeSlots.map((s) => s.id),
        assignSlotPrices,
      });
    } catch (err) {
      setPriceError(parseApiError(err, 'Ошибка подготовки сохранения цен'));
    } finally {
      setPriceSaving(false);
    }
  };

  const handleSaveAllPricesConfirm = useCallback(async () => {
    if (!priceConfirm) return;
    const { entries, slotIds, assignSlotPrices: assignSlots } = priceConfirm;
    setPriceConfirm(null);
    setPriceError(''); setPriceOk('');
    try {
      setPriceSaving(true);
      await upsertBasePrices(entries);
      if (assignSlots && slotIds?.length) {
        await assignPricesToSlots(entries, slotIds);
      }
      priceEditsRef.current = new Set();
      setPriceDirtyTick((t) => t + 1);
      const slotPart = assignSlots && slotIds?.length
        ? ` и назначены на ${slotIds.length} слотов`
        : '';
      setPriceOk(`Сохранены базовые цены для ${entries.length} типов${slotPart}`);
      await loadPricingData(eventId, eventTicketTypes, priceCurrency);
      await loadPricePreview(eventId, allActiveSlots, eventTicketTypes);
    } catch (err) {
      setPriceError(parseApiError(err, 'Ошибка сохранения цен'));
    } finally {
      setPriceSaving(false);
    }
  }, [priceConfirm, upsertBasePrices, assignPricesToSlots, loadPricingData, eventId, eventTicketTypes, priceCurrency, loadPricePreview, allActiveSlots]);

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div className="space-y-4 max-w-4xl">

        {/* Event selector */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h1 className="text-xl font-bold text-gray-900 mb-3">Настройка продаж</h1>
          {eventsError && (
            <div className="mb-3 flex items-center gap-2">
              <Err msg={eventsError} />
              <button onClick={reloadEvents} className="text-xs text-blue-600 hover:underline">Повторить</button>
            </div>
          )}
          <div className="mb-3">
            <Field label="Город">
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="w-full md:w-96 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">— Все города —</option>
                {cityOptions.map((city) => (
                  <option key={city.id} value={city.id}>{city.label}</option>
                ))}
              </select>
            </Field>
          </div>
          <EventSelect
            value={eventId}
            onChange={(v) => { setEventId(v); setShowTtForm(false); setShowSlotForm(false); setTtOk(''); setSlotOk(''); setPriceOk(''); }}
            options={filteredEventOptions}
            disabled={eventsLoading}
            placeholder={eventsLoading ? 'Загрузка…' : (cityFilter ? '— Выберите событие в городе —' : '— Выберите событие —')}
            className={`w-full md:w-96 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none ${eventsLoading ? 'opacity-60 cursor-wait' : ''}`}
          />

          {eventId && (
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full">
                {ttLoading ? '…' : eventTicketTypes.length} типов билетов
              </span>
              <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full">
                {basePricesLoading
                  ? '…'
                  : `${savedBaseForUsed}/${usedTicketTypeIdsInOpenSlots.size || '?'}`} в БД
              </span>
              <span className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full">
                {slotsLoading ? '…' : `${openSlots.length} откр. слотов`}
              </span>
              {dirtyPriceCount > 0 && (
                <span className="px-3 py-1 bg-sky-50 text-sky-700 rounded-full">
                  {dirtyPriceCount} черновик(ов)
                </span>
              )}
              {allPricesSaved && (
                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full">цены в БД</span>
              )}
            </div>
          )}

          {eventId && (
            <ReadinessChecklist
              items={readinessItems}
              readyCount={readinessReadyCount}
              totalCount={readinessItems.length}
            />
          )}
        </div>

        {!eventId && (
          <div className="text-sm text-gray-400 text-center py-8">Выберите событие чтобы начать настройку</div>
        )}

        {eventId && (
          <>
            {/* ── 1. Ticket types ─────────────────────────────────────────── */}
            <SectionCard
              title="Типы билетов"
              badge={eventTicketTypes.length}
              action={
                <button
                  onClick={() => setShowTtForm((v) => !v)}
                  className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
                >
                  {showTtForm ? 'Скрыть' : '+ Добавить'}
                </button>
              }
            >
              {ttLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-400"><Spinner /> Загрузка...</div>
              ) : ttLoadError ? (
                <div className="flex items-center gap-2">
                  <Err msg={ttLoadError} />
                  <button onClick={() => loadTicketTypes(eventId)} className="text-xs text-blue-600 hover:underline">Повторить</button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {eventTicketTypes.map((tt) => (
                    <div key={tt.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg text-sm">
                      <span className="font-medium text-gray-800">{getTicketTypeLabel(tt)}</span>
                      {tt.code && <span className="font-mono text-xs text-gray-400">({tt.code})</span>}
                      <>
                        <button
                          onClick={() => openEditTt(tt)}
                          className="text-gray-300 hover:text-blue-500 transition-colors ml-0.5 text-xs"
                          title="Редактировать"
                        >
                          ✎
                        </button>
                        <button
                          onClick={() => handleDeleteTt(tt)}
                          className="text-gray-300 hover:text-red-500 transition-colors text-xs"
                          title="Удалить"
                        >
                          ✕
                        </button>
                      </>
                    </div>
                  ))}
                  {!eventTicketTypes.length && (
                    <p className="text-sm text-gray-400">
                      Типы не найдены для этого события. Если раньше был авто-purge — проверьте глобальный каталог в админке или создайте тип вручную.
                    </p>
                  )}
                </div>
              )}

              {showTtForm && (
                <form onSubmit={handleCreateTt} className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Field label="Название (RU)" required>
                    <TextInput value={ttForm.name_ru} onChange={(e) => setTtForm((p) => ({ ...p, name_ru: e.target.value }))} placeholder="Взрослый" required />
                  </Field>
                  <Field label="Код" hint="adult / child / vip">
                    <TextInput value={ttForm.code} onChange={(e) => setTtForm((p) => ({ ...p, code: e.target.value }))} placeholder="adult" />
                  </Field>
                  <Field label="Цена" hint="сразу сохранится как базовая">
                    <TextInput type="number" step="0.01" min={0} value={ttForm.initial_price} onChange={(e) => setTtForm((p) => ({ ...p, initial_price: e.target.value }))} placeholder="25.00" />
                  </Field>
                  <Field label="Порядок">
                    <TextInput type="number" min={0} value={ttForm.sort_order} onChange={(e) => setTtForm((p) => ({ ...p, sort_order: +e.target.value || 0 }))} />
                  </Field>
                  <div className="md:col-span-4 flex items-center gap-3">
                    <button type="submit" disabled={ttSaving} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                      {ttSaving ? 'Создание…' : 'Создать тип'}
                    </button>
                    <Err msg={ttError} />
                    <Ok msg={ttOk} />
                  </div>
                </form>
              )}
            </SectionCard>

            {/* ── 2. Prices (unified) ───────────────────────────────────────── */}
            <SectionCard
              title="Цены"
              badge={usedTicketTypeIdsInOpenSlots.size ? `${savedBaseForUsed}/${usedTicketTypeIdsInOpenSlots.size}` : '…'}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <p className="text-xs text-gray-500">
                  Базовая цена действует на все слоты. Правила и цены на слоте перебивают базовую.
                </p>
                {eventId && (
                  <Link
                    to={`/catalog/pricing-rules${eventId ? `?event=${eventId}` : ''}`}
                    className="text-xs text-blue-600 hover:underline whitespace-nowrap"
                  >
                    {pricingRulesLoading
                      ? 'Правила…'
                      : pricingRules.length
                        ? `Правила цен (${pricingRules.length}) →`
                        : 'Правила цен →'}
                  </Link>
                )}
              </div>

              <PricePreviewPanel
                preview={pricePreview}
                loading={pricePreviewLoading}
                error={pricePreviewError}
              />

              {basePricesLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-400 mt-3"><Spinner /> Загрузка цен...</div>
              ) : !eventTicketTypes.length ? (
                <p className="text-sm text-gray-400 mt-3">Добавьте типы билетов, чтобы настроить цены</p>
              ) : (
                <form id="price-form" onSubmit={handleSaveAllPrices} className="space-y-4 mt-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <Field label="Валюта для всех типов">
                      <TextInput
                        value={priceCurrency}
                        maxLength={3}
                        onChange={(e) => {
                          const cur = e.target.value.toUpperCase();
                          setPriceCurrency(cur);
                          setPriceByType((prev) => {
                            const next = { ...prev };
                            for (const tt of eventTicketTypes) {
                              const id = String(tt.id);
                              next[id] = { ...(next[id] || {}), currency: normalizeCurrency(cur) };
                            }
                            return next;
                          });
                        }}
                        className="w-24"
                      />
                    </Field>
                    <div className="flex-1 min-w-[180px]">
                      <Field label="Одна цена для всех">
                        <div className="flex gap-2">
                          <TextInput
                            type="number"
                            step="0.01"
                            min={0}
                            placeholder="25.00"
                            value={uniformPrice}
                            onChange={(e) => setUniformPrice(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                applyUniformPrice(uniformPrice);
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => applyUniformPrice(uniformPrice)}
                            className="px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 whitespace-nowrap"
                          >
                            Применить
                          </button>
                        </div>
                      </Field>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                        <tr>
                          <th className="px-3 py-2 text-left">Тип билета</th>
                          <th className="px-3 py-2 text-right w-36">Цена</th>
                          <th className="px-3 py-2 text-center w-40">Статус</th>
                          <th className="px-3 py-2 text-right w-20" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {eventTicketTypes.map((tt) => {
                          const id = String(tt.id);
                          const row = priceByType[id] || {};
                          const savedBase = basePriceByType[id];
                          const isDirty = dirtyPriceIds.has(id);
                          const status = getPriceRowStatus({
                            row,
                            savedBase,
                            isDirty,
                            rulesCount: rulesCountByType[id] || 0,
                            slotOnlyCount: countSlotOnlyPrices(slotPricesList, id, !!savedBase),
                          });
                          return (
                            <tr key={id} className={`hover:bg-gray-50 ${isDirty ? 'bg-sky-50/40' : ''}`}>
                              <td className="px-3 py-2">
                                <div className="font-medium text-gray-800">{getTicketTypeLabel(tt)}</div>
                                {tt.code && <div className="text-xs text-gray-400 font-mono">{tt.code}</div>}
                              </td>
                              <td className="px-3 py-2">
                                <TextInput
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  value={row.price ?? ''}
                                  onChange={(e) => setPriceForType(id, { price: e.target.value, currency: priceCurrency })}
                                  onBlur={() => handlePriceBlur(id)}
                                  placeholder="0.00"
                                  className="text-right"
                                />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <PriceStatusBadge status={status} />
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  disabled={savingRowId === id || !isDirty}
                                  onClick={() => saveRowPrice(id)}
                                  className="text-xs text-blue-600 hover:underline disabled:opacity-40 disabled:no-underline"
                                  title="Сохранить базовую цену"
                                >
                                  {savingRowId === id ? '…' : '✓'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <SlotPriceOverrideMatrix
                    slots={openSlots}
                    ticketTypes={eventTicketTypes}
                    slotPriceMap={slotPriceMap}
                    basePriceByType={basePriceByType}
                    defaultCurrency={priceCurrency}
                    onSaveCell={handleMatrixCellSave}
                    savingKey={matrixSavingKey}
                  />

                  <label className="flex items-start gap-2 text-sm text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={assignSlotPrices}
                      onChange={(e) => setAssignSlotPrices(e.target.checked)}
                      className="mt-0.5 rounded border-gray-300 text-blue-600"
                    />
                    <span>
                      При «Сохранить все» — дополнительно зафиксировать на каждом слоте
                      <span className="block text-xs text-gray-400">Обычно не нужно: базовой цены достаточно</span>
                    </span>
                  </label>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSaveChangedPrices}
                      disabled={priceSaving || dirtyPriceCount === 0}
                      className="px-4 py-2.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
                    >
                      {priceSaving ? 'Сохранение…' : `Сохранить изменённые (${dirtyPriceCount})`}
                    </button>
                    <button
                      type="submit"
                      disabled={priceSaving || !eventTicketTypes.length}
                      className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {priceSaving ? 'Сохранение…' : 'Сохранить все типы'}
                    </button>
                    <Err msg={priceError} />
                    <Ok msg={priceOk} />
                  </div>
                </form>
              )}
            </SectionCard>

            {/* ── 3. Slots ──────────────────────────────────────────────────── */}
            <SectionCard
              title="Слоты"
              badge={slotsTotal != null ? slotsTotal : '…'}
              action={
                <div className="flex gap-2">
                  {slotsTotal > 0 && (
                    <button
                      onClick={() => setShowSlotsManager(true)}
                      className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                    >
                      Управлять
                    </button>
                  )}
                  <button
                    onClick={() => setShowSlotForm((v) => !v)}
                    className="px-3 py-1 text-xs font-medium text-purple-600 bg-purple-50 rounded-md hover:bg-purple-100 transition-colors"
                  >
                    {showSlotForm ? 'Скрыть' : '+ Добавить'}
                  </button>
                </div>
              }
            >
              {slotsLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-400"><Spinner /> Загрузка...</div>
              ) : recentSlots.length ? (
                <div className="space-y-1">
                  {recentSlots.map((s) => (
                    <div key={s.id} className="text-sm text-gray-600">
                      {new Date(s.slot_datetime).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      <span className="text-gray-400 ml-2">· {s.available_seats} мест</span>
                    </div>
                  ))}
                  {slotsTotal > 5 && <p className="text-xs text-gray-400">…и ещё {slotsTotal - 5}</p>}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Слотов нет — добавьте первый</p>
              )}
              {showSlotForm && (
                <form onSubmit={handleCreateSlots} className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {[['interval', 'Интервал'], ['schedule', 'Расписание'], ['list', 'Список дат']].map(([m, l]) => (
                      <button key={m} type="button" onClick={() => setSlotMode(m)}
                        className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${slotMode === m ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                        {l}
                      </button>
                    ))}
                  </div>

                  {slotMode === 'interval' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Field label="Начало" required><TextInput type="datetime-local" value={slotForm.start_datetime} onChange={(e) => setSlotForm((p) => ({ ...p, start_datetime: e.target.value }))} required /></Field>
                      <Field label="Конец" required><TextInput type="datetime-local" value={slotForm.end_datetime} onChange={(e) => setSlotForm((p) => ({ ...p, end_datetime: e.target.value }))} required /></Field>
                      <Field label="Шаг (мин)"><TextInput type="number" min={1} value={slotForm.step_minutes} onChange={(e) => setSlotForm((p) => ({ ...p, step_minutes: +e.target.value || 60 }))} /></Field>
                    </div>
                  )}

                  {slotMode === 'schedule' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="С даты" required><TextInput type="date" value={slotForm.schedule_start_date} onChange={(e) => setSlotForm((p) => ({ ...p, schedule_start_date: e.target.value }))} required /></Field>
                        <Field label="По дату" required><TextInput type="date" value={slotForm.schedule_end_date} onChange={(e) => setSlotForm((p) => ({ ...p, schedule_end_date: e.target.value }))} required /></Field>
                      </div>
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            ['Пн–Пт', { mon:true, tue:true, wed:true, thu:true, fri:true, sat:false, sun:false }],
                            ['Выходные', { mon:false, tue:false, wed:false, thu:false, fri:false, sat:true, sun:true }],
                            ['Все', { mon:true, tue:true, wed:true, thu:true, fri:true, sat:true, sun:true }],
                            ['Сбросить', { mon:false, tue:false, wed:false, thu:false, fri:false, sat:false, sun:false }],
                          ].map(([label, days]) => (
                            <button key={label} type="button"
                              onClick={() => setSlotForm((p) => ({ ...p, schedule_days: days }))}
                              className="px-2 py-1 text-xs rounded border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors">
                              {label}
                            </button>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {[['mon','Пн'],['tue','Вт'],['wed','Ср'],['thu','Чт'],['fri','Пт'],['sat','Сб'],['sun','Вс']].map(([k,l]) => (
                            <label key={k} className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                              <input type="checkbox" checked={!!slotForm.schedule_days[k]} onChange={(e) => setSlotForm((p) => ({ ...p, schedule_days: { ...p.schedule_days, [k]: e.target.checked } }))} />
                              {l}
                            </label>
                          ))}
                        </div>
                      </div>
                      <Field label="Время (HH:mm, по строке)" required>
                        <textarea rows={3} value={slotForm.schedule_times_text} onChange={(e) => setSlotForm((p) => ({ ...p, schedule_times_text: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none" required />
                        {(() => {
                          const bad = slotForm.schedule_times_text.split('\n')
                            .map((l, i) => ({ l: l.trim(), i: i + 1 }))
                            .filter(({ l }) => l && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(l));
                          return bad.length > 0 ? (
                            <p className="text-xs text-red-600 mt-1">
                              Неверный формат в строках: {bad.map(({ l, i }) => `${i} («${l}»)`).join(', ')}
                            </p>
                          ) : null;
                        })()}
                      </Field>
                    </div>
                  )}

                  {slotMode === 'list' && (
                    <Field label="Даты/время по строке" required>
                      <textarea rows={4} value={slotForm.datetimes_text} onChange={(e) => setSlotForm((p) => ({ ...p, datetimes_text: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none" placeholder="2026-06-01 10:00" required />
                    </Field>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Кол-во мест" hint="Общий пул на слот — делится между всеми выбранными типами билетов ниже."><TextInput type="number" min={0} value={slotForm.available_seats} onChange={(e) => setSlotForm((p) => ({ ...p, available_seats: +e.target.value || 0 }))} /></Field>
                    <Field label="Закрытие брони (мин до)"><TextInput type="number" min={0} value={slotForm.booking_closes_minutes_before} onChange={(e) => setSlotForm((p) => ({ ...p, booking_closes_minutes_before: +e.target.value || 0 }))} /></Field>
                  </div>

                  <Field
                    label="Типы билетов для слотов"
                    required
                    hint="Только глобальные типы — событийные (устаревшие) недоступны для слотов, так как их не видят покупатели."
                  >
                    {!globalEventTicketTypes.length ? (
                      <p className="text-sm text-gray-400">Сначала добавьте глобальный тип билета для события</p>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setSlotForm((p) => ({ ...p, ticket_type_ids: globalEventTicketTypes.map((tt) => String(tt.id)) }))}
                            className="px-2 py-1 text-xs rounded border border-gray-200 bg-gray-50 hover:bg-gray-100"
                          >
                            Выбрать все
                          </button>
                          <button
                            type="button"
                            onClick={() => setSlotForm((p) => ({ ...p, ticket_type_ids: [] }))}
                            className="px-2 py-1 text-xs rounded border border-gray-200 bg-gray-50 hover:bg-gray-100"
                          >
                            Снять выбор
                          </button>
                          <span className="text-xs text-gray-500 self-center">
                            Выбрано: {slotForm.ticket_type_ids?.length || 0} из {globalEventTicketTypes.length}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {globalEventTicketTypes.map((tt) => {
                            const id = String(tt.id);
                            const checked = (slotForm.ticket_type_ids || []).includes(id);
                            return (
                              <label key={id} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-sm cursor-pointer transition-colors ${checked ? 'bg-purple-50 border-purple-300 text-purple-800' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    setSlotForm((p) => {
                                      const curr = Array.isArray(p.ticket_type_ids) ? p.ticket_type_ids : [];
                                      if (e.target.checked) {
                                        return { ...p, ticket_type_ids: Array.from(new Set([...curr, id])) };
                                      }
                                      return { ...p, ticket_type_ids: curr.filter((x) => x !== id) };
                                    });
                                  }}
                                  className="rounded border-gray-300 text-purple-600"
                                />
                                {getTicketTypeLabel(tt)}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </Field>

                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!slotForm.also_create_prices}
                      onChange={(e) => setSlotForm((p) => ({ ...p, also_create_prices: e.target.checked }))}
                      className="rounded border-gray-300 text-purple-600"
                    />
                    <span>
                      Сразу сохранить цены из раздела «Цены» на новые слоты
                      <span className="block text-xs text-gray-400">По умолчанию выкл. — для приложения достаточно базовых цен</span>
                    </span>
                  </label>

                  <div className="flex items-center gap-3">
                    <button type="submit" disabled={slotSaving} className="px-4 py-2 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors">
                      {slotSaving ? 'Создание…' : 'Создать слоты'}
                    </button>
                    <Err msg={slotError} />
                    <Ok msg={slotOk} />
                  </div>
                </form>
              )}
            </SectionCard>


          </>
        )}
      </div>

      {/* Edit Ticket Type Modal */}
      <Modal open={!!editingTt} onClose={() => setEditingTt(null)} title="Редактировать тип билета" size="sm">
        {editingTt && (
          <form onSubmit={handleSaveEditTt} className="space-y-3">
            <Field label="Название (RU)" required>
              <TextInput value={editTtForm.name_ru} onChange={(e) => setEditTtForm((p) => ({ ...p, name_ru: e.target.value }))} placeholder="Взрослый" required autoFocus />
            </Field>
            <Field label="Код" hint="adult / child / vip">
              <TextInput value={editTtForm.code} onChange={(e) => setEditTtForm((p) => ({ ...p, code: e.target.value }))} placeholder="adult" />
            </Field>
            <Field label="Порядок">
              <TextInput type="number" min={0} value={editTtForm.sort_order} onChange={(e) => setEditTtForm((p) => ({ ...p, sort_order: +e.target.value || 0 }))} />
            </Field>
            <div className="flex items-center gap-3 pt-1">
              <button type="submit" disabled={editTtSaving} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {editTtSaving ? 'Сохранение…' : 'Сохранить'}
              </button>
              <button type="button" onClick={() => setEditingTt(null)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                Отмена
              </button>
              <Err msg={editTtError} />
            </div>
          </form>
        )}
      </Modal>

      <SlotsManagerModal
        open={showSlotsManager}
        eventId={eventId}
        onClose={() => setShowSlotsManager(false)}
        onChanged={() => loadSlots(eventId)}
      />

      <ConfirmModal
        open={!!priceConfirm}
        onClose={() => setPriceConfirm(null)}
        onConfirm={handleSaveAllPricesConfirm}
        title="Сохранить цены?"
        message={priceConfirm
          ? `Сохранить базовые цены для ${priceConfirm.entries.length} типов билетов?${priceConfirm.assignSlotPrices && priceConfirm.slotCount
            ? ` Также зафиксировать на ${priceConfirm.slotCount} слотах.`
            : ''}`
          : ''}
        confirmLabel="Сохранить"
      />
    </Layout>
  );
}
