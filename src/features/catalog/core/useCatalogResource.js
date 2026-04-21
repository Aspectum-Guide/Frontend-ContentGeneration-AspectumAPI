import { useCallback, useState } from 'react';
import { normalizePaginatedResponse } from '../shared/normalize';

export function useCatalogResource({
  listRequest,
  removeRequest,
  listKeys,
  defaultErrorMessage = 'Failed to load catalog data',
  mapListItem = (item) => item,
}) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (params = {}, parseError = (err) => err?.message || defaultErrorMessage) => {
    try {
      setLoading(true);
      setError(null);

      const response = await listRequest(params);
      const data = response?.data;
      const normalized = normalizePaginatedResponse(data, listKeys);

      setItems(normalized.items.map(mapListItem));
      setTotal(normalized.total);
    } catch (err) {
      setItems([]);
      setTotal(0);
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  }, [defaultErrorMessage, listKeys, listRequest, mapListItem]);

  const remove = useCallback(async (id) => {
    if (!removeRequest) return;
    await removeRequest(id);
  }, [removeRequest]);

  return {
    items,
    total,
    loading,
    error,
    load,
    remove,
    setItems,
    setTotal,
    setError,
  };
}
