import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { citiesAPI, eventsAPI } from '../../../api/generation';
import Layout from '../../../components/Layout';
import { Alert, Button, ConfirmModal, EmptyState, Heading, IconButton, InlineState, PageHeader, Panel, Select, StatusBadge, Tabs, TextInput } from '@aspectum/admin-ui-web';
import { parseApiError } from '../../../utils/apiError';
import { useCatalogFilters } from '../core/useCatalogFilters';
import { getMultiLangValue } from '../shared/i18n';
import { normalizeListResponse } from '../shared/normalize';

const PAGE_SIZE = 20;

const TABS = [
  { id: 'unlinked', label: 'Без события', hint: 'Новые продукты: события в каталоге у них ещё нет' },
  { id: 'supplier', label: 'Событие от поставщика', hint: 'Событие создано из продукта, текст приходит от поставщика' },
  { id: 'editorial', label: 'Слиты с вашими событиями', hint: 'Текст ваш, цены и билеты от поставщика' },
  { id: 'all', label: 'Все', hint: '' },
];

function label(value, fallback = '—') {
  return getMultiLangValue(value) || fallback;
}

function Badge({ tone, children }) {
  const tones = { green: 'success', amber: 'warning', info: 'info', gray: 'neutral' };
  return <StatusBadge tone={tones[tone] || 'neutral'}>{children}</StatusBadge>;
}

function MergePanel({ product, onMerged, onError }) {
  const { search, setSearch, debouncedSearch } = useCatalogFilters({ debounceMs: 300 });
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [mergeTarget, setMergeTarget] = useState(null);

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

  const merge = async () => {
    if (!mergeTarget) return;
    const event = mergeTarget;
    setBusyId(event.id);
    try {
      await eventsAPI.setExternalProduct(event.id, product.id);
      setMergeTarget(null);
      onMerged();
    } catch (err) {
      throw new Error(parseApiError(err, 'Не удалось слить с событием'));
    } finally {
      setBusyId('');
    }
  };

  return (
    <Panel tone="info" className="mt-3 p-3">
      <p className="text-xs text-aspectum-text-subtle mb-2">
        Выберите ваше существующее событие — оно получит бронирование от поставщика. Сверху события, похожие по названию и
        месту (адрес поставщика). Не нашли? Введите название.
      </p>
      <TextInput
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Поиск события по названию (все города)…"
      />
      <div className="mt-2 max-h-60 overflow-y-auto rounded-aspectum-control border border-aspectum-border bg-aspectum-surface">
        {loading && <InlineState loading size="xs" tone="disabled" className="p-2">Загрузка…</InlineState>}
        {!loading && events.length === 0 && (
          <EmptyState
            title="Подходящих событий нет"
            description="Можно создать новое событие из продукта."
            className="py-4"
          />
        )}
        {!loading &&
          events.map((event) => (
            <div key={event.id} className="flex items-center justify-between gap-2 border-b border-aspectum-border-subtle px-3 py-2 last:border-0">
              <div className="min-w-0">
                <p className="truncate text-sm text-aspectum-text">{label(event.title, event.id)}</p>
                <p className="flex items-center gap-1.5 text-xs text-aspectum-text-disabled">
                  {event.city_display_name || 'без города'}
                  {event.suggested && <Badge tone="green">похоже</Badge>}
                  {!event.is_show && <Badge tone="gray">скрыто</Badge>}
                </p>
              </div>
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="shrink-0"
                disabled={Boolean(busyId)}
                onClick={() => setMergeTarget(event)}
              >
                {busyId === event.id ? 'Сливаем…' : 'Слить'}
              </Button>
            </div>
          ))}
      </div>
      <ConfirmModal
        open={!!mergeTarget}
        onClose={() => setMergeTarget(null)}
        onConfirm={merge}
        title="Слить с событием?"
        message={mergeTarget && (product.event_id_replaced
          ? `Слить с «${label(mergeTarget.title)}»? Текущее событие продукта («${label(product.linked_event_title)}») будет скрыто.`
          : `Слить с «${label(mergeTarget.title)}»? Текст события останется вашим, цены и билеты придут от поставщика.`)}
        confirmLabel="Слить"
        loading={Boolean(busyId)}
      />
    </Panel>
  );
}

