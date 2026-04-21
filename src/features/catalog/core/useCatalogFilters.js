import { useEffect, useMemo, useState } from 'react';

export function useCatalogFilters({ initialSearch = '', initialPage = 1, debounceMs = 350 } = {}) {
  const [search, setSearch] = useState(initialSearch);
  const [page, setPage] = useState(initialPage);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [search, debounceMs]);

  return useMemo(
    () => ({
      search,
      setSearch,
      page,
      setPage,
      debouncedSearch,
    }),
    [search, page, debouncedSearch]
  );
}
