import { useState, useEffect, useRef, useCallback } from 'react';
import Layout from '../../components/Layout';
import { eventsAPI } from '../../api/generation';

const POLL_INTERVAL = 4000;

function getMultiLang(val) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  return val.ru || val.en || val.it || Object.values(val).find(Boolean) || '';
}

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  running: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

export default function EventGeneration() {
  const [cities, setCities] = useState([]);
  const [filters, setFilters] = useState([]);
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedFilters, setSelectedFilters] = useState([]);
  const [count, setCount] = useState(5);
  const [languages, setLanguages] = useState(['ru', 'en']);
  const [includeMedia, setIncludeMedia] = useState(true);
  const [loading, setLoading] = useState(false);
  const [taskId, setTaskId] = useState(null);
  const [taskStatus, setTaskStatus] = useState(null);
  const [error, setError] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const pollRef = useRef(null);

  const loadCities = useCallback(async () => {
    try {
      const r = await eventsAPI.cities();
      const data = r?.data;
      const list = Array.isArray(data?.cities) ? data.cities
        : Array.isArray(data) ? data : [];
      setCities(list);
    } catch {}
  }, []);

  const loadFilters = useCallback(async () => {
    try {
      const r = await eventsAPI.filtersReference();
      const data = r?.data;
      const list = Array.isArray(data?.filters) ? data.filters
        : Array.isArray(data) ? data : [];
      setFilters(list);
    } catch {}
  }, []);

  const loadTasks = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoadingTasks(true);
      const r = await eventsAPI.generateTasks();
      const data = r?.data;
      const list = Array.isArray(data?.tasks) ? data.tasks
        : Array.isArray(data) ? data : [];
      setTasks(list);
    } catch {}
    finally { if (!silent) setLoadingTasks(false); }
  }, []);

  useEffect(() => {
    loadCities();
    loadFilters();
    loadTasks();
    return () => clearInterval(pollRef.current);
  }, [loadCities, loadFilters, loadTasks]);

  const pollTask = (id) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const r = await eventsAPI.generateStatus(id);
        const data = r?.data;
        setTaskStatus(data);
        loadTasks(true);
        if (data?.status === 'completed' || data?.status === 'failed' || data?.status === 'cancelled') {
          clearInterval(pollRef.current);
          setLoading(false);
        }
      } catch {
        clearInterval(pollRef.current);
        setLoading(false);
      }
    }, POLL_INTERVAL);
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!selectedCity) return;
    try {
      setLoading(true);
      setError(null);
      setTaskStatus(null);
      setTaskId(null);

      const payload = {
        city_id: selectedCity,
        count,
        languages,
        include_media: includeMedia,
        ...(selectedFilters.length > 0 ? { filter_ids: selectedFilters } : {}),
      };

      const r = await eventsAPI.generate(payload);
      const data = r?.data;
      const id = data?.task_id || data?.id;

      if (id) {
        setTaskId(id);
        setTaskStatus({ status: 'running', progress: 0, current_step: 'Запущено...' });
        pollTask(id);
        loadTasks(true);
      } else {
        setLoading(false);
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Ошибка запуска генерации');
      setLoading(false);
    }
  };

  const toggleFilter = (id) => {
    setSelectedFilters((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const toggleLanguage = (lang) => {
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
  };

  const isRunning = loading && taskId;
  const isDone = taskStatus?.status === 'completed';
  const isFailed = taskStatus?.status === 'failed';

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Генерация событий</h1>
        <p className="mt-1 text-sm text-gray-500">
          Автоматическая генерация данных событий для городов с помощью ИИ
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Параметры генерации</h2>
          <form onSubmit={handleGenerate} className="space-y-4">
            {/* City */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Город <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                disabled={isRunning}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Выберите город...</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {getMultiLang(c.name) || c.id}
                  </option>
                ))}
              </select>
            </div>

            {/* Count */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Количество событий
              </label>
              <input
                type="number"
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value))))}
                min={1}
                max={50}
                disabled={isRunning}
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Languages */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Языки генерации
              </label>
              <div className="flex flex-wrap gap-2">
                {['ru', 'en', 'it', 'de', 'fr', 'es'].map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => toggleLanguage(lang)}
                    disabled={isRunning}
                    className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                      languages.includes(lang)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-blue-300'
                    }`}
                  >
                    {lang.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Filters */}
            {filters.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Типы событий
                </label>
                <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                  {filters.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => toggleFilter(f.id)}
                      disabled={isRunning}
                      className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                        selectedFilters.includes(f.id)
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-purple-300'
                      }`}
                    >
                      {getMultiLang(f.name) || f.slug || f.id}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Include media */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeMedia}
                onChange={(e) => setIncludeMedia(e.target.checked)}
                disabled={isRunning}
                className="w-4 h-4 rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm font-medium text-gray-700">
                Искать изображения для событий
              </span>
            </label>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isRunning || !selectedCity}
              className="w-full py-3 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isRunning ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Генерация...
                </span>
              ) : (
                '🎪 Запустить генерацию событий'
              )}
            </button>
          </form>
        </div>

        {/* Status + Tasks */}
        <div className="space-y-4">
          {/* Current task status */}
          {taskStatus && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-base font-semibold text-gray-900 mb-3">Текущая задача</h2>
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
                {taskStatus.progress != null && (
                  <span className="text-sm text-gray-500">{taskStatus.progress}%</span>
                )}
              </div>
              {taskStatus.progress != null && (
                <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                  <div
                    className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${taskStatus.progress}%` }}
                  />
                </div>
              )}
              {taskStatus.current_step && (
                <p className="text-sm text-gray-600">{taskStatus.current_step}</p>
              )}
              {isDone && taskStatus.result?.count != null && (
                <p className="text-sm text-green-700 mt-2">
                  ✅ Сгенерировано событий: {taskStatus.result.count}
                </p>
              )}
            </div>
          )}

          {/* Tasks history */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">История задач</h2>
              <button
                onClick={() => loadTasks()}
                className="px-2.5 py-1 text-xs text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Обновить
              </button>
            </div>
            {loadingTasks ? (
              <div className="p-6 text-center text-sm text-gray-500">Загрузка...</div>
            ) : tasks.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">Задач нет</div>
            ) : (
              <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                {tasks.map((t) => (
                  <div key={t.id} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {t.city_name || getMultiLang(t.city?.name) || '—'}
                      </div>
                      <div className="text-xs text-gray-400">
                        {t.created_at ? new Date(t.created_at).toLocaleString('ru-RU') : ''}
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[t.status] || 'bg-gray-100 text-gray-600'}`}>
                      {t.status_display || t.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
