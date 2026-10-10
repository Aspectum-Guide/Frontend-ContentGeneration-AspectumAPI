import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { citiesAPI, eventsAPI } from '../../../api/generation';
import Layout from '../../../components/Layout';
import { parseApiError } from '../../../utils/apiError';
import { useCatalogFilters } from '../core/useCatalogFilters';
import CatalogPageHeader from '../shared/components/CatalogPageHeader';
import { getMultiLangValue } from '../shared/i18n';
import { normalizeListResponse } from '../shared/normalize';

const PAGE_SIZE = 20;

const TABS = [
  { id: 'unlinked', label: 'Без события', hint: 'Новые продукты: события в каталоге у них ещё нет' },
  { id: 'supplier', label: 'Событие от поставщика', hint: 'Событие создано из продукта, текст приходит от поставщика' },
  { id: 'editorial', label: 'Слиты с вашими событиями', hint: 'Текст ваш, цены и билеты от поставщика' },
  { id: 'all', label: 'Все', hint: '' },
];

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none';

function label(value, fallback = '—') {
  return getMultiLangValue(value) || fallback;
}

function Badge({ tone, children }) {
  const tones = {
    green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    sky: 'bg-sky-100 text-sky-700',
    gray: 'bg-gray-100 text-gray-600',
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone] || tones.gray}`}>{children}</span>;
}

function MergePanel({ product, onMerged, onError }) {
  const { search, setSearch, debouncedSearch } = useCatalogFilters({ debounceMs: 300 });
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    eventsAPI
      .listEventCandidatesForExternalProduct(product.id, { search: debouncedSearch.trim() || undefined, page_size: 10 })
      .then((r) => active && setEvents(r?.data?.events || []))
      .catch((err) => {
        if (!active) return;
        setEvents([]);
        onError(parseApiError(err, 'Не удалось загрузить события'));
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [product.id, debouncedSearch, onError]);

  const merge = async (event) => {
    const moves = product.event_id_replaced;
    const text = moves
      ? `Слить с «${label(event.title)}»? Текущее событие продукта («${label(product.linked_event_title)}») будет скрыто.`
      : `Слить с «${label(event.title)}»? Текст события останется вашим, цены и билеты придут от поставщика.`;
    if (!window.confirm(text)) return;
    setBusyId(event.id);
    try {
      await eventsAPI.setExternalProduct(event.id, product.id);
      onMerged();
    } catch (err) {
      onError(parseApiError(err, 'Не удалось слить с событием'));
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/40 p-3">
      <p className="text-xs text-gray-600 mb-2">
        Выберите ваше существующее событие — оно получит бронирование от поставщика. Сверху события из города продукта,
        похожие по названию. Не нашли? Введите название.
      </p>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={inputClass}
        placeholder="Поиск события по названию (все города)…"
      />
      <div className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white">
        {loading && <p className="p-2 text-xs text-gray-400">Загрузка…</p>}
        {!loading && events.length === 0 && (
          <p className="p-2 text-xs text-gray-400">Подходящих событий нет. Можно создать новое из продукта.</p>
        )}
        {!loading &&
          events.map((event) => (
            <div key={event.id} className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2 last:border-0">
              <div className="min-w-0">
                <p className="truncate text-sm text-gray-900">{label(event.title, event.id)}</p>
                <p className="flex items-center gap-1.5 text-xs text-gray-400">
                  {event.city_display_name || 'без города'}
                  {event.suggested && <Badge tone="green">похоже</Badge>}
                  {!event.is_show && <Badge tone="gray">скрыто</Badge>}
                </p>
              </div>
              <button
                type="button"
                disabled={Boolean(busyId)}
                onClick={() => merge(event)}
                className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busyId === event.id ? 'Сливаем…' : 'Слить'}
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}

function ProductCard({ product, mergeOpen, onToggleMerge, onCreate, creating, onMerged, onError }) {
  const linked = Boolean(product.linked_event_id);
  const supplierOwned = linked && product.sync_event_content;
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 truncate">{label(product.title, product.external_id)}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
            <span>{product.city_display_name || 'город не указан'}</span>
            <span>·</span>
            <span>{product.connection_name}</span>
            <Badge tone={product.is_enabled ? 'green' : 'amber'}>
              {product.is_enabled ? 'продажи включены' : 'продажи выключены'}
            </Badge>
            {!linked && <Badge tone="gray">нет события</Badge>}
            {supplierOwned && <Badge tone="sky">событие от поставщика</Badge>}
            {linked && !supplierOwned && <Badge tone="green">слит с вашим событием</Badge>}
          </p>
          {linked && (
            <p className="mt-1 text-xs text-gray-500">
              Событие: «{label(product.linked_event_title, product.linked_event_id)}»
            </p>
          )}
        </div>

        <div className="flex shrink-0 gap-2">
          {!linked && (
            <button
              type="button"
              disabled={creating}
              onClick={() => onCreate(product)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {creating ? 'Создаём…' : 'Создать событие'}
            </button>
          )}
          {(!linked || supplierOwned) && (
            <button
              type="button"
              onClick={onToggleMerge}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              {mergeOpen ? 'Закрыть' : 'Слить с существующим…'}
            </button>
          )}
        </div>
      </div>

      {linked && !supplierOwned && (
        <p className="mt-2 text-xs text-gray-400">
          Чтобы отвязать или вернуть текст поставщику, откройте это событие в каталоге событий → вкладка «Мета» → «Бронирование у поставщика».
        </p>
      )}
      {mergeOpen && (
        <MergePanel
          product={{ ...product, event_id_replaced: supplierOwned }}
          onMerged={onMerged}
          onError={onError}
        />
      )}
    </article>
  );
}

export default function ExternalProductsLinkingPage() {
  const [tab, setTab] = useState('unlinked');
  const [cities, setCities] = useState([]);
  const [cityId, setCityId] = useState('');
  const { search, setSearch, debouncedSearch } = useCatalogFilters({ debounceMs: 300 });
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ external_products: [], total: 0, total_pages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [mergeOpenId, setMergeOpenId] = useState('');
  const [creatingId, setCreatingId] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const onError = useCallback((message) => setError(message), []);
  const reload = useCallback(() => setReloadKey((n) => n + 1), []);

  useEffect(() => {
    citiesAPI
      .list({ page_size: 1000, limit: 1000 })
      .then((response) => setCities(normalizeListResponse(response?.data, ['results', 'data'])))
      .catch(() => setCities([]));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [tab, cityId, debouncedSearch]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    eventsAPI
      .listExternalProducts({
        link_state: tab,
        page,
        page_size: PAGE_SIZE,
        city_id: cityId || undefined,
        search: debouncedSearch.trim() || undefined,
      })
      .then((r) => active && setData(r?.data || { external_products: [], total: 0, total_pages: 0 }))
      .catch((err) => active && setError(parseApiError(err, 'Не удалось загрузить продукты')))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [tab, page, cityId, debouncedSearch, reloadKey]);

  const createEvent = async (product) => {
    setCreatingId(product.id);
    setError(null);
    setNotice(null);
    try {
      const r = await eventsAPI.createEventFromExternalProduct(product.id);
      const warnings = r?.data?.warnings || [];
      setNotice(
        `Событие создано из «${label(product.title)}». ${warnings.join(' ')} Дальше: откройте его в каталоге событий, добавьте фото, аудиогид и переводы, затем «Забрать текст себе».`,
      );
      reload();
    } catch (err) {
      setError(parseApiError(err, 'Не удалось создать событие'));
    } finally {
      setCreatingId('');
    }
  };

  const onMerged = () => {
    setMergeOpenId('');
    setNotice('Готово: продукт слит с событием. Цены и билеты поставщика теперь подключены к нему, текст события остался вашим.');
    reload();
  };

  const activeTab = TABS.find((item) => item.id === tab);

  return (
    <Layout>
      <CatalogPageHeader
        title="Внешние продукты → Привязка к событиям"
        description="Продукты поставщика (Ventrata) приходят сюда сами. Здесь вы решаете, какому событию каталога они принадлежат."
      />

      <section className="mb-5 rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-sm text-gray-700">
        <p className="font-semibold text-gray-900">Как это работает — что куда нажимать</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            Синхронизация поставщика приносит продукты на вкладку <b>«Без события»</b>. В каталог приложения они сами
            не попадают — ничего лишнего пользователи не увидят.
          </li>
          <li>
            Для каждого продукта выберите одно:
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>
                <b>«Слить с существующим…»</b> — если такое событие у вас уже есть (с фото, аудиогидом, переводами).
                Текст остаётся вашим, цены, билеты и доступность подключатся от поставщика.
              </li>
              <li>
                <b>«Создать событие»</b> — если такого события нет. Создастся новое с текстом поставщика; потом
                доработайте его в каталоге событий.
              </li>
            </ul>
          </li>
          <li>
            Продажи включаются в Django-админке (Внешние продукты → «Включено»). Пока не включено, событие скрыто или
            без кнопки бронирования.
          </li>
        </ol>
        <p className="mt-2 text-xs text-gray-500">
          Отвязать продукт или вернуть текст поставщику: каталог событий → нужное событие → вкладка «Мета».{' '}
          <Link to="/catalog/external-products" className="text-blue-700 underline">
            Тест брони и availability
          </Link>
        </p>
      </section>

      {error && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-red-500">×</button>
        </div>
      )}
      {notice && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-emerald-600">×</button>
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setTab(item.id);
              setMergeOpenId('');
            }}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              tab === item.id ? 'bg-blue-600 text-white' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {activeTab?.hint && <p className="mb-3 text-xs text-gray-500">{activeTab.hint}</p>}

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={inputClass}
          placeholder="Поиск по названию, ID поставщика…"
        />
        <select value={cityId} onChange={(e) => setCityId(e.target.value)} className={inputClass}>
          <option value="">Все города</option>
          {cities.map((city) => (
            <option key={city.id} value={city.id}>{label(city.name, city.id)}</option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {loading && <p className="text-sm text-gray-400">Загрузка…</p>}
        {!loading && data.external_products.length === 0 && (
          <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
            {tab === 'unlinked' ? 'Все продукты привязаны к событиям.' : 'Продуктов не найдено.'}
          </p>
        )}
        {data.external_products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            mergeOpen={mergeOpenId === product.id}
            onToggleMerge={() => setMergeOpenId((current) => (current === product.id ? '' : product.id))}
            onCreate={createEvent}
            creating={creatingId === product.id}
            onMerged={onMerged}
            onError={onError}
          />
        ))}
      </div>

      {data.total_pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((n) => n - 1)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 disabled:opacity-50"
          >
            ← Назад
          </button>
          <span>Страница {page} из {data.total_pages} · всего {data.total}</span>
          <button
            type="button"
            disabled={page >= data.total_pages}
            onClick={() => setPage((n) => n + 1)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 disabled:opacity-50"
          >
            Вперёд →
          </button>
        </div>
      )}
    </Layout>
  );
}
