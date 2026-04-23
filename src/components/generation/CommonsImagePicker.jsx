import { useState, useRef, useEffect, useCallback } from 'react';
import { imagesAPI } from '../../api/generation';

/**
 * CommonsImagePicker - компонент для поиска и выбора изображений из Wikimedia Commons
 * Аналог cg-commons-picker.js из Django templates
 */
export default function CommonsImagePicker({
  isOpen,
  onClose,
  onImageSelected,
  getSessionUuid,
  defaultQuery = '',
}) {
  const [query, setQuery] = useState(defaultQuery);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchDebounceTimer, setSearchDebounceTimer] = useState(null);

  const modalRef = useRef(null);
  const dialogRef = useRef(null);
  const limit = 10;

  // Сброс состояния при открытии
  useEffect(() => {
    if (isOpen) {
      setItems([]);
      setPage(1);
      setHasMore(true);
      if (defaultQuery && defaultQuery.length >= 2) {
        runSearch(defaultQuery, 1);
      }
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Поиск с дебаунсом
  const runSearch = useCallback(async (searchQuery, pageNum = 1) => {
    const q = (searchQuery || query).trim();
    if (!q || q.length < 2) {
      setItems([]);
      setHasMore(false);
      return;
    }

    setLoading(true);
    try {
      console.log('Commons search:', { q, limit, pageNum });
      const response = await imagesAPI.searchCommons(q, limit, pageNum);
      console.log('Commons search response:', response);
      console.log('Commons search response.data:', response.data);
      
      // Axios возвращает { data, status, ... }, данные в response.data
      const data = response.data;
      const incoming = Array.isArray(data?.results) ? data.results : [];
      console.log('Parsed results:', incoming);
      
      if (pageNum === 1) {
        setItems(incoming);
      } else {
        setItems(prev => [...prev, ...incoming]);
      }
      
      setHasMore(incoming.length >= limit);
    } catch (err) {
      console.error('Commons search error:', err);
      if (pageNum === 1) {
        setItems([]);
      }
    } finally {
      setLoading(false);
    }
  }, [query, limit]); // eslint-disable-line react-hooks/exhaustive-deps

  // Обработчик ввода с дебаунсом
  const handleQueryChange = useCallback((e) => {
    const value = e.target.value.trim();
    setQuery(value);

    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);

    if (value.length < 2) {
      setItems([]);
      setHasMore(false);
      return;
    }

    const timer = setTimeout(() => {
      setPage(1);
      runSearch(value, 1);
    }, 350);

    setSearchDebounceTimer(timer);
  }, [searchDebounceTimer, runSearch]);

  // Выбор изображения
  const handleImageSelect = useCallback(async (item) => {
    setLoading(true);
    try {
      const payload = {
        image_url: item.thumb_url || item.image_url,
        original_image_url: item.image_url || '',
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

      if (!image || !image.url) {
        throw new Error('Сервер не вернул локальный URL изображения');
      }

      const copyright = buildCopyright(item);

      onImageSelected?.({
        imageId: image.id,
        localUrl: image.url,
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

  // Загрузка по скроллу
  const handleScroll = useCallback(() => {
    const scrollHost = dialogRef.current || modalRef.current;
    if (!scrollHost || loading || !hasMore || !query) return;

    const scrollBottom = scrollHost.scrollTop + scrollHost.clientHeight;
    const threshold = scrollHost.scrollHeight - 180;

    if (scrollBottom >= threshold) {
      const nextPage = page + 1;
      setPage(nextPage);
      runSearch(query, nextPage);
    }
  }, [loading, hasMore, query, page, runSearch]);

  // Привязка scroll обработчика
  useEffect(() => {
    const scrollHost = dialogRef.current || modalRef.current;
    if (!scrollHost || !isOpen) return;

    scrollHost.addEventListener('scroll', handleScroll);
    return () => scrollHost.removeEventListener('scroll', handleScroll);
  }, [isOpen, handleScroll]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Выбор изображения из Wikimedia Commons"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Wikimedia Commons</h3>
            <p className="text-sm text-gray-500">
              Выберите изображение города с указанием лицензии и автора
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

        {/* Search */}
        <div className="p-4 border-b border-gray-200">
          <input
            type="text"
            value={query}
            onChange={handleQueryChange}
            placeholder="Запрос, например: Rome city"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </div>

        {/* Grid */}
        <div
          ref={dialogRef}
          className="flex-1 overflow-y-auto p-4"
        >
          {loading && items.length === 0 ? (
            <SkeletonGrid />
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              {query && query.length < 2
                ? 'Введите минимум 2 символа'
                : 'Ничего не найдено'}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {items.map((item, idx) => (
                <ImageCard
                  key={idx}
                  item={item}
                  idx={idx}
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
        </div>
      </div>
    </div>
  );
}

// Компонент карточки изображения
function ImageCard({ item, idx, onSelect, disabled }) {
  const title = item.title || '';
  const thumb = item.thumb_url || item.image_url || '';
  const author = cleanHtmlText(item.author || '');
  const license = cleanHtmlText(item.license || '');

  console.log(`ImageCard[${idx}]:`, { title, thumb, author, license });

  return (
    <div
      className={`border border-gray-200 rounded-lg overflow-hidden cursor-pointer hover:border-blue-400 hover:shadow-md transition-all ${
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
      {/* Thumbnail */}
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

      {/* Meta */}
      <div className="p-2">
        <div className="text-xs font-medium text-gray-900 truncate" title={title}>
          {title || 'Без названия'}
        </div>
        <div className="text-xs text-gray-500 truncate" title={author}>
          Автор: {author || '—'}
        </div>
        <div className="text-xs text-gray-500 truncate" title={license}>
          Лицензия: {license || '—'}
        </div>
      </div>
    </div>
  );
}

// Skeleton загрузка
function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="border border-gray-200 rounded-lg overflow-hidden animate-pulse">
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

// Утилиты
function cleanHtmlText(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.innerHTML = String(s);
  return (d.textContent || d.innerText || '').trim();
}

function buildCopyright(item) {
  const author = cleanHtmlText(item.author || '');
  const license = cleanHtmlText(item.license || '');
  const pageUrl = item.file_page_url || '';
  const chunks = [];
  if (author) chunks.push(author);
  if (license) chunks.push(license);
  if (pageUrl) chunks.push(pageUrl);
  return chunks.join(' | ');
}
