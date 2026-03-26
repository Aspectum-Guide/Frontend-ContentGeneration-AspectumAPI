import { useState, useRef, useEffect } from 'react';
import Layout from '../../components/Layout';
import { aiAPI, tasksAPI } from '../../api/generation';

const POLL_INTERVAL = 4000;

export default function CityGeneration() {
  const [cityList, setCityList] = useState('');
  const [provider, setProvider] = useState('');
  const [loading, setLoading] = useState(false);
  const [taskId, setTaskId] = useState(null);
  const [taskStatus, setTaskStatus] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    return () => clearInterval(pollRef.current);
  }, []);

  const pollTask = (id) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const r = await tasksAPI.get(id);
        const data = r?.data;
        setTaskStatus(data);
        if (data?.status === 'completed' || data?.status === 'failed' || data?.status === 'cancelled') {
          clearInterval(pollRef.current);
          setLoading(false);
          if (data?.status === 'completed' && data?.result_data) {
            setResult(data.result_data);
          }
        }
      } catch {
        clearInterval(pollRef.current);
        setLoading(false);
      }
    }, POLL_INTERVAL);
  };

  const handleStart = async (e) => {
    e.preventDefault();
    if (!cityList.trim()) return;
    try {
      setLoading(true);
      setError(null);
      setResult(null);
      setTaskStatus(null);
      setTaskId(null);

      const cities = cityList
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      const payload = {
        cities,
        ...(provider ? { provider } : {}),
      };

      const r = await aiAPI.citiesJsonStart(payload);
      const data = r?.data;
      const id = data?.task_id || data?.id;

      if (id) {
        setTaskId(id);
        setTaskStatus({ status: 'running', progress: 0, current_step: 'Запуск...' });
        pollTask(id);
      } else {
        setResult(data);
        setLoading(false);
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Ошибка генерации');
      setLoading(false);
    }
  };

  const isRunning = loading && taskId;
  const isDone = taskStatus?.status === 'completed';
  const isFailed = taskStatus?.status === 'failed';
  const progress = taskStatus?.progress ?? null;

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Генерация городов</h1>
        <p className="mt-1 text-sm text-gray-500">
          Автоматическая генерация данных городов с помощью ИИ
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Параметры генерации</h2>
          <form onSubmit={handleStart} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Список городов <span className="text-gray-400 font-normal">(по одному на строку)</span>
              </label>
              <textarea
                value={cityList}
                onChange={(e) => setCityList(e.target.value)}
                rows={8}
                placeholder={'Рим, Италия\nПариж, Франция\nБерлин, Германия'}
                disabled={isRunning}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-50"
              />
              <p className="text-xs text-gray-400 mt-1">
                {cityList.split('\n').filter((l) => l.trim()).length} городов
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Провайдер ИИ <span className="text-gray-400 font-normal">(по умолчанию)</span>
              </label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                disabled={isRunning}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">По умолчанию</option>
                <option value="openai">OpenAI</option>
                <option value="ollama">Ollama (локально)</option>
              </select>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isRunning || !cityList.trim()}
              className="w-full py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isRunning ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Генерация...
                </span>
              ) : (
                '🤖 Запустить генерацию'
              )}
            </button>
          </form>
        </div>

        {/* Status & Result */}
        <div className="space-y-4">
          {/* Task Status */}
          {taskStatus && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Статус задачи</h2>

              <div className="flex items-center justify-between mb-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  isDone ? 'bg-green-100 text-green-800'
                  : isFailed ? 'bg-red-100 text-red-800'
                  : 'bg-blue-100 text-blue-800'
                }`}>
                  {isRunning && (
                    <span className="animate-spin inline-block w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full" />
                  )}
                  {isDone ? '✅ Завершено' : isFailed ? '❌ Ошибка' : '⏳ Выполняется'}
                </span>
                {progress != null && <span className="text-sm text-gray-500">{progress}%</span>}
              </div>

              {progress != null && (
                <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}

              {taskStatus.current_step && (
                <p className="text-sm text-gray-600">{taskStatus.current_step}</p>
              )}
              {taskStatus.error_message && (
                <p className="text-sm text-red-600 mt-2">{taskStatus.error_message}</p>
              )}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-gray-900">Результат</h2>
                <button
                  onClick={() => {
                    const json = JSON.stringify(result, null, 2);
                    const blob = new Blob([json], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `cities-${Date.now()}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  ⬇ Скачать JSON
                </button>
              </div>
              <pre className="text-xs bg-gray-50 rounded-lg p-3 overflow-auto max-h-64 text-gray-700">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
