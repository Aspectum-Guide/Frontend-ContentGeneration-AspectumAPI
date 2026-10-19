import { useEffect, useMemo, useState } from 'react';
import { externalProductsAPI } from '../../../api/booking';
import { citiesAPI } from '../../../api/generation';
import Layout from '../../../components/Layout';
import { Alert, Button, CalendarDayButton, Field, Heading, InlineState, PageHeader, Panel, SectionHeader, Select, StatusBadge, TextInput } from '@aspectum/ui';
import { parseApiError } from '../../../utils/apiError';
import { getMultiLangValue } from '../shared/i18n';
import { normalizeListResponse } from '../shared/normalize';

function label(value, fallback = '—') {
  return getMultiLangValue(value) || fallback;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function dateAfter(start, days) {
  const value = new Date(`${start}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function formatSupplierMoney(minor, currency, precision = 2) {
  if (minor == null || !currency) return '—';
  const amount = Number(minor) / (10 ** Number(precision || 0));
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency }).format(amount);
}

export default function ExternalProductsCatalogPage() {
  const [cities, setCities] = useState([]);
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [cityId, setCityId] = useState('');
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productId, setProductId] = useState('');
  const [optionId, setOptionId] = useState('');
  const [quantities, setQuantities] = useState({});
  const [date, setDate] = useState(today());
  const [availability, setAvailability] = useState(null);
  const [calendar, setCalendar] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [booking, setBooking] = useState(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [holds, setHolds] = useState([]);
  const [holdsLoading, setHoldsLoading] = useState(false);
  const [holdActionId, setHoldActionId] = useState('');

  useEffect(() => {
    let active = true;
    citiesAPI.list({ page_size: 1000, limit: 1000 })
      .then((response) => {
        if (active) setCities(normalizeListResponse(response?.data, ['results', 'data']));
      })
      .catch((err) => active && setError(parseApiError(err, 'Не удалось загрузить города')))
      .finally(() => active && setCitiesLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setProducts([]);
    setProductId('');
    setOptionId('');
    setQuantities({});
    setAvailability(null);
    setBooking(null);
    if (!cityId) return () => { active = false; };

    setProductsLoading(true);
    setError(null);
    externalProductsAPI.list(cityId)
      .then((response) => active && setProducts(normalizeListResponse(response?.data, ['results', 'data'])))
      .catch((err) => active && setError(parseApiError(err, 'Не удалось загрузить внешний каталог')))
      .finally(() => active && setProductsLoading(false));
    return () => { active = false; };
  }, [cityId]);

  const product = useMemo(
    () => products.find((item) => String(item.id) === String(productId)) || null,
    [products, productId],
  );
  const option = useMemo(
    () => product?.options?.find((item) => String(item.id) === String(optionId)) || null,
    [product, optionId],
  );

  useEffect(() => {
    const nextOption = product?.options?.find((item) => item.is_default) || product?.options?.[0] || null;
    setOptionId(nextOption?.id ? String(nextOption.id) : '');
    setAvailability(null);
    setBooking(null);
  }, [productId, product]);

  useEffect(() => {
    const firstUnit = option?.units?.[0];
    setQuantities(firstUnit?.id ? { [firstUnit.id]: 1 } : {});
    setAvailability(null);
  }, [optionId, option]);

  useEffect(() => {
    let active = true;
    setCalendar([]);
    if (!product || !option) return () => { active = false; };
    const dateFrom = today();
    setCalendarLoading(true);
    externalProductsAPI.calendar(product.id, {
      option: option.id,
      date_from: dateFrom,
      date_to: dateAfter(dateFrom, 30),
    })
      .then((response) => active && setCalendar(response?.data?.availability || []))
      .catch((err) => active && setError(parseApiError(err, 'Не удалось загрузить календарь поставщика')))
      .finally(() => active && setCalendarLoading(false));
    return () => { active = false; };
  }, [product, option]);

  const loadHolds = async () => {
    if (!product) return;
    setHoldsLoading(true);
    try {
      const response = await externalProductsAPI.holds(product.id);
      setHolds(Array.isArray(response?.data) ? response.data : []);
    } catch (err) {
      setError(parseApiError(err, 'Не удалось загрузить бронирования'));
    } finally {
      setHoldsLoading(false);
    }
  };

  const updateHold = async (holdId, action) => {
    setHoldActionId(holdId);
    setError(null);
    try {
      const response = action === 'cancel'
        ? await externalProductsAPI.cancelHold(holdId)
        : action === 'test-pay'
          ? await externalProductsAPI.testPay(holdId)
          : action === 'refund'
            ? await externalProductsAPI.refund(holdId)
          : await externalProductsAPI.refreshHold(holdId);
      const updated = response?.data;
      if (updated?.id) setHolds((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (err) {
      setError(parseApiError(err, action === 'cancel' ? 'Не удалось отменить hold' : action === 'test-pay' ? 'Не удалось подтвердить тестовую оплату' : action === 'refund' ? 'Не удалось выполнить refund' : 'Не удалось обновить статус hold'));
    } finally {
      setHoldActionId('');
    }
  };

  useEffect(() => {
    setHolds([]);
    if (product) loadHolds();
  // loadHolds is intentionally invoked only when the selected product changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const checkAvailability = async () => {
    const units = (option?.units || [])
      .map((unit) => ({ unit: String(unit.id), quantity: Number(quantities[unit.id] || 0) }))
      .filter((unit) => Number.isInteger(unit.quantity) && unit.quantity > 0);
    if (!product || !option || !date || !units.length) {
      setError('Выберите продукт, option, дату и хотя бы один билет.');
      return;
    }
    setChecking(true);
    setError(null);
    setAvailability(null);
    setBooking(null);
    try {
      const response = await externalProductsAPI.availability(product.id, {
        option: option.id,
        date,
        units,
        currency: product.default_currency || undefined,
      });
      setAvailability(response?.data || null);
    } catch (err) {
      setError(parseApiError(err, 'Не удалось получить availability у поставщика'));
    } finally {
      setChecking(false);
    }
  };

  const reserveHold = async () => {
    const units = (option?.units || [])
      .map((unit) => ({ unit: String(unit.id), quantity: Number(quantities[unit.id] || 0) }))
      .filter((unit) => Number.isInteger(unit.quantity) && unit.quantity > 0);
    if (!product || !option || !date || !units.length || !fullName.trim() || !email.trim()) {
      setError('Для резервации заполните билеты, дату, имя и e-mail.');
      return;
    }
    setBookingLoading(true);
    setError(null);
    try {
      const idempotencyKey = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
      const response = await externalProductsAPI.createHold(product.id, {
        option: option.id,
        date,
        units,
        currency: product.default_currency || undefined,
        full_name: fullName.trim(),
        email: email.trim(),
      }, idempotencyKey);
      setBooking(response?.data || null);
      await loadHolds();
    } catch (err) {
      setError(parseApiError(err, 'Не удалось зарезервировать билеты у поставщика'));
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <Layout>
      <PageHeader
        title="Внешние продукты"
        description="Тестовый экран каталога, live availability и резервации у поставщика. Платёж и подтверждение брони пока не создаются."
      />

      {error && <Alert tone="error" className="mb-4">{error}</Alert>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Panel as="section" className="p-5 space-y-4">
          <Field label="Город">
            <Select value={cityId} onChange={(e) => setCityId(e.target.value)} disabled={citiesLoading}>
              <option value="">{citiesLoading ? 'Загрузка…' : 'Выберите город'}</option>
              {cities.map((city) => <option key={city.id} value={city.id}>{label(city.name, city.id)}</option>)}
            </Select>
          </Field>

          <Field label="Продукт поставщика">
            <Select value={productId} onChange={(e) => setProductId(e.target.value)} disabled={!cityId || productsLoading || !products.length}>
              <option value="">{productsLoading ? 'Загрузка…' : products.length ? 'Выберите продукт' : 'Нет опубликованных продуктов'}</option>
              {products.map((item) => <option key={item.id} value={item.id}>{label(item.title, item.external_id)}</option>)}
            </Select>
          </Field>

          {product && <>
            <Panel tone="muted" className="p-3 text-xs space-y-1">
              <p><span className="font-medium">Поставщик:</span> {product.supplier_name || product.provider}</p>
              <p><span className="font-medium">External ID:</span> <span className="font-mono">{product.external_id}</span></p>
              {product.description && <p>{label(product.description, '')}</p>}
            </Panel>
            <Field label="Option">
              <Select value={optionId} onChange={(e) => setOptionId(e.target.value)}>
                {product.options?.map((item) => <option key={item.id} value={item.id}>{label(item.title, item.external_id)}</option>)}
              </Select>
            </Field>
            <Field label="Дата">
              <TextInput type="date" value={date} min={today()} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <p className="text-sm font-medium text-aspectum-text-strong">Календарь доступности</p>
                {calendarLoading && <InlineState as="span" loading size="xs" tone="disabled">Загрузка…</InlineState>}
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {calendar.map((day) => {
                  const selected = date === day.localDate;
                  return (
                    <CalendarDayButton
                      key={day.localDate}
                      date={day.localDate}
                      available={day.available}
                      selected={selected}
                      vacancies={day.vacancies ?? 0}
                      onSelect={setDate}
                    />
                  );
                })}
              </div>
              {!calendarLoading && calendar.length === 0 && <p className="text-xs text-aspectum-text-disabled">Нет данных на ближайший месяц.</p>}
            </div>
            <div>
              <p className="text-sm font-medium text-aspectum-text-strong mb-2">Билеты</p>
              <div className="space-y-2">
                {option?.units?.map((unit) => (
                  <div key={unit.id} className="flex items-center gap-3 rounded-aspectum-control border border-aspectum-border px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-aspectum-text-emphasis truncate">{label(unit.title, unit.external_id)}</p>
                      <p className="text-xs text-aspectum-text-disabled">{unit.unit_type || unit.external_id}</p>
                    </div>
                    <TextInput className="w-20 text-right" type="number" min="0" max="100" value={quantities[unit.id] || 0} onChange={(e) => setQuantities((current) => ({ ...current, [unit.id]: e.target.value }))} aria-label={`Количество ${label(unit.title, unit.external_id)}`} />
                  </div>
                ))}
              </div>
            </div>
            <Button type="button" variant="primary" size="md" onClick={checkAvailability} disabled={checking || !option} className="w-full">
              {checking ? 'Проверяем…' : 'Проверить доступность'}
            </Button>
            <div className="border-t border-aspectum-border pt-4 space-y-3">
              <p className="text-sm font-medium text-aspectum-text-strong">Тестовая резервация</p>
              <TextInput value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Имя гостя" />
              <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail гостя" />
              <Button type="button" onClick={reserveHold} disabled={bookingLoading || !availability} variant="amber" size="md" className="w-full">
                {bookingLoading ? 'Резервируем…' : 'Создать hold на 10 минут'}
              </Button>
              <p className="text-xs text-aspectum-text-muted">Повторная проверка цены и мест выполняется на сервере перед запросом в Ventrata. Деньги не списываются.</p>
            </div>
          </>}
        </Panel>

        <Panel as="section" className="p-5">
          <SectionHeader title="Результат availability" size="sm" />
          {!availability && <p className="mt-3 text-sm text-aspectum-text-disabled">Выберите продукт и нажмите «Проверить доступность».</p>}
          {availability && <div className="mt-4 space-y-3">
            <p className="text-xs text-aspectum-text-disabled">Provider: {availability.provider} · Request ID: <span className="font-mono">{availability.request_id}</span></p>
            {availability.availability?.map((item) => (
              <Panel as="article" radius="control" key={item.id || item.localDateTimeStart} className="p-4">
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-medium text-aspectum-text">{item.localDateTimeStart || item.id}</p>
                    <p className="mt-1 text-sm text-aspectum-text-muted">{item.statusMessage || item.status || '—'}</p>
                  </div>
                  <StatusBadge tone={item.available ? 'success' : 'danger'} label={item.available ? 'Доступно' : 'Недоступно'} className="h-fit py-1" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <p className="text-aspectum-text-subtle">Мест: <b className="text-aspectum-text">{item.vacancies ?? '—'}</b></p>
                  <p className="text-aspectum-text-subtle">Цена: <b className="text-aspectum-text">{formatSupplierMoney(item.pricing?.retail, item.pricing?.currency, item.pricing?.currencyPrecision)}</b></p>
                </div>
              </Panel>
            ))}
            {availability.availability?.length === 0 && <p className="text-sm text-aspectum-text-muted">Поставщик не вернул вариантов на эту дату.</p>}
          </div>}
          {booking && <Alert tone="warning" className="mt-5 p-4 text-sm">
            <p className="font-semibold">Hold создан</p>
            <p className="mt-1">Статус: {booking.status} · до {booking.expires_at ? new Date(booking.expires_at).toLocaleString('ru-RU') : 'срок не передан поставщиком'}</p>
            <p className="mt-1">Сумма: {booking.total_price ?? '—'} {booking.currency}</p>
            <p className="mt-1 text-xs">Aspectum ID: <span className="font-mono">{booking.id}</span></p>
          </Alert>}
          <div className="mt-5 border-t border-aspectum-border pt-5">
            <div className="flex items-center justify-between gap-3">
              <Heading level={3} size="xs">Мои внешние бронирования</Heading>
              <Button type="button" variant="link" size="sm" onClick={loadHolds} disabled={!product || holdsLoading}>
                {holdsLoading ? 'Обновляем…' : 'Обновить'}
              </Button>
            </div>
            {!holdsLoading && holds.length === 0 && <p className="mt-2 text-sm text-aspectum-text-disabled">Для этого продукта пока нет сохранённых бронирований.</p>}
            <div className="mt-3 space-y-2">
              {holds.map((item) => (
                <Panel as="article" radius="control" key={item.id} className="p-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <p className="font-medium text-aspectum-text">{item.status}</p>
                    <p className="text-aspectum-text-strong">{item.total_price ?? '—'} {item.currency}</p>
                  </div>
                  <p className="mt-1 text-xs text-aspectum-text-muted">Создано: {new Date(item.created_at).toLocaleString('ru-RU')}</p>
                  {item.expires_at && <p className="text-xs text-aspectum-text-muted">Hold до: {new Date(item.expires_at).toLocaleString('ru-RU')}</p>}
                  {item.provider_booking_id && <p className="mt-1 text-xs text-aspectum-text-muted">Supplier ID: <span className="font-mono">{item.provider_booking_id}</span></p>}
                  <p className="mt-1 text-xs text-aspectum-text-disabled">Aspectum ID: <span className="font-mono">{item.id}</span></p>
                  <div className="mt-3 flex gap-3 text-xs">
                    <Button type="button" variant="link" size="sm" onClick={() => updateHold(item.id, 'refresh')} disabled={holdActionId === item.id}>
                      {holdActionId === item.id ? 'Обновляем…' : 'Обновить статус'}
                    </Button>
                    {item.status === 'on_hold' && (
                      <Button type="button" variant="linkDanger" size="sm" onClick={() => updateHold(item.id, 'cancel')} disabled={holdActionId === item.id}>
                        Отменить hold
                      </Button>
                    )}
                    {item.status === 'on_hold' && (
                      <Button type="button" variant="linkEmerald" size="sm" onClick={() => updateHold(item.id, 'test-pay')} disabled={holdActionId === item.id}>
                        Тестово оплатить и подтвердить
                      </Button>
                    )}
                  </div>
                  {item.status === 'confirmed' && <div className="mt-3 text-xs text-aspectum-success-strong">
                    <p>Оплата: {item.payment_status || 'succeeded'} · подтверждено: {item.confirmed_at ? new Date(item.confirmed_at).toLocaleString('ru-RU') : '—'}</p>
                    {item.fulfillment?.voucher_url && <a className="mt-1 inline-block underline" href={item.fulfillment.voucher_url} target="_blank" rel="noreferrer">Открыть ваучер</a>}
                    {item.fulfillment?.tickets?.map((ticket, index) => <a key={`${ticket.url}-${index}`} className="mt-1 ml-3 inline-block underline" href={ticket.url} target="_blank" rel="noreferrer">Билет {index + 1}</a>)}
                  </div>}
                  {item.status === 'confirmed' && item.refund_status !== 'succeeded' && (
                    <Button type="button" variant="linkDanger" size="sm" onClick={() => updateHold(item.id, 'refund')} disabled={holdActionId === item.id} className="mt-3">
                      Тестовый refund
                    </Button>
                  )}
                  {item.refund_status === 'succeeded' && <p className="mt-3 text-xs text-aspectum-success-strong">Refund выполнен: <span className="font-mono">{item.refund_id}</span></p>}
                </Panel>
              ))}
            </div>
          </div>
        </Panel>
      </div>
    </Layout>
  );
}
