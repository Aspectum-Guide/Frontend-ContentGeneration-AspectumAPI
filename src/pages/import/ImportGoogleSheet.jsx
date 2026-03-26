import { useState, useRef, useEffect } from 'react';
import Layout from '../../components/Layout';
import { importAPI } from '../../api/generation';

export default function ImportGoogleSheet() {
  const [sheetUrl, setSheetUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    return () => clearInterval(pollRef.current);
  }, []);

  const pollStatus = (id) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const r = await importAPI.fromSheetsStatus({ job_id: id });
        const data = r?.data;
        setStatus(data);
        if (data?.status === 'done' || data?.status === 'completed' || data?.status === 'error' || data?.status === 'failed') {
          clearInterval(pollRef.current);
          setLoading(false);
        }
      } catch {
        clearInterval(pollRef.current);
        setLoading(false);
      }
    }, 3000);
  };

  const handleImport = async (e) => {
    e.preventDefault();
    if (!sheetUrl.trim()) return;
    try {
      setLoading(true);
      setError(null);
      setStatus(null);
      setJobId(null);

      const r = await importAPI.fromSheets({ sheet_url: sheetUrl.trim() });
      const data = r?.data;

      if (data?.job_id) {
        setJobId(data.job_id);
        setStatus({ status: 'running', message: 'Импорт запущен...' });
        pollStatus(data.job_id);
      } else {
        setStatus({ status: 'done', message: data?.message || 'Импорт завершён' });
        setLoading(false);
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Ошибка импорта');
      setLoading(false);
    }
  };

  const isRunning = loading && jobId;
  const isDone = status?.status === 'done' || status?.status === 'completed';
  const isFailed = status?.status === 'error' || status?.status === 'failed';

  return (
    <Layout>
      <div className="max-w-lg">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Импорт из Google Таблицы</h1>
          <p className="mt-1 text-sm text-gray-500">
            Импорт городов и событий из Google Sheets
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div className="flex items-start gap-4">
            <div className="text-4xl">📊</div>
            <div>
              <h3 className="font-semibold text-gray-900">Google Sheets → База данных</h3>
              <p className="text-sm text-gray-500 mt-1">
                Введите ссылку на таблицу Google Sheets с данными для импорта.
                Таблица должна быть открыта для просмотра.
              </p>
            </div>
          </div>

          <form onSubmit={handleImport} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ссылка на таблицу
              </label>
              <input
                type="url"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                disabled={isRunning}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            {status && (
              <div className={`p-3 border rounded-lg text-sm ${
                isDone ? 'bg-green-50 border-green-200 text-green-700'
                : isFailed ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-blue-50 border-blue-200 text-blue-700'
              }`}>
                <div className="flex items-center gap-2">
                  {isRunning && (
                    <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full" />
                  )}
                  {isDone ? '✅' : isFailed ? '❌' : ''}
                  <span>
                    {status.message || status.status}
                    {status.imported_count != null && ` — загружено: ${status.imported_count}`}
                  </span>
                </div>
                {status.errors?.length > 0 && (
                  <ul className="mt-2 list-disc list-inside space-y-1 text-xs opacity-80">
                    {status.errors.slice(0, 5).map((e, i) => (
                      <li key={i}>{typeof e === 'string' ? e : JSON.stringify(e)}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !sheetUrl.trim()}
              className="w-full py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isRunning ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Импорт выполняется...
                </span>
              ) : (
                '📊 Начать импорт'
              )}
            </button>
          </form>
        </div>

        {/* Import ZIP */}
        <div className="mt-4 bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-2">Импорт из ZIP-архива</h3>
          <p className="text-sm text-gray-500 mb-4">
            Загрузите ZIP-архив с данными городов или событий, экспортированный ранее.
          </p>
          <ImportZip />
        </div>
      </div>
    </Layout>
  );
}

function ImportZip() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      const formData = new FormData();
      formData.append('file', file);
      const r = await importAPI.fromZip(formData);
      setSuccess(r?.data?.message || 'Импорт завершён');
      setFile(null);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Ошибка импорта');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleUpload} className="space-y-3">
      <input
        type="file"
        accept=".zip"
        onChange={(e) => { setFile(e.target.files?.[0] || null); setError(null); setSuccess(null); }}
        className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
      />
      {file && <p className="text-xs text-gray-500">Выбран: {file.name}</p>}
      {error && <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>}
      {success && <div className="p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">✅ {success}</div>}
      <button
        type="submit"
        disabled={!file || loading}
        className="w-full py-2.5 text-sm font-medium text-white bg-gray-700 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Загрузка...' : '📁 Загрузить ZIP'}
      </button>
    </form>
  );
}
