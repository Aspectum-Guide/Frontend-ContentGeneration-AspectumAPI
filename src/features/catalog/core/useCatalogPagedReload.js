import { useEffect, useRef } from 'react';

/**
 * Единый эффект загрузки справочника: при смене фильтров — page=1 и один reload(1);
 * при смене только page — reload(page). Убирает двойные запросы из пары useEffect.
 */
export function useCatalogPagedReload({ page, setPage, reload, filterSignature }) {
  const filterRef = useRef(filterSignature);

  useEffect(() => {
    const filtersChanged = filterRef.current !== filterSignature;
    if (filtersChanged) {
      filterRef.current = filterSignature;
      if (page !== 1) {
        setPage(1);
        return;
      }
      reload(1);
      return;
    }

    reload(page);
  }, [page, filterSignature, reload, setPage]);
}
