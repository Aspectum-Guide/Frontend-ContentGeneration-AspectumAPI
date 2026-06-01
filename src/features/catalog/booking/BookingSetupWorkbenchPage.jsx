import { useCallback, useEffect, useRef, useState } from 'react';
import {
  eventSlotAvailabilitiesAPI,
  eventTicketTypePricesAPI,
  ticketPricesAPI,
  ticketTypesAPI,
} from '../../../api/booking';
import Layout from '../../../components/Layout';
import Modal, { ConfirmModal } from '../../../components/ui/Modal';
import { Field, TextInput } from '../../../components/ui/FormField';
import { parseApiError } from '../../../utils/apiError';
import { useEventOptions } from '../shared/bookingOptions';
import { getMultiLangValue } from '../shared/i18n';
import { normalizeListResponse } from '../shared/normalize';

// ─── helpers ────────────────────────────────────────────────────────────────

function parseInputToIso(v) {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

function buildFromInterval({ startIso, endIso, stepMinutes }) {
  const start = startIso ? new Date(startIso) : null;
  const end = endIso ? new Date(endIso) : null;
  const step = Number(stepMinutes || 0);
  if (!start || !end || !Number.isFinite(step) || step <= 0) return [];
  const out = [];
  for (let t = start.getTime(); t <= end.getTime(); t += step * 60_000) {
    out.push(new Date(t).toISOString());
    if (out.length >= 1000) break;
  }
  return out;
}

function buildFromSchedule({ startDate, endDate, days, timesText }) {
  if (!startDate || !endDate) return [];
  const lines = String(timesText || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const times = lines.map((l) => { const m = /^(\d{1,2}):(\d{2})$/.exec(l); return m ? { hh: +m[1], mm: +m[2] } : null; }).filter(Boolean);
  const dayMap = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' };
  const out = [];
  for (let d = new Date(`${startDate}T00:00:00`); d <= new Date(`${endDate}T00:00:00`); d.setDate(d.getDate() + 1)) {
    if (!days[dayMap[d.getDay()]]) continue;
    for (const t of times) {
      const dt = new Date(d); dt.setHours(t.hh, t.mm, 0, 0);
      out.push(dt.toISOString());
      if (out.length >= 1000) return [...new Set(out)];
    }
  }
  return [...new Set(out)];
}

function buildFromList(text) {
  return [...new Set(
    String(text || '').split('\n').map((l) => l.trim()).filter(Boolean)
      .map((l) => { const d = new Date(l.replace(' ', 'T')); return Number.isNaN(d.getTime()) ? null : d.toISOString(); })
      .filter(Boolean)
  )];
}

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

// ─── SlotsManagerModal ───────────────────────────────────────────────────────

const SLOTS_PAGE = 20;

function fmtSlot(iso) {
  return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
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
    if (open) { setPage(1); setEditingId(null); setRowError({}); loadSlots(1, dateFrom, dateTo); }
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
    setEditForm({ available_seats: slot.available_seats, booking_closes_minutes_before: slot.booking_closes_minutes_before });
    setRowError((p) => { const n = { ...p }; delete n[slot.id]; return n; });
  };

  const handleSaveEdit = async (slot) => {
    setSaving(slot.id);
    try {
      await eventSlotAvailabilitiesAPI.update(slot.id, {
        available_seats: Number(editForm.available_seats ?? 0),
        booking_closes_minutes_before: Number(editForm.booking_closes_minutes_before ?? 0),
      });
      setSlots((prev) => prev.map((s) => s.id === slot.id
        ? { ...s, available_seats: Number(editForm.available_seats), booking_closes_minutes_before: Number(editForm.booking_closes_minutes_before) }
        : s));
      setEditingId(null);
      onChanged?.();
    } catch (e) {
      setRowError((p) => ({ ...p, [slot.id]: parseApiError(e, 'Ошибка сохранения') }));
    } finally { setSaving(null); }
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

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
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
                  <tr key={slot.id} className={`hover:bg-gray-50 ${!slot.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-3 py-2 font-mono text-xs text-gray-700 whitespace-nowrap">{fmtSlot(slot.slot_datetime)}</td>
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
  const { eventOptions, eventsLoading } = useEventOptions();
  const [eventId, setEventId] = useState('');

  // ── state per section ────────────────────────────────────────────────────
  const [ticketTypes, setTicketTypes] = useState([]);
  const [ttLoading, setTtLoading] = useState(false);

  const [slotsTotal, setSlotsTotal] = useState(null);
  const [recentSlots, setRecentSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [coverage, setCoverage] = useState([]); // [{tt, covered, total}]
  const [coverageLoading, setCoverageLoading] = useState(false);

  const [basePrices, setBasePrices] = useState([]);
  const [basePricesLoading, setBasePricesLoading] = useState(false);

  // ── ticket type form ─────────────────────────────────────────────────────
  const [showTtForm, setShowTtForm] = useState(false);
  const [ttForm, setTtForm] = useState({ name_ru: '', code: '', sort_order: 0 });
  const [ttSaving, setTtSaving] = useState(false);
  const [ttError, setTtError] = useState('');
  const [ttOk, setTtOk] = useState('');

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
  });
  const [slotSaving, setSlotSaving] = useState(false);
  const [slotError, setSlotError] = useState('');
  const [slotOk, setSlotOk] = useState('');

  // ── coverage fill ────────────────────────────────────────────────────────
  const [fillTtId, setFillTtId] = useState('');
  const [fillPrice, setFillPrice] = useState('');
  const [fillCurrency, setFillCurrency] = useState('EUR');
  const [fillSaving, setFillSaving] = useState(false);
  const [fillError, setFillError] = useState('');
  const [fillOk, setFillOk] = useState('');

  // ── base price form ──────────────────────────────────────────────────────
  const [showBpForm, setShowBpForm] = useState(false);
  const [bpForm, setBpForm] = useState({ ticket_type: '', base_price: '', currency: 'EUR' });
  const [bpSaving, setBpSaving] = useState(false);
  const [bpError, setBpError] = useState('');
  const [bpOk, setBpOk] = useState('');

  // ── loaders ──────────────────────────────────────────────────────────────

  const loadTicketTypes = useCallback(async (evId) => {
    if (!evId) { setTicketTypes([]); return; }
    setTtLoading(true);
    try {
      const r = await ticketTypesAPI.list({ event: evId, page_size: 100, ordering: 'sort_order' });
      setTicketTypes(normalizeListResponse(r?.data, ['results', 'data']));
    } catch { setTicketTypes([]); } finally { setTtLoading(false); }
  }, []);

  const loadSlots = useCallback(async (evId) => {
    if (!evId) { setSlotsTotal(null); setRecentSlots([]); return; }
    setSlotsLoading(true);
    try {
      const r = await eventSlotAvailabilitiesAPI.list({ event: evId, page_size: 5, ordering: 'slot_datetime' });
      const data = r?.data;
      setSlotsTotal(data?.count ?? data?.total ?? normalizeListResponse(data, ['results', 'data']).length);
      setRecentSlots(normalizeListResponse(data, ['results', 'data']).slice(0, 5));
    } catch { setSlotsTotal(null); setRecentSlots([]); } finally { setSlotsLoading(false); }
  }, []);

  const loadCoverage = useCallback(async (evId, tts) => {
    if (!evId || !tts.length) { setCoverage([]); return; }
    setCoverageLoading(true);
    try {
      const [slotsR, pricesR] = await Promise.all([
        eventSlotAvailabilitiesAPI.list({ event: evId, page_size: 1, is_active: 'true' }),
        ticketPricesAPI.list({ event: evId, page_size: 1000, is_active: 'true' }),
      ]);
      const total = slotsR?.data?.count ?? slotsR?.data?.total ?? 0;
      const prices = normalizeListResponse(pricesR?.data, ['results', 'data']);
      const cov = tts.map((tt) => {
        const covered = new Set(prices.filter((p) => String(p.ticket_type) === String(tt.id)).map((p) => String(p.slot))).size;
        return { tt, covered, total };
      });
      setCoverage(cov);
    } catch { setCoverage([]); } finally { setCoverageLoading(false); }
  }, []);

  const loadBasePrices = useCallback(async (evId) => {
    if (!evId) { setBasePrices([]); return; }
    setBasePricesLoading(true);
    try {
      const r = await eventTicketTypePricesAPI.list({ event: evId, page_size: 100 });
      setBasePrices(normalizeListResponse(r?.data, ['results', 'data']));
    } catch { setBasePrices([]); } finally { setBasePricesLoading(false); }
  }, []);

  const loadAll = useCallback((evId) => {
    loadTicketTypes(evId);
    loadSlots(evId);
    loadBasePrices(evId);
  }, [loadTicketTypes, loadSlots, loadBasePrices]);

  useEffect(() => { loadAll(eventId); }, [eventId, loadAll]);
  useEffect(() => { if (ticketTypes.length) loadCoverage(eventId, ticketTypes); }, [ticketTypes, eventId, loadCoverage]);

  // ── actions ───────────────────────────────────────────────────────────────

  const handleCreateTt = async (e) => {
    e.preventDefault();
    setTtError(''); setTtOk('');
    const nameRu = ttForm.name_ru.trim();
    const code = ttForm.code.trim().toLowerCase();
    if (!nameRu) { setTtError('Введите название'); return; }
    try {
      setTtSaving(true);
      await ticketTypesAPI.create({
        event: eventId, code,
        name: nameRu ? { ru: nameRu } : {},
        sort_order: Number(ttForm.sort_order || 0),
        is_active: true,
      });
      setTtOk(`Создан: ${nameRu}`);
      setTtForm({ name_ru: '', code: '', sort_order: Number(ttForm.sort_order || 0) + 10 });
      await loadTicketTypes(eventId);
    } catch (err) { setTtError(parseApiError(err, 'Ошибка создания')); }
    finally { setTtSaving(false); }
  };

  const handleDeleteTt = async (tt) => {
    if (!confirm(`Удалить тип «${getMultiLangValue(tt.name) || tt.code}»?`)) return;
    try {
      await ticketTypesAPI.delete(tt.id);
      await loadTicketTypes(eventId);
    } catch (err) { setTtError(parseApiError(err, 'Ошибка удаления типа билета')); setShowTtForm(true); }
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
    try {
      setSlotSaving(true);
      const r = await eventSlotAvailabilitiesAPI.bulkCreate({
        event: eventId, slot_datetimes: datetimes,
        ticket_types: ticketTypes.map((t) => t.id),
        booking_closes_minutes_before: Number(slotForm.booking_closes_minutes_before || 0),
        available_seats: Number(slotForm.available_seats || 0),
        is_active: true,
      });
      const res = r?.data;
      setSlotOk(`Создано: ${res?.created_count ?? 0}, пропущено: ${res?.skipped_existing ?? 0}`);
      await loadSlots(eventId);
      await loadCoverage(eventId, ticketTypes);
    } catch (err) { setSlotError(parseApiError(err, 'Ошибка создания слотов')); }
    finally { setSlotSaving(false); }
  };

  const handleFillPrices = async (e) => {
    e.preventDefault();
    setFillError(''); setFillOk('');
    const price = Number(fillPrice);
    if (!fillTtId) { setFillError('Выберите тип билета'); return; }
    if (!Number.isFinite(price) || price < 0) { setFillError('Введите корректную цену'); return; }
    try {
      setFillSaving(true);
      // Load all slots for the event
      const r = await eventSlotAvailabilitiesAPI.list({ event: eventId, page_size: 1000, is_active: 'true' });
      const slots = normalizeListResponse(r?.data, ['results', 'data']);
      if (!slots.length) { setFillError('Нет активных слотов'); return; }
      await ticketPricesAPI.bulkCreate({
        event: eventId,
        slot_ids: slots.map((s) => s.id),
        ticket_types: [fillTtId],
        price, currency: fillCurrency.toUpperCase(), is_active: true,
      });
      setFillOk(`Готово: цены назначены для ${slots.length} слотов`);
      await loadCoverage(eventId, ticketTypes);
    } catch (err) { setFillError(parseApiError(err, 'Ошибка назначения цен')); }
    finally { setFillSaving(false); }
  };

  const handleCreateBp = async (e) => {
    e.preventDefault();
    setBpError(''); setBpOk('');
    if (!bpForm.ticket_type) { setBpError('Выберите тип билета'); return; }
    const price = Number(bpForm.base_price);
    if (!Number.isFinite(price) || price < 0) { setBpError('Введите корректную цену'); return; }
    try {
      setBpSaving(true);
      await eventTicketTypePricesAPI.create({
        event: eventId, ticket_type: bpForm.ticket_type,
        base_price: price, currency: bpForm.currency.toUpperCase(), is_active: true,
      });
      setBpOk('Базовая цена добавлена');
      setBpForm({ ticket_type: '', base_price: '', currency: 'EUR' });
      await loadBasePrices(eventId);
    } catch (err) { setBpError(parseApiError(err, 'Ошибка создания')); }
    finally { setBpSaving(false); }
  };

  const handleDeleteBp = async (bp) => {
    if (!confirm('Удалить базовую цену?')) return;
    try {
      await eventTicketTypePricesAPI.delete(bp.id);
      await loadBasePrices(eventId);
    } catch (err) { setBpError(parseApiError(err, 'Ошибка удаления базовой цены')); setShowBpForm(true); }
  };

  // ── render ────────────────────────────────────────────────────────────────

  const eventName = eventOptions.find((e) => String(e.id) === eventId);
  const ttById = Object.fromEntries(ticketTypes.map((t) => [String(t.id), t]));

  return (
    <Layout>
      <div className="space-y-4 max-w-4xl">

        {/* Event selector */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h1 className="text-xl font-bold text-gray-900 mb-3">Настройка продаж</h1>
          <select
            value={eventId}
            onChange={(e) => { setEventId(e.target.value); setShowTtForm(false); setShowSlotForm(false); setShowBpForm(false); setTtOk(''); setSlotOk(''); setBpOk(''); setFillOk(''); }}
            className={`w-full md:w-96 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none ${eventsLoading ? 'opacity-60 cursor-wait' : ''}`}
            disabled={eventsLoading}
          >
            <option value="">{eventsLoading ? 'Загрузка…' : '— Выберите событие —'}</option>
            {eventOptions.map((ev) => (
              <option key={ev.id} value={ev.id}>{getMultiLangValue(ev.title) || ev.id}</option>
            ))}
          </select>

          {eventId && (
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full">
                {ttLoading ? '…' : ticketTypes.length} типов билетов
              </span>
              <span className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full">
                {slotsLoading ? '…' : slotsTotal ?? '?'} слотов
              </span>
              <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full">
                {basePricesLoading ? '…' : basePrices.length} базовых цен
              </span>
            </div>
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
              badge={ticketTypes.length}
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
              ) : (
                <div className="flex flex-wrap gap-2">
                  {ticketTypes.map((tt) => (
                    <div key={tt.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg text-sm">
                      <span className="font-medium text-gray-800">{getMultiLangValue(tt.name) || tt.code}</span>
                      {tt.code && <span className="font-mono text-xs text-gray-400">({tt.code})</span>}
                      <button onClick={() => handleDeleteTt(tt)} className="text-gray-300 hover:text-red-500 transition-colors ml-1 text-xs">✕</button>
                    </div>
                  ))}
                  {!ticketTypes.length && <p className="text-sm text-gray-400">Нет типов билетов — добавьте первый</p>}
                </div>
              )}

              {showTtForm && (
                <form onSubmit={handleCreateTt} className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Field label="Название (RU)" required>
                    <TextInput value={ttForm.name_ru} onChange={(e) => setTtForm((p) => ({ ...p, name_ru: e.target.value }))} placeholder="Взрослый" required />
                  </Field>
                  <Field label="Код" hint="adult / child / vip">
                    <TextInput value={ttForm.code} onChange={(e) => setTtForm((p) => ({ ...p, code: e.target.value }))} placeholder="adult" />
                  </Field>
                  <Field label="Порядок">
                    <TextInput type="number" min={0} value={ttForm.sort_order} onChange={(e) => setTtForm((p) => ({ ...p, sort_order: +e.target.value || 0 }))} />
                  </Field>
                  <div className="md:col-span-3 flex items-center gap-3">
                    <button type="submit" disabled={ttSaving} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                      {ttSaving ? 'Создание…' : 'Создать тип'}
                    </button>
                    <Err msg={ttError} />
                    <Ok msg={ttOk} />
                  </div>
                </form>
              )}
            </SectionCard>

            {/* ── 2. Slots ──────────────────────────────────────────────────── */}
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
                      <div className="flex flex-wrap gap-3">
                        {[['mon','Пн'],['tue','Вт'],['wed','Ср'],['thu','Чт'],['fri','Пт'],['sat','Сб'],['sun','Вс']].map(([k,l]) => (
                          <label key={k} className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                            <input type="checkbox" checked={!!slotForm.schedule_days[k]} onChange={(e) => setSlotForm((p) => ({ ...p, schedule_days: { ...p.schedule_days, [k]: e.target.checked } }))} />
                            {l}
                          </label>
                        ))}
                      </div>
                      <Field label="Время (HH:mm, по строке)" required>
                        <textarea rows={3} value={slotForm.schedule_times_text} onChange={(e) => setSlotForm((p) => ({ ...p, schedule_times_text: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none" required />
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
                    <Field label="Кол-во мест"><TextInput type="number" min={0} value={slotForm.available_seats} onChange={(e) => setSlotForm((p) => ({ ...p, available_seats: +e.target.value || 0 }))} /></Field>
                    <Field label="Закрытие брони (мин до)"><TextInput type="number" min={0} value={slotForm.booking_closes_minutes_before} onChange={(e) => setSlotForm((p) => ({ ...p, booking_closes_minutes_before: +e.target.value || 0 }))} /></Field>
                  </div>

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

            {/* ── 3. Price coverage ─────────────────────────────────────────── */}
            <SectionCard title="Покрытие ценами">
              {coverageLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-400"><Spinner /> Загрузка...</div>
              ) : !coverage.length ? (
                <p className="text-sm text-gray-400">Добавьте типы билетов и слоты чтобы увидеть покрытие</p>
              ) : (
                <div className="space-y-3">
                  {coverage.map(({ tt, covered, total }) => {
                    const pct = total > 0 ? Math.round((covered / total) * 100) : 0;
                    const full = pct === 100;
                    return (
                      <div key={tt.id} className="flex items-center gap-3">
                        <div className="w-28 text-sm font-medium text-gray-700 truncate">{getMultiLangValue(tt.name) || tt.code}</div>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${full ? 'bg-green-500' : 'bg-blue-400'}`} style={{ width: `${pct}%` }} />
                        </div>
                        <div className="text-xs text-gray-500 w-20 text-right">{covered}/{total} слотов</div>
                        {!full && (
                          <button
                            onClick={() => { setFillTtId(tt.id); setFillPrice(''); document.getElementById('fill-form')?.scrollIntoView({ behavior: 'smooth' }); }}
                            className="px-2 py-1 text-xs text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors whitespace-nowrap"
                          >
                            Заполнить
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Fill prices form */}
              {!!ticketTypes.length && (
                <form id="fill-form" onSubmit={handleFillPrices} className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-3">Назначить цену всем активным слотам события:</p>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <Field label="Тип билета" required>
                      <select value={fillTtId} onChange={(e) => setFillTtId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" required>
                        <option value="">Выберите тип</option>
                        {ticketTypes.map((tt) => <option key={tt.id} value={tt.id}>{getMultiLangValue(tt.name) || tt.code}</option>)}
                      </select>
                    </Field>
                    <Field label="Цена" required>
                      <TextInput type="number" step="0.01" min={0} value={fillPrice} onChange={(e) => setFillPrice(e.target.value)} required />
                    </Field>
                    <Field label="Валюта">
                      <TextInput value={fillCurrency} maxLength={3} onChange={(e) => setFillCurrency(e.target.value.toUpperCase())} />
                    </Field>
                    <div className="flex items-end">
                      <button type="submit" disabled={fillSaving} className="w-full px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                        {fillSaving ? 'Назначение…' : 'Назначить'}
                      </button>
                    </div>
                  </div>
                  <div className="mt-1 flex gap-2">
                    <Err msg={fillError} />
                    <Ok msg={fillOk} />
                  </div>
                </form>
              )}
            </SectionCard>

            {/* ── 4. Base prices ────────────────────────────────────────────── */}
            <SectionCard
              title="Базовые цены"
              badge={basePrices.length}
              action={
                <button onClick={() => setShowBpForm((v) => !v)}
                  className="px-3 py-1 text-xs font-medium text-amber-600 bg-amber-50 rounded-md hover:bg-amber-100 transition-colors">
                  {showBpForm ? 'Скрыть' : '+ Добавить'}
                </button>
              }
            >
              <p className="text-xs text-gray-400 mb-3">Fallback-цена ценового движка когда нет конкретной цены для слота.</p>
              {basePricesLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-400"><Spinner /> Загрузка...</div>
              ) : basePrices.length ? (
                <div className="flex flex-wrap gap-2">
                  {basePrices.map((bp) => {
                    const tt = ttById[String(bp.ticket_type)];
                    return (
                      <div key={bp.id} className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                        <span className="text-gray-700">{tt ? (getMultiLangValue(tt.name) || tt.code) : bp.ticket_type}</span>
                        <span className="font-medium text-amber-800">{bp.base_price} {bp.currency}</span>
                        <button onClick={() => handleDeleteBp(bp)} className="text-amber-300 hover:text-red-500 transition-colors text-xs">✕</button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Базовых цен нет</p>
              )}

              {showBpForm && (
                <form onSubmit={handleCreateBp} className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Field label="Тип билета" required>
                    <select value={bpForm.ticket_type} onChange={(e) => setBpForm((p) => ({ ...p, ticket_type: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" required>
                      <option value="">Выберите тип</option>
                      {ticketTypes.map((tt) => <option key={tt.id} value={tt.id}>{getMultiLangValue(tt.name) || tt.code}</option>)}
                    </select>
                  </Field>
                  <Field label="Базовая цена" required>
                    <TextInput type="number" step="0.01" min={0} value={bpForm.base_price} onChange={(e) => setBpForm((p) => ({ ...p, base_price: e.target.value }))} required />
                  </Field>
                  <Field label="Валюта">
                    <TextInput value={bpForm.currency} maxLength={3} onChange={(e) => setBpForm((p) => ({ ...p, currency: e.target.value.toUpperCase() }))} />
                  </Field>
                  <div className="flex items-end">
                    <button type="submit" disabled={bpSaving} className="w-full px-4 py-2 text-sm text-white bg-amber-500 rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors">
                      {bpSaving ? 'Создание…' : 'Добавить'}
                    </button>
                  </div>
                  <div className="md:col-span-4 flex gap-2">
                    <Err msg={bpError} />
                    <Ok msg={bpOk} />
                  </div>
                </form>
              )}
            </SectionCard>
          </>
        )}
      </div>

      <SlotsManagerModal
        open={showSlotsManager}
        eventId={eventId}
        onClose={() => setShowSlotsManager(false)}
        onChanged={() => loadSlots(eventId)}
      />
    </Layout>
  );
}
