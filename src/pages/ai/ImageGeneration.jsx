import { useState } from 'react';
import Layout from '../../components/Layout';
import { aiAPI } from '../../api/generation';
import { Alert, Button, Field, PageHeader, Panel, SectionHeader, Spinner, TextInput, Glyph } from '@aspectum/admin-ui-web';

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
      <PageHeader
        title="Поиск изображений"
        description="Поиск изображений в Wikimedia Commons для городов и достопримечательностей"
      />

      {/* Search Form */}
      <Panel className="p-6 mb-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Поисковый запрос">
              <TextInput
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="напр. «Colosseum Rome architecture»"
              />
            </Field>
            <Field label="Город / контекст">
              <TextInput
                type="text"
                value={cityName}
                onChange={(e) => setCityName(e.target.value)}
                placeholder="напр. «Rome»"
              />
            </Field>
          </div>

          <Field label="Количество результатов">
            <TextInput
              type="number"
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(20, Number(e.target.value))))}
              min={1}
              max={20}
              className="w-24"
            />
          </Field>

          {error && (
            <Alert tone="error">{error}</Alert>
          )}

          <Button
            type="submit"
            disabled={loading || (!query.trim() && !cityName.trim())}
            variant="primary"
            size="md"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Spinner size="sm" className="border-aspectum-on-accent" />
                Поиск...
              </span>
            ) : (
              '🔍 Найти изображения'
            )}
          </Button>
        </form>
      </Panel>

      {/* Results */}
      {images.length > 0 && (
        <div>
          <SectionHeader title={`Найдено: ${images.length}`} size="sm" className="mb-3" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {images.map((img, idx) => (
              <div
                key={img.id || img.url || idx}
                className="bg-aspectum-surface rounded-aspectum-control border border-aspectum-border overflow-hidden shadow-aspectum-card hover:shadow-aspectum-raised transition-shadow group"
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
                      className="absolute inset-0 flex items-center justify-center bg-aspectum-overlay-clear group-hover:bg-aspectum-overlay-soft transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <span className="px-2 py-1 bg-aspectum-surface/90 rounded text-xs font-medium text-aspectum-text-emphasis">
                        Открыть
                      </span>
                    </a>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-xs text-aspectum-text-strong font-medium truncate" title={img.title}>
                    {img.title || '—'}
                  </p>
                  {img.author && (
                    <p className="text-xs text-aspectum-text-disabled truncate">© {img.author}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && images.length === 0 && (
        <Panel className="p-12 text-center">
          <div className="text-5xl mb-4"><Glyph name="🖼" /></div>
          <p className="text-aspectum-text-muted">Введите запрос для поиска изображений</p>
          <p className="text-xs text-aspectum-text-disabled mt-2">
            Поиск выполняется в открытой базе Wikimedia Commons
          </p>
        </Panel>
      )}
    </Layout>
  );
}
