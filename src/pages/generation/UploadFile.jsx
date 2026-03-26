import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import apiClient from '../../api/client';

export default function UploadFile() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const inputRef = useRef(null);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const text = await file.text();
      const response = await apiClient.post('/generation/sessions/upload/', text, {
        headers: { 'Content-Type': 'application/json' },
      });
      const data = response?.data;

      setSuccess(data?.message || 'Файл успешно загружен');
      const sessionId = data?.session?.id || data?.session?.uuid || data?.session_id;
      if (sessionId) {
        setTimeout(() => navigate(`/generation/${sessionId}`), 1000);
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Ошибка загрузки файла');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) setFile(droppedFile);
  };

  return (
    <Layout>
      <div className="max-w-lg">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Загрузить из файла</h1>
          <p className="mt-1 text-sm text-gray-500">
            Загрузка данных сессии генерации из JSON-файла
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <form onSubmit={handleUpload} className="space-y-4">
            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              <input
                ref={inputRef}
                type="file"
                accept=".json"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <div className="text-4xl mb-3">{file ? '📄' : '📂'}</div>
              {file ? (
                <div>
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-400 mt-1">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-gray-700 font-medium">Нажмите или перетащите файл</p>
                  <p className="text-sm text-gray-400 mt-1">JSON-файл с данными города</p>
                </div>
              )}
            </div>

            {file && (
              <button
                type="button"
                onClick={() => setFile(null)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Убрать файл
              </button>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                ✅ {success}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={!file || loading}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Загрузка...
                  </span>
                ) : (
                  '⬆ Загрузить'
                )}
              </button>
              <button
                type="button"
                onClick={() => navigate('/generation')}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
