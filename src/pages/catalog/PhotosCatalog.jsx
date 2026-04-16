import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/Layout';
import apiClient from '../../api/client';
import { imagesAPI } from '../../api/generation';

export default function PhotosCatalog() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingImage, setEditingImage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const PAGE_SIZE = 24;

  const loadImages = useCallback(async (pageNum = 1) => {
    try {
      setLoading(true);
      setError(null);
      // Use media/images API endpoint
      const response = await apiClient.get('/media/images/', {
        params: { page: pageNum, page_size: PAGE_SIZE },
      });
      const data = response?.data;
      const list = Array.isArray(data?.results) ? data.results
        : Array.isArray(data) ? data
        : [];
      setImages(list.map((img) => ({
        ...img,
        image_url: img.image_url || img.url || null,
      })));
      setTotalCount(data?.count || list.length);
    } catch (err) {
      // Fallback: endpoint might not support listing; show friendly message
      setError('Список изображений: ' + (err?.response?.data?.error || err.message || 'недоступен'));
      setImages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadImages(page);
  }, [page, loadImages]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editingImage?.id) return;
    try {
      setSaving(true);
      await imagesAPI.update(editingImage.id, { copyright: editingImage.copyright });
      setEditingImage(null);
      await loadImages(page);
    } catch (err) {
      alert(err?.response?.data?.error || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (img) => {
    if (!window.confirm('Удалить изображение?')) return;
    try {
      await imagesAPI.delete(img.id);
      await loadImages(page);
    } catch (err) {
      alert(err?.response?.data?.error || 'Ошибка удаления');
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Фотографии</h1>
          <p className="mt-1 text-sm text-gray-500">Справочник изображений</p>
        </div>
        {totalCount > 0 && (
          <span className="text-sm text-gray-500">Всего: {totalCount}</span>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16 text-gray-500">Загрузка...</div>
      ) : images.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-5xl mb-4">🖼️</div>
          <p className="text-gray-500">Изображений не найдено</p>
          <p className="text-xs text-gray-400 mt-2">
            Изображения добавляются автоматически при создании контента городов и событий
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
            {images.map((img) => (
              <div
                key={img.id}
                className="group relative bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                {img.image_url ? (
                  <img
                    src={img.image_url}
                    alt={img.copyright || `#${img.id}`}
                    className="w-full aspect-square object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full aspect-square bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                    No image
                  </div>
                )}
                <div className="p-2">
                  <p className="text-xs text-gray-500 truncate">{img.copyright || '—'}</p>
                  <p className="text-xs text-gray-300 font-mono">#{img.id}</p>
                </div>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 gap-2">
                  <button
                    onClick={() => setEditingImage({ ...img })}
                    className="p-1.5 bg-white rounded-md shadow text-xs text-gray-700 hover:bg-gray-50"
                    title="Редактировать"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(img)}
                    className="p-1.5 bg-white rounded-md shadow text-xs text-red-600 hover:bg-red-50"
                    title="Удалить"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 py-4">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 text-sm rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">
                ← Предыдущая
              </button>
              <span className="text-sm text-gray-600">{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 text-sm rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">
                Следующая →
              </button>
            </div>
          )}
        </>
      )}

      {/* Edit Modal */}
      {editingImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Редактировать изображение</h2>
              <button onClick={() => setEditingImage(null)} className="text-gray-400 hover:text-gray-600 text-xl font-light">✕</button>
            </div>
            <form onSubmit={handleSave} className="px-6 py-4 space-y-4">
              {editingImage.image_url && (
                <img src={editingImage.image_url} alt="preview"
                  className="w-full max-h-48 object-contain rounded-lg border border-gray-200" />
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Авторское право</label>
                <input
                  type="text"
                  value={editingImage.copyright || ''}
                  onChange={(e) => setEditingImage((p) => ({ ...p, copyright: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="© Author Name"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button type="button" onClick={() => setEditingImage(null)}
                  className="flex-1 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
