import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { eventSlotAvailabilitiesAPI, ticketPricesAPI, ticketTypesAPI } from '../../../api/booking';
import Layout from '../../../components/Layout';
import { Field, FormActions, TextInput } from '../../../components/ui/FormField';
import { parseApiError } from '../../../utils/apiError';
import { useEventOptions, useTicketTypeOptions } from '../shared/bookingOptions';
import FormErrorAlert from '../shared/components/FormErrorAlert';
import FormHint from '../shared/components/FormHint';
import { getMultiLangValue } from '../shared/i18n';

function parseInputToIso(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}

function buildSlotDatetimesFromInterval({ startIso, endIso, stepMinutes }) {
  const start = startIso ? new Date(startIso) : null;
  const end = endIso ? new Date(endIso) : null;
  const step = Number(stepMinutes || 0);
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  if (!Number.isFinite(step) || step <= 0) return [];

  const out = [];
  for (let t = start.getTime(); t <= end.getTime(); t += step * 60 * 1000) {
    out.push(new Date(t).toISOString());
    if (out.length >= 1000) break;
  }
  return out;
}

function parseSlotDatetimesText(text) {
  const raw = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const out = [];
  for (const line of raw) {
    const normalized = line.replace(' ', 'T');
    const d = new Date(normalized);
    if (!Number.isNaN(d.getTime())) out.push(d.toISOString());
    if (out.length >= 1000) break;
  }

  return Array.from(new Set(out));
}

