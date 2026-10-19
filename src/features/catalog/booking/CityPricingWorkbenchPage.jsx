import { useCallback, useEffect, useMemo, useState } from 'react';
import { eventSlotAvailabilitiesAPI, eventTicketTypePricesAPI, ticketTypesAPI } from '../../../api/booking';
import { citiesCatalogAPI } from '../cities/api';
import Layout from '../../../components/Layout';
import { FormLabel, Alert, BulkActionModal, Button, Checkbox, DataTableSurface, EmptyState, InlineState, PageHeader, Select, TextInput, formGridClassName } from '@aspectum/admin-ui-web';
import { parseApiError } from '../../../utils/apiError';
import { loadReferenceEventsForCity } from '../shared/bookingOptions';
import TicketTypeSelect from '../shared/components/TicketTypeSelect';
import { CURRENCIES, DEFAULT_CURRENCY, normalizeCurrency } from '../shared/currencies';
import { getCityLabel } from '../shared/labels';
import { normalizeListResponse } from '../shared/normalize';
import { getPriceRowStatus, priceStatusClass } from './bookingSetupPricingHelpers';
import { buildCityPriceRows, collectCityBulkEntries, groupSlotsByEvent } from './cityPricingHelpers';

const RU_MODE_STORAGE_KEY = 'aspectum.cityPricing.ruMode';

