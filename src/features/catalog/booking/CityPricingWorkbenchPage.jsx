import { useCallback, useEffect, useMemo, useState } from 'react';
import { eventSlotAvailabilitiesAPI, eventTicketTypePricesAPI, ticketTypesAPI } from '../../../api/booking';
import { citiesCatalogAPI } from '../cities/api';
import BulkActionModal from '../../../components/bulk/BulkActionModal';
import Layout from '../../../components/Layout';
import { Select, TextInput } from '../../../components/ui/FormField';
import { parseApiError } from '../../../utils/apiError';
import { loadReferenceEventsForCity } from '../shared/bookingOptions';
import TicketTypeSelect from '../shared/components/TicketTypeSelect';
import { CURRENCIES, DEFAULT_CURRENCY, normalizeCurrency } from '../shared/currencies';
import { getMultiLangValue } from '../shared/i18n';
import { normalizeListResponse } from '../shared/normalize';
import { getPriceRowStatus, priceStatusClass } from './bookingSetupPricingHelpers';
import { buildCityPriceRows, collectCityBulkEntries, groupSlotsByEvent } from './cityPricingHelpers';

const RU_MODE_STORAGE_KEY = 'aspectum.cityPricing.ruMode';

function getCityLabel(city) {
  return getMultiLangValue(city?.name) || String(city?.id || '');
}

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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Массовые цены по городу</h1>
        <p className="mt-1 text-sm text-gray-500">
          Базовые цены (событие + тип билета) для всех событий выбранного города. Слоты и правила
          цен по-прежнему редактируются в мастере настройки конкретного события.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4 mb-4">
        <div className="w-64">
          <label className="block text-xs text-gray-500 mb-1">Город</label>
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
          <label className="block text-xs text-gray-500 mb-1">Тип билета (фильтр)</label>
          <TicketTypeSelect
            value={ticketTypeFilter}
            onChange={setTicketTypeFilter}
            options={ticketTypes}
            disabled={!cityId || dataLoading}
            placeholder="Все типы"
          />
        </div>

        <label className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={ruMode}
            onChange={(e) => setRuMode(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          RU-контур (только RUB)
        </label>

        {selectedKeys.size > 0 && (
          <button
            type="button"
            onClick={() => setBulkModalOpen(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Применить к выбранным ({selectedKeys.size})
          </button>
        )}

        {dirtyCount > 0 && (
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={savingAll}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {savingAll ? 'Сохранение…' : `Сохранить изменённые (${dirtyCount})`}
          </button>
        )}
      </div>

      {saveError && (
        <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {saveError}
        </div>
      )}
      {saveNotice && (
        <div className="mb-4 px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg">
          {saveNotice}
        </div>
      )}
      {loadError && (
        <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {loadError}
        </div>
      )}

      {!cityId ? (
        <div className="px-4 py-8 text-center text-gray-400 text-sm border border-dashed border-gray-300 rounded-xl">
          Выберите город, чтобы увидеть цены по его событиям.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-3 py-2 text-center w-8">
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && selectedKeys.size === rows.length}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
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
            <tbody className="divide-y divide-gray-100">
              {dataLoading ? (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400">Загрузка…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400">Нет событий с ценами для этого города</td></tr>
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
                  <tr key={row.key} className={selectedKeys.has(row.key) ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={selectedKeys.has(row.key)}
                        onChange={() => toggleSelect(row.key)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-3 py-2 text-gray-700">{row.eventLabel}</td>
                    <td className="px-3 py-2 text-gray-700">{row.ticketTypeLabel}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs ${priceStatusClass(rowStatus.kind)}`}>
                        {rowStatus.label}
                      </span>
                      {currencyWarning && (
                        <span className="ml-2 text-xs text-amber-600">не RUB — не виден в RU-приложении</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number" step="0.01" min={0}
                        value={draft.price ?? ''}
                        onChange={(e) => setDraft(row.key, { price: e.target.value })}
                        placeholder={row.savedBase ? String(row.savedBase.base_price) : '—'}
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      {ruMode ? (
                        <span className="text-xs text-gray-500">RUB</span>
                      ) : (
                        <select
                          value={rowCurrency}
                          onChange={(e) => setDraft(row.key, { currency: e.target.value })}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center text-xs text-gray-500">
                      {row.slotsSummary.total === 0
                        ? <span className="text-amber-600">нет слотов</span>
                        : `${row.slotsSummary.active}/${row.slotsSummary.total} открыт`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
            {error && <div className="text-sm text-red-600">{error}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Цена</label>
                <TextInput
                  type="number" step="0.01" min={0}
                  value={values.price}
                  onChange={(e) => setValues((p) => ({ ...p, price: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Валюта</label>
                {ruMode ? (
                  <span className="block px-3 py-2 text-sm text-gray-500">RUB</span>
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
          <div className="text-sm text-emerald-700">
            Создано: {result?.created_count ?? 0}, обновлено: {result?.updated_count ?? 0}
          </div>
        )}
      />
    </Layout>
  );
}