function CreatePanel({ product, cities, creating, onCreate, onCancel }) {
  const [cityId, setCityId] = useState(product.suggested_city_id || '');
  return (
    <Panel tone="muted" className="mt-3 p-3">
      <p className="mb-2 text-xs text-aspectum-text-subtle">
        Поставщик — не город: выберите город Aspectum, где находится это место
        {product.location_text ? <> (адрес поставщика: <b>{product.location_text}</b>)</> : null}.
        {product.suggested_city_id ? ' Город подобран по адресу — проверьте.' : ' По адресу город определить не удалось.'}
        {' '}Без города событие будет скрыто.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={cityId} onChange={(e) => setCityId(e.target.value)} className="sm:max-w-xs">
          <option value="">— город не выбран —</option>
          {cities.map((city) => (
            <option key={city.id} value={city.id}>{label(city.name, city.id)}</option>
          ))}
        </Select>
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={creating}
          onClick={() => onCreate(product, cityId)}
        >
          {creating ? 'Создаём…' : 'Создать событие'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Отмена</Button>
      </div>
    </Panel>
  );
}

function ProductCard({ product, cities, mergeOpen, onToggleMerge, createOpen, onToggleCreate, onCreate, creating, onMerged, onError }) {
  const linked = Boolean(product.linked_event_id);
  const supplierOwned = linked && product.sync_event_content;
  return (
    <Panel as="article" className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Heading level={3} size="xs" className="truncate">{label(product.title, product.external_id)}</Heading>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-aspectum-text-muted">
            <span>{product.location_text || product.city_display_name || 'место не указано'}</span>
            <span>·</span>
            <span>{product.connection_name}</span>
            <Badge tone={product.is_enabled ? 'green' : 'amber'}>
              {product.is_enabled ? 'продажи включены' : 'продажи выключены'}
            </Badge>
            {!linked && <Badge tone="gray">нет события</Badge>}
            {supplierOwned && <Badge tone="info">событие от поставщика</Badge>}
            {linked && !supplierOwned && <Badge tone="green">слит с вашим событием</Badge>}
          </p>
          {linked && (
            <p className="mt-1 text-xs text-aspectum-text-muted">
              Событие: «{label(product.linked_event_title, product.linked_event_id)}»
            </p>
          )}
        </div>

        <div className="flex shrink-0 gap-2">
          {!linked && (
            <Button type="button" variant="outline" size="sm" onClick={onToggleCreate}>
              {createOpen ? 'Закрыть' : 'Создать событие…'}
            </Button>
          )}
          {(!linked || supplierOwned) && (
            <Button type="button" variant="primary" size="sm" onClick={onToggleMerge}>
              {mergeOpen ? 'Закрыть' : 'Слить с существующим…'}
            </Button>
          )}
        </div>
      </div>

      {linked && !supplierOwned && (
        <p className="mt-2 text-xs text-aspectum-text-disabled">
          Чтобы отвязать или вернуть текст поставщику, откройте это событие в каталоге событий → вкладка «Мета» → «Бронирование у поставщика».
        </p>
      )}
      {createOpen && !linked && (
        <CreatePanel product={product} cities={cities} creating={creating} onCreate={onCreate} onCancel={onToggleCreate} />
      )}
      {mergeOpen && (
        <MergePanel
          product={{ ...product, event_id_replaced: supplierOwned }}
          onMerged={onMerged}
          onError={onError}
        />
      )}
    </Panel>
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
  const [createOpenId, setCreateOpenId] = useState('');
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

  const createEvent = async (product, newCityId) => {
    setCreatingId(product.id);
    setError(null);
    setNotice(null);
    try {
      const r = await eventsAPI.createEventFromExternalProduct(product.id, { cityId: newCityId });
      const warnings = r?.data?.warnings || [];
      setNotice(
        `Событие создано из «${label(product.title)}». ${warnings.join(' ')} Дальше: откройте его в каталоге событий, добавьте фото, аудиогид и переводы, затем «Забрать текст себе».`,
      );
      setCreateOpenId('');
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
      <PageHeader
        title="Внешние продукты → Привязка к событиям"
        description="Продукты поставщика (Ventrata) приходят сюда сами. Здесь вы решаете, какому событию каталога они принадлежат."
      />

      <Panel tone="info" className="mb-5 p-4 text-sm text-aspectum-text-strong">
        <p className="font-semibold text-aspectum-text">Как это работает — что куда нажимать</p>
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
                <b>«Создать событие…»</b> — если такого события нет. Выберите город (он подставляется по адресу поставщика) — создастся новое событие с текстом поставщика; потом
                доработайте его в каталоге событий.
              </li>
            </ul>
          </li>
          <li>
            Продажи включаются в Django-админке (Внешние продукты → «Включено»). Пока не включено, событие скрыто или
            без кнопки бронирования.
          </li>
        </ol>
        <p className="mt-2 text-xs text-aspectum-text-muted">
          Отвязать продукт или вернуть текст поставщику: каталог событий → нужное событие → вкладка «Мета».{' '}
          <Link to="/catalog/external-products" className="text-aspectum-primary-hover underline">
            Тест брони и availability
          </Link>
        </p>
      </Panel>

      {error && (
        <Alert tone="error" className="mb-4 flex items-start justify-between gap-3">
          <span>{error}</span>
          <IconButton label="Закрыть ошибку" onClick={() => setError(null)} variant="ghostDanger">×</IconButton>
        </Alert>
      )}
      {notice && (
        <Alert tone="success" className="mb-4 flex items-start justify-between gap-3">
          <span>{notice}</span>
          <IconButton label="Закрыть уведомление" onClick={() => setNotice(null)} variant="ghostSuccess">×</IconButton>
        </Alert>
      )}

      <Tabs
        items={TABS}
        value={tab}
        onChange={(nextTab) => {
          setTab(nextTab);
          setMergeOpenId('');
        }}
        className="mb-3"
      />
      {activeTab?.hint && <p className="mb-3 text-xs text-aspectum-text-muted">{activeTab.hint}</p>}

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <TextInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по названию, адресу, ID поставщика…"
        />
        <Select value={cityId} onChange={(e) => setCityId(e.target.value)}>
          <option value="">Все города (назначенные в Aspectum)</option>
          {cities.map((city) => (
            <option key={city.id} value={city.id}>{label(city.name, city.id)}</option>
          ))}
        </Select>
      </div>

      <div className="space-y-3">
        {loading && <EmptyState icon={null} title="Загрузка…" spacing="sm" />}
        {!loading && data.external_products.length === 0 && (
          <EmptyState
            icon={null}
            title={tab === 'unlinked' ? 'Все продукты привязаны к событиям.' : 'Продуктов не найдено.'}
            spacing="md"
            className="rounded-aspectum-control border border-dashed border-aspectum-border-strong"
          />
        )}
        {data.external_products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            cities={cities}
            createOpen={createOpenId === product.id}
            onToggleCreate={() => setCreateOpenId((current) => (current === product.id ? '' : product.id))}
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
        <div className="mt-4 flex items-center justify-between text-sm text-aspectum-text-subtle">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((n) => n - 1)}
          >
            ← Назад
          </Button>
          <span>Страница {page} из {data.total_pages} · всего {data.total}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= data.total_pages}
            onClick={() => setPage((n) => n + 1)}
          >
            Вперёд →
          </Button>
        </div>
      )}
    </Layout>
  );
}