function loadRuMode() {
  try {
    return window.localStorage.getItem(RU_MODE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function saveRuMode(value) {
  try {
    window.localStorage.setItem(RU_MODE_STORAGE_KEY, value ? '1' : '0');
  } catch {
    // ignore — non-critical UI preference
  }
}

export default function CityPricingWorkbenchPage() {
  const [cities, setCities] = useState([]);
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [cityId, setCityId] = useState('');
  const [ruMode, setRuMode] = useState(loadRuMode);

  const [events, setEvents] = useState([]);
  const [ticketTypes, setTicketTypes] = useState([]);
  const [basePrices, setBasePrices] = useState([]);
  const [slots, setSlots] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const [ticketTypeFilter, setTicketTypeFilter] = useState('');
  const [draftByKey, setDraftByKey] = useState(new Map());
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [savingAll, setSavingAll] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveNotice, setSaveNotice] = useState(null);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);

  useEffect(() => {
    saveRuMode(ruMode);
  }, [ruMode]);

  useEffect(() => {
    (async () => {
      setCitiesLoading(true);
      try {
        const r = await citiesCatalogAPI.list({});
        setCities(normalizeListResponse(r?.data, ['data', 'results']));
      } catch {
        setCities([]);
      } finally {
        setCitiesLoading(false);
      }
    })();
  }, []);

  const loadCityData = useCallback(async () => {
    if (!cityId) {
      setEvents([]); setTicketTypes([]); setBasePrices([]); setSlots([]);
      return;
    }
    setDataLoading(true);
    setLoadError(null);
    try {
      const [eventsList, ttRes, pricesRes, slotsRes] = await Promise.all([
        loadReferenceEventsForCity(cityId),
        ticketTypesAPI.list({ city: cityId, is_active: 'true' }),
        eventTicketTypePricesAPI.list({ city: cityId }),
        eventSlotAvailabilitiesAPI.list({ city: cityId }),
      ]);
      setEvents(eventsList);
      setTicketTypes(normalizeListResponse(ttRes?.data, ['results', 'data']));
      setBasePrices(normalizeListResponse(pricesRes?.data, ['results', 'data']));
      setSlots(normalizeListResponse(slotsRes?.data, ['results', 'data']));
      setDraftByKey(new Map());
      setSelectedKeys(new Set());
    } catch (err) {
      setLoadError(parseApiError(err, 'Не удалось загрузить данные по городу'));
    } finally {
      setDataLoading(false);
    }
  }, [cityId]);

  useEffect(() => { loadCityData(); }, [loadCityData]);

  const allRows = useMemo(() => buildCityPriceRows({
    events,
    ticketTypes,
    basePrices,
    slotsByEvent: groupSlotsByEvent(slots),
  }), [events, ticketTypes, basePrices, slots]);

  const rows = useMemo(() => {
    if (!ticketTypeFilter) return allRows;
    return allRows.filter((r) => r.ticketTypeId === String(ticketTypeFilter));
  }, [allRows, ticketTypeFilter]);

  const setDraft = (key, patch) => {
    setDraftByKey((prev) => {
      const next = new Map(prev);
      next.set(key, { ...(next.get(key) || {}), ...patch });
      return next;
    });
  };

  const toggleSelect = (key) => setSelectedKeys((prev) => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const toggleSelectAll = () => setSelectedKeys((prev) =>
    prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.key)),
  );

  const handleSaveAll = async () => {
    if (draftByKey.size === 0) return;
    setSavingAll(true);
    setSaveError(null);
    setSaveNotice(null);
    const { entries, skipped } = collectCityBulkEntries(
      rows,
      draftByKey,
      ruMode ? 'RUB' : DEFAULT_CURRENCY,
    );
    if (!entries.length) {
      setSaveError('Нет корректных цен для сохранения (проверьте значения)');
      setSavingAll(false);
      return;
    }
    try {
      const { data } = await eventTicketTypePricesAPI.bulkUpsert({ entries });
      setSaveNotice(
        `Создано: ${data?.created_count ?? 0}, обновлено: ${data?.updated_count ?? 0}`
        + (skipped.length ? `, пропущено (некорректная цена): ${skipped.length}` : ''),
      );
      setDraftByKey(new Map());
      await loadCityData();
    } catch (err) {
      setSaveError(parseApiError(err, 'Ошибка массового сохранения'));
    } finally {
      setSavingAll(false);
    }
  };

  const handleBulkApply = async ({ price, currency }) => {
    const draft = { price, currency: ruMode ? 'RUB' : currency };
    const entriesByKey = new Map([...selectedKeys].map((key) => [key, draft]));
    const { entries } = collectCityBulkEntries(rows, entriesByKey, ruMode ? 'RUB' : DEFAULT_CURRENCY);
    if (!entries.length) {
      throw new Error('Укажите корректную цену');
    }
    const { data } = await eventTicketTypePricesAPI.bulkUpsert({ entries });
    setSelectedKeys(new Set());
    await loadCityData();
    return data;
  };

  const dirtyCount = draftByKey.size;

  return (
    <Layout>
      <PageHeader
        title="Массовые цены по городу"
        description="Базовые цены (событие + тип билета) для всех событий выбранного города. Слоты и правила цен по-прежнему редактируются в мастере настройки конкретного события."
      />

      <div className="flex flex-wrap items-end gap-4 mb-4">
        <div className="w-64">
          <FormLabel  layout="block" size="xs" tone="muted" spacing="xs">Город</FormLabel>
          <Select
            value={cityId}
            onChange={(e) => setCityId(e.target.value)}
            disabled={citiesLoading}
          >
            <option value="">{citiesLoading ? 'Загрузка…' : 'Выберите город'}</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>{getCityLabel(c)}</option>
            ))}
          </Select>
        </div>

        <div className="w-64">
          <FormLabel  layout="block" size="xs" tone="muted" spacing="xs">Тип билета (фильтр)</FormLabel>
          <TicketTypeSelect
            value={ticketTypeFilter}
            onChange={setTicketTypeFilter}
            options={ticketTypes}
            disabled={!cityId || dataLoading}
            placeholder="Все типы"
          />
        </div>

        <FormLabel  layout="row" size="sm" interactive className="px-3 py-2 bg-aspectum-surface border border-aspectum-border-strong rounded-aspectum-control">
          <Checkbox
            checked={ruMode}
            onChange={(e) => setRuMode(e.target.checked)}
            className="rounded border-aspectum-border-strong text-aspectum-primary focus:ring-aspectum-focus"
          />
          RU-контур (только RUB)
        </FormLabel>

        {selectedKeys.size > 0 && (
          <Button type="button" variant="primary" size="md" onClick={() => setBulkModalOpen(true)}>
            Применить к выбранным ({selectedKeys.size})
          </Button>
        )}

        {dirtyCount > 0 && (
          <Button type="button" variant="emerald" size="md" onClick={handleSaveAll} disabled={savingAll}>
            {savingAll ? 'Сохранение…' : `Сохранить изменённые (${dirtyCount})`}
          </Button>
        )}
      </div>

      {saveError && <Alert tone="error" className="mb-4">{saveError}</Alert>}
      {saveNotice && <Alert tone="success" className="mb-4">{saveNotice}</Alert>}
      {loadError && <Alert tone="error" className="mb-4">{loadError}</Alert>}

      {!cityId ? (
        <EmptyState
          icon="🏙️"
          title="Выберите город"
          description="После выбора здесь появятся цены по его событиям."
          className="py-8"
        />
      ) : (
        <DataTableSurface className="rounded-aspectum-card">
          <table className="w-full text-sm">
            <thead className="bg-aspectum-surface-muted text-xs text-aspectum-text-muted uppercase">
              <tr>
                <th className="px-3 py-2 text-center w-8">
                  <Checkbox
                    checked={rows.length > 0 && selectedKeys.size === rows.length}
                    onChange={toggleSelectAll}
                    className="rounded border-aspectum-border-strong text-aspectum-primary focus:ring-aspectum-focus"
                  />
                </th>
                <th className="px-3 py-2 text-left">Событие</th>
                <th className="px-3 py-2 text-left">Тип билета</th>
                <th className="px-3 py-2 text-left">Текущая цена</th>
                <th className="px-3 py-2 text-right">Новая цена</th>
                <th className="px-3 py-2 text-left">Валюта</th>
                <th className="px-3 py-2 text-center">Слоты</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-aspectum-border-subtle">
              {dataLoading ? (
                <tr><InlineState as="td" colSpan={7} loading align="center" tone="disabled" className="px-3 py-6">Загрузка…</InlineState></tr>
              ) : rows.length === 0 ? (
                <tr><InlineState as="td" colSpan={7} align="center" tone="disabled" className="px-3 py-6">Нет событий с ценами для этого города</InlineState></tr>
              ) : rows.map((row) => {
                const draft = draftByKey.get(row.key) || {};
                const isDirty = draft.price !== undefined && draft.price !== '';
                const rowStatus = getPriceRowStatus({
                  row: { price: draft.price },
                  savedBase: row.savedBase,
                  isDirty,
                });
                const rowCurrency = draft.currency
                  || row.savedBase?.currency
                  || (ruMode ? 'RUB' : DEFAULT_CURRENCY);
                const currencyWarning = ruMode && row.savedBase && normalizeCurrency(row.savedBase.currency) !== 'RUB';
                return (
                  <tr key={row.key} className={selectedKeys.has(row.key) ? 'bg-aspectum-primary-soft' : 'hover:bg-aspectum-surface-muted'}>
                    <td className="px-3 py-2 text-center">
                      <Checkbox
                        checked={selectedKeys.has(row.key)}
                        onChange={() => toggleSelect(row.key)}
                        className="rounded border-aspectum-border-strong text-aspectum-primary focus:ring-aspectum-focus"
                      />
                    </td>
                    <td className="px-3 py-2 text-aspectum-text-strong">{row.eventLabel}</td>
                    <td className="px-3 py-2 text-aspectum-text-strong">{row.ticketTypeLabel}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs ${priceStatusClass(rowStatus.kind)}`}>
                        {rowStatus.label}
                      </span>
                      {currencyWarning && (
                        <span className="ml-2 text-xs text-aspectum-warning">не RUB — не виден в RU-приложении</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <TextInput className="w-24 text-right" type="number" step="0.01" min={0} value={draft.price ?? ''} onChange={(e) => setDraft(row.key, { price: e.target.value })} placeholder={row.savedBase ? String(row.savedBase.base_price) : '—'} />
                    </td>
                    <td className="px-3 py-2">
                      {ruMode ? (
                        <span className="text-xs text-aspectum-text-muted">RUB</span>
                      ) : (
                        <Select className="w-20" value={rowCurrency} onChange={(e) => setDraft(row.key, { currency: e.target.value })}>
                          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </Select>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center text-xs text-aspectum-text-muted">
                      {row.slotsSummary.total === 0
                        ? <span className="text-aspectum-warning">нет слотов</span>
                        : `${row.slotsSummary.active}/${row.slotsSummary.total} открыт`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DataTableSurface>
      )}

      <BulkActionModal
        open={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        title={`Применить цену к выбранным (${selectedKeys.size})`}
        initialValues={{ price: '', currency: ruMode ? 'RUB' : DEFAULT_CURRENCY }}
        submitLabel="Применить"
        onSubmit={handleBulkApply}
        renderFields={({ values, setValues, error }) => (
          <div className="space-y-3">
            {error && <div className="text-sm text-aspectum-danger">{error}</div>}
            <div className={formGridClassName({ responsive: false })}>
              <div>
                <FormLabel  layout="block" size="xs" tone="muted" spacing="xs">Цена</FormLabel>
                <TextInput
                  type="number" step="0.01" min={0}
                  value={values.price}
                  onChange={(e) => setValues((p) => ({ ...p, price: e.target.value }))}
                  required
                />
              </div>
              <div>
                <FormLabel  layout="block" size="xs" tone="muted" spacing="xs">Валюта</FormLabel>
                {ruMode ? (
                  <span className="block px-3 py-2 text-sm text-aspectum-text-muted">RUB</span>
                ) : (
                  <Select
                    value={values.currency}
                    onChange={(e) => setValues((p) => ({ ...p, currency: e.target.value }))}
                  >
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                )}
              </div>
            </div>
          </div>
        )}
        renderResult={({ result }) => (
          <div className="text-sm text-aspectum-success-strong">
            Создано: {result?.created_count ?? 0}, обновлено: {result?.updated_count ?? 0}
          </div>
        )}
      />
    </Layout>
  );
}
