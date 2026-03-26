import { useState } from 'react';
import Layout from '../../components/Layout';
import { aiAPI } from '../../api/generation';

export default function ImageGeneration() {
  const [query, setQuery] = useState('');
  const [cityName, setCityName] = useState('');
  const [count, setCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [images, setImages] = useState([]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim() && !cityName.trim()) return;
    try {
      setLoading(true);
      setError(null);
      setImages([]);

      const payload = {
        query: query.trim() || undefined,
        city_name: cityName.trim() || undefined,
        count,
      };

      const r = await aiAPI.searchImages(payload);
      const data = r?.data;
      const imgs = Array.isArray(data?.images) ? data.images
        : Array.isArray(data?.results) ? data.results
        : Array.isArray(data) ? data : [];
      setImages(imgs);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Ошибка поиска изображений');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Поиск изображений</h1>
        <p className="mt-1 text-sm text-gray-500">
          Поиск изображений в Wikimedia Commons для городов и достопримечательностей
        </p>
      </div>

      {/* Search Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Поисковый запрос
              </label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="напр. «Colosseum Rome architecture»"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Город / контекст
              </label>
              <input
                type="text"
                value={cityName}
                onChange={(e) => setCityName(e.target.value)}
                placeholder="напр. «Rome»"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Количество результатов
            </label>
            <input
              type="number"
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(20, Number(e.target.value))))}
              min={1}
              max={20}
              className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (!query.trim() && !cityName.trim())}
            className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Поиск...
              </span>
            ) : (
              '🔍 Найти изображения'
            )}
          </button>
        </form>
      </div>

      {/* Results */}
      {images.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">
            Найдено: {images.length}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {images.map((img, idx) => (
              <div
                key={img.id || img.url || idx}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow group"
              >
                <div className="relative">
                  <img
                    src={img.thumb_url || img.url}
                    alt={img.title || img.description || `Image ${idx + 1}`}
                    className="w-full aspect-square object-cover"
                    loading="lazy"
                  />
                  {img.url && (
                    <a
                      href={img.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <span className="px-2 py-1 bg-white/90 rounded text-xs font-medium text-gray-800">
                        Открыть
                      </span>
                    </a>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-xs text-gray-700 font-medium truncate" title={img.title}>
                    {img.title || '—'}
                  </p>
                  {img.author && (
                    <p className="text-xs text-gray-400 truncate">© {img.author}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && images.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-5xl mb-4">🖼️</div>
          <p className="text-gray-500">Введите запрос для поиска изображений</p>
          <p className="text-xs text-gray-400 mt-2">
            Поиск выполняется в открытой базе Wikimedia Commons
          </p>
        </div>
      )}
    </Layout>
  );
}
