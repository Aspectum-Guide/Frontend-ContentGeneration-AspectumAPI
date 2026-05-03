import { useCallback, useMemo, useState } from 'react';
import { normalizePaginatedResponse } from '../shared/normalize';

const IDENTITY = (item) => item;

/**
 * Загрузка списка справочника (пагинация + ошибки).
 * Возвращаемый объект меняет ссылку при обновлении items / loading / error.
 * В зависимостях useCallback/useEffect указывайте `resource.load` (и при необходимости `remove`),
 * а не весь `resource` — иначе после каждого ответа API пересоздаётся callback и возможен цикл запросов.
 */
export function useCatalogResource({
  listRequest,
  removeRequest,
  listKeys,
  defaultErrorMessage = 'Failed to load catalog data',
  mapListItem = IDENTITY,
}) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const listKeysKey = useMemo(() => {
    if (!Array.isArray(listKeys)) return '';
    // stable signature even if caller passes new array each render
    return listKeys.join('|');
  }, [listKeys]);

  const normalizedListKeys = useMemo(() => {
    if (!listKeysKey) return [];
    return listKeysKey.split('|').filter(Boolean);
  }, [listKeysKey]);

  const load = useCallback(async (params = {}, parseError = (err) => err?.message || defaultErrorMessage) => {
    try {
      setLoading(true);
      setError(null);

      const response = await listRequest(params);
      const data = response?.data;
      const normalized = normalizePaginatedResponse(data, normalizedListKeys);

      setItems(normalized.items.map(mapListItem));
      setTotal(normalized.total);
    } catch (err) {
      setItems([]);
      setTotal(0);
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  }, [defaultErrorMessage, listRequest, mapListItem, normalizedListKeys]);

  const remove = useCallback(async (id) => {
    if (!removeRequest) return;
    await removeRequest(id);
  }, [removeRequest]);

  return useMemo(() => ({
    items,
    total,
    loading,
    error,
    load,
    remove,
    setItems,
    setTotal,
    setError,
  }), [error, items, load, loading, remove, total]);
}
