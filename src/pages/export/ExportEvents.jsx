import { useState } from 'react';
import Layout from '../../components/Layout';
import apiClient from '../../api/client';

export default function ExportEvents() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleExport = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      const response = await apiClient.get('/generation/events/export/', {
        responseType: 'blob',
      });

      const contentType = response.headers?.['content-type'] || '';
      const isJson = contentType.includes('json');
      const ext = isJson ? 'json' : 'zip';
      const mimeType = isJson ? 'application/json' : 'application/zip';

      const blob = new Blob([response.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `events-export-${new Date().toISOString().slice(0, 10)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setSuccess(true);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Ошибка экспорта');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-lg">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Экспорт событий</h1>
          <p className="mt-1 text-sm text-gray-500">
            Скачать данные всех событий
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="mb-6">
            <div className="flex items-start gap-4">
              <div className="text-4xl">🎪</div>
              <div>
                <h3 className="font-semibold text-gray-900">Экспорт событий</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Экспортирует все события с многоязычными данными, привязками к городам и медиафайлами.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              ✅ Файл успешно скачан
            </div>
          )}

          <button
            onClick={handleExport}
            disabled={loading}
            className="w-full py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Подготовка...
              </span>
            ) : (
              '⬇ Скачать события'
            )}
          </button>
        </div>
      </div>
    </Layout>
  );
}
