import { useEffect, useMemo, useState } from 'react';
import { externalProductsAPI } from '../../../api/booking';
import { citiesAPI } from '../../../api/generation';
import Layout from '../../../components/Layout';
import { parseApiError } from '../../../utils/apiError';
import CatalogPageHeader from '../shared/components/CatalogPageHeader';
import { getMultiLangValue } from '../shared/i18n';
import { normalizeListResponse } from '../shared/normalize';

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none';

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
    } catch (err) {
      setError(parseApiError(err, 'Не удалось зарезервировать билеты у поставщика'));
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <Layout>
      <CatalogPageHeader
        title="Внешние продукты"
        description="Тестовый экран каталога, live availability и резервации у поставщика. Платёж и подтверждение брони пока не создаются."
      />

      {error && <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Город</label>
            <select value={cityId} onChange={(e) => setCityId(e.target.value)} className={inputClass} disabled={citiesLoading}>
              <option value="">{citiesLoading ? 'Загрузка…' : 'Выберите город'}</option>
              {cities.map((city) => <option key={city.id} value={city.id}>{label(city.name, city.id)}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Продукт поставщика</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputClass} disabled={!cityId || productsLoading || !products.length}>
              <option value="">{productsLoading ? 'Загрузка…' : products.length ? 'Выберите продукт' : 'Нет опубликованных продуктов'}</option>
              {products.map((item) => <option key={item.id} value={item.id}>{label(item.title, item.external_id)}</option>)}
            </select>
          </div>

          {product && <>
            <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600 space-y-1">
              <p><span className="font-medium">Поставщик:</span> {product.supplier_name || product.provider}</p>
              <p><span className="font-medium">External ID:</span> <span className="font-mono">{product.external_id}</span></p>
              {product.description && <p>{label(product.description, '')}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Option</label>
              <select value={optionId} onChange={(e) => setOptionId(e.target.value)} className={inputClass}>
                {product.options?.map((item) => <option key={item.id} value={item.id}>{label(item.title, item.external_id)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Дата</label>
              <input type="date" value={date} min={today()} onChange={(e) => setDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <p className="text-sm font-medium text-gray-700">Календарь доступности</p>
                {calendarLoading && <span className="text-xs text-gray-400">Загрузка…</span>}
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {calendar.map((day) => {
                  const selected = date === day.localDate;
                  return (
                    <button
                      type="button" key={day.localDate} disabled={!day.available}
                      onClick={() => setDate(day.localDate)}
                      className={`rounded-lg border px-2 py-2 text-left text-xs transition ${selected ? 'border-blue-600 bg-blue-50 text-blue-800' : day.available ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-400' : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'}`}
                    >
                      <span className="block font-medium">{day.localDate?.slice(8, 10)}.{day.localDate?.slice(5, 7)}</span>
                      <span className="block mt-0.5">{day.available ? `${day.vacancies ?? 0} мест` : 'Закрыто'}</span>
                    </button>
                  );
                })}
              </div>
              {!calendarLoading && calendar.length === 0 && <p className="text-xs text-gray-400">Нет данных на ближайший месяц.</p>}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Билеты</p>
              <div className="space-y-2">
                {option?.units?.map((unit) => (
                  <div key={unit.id} className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{label(unit.title, unit.external_id)}</p>
                      <p className="text-xs text-gray-400">{unit.unit_type || unit.external_id}</p>
                    </div>
                    <input
                      type="number" min="0" max="100" value={quantities[unit.id] || 0}
                      onChange={(e) => setQuantities((current) => ({ ...current, [unit.id]: e.target.value }))}
                      className="w-20 px-2 py-1.5 border border-gray-300 rounded text-sm text-right"
                      aria-label={`Количество ${label(unit.title, unit.external_id)}`}
                    />
                  </div>
                ))}
              </div>
            </div>
            <button type="button" onClick={checkAvailability} disabled={checking || !option} className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {checking ? 'Проверяем…' : 'Проверить доступность'}
            </button>
            <div className="border-t border-gray-200 pt-4 space-y-3">
              <p className="text-sm font-medium text-gray-700">Тестовая резервация</p>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} placeholder="Имя гостя" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="E-mail гостя" />
              <button type="button" onClick={reserveHold} disabled={bookingLoading || !availability} className="w-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">
                {bookingLoading ? 'Резервируем…' : 'Создать hold на 10 минут'}
              </button>
              <p className="text-xs text-gray-500">Повторная проверка цены и мест выполняется на сервере перед запросом в Ventrata. Деньги не списываются.</p>
            </div>
          </>}
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-base font-semibold text-gray-900">Результат availability</h2>
          {!availability && <p className="mt-3 text-sm text-gray-400">Выберите продукт и нажмите «Проверить доступность».</p>}
          {availability && <div className="mt-4 space-y-3">
            <p className="text-xs text-gray-400">Provider: {availability.provider} · Request ID: <span className="font-mono">{availability.request_id}</span></p>
            {availability.availability?.map((item) => (
              <article key={item.id || item.localDateTimeStart} className="rounded-lg border border-gray-200 p-4">
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900">{item.localDateTimeStart || item.id}</p>
                    <p className="mt-1 text-sm text-gray-500">{item.statusMessage || item.status || '—'}</p>
                  </div>
                  <span className={`h-fit rounded-full px-2 py-1 text-xs font-medium ${item.available ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {item.available ? 'Доступно' : 'Недоступно'}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <p className="text-gray-600">Мест: <b className="text-gray-900">{item.vacancies ?? '—'}</b></p>
                  <p className="text-gray-600">Цена: <b className="text-gray-900">{formatSupplierMoney(item.pricing?.retail, item.pricing?.currency, item.pricing?.currencyPrecision)}</b></p>
                </div>
              </article>
            ))}
            {availability.availability?.length === 0 && <p className="text-sm text-gray-500">Поставщик не вернул вариантов на эту дату.</p>}
          </div>}
          {booking && <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Hold создан</p>
            <p className="mt-1">Статус: {booking.status} · до {booking.expires_at ? new Date(booking.expires_at).toLocaleString('ru-RU') : 'срок не передан поставщиком'}</p>
            <p className="mt-1">Сумма: {booking.total_price ?? '—'} {booking.currency}</p>
            <p className="mt-1 text-xs">Aspectum ID: <span className="font-mono">{booking.id}</span></p>
          </div>}
        </section>
      </div>
    </Layout>
  );
}
