import { useState, useRef, useEffect, useCallback } from 'react';
import { Alert, Button, EmptyState, InlineState, MediaResultCard, Modal, SkeletonGrid, Tabs, TextInput } from '@aspectum/ui';
import { imagesAPI } from '../../api/generation';

/**
 * CommonsImagePicker - компонент для поиска и выбора изображений из Wikimedia Commons
 * Аналог cg-commons-picker.js из Django templates
 */
const LIBRARY_TABS = [
  { key: 'best', label: '★ Подбор' },
  { key: 'commons', label: 'WC' },
  { key: 'mkrf', label: 'Минкульт' },
  { key: 'openverse', label: 'Openverse' },
  { key: 'pastvu', label: 'Pastvu' },
  { key: 'mapillary', label: 'Mapillary' },
];

export default function CommonsImagePicker({
  isOpen,
  onClose,
  onImageSelected,
  getSessionUuid,
  defaultQuery = '',
  description = 'Выберите изображение с указанием лицензии и автора',
  // Контекст объекта для «Библиотеки»: координаты включают гео-источники
  // (pastvu/mapillary/commons-geo), city/country — Минкульт и точность поиска.
  coords = null,
  cityName = '',
  countryName = '',
}) {
  const [query, setQuery] = useState(defaultQuery || '');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [tab, setTab] = useState('best');
  const [library, setLibrary] = useState(null);   // ответ photo-library
  const [libLoading, setLibLoading] = useState(false);
  // Инфинит-скролл табов-источников: страница и «есть ещё» по каждому табу.
  const [libPages, setLibPages] = useState({});
  const [libHasMore, setLibHasMore] = useState({});
  const libParamsRef = useRef(null);   // параметры последней загрузки библиотеки

  const loadLibrary = useCallback(async (searchQuery) => {
    const q = String(searchQuery || '').trim();
    if (!q && !(coords?.lat != null)) return;
    setLibLoading(true);
    try {
      const params = { q };
      // Ручной запрос (оператор изменил текст) — глобальный поиск БЕЗ привязки
      // к городу объекта: «кремль» должен находить кремли, а не пустой
      // «кремль в Гусь-Хрустальном». Дефолтный запрос объекта — с городом.
      const isManual = q && q !== String(defaultQuery || '').trim();
      if (!isManual && cityName) params.city = cityName;
      if (!isManual && countryName) params.country = countryName;
      if (coords?.lat != null && coords?.lon != null) {
        params.lat = coords.lat;
        params.lon = coords.lon;
      }
      const { data } = await imagesAPI.photoLibrary(params);
      libParamsRef.current = params;
      setLibrary(data || null);
      // первая страница загружена; «есть ещё», если источник отдал полный лист
      const pages = {};
      const more = {};
      for (const [k, v] of Object.entries(data?.sources || {})) {
        pages[k] = 1;
        more[k] = (v || []).length >= 10;
      }
      setLibPages(pages);
      setLibHasMore(more);
    } catch (err) {
      console.error('Photo library error:', err);
      setLibrary(null);
    } finally {
      setLibLoading(false);
    }
  }, [coords, cityName, countryName, defaultQuery]);

  // Догрузка следующей страницы активного таба-источника (кроме best/commons).
  const [libPageLoading, setLibPageLoading] = useState(false);
  const loadMoreForTab = useCallback(async (tabKey) => {
    if (!libParamsRef.current || libPageLoading) return;
    if (!libHasMore[tabKey]) return;
    const nextPage = (libPages[tabKey] || 1) + 1;
    setLibPageLoading(true);
    try {
      const { data } = await imagesAPI.photoLibrary({
        ...libParamsRef.current, source: tabKey, page: nextPage,
      });
      const incoming = data?.items || [];
      setLibrary((prev) => {
        if (!prev) return prev;
        const seen = new Set((prev.sources?.[tabKey] || []).map((i) => i.image_url));
        const fresh = incoming.filter((i) => !seen.has(i.image_url));
        return {
          ...prev,
          sources: {
            ...prev.sources,
            [tabKey]: [...(prev.sources?.[tabKey] || []), ...fresh],
          },
        };
      });
      setLibPages((p) => ({ ...p, [tabKey]: nextPage }));
      setLibHasMore((m) => ({ ...m, [tabKey]: !!data?.has_more }));
    } catch (err) {
      console.error('Photo library page error:', err);
      setLibHasMore((m) => ({ ...m, [tabKey]: false }));
    } finally {
      setLibPageLoading(false);
    }
  }, [libPages, libHasMore, libPageLoading]);

  const dialogRef = useRef(null);
  const searchDebounceRef = useRef(null);

  const limit = 10;

  const runSearch = useCallback(async (searchQuery, pageNum = 1) => {
    const q = String(searchQuery || '').trim();

    if (!q || q.length < 2) {
      setItems([]);
      setHasMore(false);
      return;
    }

    setLoading(true);

    try {
      const response = await imagesAPI.searchCommons(q, limit, pageNum);
      const data = response?.data ?? response;
      const incoming = Array.isArray(data?.results) ? data.results : [];

      if (pageNum === 1) {
        setItems(incoming);
      } else {
        setItems((prev) => [...prev, ...incoming]);
      }

      setHasMore(incoming.length >= limit);
    } catch (err) {
      console.error('Commons search error:', err);

      if (pageNum === 1) {
        setItems([]);
      }

      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    if (!isOpen) return;

    const initialQuery = defaultQuery || '';

    setQuery(initialQuery);
    setItems([]);
    setImportError('');
    setPage(1);
    setHasMore(true);
    setTab('best');
    setLibrary(null);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }

    if (initialQuery.trim().length >= 2) {
      runSearch(initialQuery, 1);
    }
    // библиотека грузится и по одним координатам (объект без названия)
    loadLibrary(initialQuery);
  }, [isOpen, defaultQuery, runSearch, loadLibrary]);

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

  const handleQueryChange = useCallback((e) => {
    const value = e.target.value;

    setQuery(value);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    const normalizedValue = value.trim();

    if (normalizedValue.length < 2) {
      setItems([]);
      setPage(1);
      setHasMore(false);
      return;
    }

    searchDebounceRef.current = setTimeout(() => {
      setPage(1);
      runSearch(normalizedValue, 1);
    }, 350);
  }, [runSearch]);

  const handleSearchSubmit = useCallback((e) => {
    e?.preventDefault?.();

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }

    const normalizedQuery = query.trim();

    setPage(1);
    runSearch(normalizedQuery, 1);
    loadLibrary(normalizedQuery);
  }, [query, runSearch, loadLibrary]);

  const handleImageSelect = useCallback(async (item) => {
    setLoading(true);
    setImportError('');

    try {
      const originalUrl = item.image_url || item.original_image_url || '';
      const thumbUrl = item.thumb_url || originalUrl;

      const payload = {
        image_url: originalUrl || thumbUrl,
        original_image_url: originalUrl,
        title: item.title || '',
        author: cleanHtmlText(item.author || ''),
        license: cleanHtmlText(item.license || ''),
        license_url: item.license_url || '',
        file_page_url: item.file_page_url || '',
      };

      const sessionUuid = getSessionUuid?.();

      if (sessionUuid) {
        payload.session_uuid = sessionUuid;
      }

      const response = await imagesAPI.importCommons(payload);
      const data = response?.data ?? response;
      const image = data?.image;

      if (!image) {
        throw new Error('Сервер не вернул данные изображения');
      }

      const selectedOriginalUrl =
        data?.original_image_url ||
        data?.source_url ||
        originalUrl ||
        thumbUrl ||
        '';

      const importedLocalUrl = image?.url || '';
      const copyright = image?.copyright || buildCopyright(item);

      onImageSelected?.({
        imageId: image.id,

        // Локальная ссылка backend/media. Её используем только для preview.
        localUrl: importedLocalUrl,

        // Оригинальная ссылка Wikimedia. Её сохраняем в поле URL.
        originalUrl: selectedOriginalUrl,
        sourceUrl: data?.source_url || selectedOriginalUrl,

        // Дополнительные поля для совместимости.
        imageUrl: selectedOriginalUrl,
        thumbUrl,
        importedLocalUrl,

        title: item.title || '',
        author: cleanHtmlText(item.author || ''),
        license: cleanHtmlText(item.license || ''),
        licenseUrl: item.license_url || '',
        filePageUrl: item.file_page_url || '',
        copyright,
      });

      onClose?.();
    } catch (err) {
      console.error('Image import error:', err);
      setImportError(err.message || 'Не удалось загрузить изображение');
    } finally {
      setLoading(false);
    }
  }, [onImageSelected, onClose, getSessionUuid]);

  const handleScroll = useCallback(() => {
    const scrollHost = dialogRef.current;
    if (!scrollHost) return;

    const scrollBottom = scrollHost.scrollTop + scrollHost.clientHeight;
    const threshold = scrollHost.scrollHeight - 180;
    if (scrollBottom < threshold) return;

    if (tab === 'commons') {
      const normalizedQuery = query.trim();
      if (loading || !hasMore || normalizedQuery.length < 2) return;
      const nextPage = page + 1;
      setPage(nextPage);
      runSearch(normalizedQuery, nextPage);
      return;
    }
    // табы-источники: догрузка своей страницы («как в WC»)
    if (tab !== 'best') {
      loadMoreForTab(tab);
    }
  }, [tab, loading, hasMore, query, page, runSearch, loadMoreForTab]);

  useEffect(() => {
    const scrollHost = dialogRef.current;

    if (!scrollHost || !isOpen) return;

    scrollHost.addEventListener('scroll', handleScroll);

    return () => {
      scrollHost.removeEventListener('scroll', handleScroll);
    };
  }, [isOpen, handleScroll]);

  if (!isOpen) return null;

  const normalizedQuery = query.trim();
  const libItems = tab === 'best'
    ? (library?.best || [])
    : (library?.sources?.[tab] || []);
  const tabCount = (key) => (key === 'best'
    ? (library?.best || []).length
    : (library?.sources?.[key] || []).length);
  const showCommonsSearch = tab === 'commons';

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="⊞ Библиотека изображений"
      description={description}
      size="xl"
      bodyRef={dialogRef}
      bodyClassName="p-4"
      toolbar={(
        <form onSubmit={handleSearchSubmit} className="px-6 pt-4 pb-2 border-b border-aspectum-border">
          <div className="flex gap-2">
            <TextInput
              type="text"
              value={query}
              onChange={handleQueryChange}
              placeholder="Запрос, например: Высоцкий монастырь Серпухов"
              autoFocus
            />

            <Button
              type="submit"
              disabled={(loading || libLoading) || normalizedQuery.length < 2}
              variant="primary"
              size="md"
            >
              Найти
            </Button>
          </div>

          <Tabs
            items={LIBRARY_TABS.map((t) => ({
              id: t.key,
              label: `${t.label}${t.key !== 'commons' && library ? ` (${tabCount(t.key)})` : ''}`,
            }))}
            value={tab}
            onChange={setTab}
            className="mt-2"
          />
        </form>
      )}
    >
          {importError && <Alert tone="error" className="mb-4">{importError}</Alert>}
          {showCommonsSearch ? (
            <>
              {loading && items.length === 0 ? (
                <SkeletonGrid />
              ) : items.length === 0 ? (
                <EmptyState
                  icon={null}
                  title={normalizedQuery && normalizedQuery.length < 2
                    ? 'Введите минимум 2 символа'
                    : 'Ничего не найдено'}
                />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {items.map((item, idx) => (
                    <MediaResultCard
                      key={`${item.image_url || item.thumb_url || item.title || 'commons'}:${idx}`}
                      title={item.title || ''}
                      thumb={item.thumb_url || item.image_url || ''}
                      author={cleanHtmlText(item.author || '')}
                      license={cleanHtmlText(item.license || '')}
                      onSelect={() => handleImageSelect(item)}
                      disabled={loading}
                    />
                  ))}
                </div>
              )}

              {loading && items.length > 0 && (
                <InlineState loading align="center" className="py-4">Загрузка...</InlineState>
              )}

              {!hasMore && items.length > 0 && (
                <InlineState size="xs" tone="disabled" align="center" className="py-4">Больше результатов нет</InlineState>
              )}
            </>
          ) : libLoading ? (
            <SkeletonGrid />
          ) : libItems.length === 0 ? (
            <EmptyState
              icon={null}
              title={library
                ? 'В этом источнике ничего не нашлось'
                : 'Введите запрос и нажмите «Найти»'}
            />
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {libItems.map((item, idx) => (
                  <MediaResultCard
                    key={`${item.image_url || item.thumb_url || 'lib'}:${idx}`}
                    title={item.title || ''}
                    thumb={item.thumb_url || item.image_url || ''}
                    author={cleanHtmlText(item.author || '')}
                    license={cleanHtmlText(item.license || '')}
                    onSelect={() => handleImageSelect(item)}
                    disabled={loading || libLoading}
                    badge={tab === 'best' ? (SOURCE_BADGES[item.source] || item.source || '') : ''}
                  />
                ))}
              </div>
              {libPageLoading && (
                <InlineState loading align="center" className="py-4">Загрузка...</InlineState>
              )}
              {tab !== 'best' && libHasMore[tab] && !libPageLoading && libItems.length > 0 && (
                <div className="text-center py-4">
                  <Button
                    type="button"
                    onClick={() => loadMoreForTab(tab)}
                    variant="soft"
                    size="md"
                  >
                    Показать ещё
                  </Button>
                </div>
              )}
              {tab !== 'best' && !libHasMore[tab] && libItems.length > 0 && (
                <InlineState size="xs" tone="disabled" align="center" className="py-4">Больше результатов нет</InlineState>
              )}
            </>
          )}
    </Modal>
  );
}

const SOURCE_BADGES = {
  mkrf: 'Минкульт', commons: 'WC', commons_category: 'WC·кат',
  commons_geo: 'WC·гео', commons_search: 'WC', wikipedia_article: 'Wiki',
  openverse: 'OV', pastvu: 'Pastvu', mapillary: 'Mplr', flickr: 'Flickr',
};

function cleanHtmlText(s) {
  if (!s) return '';

  const d = document.createElement('div');
  d.innerHTML = String(s);

  return (d.textContent || d.innerText || '').trim();
}

function buildCopyright(item) {
  const author = cleanHtmlText(item.author || '');
  const license = cleanHtmlText(item.license || '');
  const licenseUrl = item.license_url || '';
  const pageUrl = item.file_page_url || '';
  const title = cleanHtmlText(item.title || '');

  const chunks = [];

  if (author) chunks.push(author);
  if (license) chunks.push(license);
  if (licenseUrl) chunks.push(licenseUrl);
  if (pageUrl) chunks.push(pageUrl);
  if (title) chunks.push(title);

  return chunks.join(' | ');
}
