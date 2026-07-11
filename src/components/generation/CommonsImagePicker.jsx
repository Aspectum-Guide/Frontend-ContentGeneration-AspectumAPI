import { useState, useRef, useEffect, useCallback } from 'react';
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
  const [hasMore, setHasMore] = useState(true);
  const [tab, setTab] = useState('best');
  const [library, setLibrary] = useState(null);   // ответ photo-library
  const [libLoading, setLibLoading] = useState(false);

  const loadLibrary = useCallback(async (searchQuery) => {
    const q = String(searchQuery || '').trim();
    if (!q && !(coords?.lat != null)) return;
    setLibLoading(true);
    try {
      const params = { q };
      if (cityName) params.city = cityName;
      if (countryName) params.country = countryName;
      if (coords?.lat != null && coords?.lon != null) {
        params.lat = coords.lat;
        params.lon = coords.lon;
      }
      const { data } = await imagesAPI.photoLibrary(params);
      setLibrary(data || null);
    } catch (err) {
      console.error('Photo library error:', err);
      setLibrary(null);
    } finally {
      setLibLoading(false);
    }
  }, [coords, cityName, countryName]);

  const modalRef = useRef(null);
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
      alert(`Ошибка: ${err.message || 'Не удалось загрузить изображение'}`);
    } finally {
      setLoading(false);
    }
  }, [onImageSelected, onClose, getSessionUuid]);

  const handleScroll = useCallback(() => {
    const scrollHost = dialogRef.current || modalRef.current;
    const normalizedQuery = query.trim();

    if (!scrollHost || loading || !hasMore || normalizedQuery.length < 2) return;

    const scrollBottom = scrollHost.scrollTop + scrollHost.clientHeight;
    const threshold = scrollHost.scrollHeight - 180;

    if (scrollBottom >= threshold) {
      const nextPage = page + 1;

      setPage(nextPage);
      runSearch(normalizedQuery, nextPage);
    }
  }, [loading, hasMore, query, page, runSearch]);

  useEffect(() => {
    const scrollHost = dialogRef.current || modalRef.current;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      <div
        ref={modalRef}
        className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Выбор изображения из Wikimedia Commons"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              ⊞ Библиотека изображений
            </h3>

            <p className="text-sm text-gray-500">
              {description}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <form
          onSubmit={handleSearchSubmit}
          className="p-4 pb-2 border-b border-gray-200"
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={handleQueryChange}
              placeholder="Запрос, например: Высоцкий монастырь Серпухов"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />

            <button
              type="submit"
              disabled={(loading || libLoading) || normalizedQuery.length < 2}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Найти
            </button>
          </div>

          <div className="flex flex-wrap gap-1 mt-2">
            {LIBRARY_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  tab === t.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t.label}
                {t.key !== 'commons' && library ? ` (${tabCount(t.key)})` : ''}
              </button>
            ))}
          </div>
        </form>

        <div
          ref={dialogRef}
          className="flex-1 overflow-y-auto p-4"
        >
          {showCommonsSearch ? (
            <>
              {loading && items.length === 0 ? (
                <SkeletonGrid />
              ) : items.length === 0 ? (
                <div className="text-center py-12 text-gray-500 text-sm">
                  {normalizedQuery && normalizedQuery.length < 2
                    ? 'Введите минимум 2 символа'
                    : 'Ничего не найдено'}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {items.map((item, idx) => (
                    <ImageCard
                      key={`${item.image_url || item.thumb_url || item.title || 'commons'}:${idx}`}
                      item={item}
                      onSelect={() => handleImageSelect(item)}
                      disabled={loading}
                    />
                  ))}
                </div>
              )}

              {loading && items.length > 0 && (
                <div className="text-center py-4 text-gray-500 text-sm">
                  Загрузка...
                </div>
              )}

              {!hasMore && items.length > 0 && (
                <div className="text-center py-4 text-gray-400 text-xs">
                  Больше результатов нет
                </div>
              )}
            </>
          ) : libLoading ? (
            <SkeletonGrid />
          ) : libItems.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              {library
                ? 'В этом источнике ничего не нашлось'
                : 'Введите запрос и нажмите «Найти»'}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {libItems.map((item, idx) => (
                <ImageCard
                  key={`${item.image_url || item.thumb_url || 'lib'}:${idx}`}
                  item={item}
                  onSelect={() => handleImageSelect(item)}
                  disabled={loading || libLoading}
                  sourceBadge={tab === 'best' ? item.source : ''}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const SOURCE_BADGES = {
  mkrf: 'Минкульт', commons: 'WC', commons_category: 'WC·кат',
  commons_geo: 'WC·гео', commons_search: 'WC', wikipedia_article: 'Wiki',
  openverse: 'OV', pastvu: 'Pastvu', mapillary: 'Mplr', flickr: 'Flickr',
};

function ImageCard({ item, onSelect, disabled, sourceBadge = '' }) {
  const title = item.title || '';
  const thumb = item.thumb_url || item.image_url || '';
  const author = cleanHtmlText(item.author || '');
  const license = cleanHtmlText(item.license || '');
  const badge = sourceBadge ? (SOURCE_BADGES[sourceBadge] || sourceBadge) : '';

  return (
    <div
      className={`relative border border-gray-200 rounded-lg overflow-hidden cursor-pointer hover:border-blue-400 hover:shadow-md transition-all ${
        disabled ? 'opacity-50 pointer-events-none' : ''
      }`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      tabIndex={0}
      role="button"
      aria-label="Выбрать изображение"
    >
      {badge && (
        <span className="absolute top-1 left-1 z-10 px-1.5 py-0.5 rounded bg-black/55 text-white text-[10px] leading-none">
          {badge}
        </span>
      )}
      <div className="aspect-square bg-gray-100 overflow-hidden">
        {thumb ? (
          <img
            src={thumb}
            alt={title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
            Нет превью
          </div>
        )}
      </div>

      <div className="p-2">
        <div
          className="text-xs font-medium text-gray-900 truncate"
          title={title}
        >
          {title || 'Без названия'}
        </div>

        <div
          className="text-xs text-gray-500 truncate"
          title={author}
        >
          Автор: {author || '—'}
        </div>

        <div
          className="text-xs text-gray-500 truncate"
          title={license}
        >
          Лицензия: {license || '—'}
        </div>
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="border border-gray-200 rounded-lg overflow-hidden animate-pulse"
        >
          <div className="aspect-square bg-gray-200" />

          <div className="p-2 space-y-1">
            <div className="h-3 bg-gray-200 rounded w-3/4" />
            <div className="h-2 bg-gray-200 rounded w-1/2" />
            <div className="h-2 bg-gray-200 rounded w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

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