function parseTimesText(text) {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const out = [];
  for (const line of lines) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(line);
    if (!m) continue;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) continue;
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) continue;
    out.push({ hh, mm, label: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` });
  }

  const seen = new Set();
  return out.filter((t) => (seen.has(t.label) ? false : (seen.add(t.label), true)));
}

function buildSlotDatetimesFromSchedule({ startDate, endDate, days, times }) {
  if (!startDate || !endDate) return [];
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  if (end.getTime() < start.getTime()) return [];
  if (!times?.length) return [];

  const dayMap = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' };
  const out = [];
  for (let d = new Date(start); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 1)) {
    const key = dayMap[d.getDay()];
    if (!days?.[key]) continue;
    for (const t of times) {
      const dt = new Date(d);
      dt.setHours(t.hh, t.mm, 0, 0);
      out.push(dt.toISOString());
      if (out.length >= 1000) return Array.from(new Set(out));
    }
  }
  return Array.from(new Set(out));
}

export default function BookingSetupWorkbenchPage() {
  const { eventOptions, eventsLoading } = useEventOptions();
  const [eventId, setEventId] = useState('');
  const { ticketTypeOptions, ticketTypesLoading, reloadTicketTypes } = useTicketTypeOptions(eventId);

  const [typeForm, setTypeForm] = useState({
    name_primary: '',
    name_ru: '',
    sort_order: 0,
    is_active: true,
  });
  const [typeSaving, setTypeSaving] = useState(false);
  const [typeError, setTypeError] = useState('');
  const [typeSuccess, setTypeSuccess] = useState('');

  const [slotForm, setSlotForm] = useState({
    mode: 'interval',
    ticket_types: [],
    start_datetime: '',
    end_datetime: '',
    step_minutes: 60,
    datetimes_text: '',
    schedule_start_date: '',
    schedule_end_date: '',
    schedule_days: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false },
    schedule_times_text: '10:00\n12:00\n14:00',
    booking_closes_minutes_before: 60,
    available_seats: 0,
    is_active: true,
  });
  const [slotSaving, setSlotSaving] = useState(false);
  const [slotError, setSlotError] = useState('');
  const [slotResult, setSlotResult] = useState(null);
  const [createdSlotIds, setCreatedSlotIds] = useState([]);

  const [priceForm, setPriceForm] = useState({
    price_mode: 'single',
    price_value: '',
    price_currency: 'EUR',
    price_is_active: true,
    price_by_ticket_type: {},
  });
  const [priceSaving, setPriceSaving] = useState(false);
  const [priceError, setPriceError] = useState('');
  const [priceResult, setPriceResult] = useState(null);

  const eventLabel = useMemo(() => {
    const event = eventOptions.find((item) => String(item.id) === String(eventId));
    return getMultiLangValue(event?.title) || String(event?.id || '');
  }, [eventOptions, eventId]);

  const createTicketType = async (e) => {
    e.preventDefault();
    if (!eventId) {
      setTypeError('Сначала выберите событие.');
      return;
    }

    const namePrimary = (typeForm.name_primary || '').trim();
    const nameRu = (typeForm.name_ru || '').trim();
    if (!namePrimary && !nameRu) {
      setTypeError('Укажите хотя бы название типа билета.');
      return;
    }

    const payload = {
      event: eventId,
      name_primary: namePrimary || nameRu,
      name: nameRu ? { ru: nameRu } : (namePrimary ? { en: namePrimary } : {}),
      sort_order: Number(typeForm.sort_order || 0),
      is_active: !!typeForm.is_active,
    };

    try {
      setTypeSaving(true);
      setTypeError('');
      setTypeSuccess('');
      await ticketTypesAPI.create(payload);
      setTypeSuccess('Тип билета создан.');
      setTypeForm((prev) => ({ ...prev, name_primary: '', name_ru: '', sort_order: Number(prev.sort_order || 0) + 10 }));
      await reloadTicketTypes();
    } catch (err) {
      setTypeError(parseApiError(err, 'Не удалось создать тип билета'));
    } finally {
      setTypeSaving(false);
    }
  };

  const createSlots = async (e) => {
    e.preventDefault();
    if (!eventId) {
      setSlotError('Сначала выберите событие.');
      return;
    }

    const slotDatetimes =
      slotForm.mode === 'interval'
        ? buildSlotDatetimesFromInterval({
          startIso: parseInputToIso(slotForm.start_datetime),
          endIso: parseInputToIso(slotForm.end_datetime),
          stepMinutes: slotForm.step_minutes,
        })
        : slotForm.mode === 'schedule'
          ? buildSlotDatetimesFromSchedule({
            startDate: slotForm.schedule_start_date,
            endDate: slotForm.schedule_end_date,
            days: slotForm.schedule_days,
            times: parseTimesText(slotForm.schedule_times_text),
          })
          : parseSlotDatetimesText(slotForm.datetimes_text);

    if (!slotDatetimes.length) {
      setSlotError('Нет валидных дат/времени для создания слотов.');
      return;
    }

    const payload = {
      event: eventId,
      ticket_types: Array.isArray(slotForm.ticket_types) ? slotForm.ticket_types.filter(Boolean) : [],
      slot_datetimes: slotDatetimes,
      booking_closes_minutes_before: Number(slotForm.booking_closes_minutes_before || 0),
      available_seats: Number(slotForm.available_seats || 0),
      is_active: !!slotForm.is_active,
    };

    try {
      setSlotSaving(true);
      setSlotError('');
      const resp = await eventSlotAvailabilitiesAPI.bulkCreate(payload);
      const result = resp?.data || null;
      setSlotResult(result);
      const ids = Array.isArray(result?.created_ids) ? result.created_ids.map(String) : [];
      setCreatedSlotIds(ids);
    } catch (err) {
      setSlotError(parseApiError(err, 'Не удалось создать слоты'));
    } finally {
      setSlotSaving(false);
    }
  };

  const createPrices = async (e) => {
    e.preventDefault();
    if (!eventId) {
      setPriceError('Сначала выберите событие.');
      return;
    }
    if (!createdSlotIds.length) {
      setPriceError('Сначала создайте слоты в блоке выше (или создайте цены в каталоге цен).');
      return;
    }
    const ticketTypeIds = Array.isArray(slotForm.ticket_types) ? slotForm.ticket_types.filter(Boolean) : [];
    if (!ticketTypeIds.length) {
      setPriceError('Для массовых цен выберите хотя бы один тип билета в блоке слотов.');
      return;
    }

    try {
      setPriceSaving(true);
      setPriceError('');
      const currency = (priceForm.price_currency || 'EUR').toUpperCase();
      const isActive = !!priceForm.price_is_active;

      if (priceForm.price_mode === 'per_type') {
        for (const ttId of ticketTypeIds) {
          const raw = priceForm.price_by_ticket_type?.[ttId];
          const value = Number(raw);
          if (!Number.isFinite(value) || value < 0) {
            throw new Error(`Введите корректную цену для типа ${ttId}`);
          }
          await ticketPricesAPI.bulkCreate({
            event: eventId,
            slot_ids: createdSlotIds,
            ticket_types: [ttId],
            price: value,
            currency,
            is_active: isActive,
          });
        }
      } else {
        const value = Number(priceForm.price_value);
        if (!Number.isFinite(value) || value < 0) {
          throw new Error('Введите корректную цену (0 или больше).');
        }
        await ticketPricesAPI.bulkCreate({
          event: eventId,
          slot_ids: createdSlotIds,
          ticket_types: ticketTypeIds,
          price: value,
          currency,
          is_active: isActive,
        });
      }

      setPriceResult({
        slotCount: createdSlotIds.length,
        ticketTypeCount: ticketTypeIds.length,
      });
    } catch (err) {
      setPriceError(parseApiError(err, err?.message || 'Не удалось создать цены'));
    } finally {
      setPriceSaving(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 md:p-5">
          <h1 className="text-2xl font-bold text-gray-900">Booking Setup</h1>
          <p className="mt-1 text-sm text-gray-500">
            Удобный мастер для настройки продаж: типы билетов, массовые слоты и цены без табличного режима.
          </p>
          <div className="mt-4 max-w-xl">
            <Field label="Событие" required>
              <select
                value={eventId}
                onChange={(e) => {
                  const nextEvent = e.target.value;
                  setEventId(nextEvent);
                  setTypeSuccess('');
                  setCreatedSlotIds([]);
                  setSlotResult(null);
                  setPriceResult(null);
                  setSlotForm((prev) => ({ ...prev, ticket_types: [] }));
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                disabled={eventsLoading}
                required
              >
                <option value="">Выберите событие</option>
                {eventOptions.map((eventItem) => (
                  <option key={eventItem.id} value={eventItem.id}>
                    {getMultiLangValue(eventItem.title) || eventItem.id}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-gray-900">1. Создать тип билета</h2>
            <FormErrorAlert message={typeError} />
            {typeSuccess ? <p className="mt-2 text-sm text-emerald-700">{typeSuccess}</p> : null}
            <form className="mt-3 space-y-3" onSubmit={createTicketType}>
              <Field label="Название (key)" required>
                <TextInput
                  value={typeForm.name_primary}
                  onChange={(e) => setTypeForm((prev) => ({ ...prev, name_primary: e.target.value }))}
                  placeholder="adult / child / vip"
                  required={!typeForm.name_ru}
                />
              </Field>
              <Field label="Название (RU)">
                <TextInput
                  value={typeForm.name_ru}
                  onChange={(e) => setTypeForm((prev) => ({ ...prev, name_ru: e.target.value }))}
                  placeholder="Взрослый / Детский / VIP"
                />
              </Field>
              <Field label="Порядок">
                <TextInput
                  type="number"
                  min={0}
                  value={typeForm.sort_order}
                  onChange={(e) => setTypeForm((prev) => ({ ...prev, sort_order: Number(e.target.value || 0) }))}
                />
              </Field>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={typeForm.is_active}
                  onChange={(e) => setTypeForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                />
                Активный тип билета
              </label>
              <FormActions saving={typeSaving} saveLabel="Создать тип" onCancel={() => setTypeError('')} />
            </form>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4 xl:col-span-2">
            <h2 className="text-lg font-semibold text-gray-900">2. Массово создать слоты</h2>
            <FormErrorAlert message={slotError} />
            <div className="mt-3 mb-3">
              <Field label="Типы билетов (для слотов)">
                {!eventId ? (
                  <div className="text-sm text-gray-500">Сначала выберите событие</div>
                ) : ticketTypesLoading ? (
                  <div className="text-sm text-gray-500">Загрузка типов билетов...</div>
                ) : (
                  <div className="max-h-40 overflow-auto rounded-lg border border-gray-200 p-2">
                    {ticketTypeOptions.map((tt) => {
                      const id = String(tt.id);
                      const label = getMultiLangValue(tt.name) || tt.name_primary || id;
                      const checked = slotForm.ticket_types.includes(id);
                      return (
                        <label key={id} className="flex items-center gap-2 text-sm text-gray-700 py-1">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? Array.from(new Set([...slotForm.ticket_types, id]))
                                : slotForm.ticket_types.filter((x) => x !== id);
                              setSlotForm((prev) => ({ ...prev, ticket_types: next }));
                            }}
                          />
                          {label}
                        </label>
                      );
                    })}
                  </div>
                )}
              </Field>
            </div>

            <form className="space-y-3" onSubmit={createSlots}>
              <div className="flex flex-wrap gap-2">
                {['interval', 'list', 'schedule'].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSlotForm((prev) => ({ ...prev, mode }))}
                    className={`px-3 py-1.5 text-sm rounded-lg border ${slotForm.mode === mode ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700'}`}
                  >
                    {mode === 'interval' ? 'Интервал' : mode === 'list' ? 'Список дат' : 'Дни + время'}
                  </button>
                ))}
              </div>

              {slotForm.mode === 'interval' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Field label="Начало" required><TextInput type="datetime-local" value={slotForm.start_datetime} onChange={(e) => setSlotForm((p) => ({ ...p, start_datetime: e.target.value }))} required /></Field>
                  <Field label="Конец" required><TextInput type="datetime-local" value={slotForm.end_datetime} onChange={(e) => setSlotForm((p) => ({ ...p, end_datetime: e.target.value }))} required /></Field>
                  <Field label="Шаг (мин)" required><TextInput type="number" min={1} value={slotForm.step_minutes} onChange={(e) => setSlotForm((p) => ({ ...p, step_minutes: Number(e.target.value || 0) }))} required /></Field>
                </div>
              ) : null}

              {slotForm.mode === 'list' ? (
                <Field label="Даты/время (по строке)" required>
                  <textarea
                    rows={5}
                    value={slotForm.datetimes_text}
                    onChange={(e) => setSlotForm((p) => ({ ...p, datetimes_text: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                    placeholder={'2026-05-10 10:00\n2026-05-10 12:00'}
                    required
                  />
                </Field>
              ) : null}

              {slotForm.mode === 'schedule' ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Дата начала" required><TextInput type="date" value={slotForm.schedule_start_date} onChange={(e) => setSlotForm((p) => ({ ...p, schedule_start_date: e.target.value }))} required /></Field>
                    <Field label="Дата конца" required><TextInput type="date" value={slotForm.schedule_end_date} onChange={(e) => setSlotForm((p) => ({ ...p, schedule_end_date: e.target.value }))} required /></Field>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      ['mon', 'Пн'], ['tue', 'Вт'], ['wed', 'Ср'], ['thu', 'Чт'], ['fri', 'Пт'], ['sat', 'Сб'], ['sun', 'Вс'],
                    ].map(([k, label]) => (
                      <label key={k} className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={!!slotForm.schedule_days[k]}
                          onChange={(e) => setSlotForm((p) => ({ ...p, schedule_days: { ...p.schedule_days, [k]: e.target.checked } }))}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <Field label="Время (HH:mm по строке)" required>
                    <textarea
                      rows={4}
                      value={slotForm.schedule_times_text}
                      onChange={(e) => setSlotForm((p) => ({ ...p, schedule_times_text: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                      required
                    />
                  </Field>
                </div>
              ) : null}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Мест"><TextInput type="number" min={0} value={slotForm.available_seats} onChange={(e) => setSlotForm((p) => ({ ...p, available_seats: Number(e.target.value || 0) }))} /></Field>
                <Field label="Закрытие брони (мин)"><TextInput type="number" min={0} value={slotForm.booking_closes_minutes_before} onChange={(e) => setSlotForm((p) => ({ ...p, booking_closes_minutes_before: Number(e.target.value || 0) }))} /></Field>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 self-end pb-2">
                  <input type="checkbox" checked={slotForm.is_active} onChange={(e) => setSlotForm((p) => ({ ...p, is_active: e.target.checked }))} />
                  Активные слоты
                </label>
              </div>

              <FormActions saving={slotSaving} saveLabel="Создать слоты" onCancel={() => setSlotError('')} />
            </form>

            {slotResult ? (
              <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                Создано: <b>{slotResult.created_count ?? 0}</b>, пропущено: <b>{slotResult.skipped_existing ?? 0}</b>
              </div>
            ) : null}
          </section>
        </div>

        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-gray-900">3. Массово создать цены для новых слотов</h2>
          <FormErrorAlert message={priceError} />
          <FormHint>
            Цены применяются к слотам, созданным на шаге 2 в этом же мастере ({createdSlotIds.length} слотов в буфере).
          </FormHint>
          <form className="mt-3 space-y-3" onSubmit={createPrices}>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPriceForm((p) => ({ ...p, price_mode: 'single' }))}
                className={`px-3 py-1.5 text-sm rounded-lg border ${priceForm.price_mode === 'single' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700'}`}
              >
                Одна цена на все типы
              </button>
              <button
                type="button"
                onClick={() => setPriceForm((p) => ({ ...p, price_mode: 'per_type' }))}
                className={`px-3 py-1.5 text-sm rounded-lg border ${priceForm.price_mode === 'per_type' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700'}`}
              >
                Разные цены по типам
              </button>
            </div>

            {priceForm.price_mode === 'single' ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Цена" required><TextInput type="number" step="0.01" min={0} value={priceForm.price_value} onChange={(e) => setPriceForm((p) => ({ ...p, price_value: e.target.value }))} required /></Field>
                <Field label="Валюта" required><TextInput value={priceForm.price_currency} maxLength={3} onChange={(e) => setPriceForm((p) => ({ ...p, price_currency: e.target.value }))} required /></Field>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 self-end pb-2"><input type="checkbox" checked={priceForm.price_is_active} onChange={(e) => setPriceForm((p) => ({ ...p, price_is_active: e.target.checked }))} />Цена активна</label>
              </div>
            ) : (
              <div className="space-y-2">
                {slotForm.ticket_types.map((ttId) => {
                  const tt = ticketTypeOptions.find((x) => String(x.id) === String(ttId));
                  const label = getMultiLangValue(tt?.name) || tt?.name_primary || ttId;
                  return (
                    <div key={ttId} className="grid grid-cols-1 md:grid-cols-[1fr_140px] gap-2 items-center">
                      <div className="text-sm text-gray-700 truncate">{label}</div>
                      <TextInput
                        type="number"
                        min={0}
                        step="0.01"
                        value={priceForm.price_by_ticket_type?.[ttId] ?? ''}
                        onChange={(e) => setPriceForm((p) => ({ ...p, price_by_ticket_type: { ...(p.price_by_ticket_type || {}), [ttId]: e.target.value } }))}
                        required
                      />
                    </div>
                  );
                })}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Валюта" required><TextInput value={priceForm.price_currency} maxLength={3} onChange={(e) => setPriceForm((p) => ({ ...p, price_currency: e.target.value }))} required /></Field>
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700 self-end pb-2"><input type="checkbox" checked={priceForm.price_is_active} onChange={(e) => setPriceForm((p) => ({ ...p, price_is_active: e.target.checked }))} />Цена активна</label>
                </div>
              </div>
            )}
            <FormActions saving={priceSaving} saveLabel="Создать цены" onCancel={() => setPriceError('')} />
          </form>

          {priceResult ? (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              Готово: цены созданы для <b>{priceResult.slotCount}</b> слотов и <b>{priceResult.ticketTypeCount}</b> типов билетов.
            </div>
          ) : null}
        </section>

        <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
          Работаете с событием: <b>{eventLabel || 'не выбрано'}</b>. Для детальной правки можно перейти в{' '}
          <Link className="text-blue-700 hover:underline" to="/catalog/slot-availabilities">каталог слотов</Link>{' '}
          и{' '}
          <Link className="text-blue-700 hover:underline" to="/catalog/ticket-prices">каталог цен</Link>.
        </div>
      </div>
    </Layout>
  );
}
