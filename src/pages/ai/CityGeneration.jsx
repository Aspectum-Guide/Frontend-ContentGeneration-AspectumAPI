import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { aiAPI, tasksAPI } from '../../api/generation';
import AiGenerationQualitySettings, {
  DEFAULT_GENERATION_MODE,
  buildGenerationPayloadFields,
} from '../../components/generation/AiGenerationQualitySettings.jsx';
import AiGenerationCountField from '../../components/generation/AiGenerationCountField.jsx';
import { clampGenerationCount } from '../../components/generation/AiGenerationCountField.jsx';
import {
  pollGenerationTask,
  isPollCancelledError,
  TASK_NOT_FOUND_MESSAGE,
} from '../../utils/generationTaskPoll';

const POLL_INTERVAL = 4000;
const POLL_MAX_WAIT_MS = 20 * 60 * 1000;

const SOURCE_LANGUAGES = [
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
  { value: 'it', label: 'Italiano' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
];

function getLocalizedText(value, preferredLanguage = 'ru', fallback = '—') {
  if (value == null) return fallback;

  if (typeof value === 'string' || typeof value === 'number') {
    const text = String(value).trim();
    return text || fallback;
  }

  if (Array.isArray(value)) {
    const first = value.find(Boolean);
    return first ? getLocalizedText(first, preferredLanguage, fallback) : fallback;
  }

  if (typeof value === 'object') {
    if (value[preferredLanguage]) {
      return String(value[preferredLanguage]).trim() || fallback;
    }

    const preferredKeys = ['ru', 'en', 'it', 'fr', 'de', 'es'];
    for (const key of preferredKeys) {
      if (value[key]) return String(value[key]).trim();
    }

    const firstNonEmpty = Object.values(value).find(
      (v) => typeof v === 'string' && v.trim()
    );

    return firstNonEmpty ? String(firstNonEmpty).trim() : fallback;
  }

  return fallback;
}

export default function CityGeneration() {
  const navigate = useNavigate();

  const [prompt, setPrompt] = useState('');
  const [requestedCount, setRequestedCount] = useState(5);
  const [provider, setProvider] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('ru');
  const [generationMode, setGenerationMode] = useState(DEFAULT_GENERATION_MODE);
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [advancedGenerationAvailable, setAdvancedGenerationAvailable] = useState(true);

  const [loading, setLoading] = useState(false);
  const [taskId, setTaskId] = useState(null);
  const [taskStatus, setTaskStatus] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [creatingSessions, setCreatingSessions] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(null);

  const pollCancelledRef = useRef(false);
  const generationInFlightRef = useRef(false);

  useEffect(() => {
    return () => {
      pollCancelledRef.current = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await aiAPI.getSettings();
        if (cancelled) return;

        const caps = response?.data?.generation_capabilities || {};
        const providerName = String(response?.data?.provider || '').toLowerCase();
        const isOllama = providerName === 'ollama';
        const advancedAvailable = !isOllama && caps.thinking_modes !== false;

        setAdvancedGenerationAvailable(advancedAvailable);
        if (!advancedAvailable) {
          setGenerationMode(DEFAULT_GENERATION_MODE);
          setUseWebSearch(false);
        }
      } catch {
        if (!cancelled) {
          setAdvancedGenerationAvailable(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const runPoll = async (id) => {
    pollCancelledRef.current = false;
    try {
      const task = await pollGenerationTask(id, {
        tasksAPI,
        intervalMs: POLL_INTERVAL,
        maxWaitMs: POLL_MAX_WAIT_MS,
        isCancelled: () => pollCancelledRef.current,
        onProgress: (data) => setTaskStatus(data),
      });
      setTaskStatus(task);
      if (task?.result_data) {
        setResult(task.result_data);
      }
    } catch (err) {
      if (isPollCancelledError(err)) {
        return;
      }
      const message = err?.message || TASK_NOT_FOUND_MESSAGE;
      setError(message);
      setTaskStatus((prev) => ({
        ...(prev || {}),
        status: 'failed',
        error_message: message,
        current_step: `Ошибка: ${message}`,
      }));
      setTaskId(null);
    } finally {
      setLoading(false);
      generationInFlightRef.current = false;
    }
  };

  const handleStart = async (e) => {
    e.preventDefault();

    if (!prompt.trim() || loading || generationInFlightRef.current) return;

    generationInFlightRef.current = true;
    pollCancelledRef.current = false;
    setLoading(true);
    setError(null);
    setResult(null);
    setTaskStatus(null);
    setTaskId(null);
    setSaveSuccess(null);

    try {
      const payload = {
        prompt: prompt.trim(),
        requested_count: clampGenerationCount(requestedCount, 'cities'),
        with_images: false,
        source_language: sourceLanguage,
        ...(provider ? { provider } : {}),
        ...buildGenerationPayloadFields(generationMode, useWebSearch),
      };

      const r = await aiAPI.citiesJsonStart(payload);
      const data = r?.data;
      const id = data?.task_id || data?.id;

      if (id) {
        setTaskId(id);
        setTaskStatus({
          status: 'processing',
          progress: 0,
          current_step: 'Запуск...',
        });
        await runPoll(id);
      } else {
        setResult(data);
        setLoading(false);
        generationInFlightRef.current = false;
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Ошибка генерации');
      setLoading(false);
      setTaskId(null);
      generationInFlightRef.current = false;
    }
  };

  useEffect(() => {
    if (taskStatus?.status === 'completed' && taskStatus?.result_data) {
      setResult(taskStatus.result_data);
      setResultModalOpen(true);
    }
  }, [taskStatus]);

  const resultCities = Array.isArray(result?.data) ? result.data : [];
  const cityCount = resultCities.length;
  const resultSourceLanguage = result?.source_language || sourceLanguage || 'ru';

  const handleCreateSessions = async () => {
    if (!taskId) return;

    try {
      setCreatingSessions(true);
      setError(null);

      const response = await aiAPI.citiesTaskCreateSessions(taskId);
      const data = response?.data || {};
      const firstSessionId = data?.session?.id || data?.session?.uuid;

      setSaveSuccess(`Сохранено. Черновиков городов добавлено: ${data?.count || 0}`);

      if (firstSessionId) {
        navigate(`/generation/${firstSessionId}`);
      } else {
        navigate('/generation');
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Не удалось создать сессии');
    } finally {
      setCreatingSessions(false);
    }
  };

  const isRunning = loading;
  const isDone = taskStatus?.status === 'completed';
  const isFailed = taskStatus?.status === 'failed';
  const progress = taskStatus?.progress ?? null;

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Генерация городов</h1>
        <p className="mt-1 text-sm text-gray-500">
          Первичная генерация данных городов с помощью ИИ на одном исходном языке
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Параметры генерации
          </h2>

          <form onSubmit={handleStart} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Промпт для генерации
              </label>

              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={8}
                placeholder="Например: города Италии для культурного туризма с кратким описанием"
                disabled={isRunning}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-50"
              />

              <p className="text-xs text-gray-400 mt-1">
                Количество задаётся отдельным полем ниже — не нужно писать число в промпте.
              </p>
            </div>

            <AiGenerationCountField
              id="city-gen-count"
              label="Количество городов"
              value={requestedCount}
              onChange={setRequestedCount}
              generationType="cities"
              disabled={isRunning}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Язык первичной генерации
              </label>

              <select
                value={sourceLanguage}
                onChange={(e) => setSourceLanguage(e.target.value)}
                disabled={isRunning}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {SOURCE_LANGUAGES.map((language) => (
                  <option key={language.value} value={language.value}>
                    {language.label}
                  </option>
                ))}
              </select>

              <p className="text-xs text-gray-400 mt-1">
                Модель должна вернуть поля name, description и country только с этим языковым ключом.
              </p>
            </div>

            <AiGenerationQualitySettings
              generationMode={generationMode}
              onGenerationModeChange={setGenerationMode}
              useWebSearch={useWebSearch}
              onUseWebSearchChange={setUseWebSearch}
              disabled={isRunning}
              advancedDisabled={!advancedGenerationAvailable}
            />

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

            {saveSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                {saveSuccess}
              </div>
            )}

            <button
              type="submit"
              disabled={isRunning || !prompt.trim()}
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
          {taskStatus && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">
                Статус задачи
              </h2>

              <div className="flex items-center justify-between mb-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    isDone
                      ? 'bg-green-100 text-green-800'
                      : isFailed
                        ? 'bg-red-100 text-red-800'
                        : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {isRunning && (
                    <span className="animate-spin inline-block w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full" />
                  )}
                  {isDone ? '✅ Завершено' : isFailed ? '❌ Ошибка' : '⏳ Выполняется'}
                </span>

                {progress != null && (
                  <span className="text-sm text-gray-500">{progress}%</span>
                )}
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

      {resultModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !creatingSessions && setResultModalOpen(false)}
          />

          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Результат генерации
            </h3>

            <p className="text-sm text-gray-700">
              Города найдены: <span className="font-semibold">{cityCount}</span>
            </p>

            <p className="text-xs text-gray-500">
              Язык первичной генерации: <span className="font-semibold">{resultSourceLanguage}</span>
            </p>

            <div className="max-h-56 overflow-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
              {resultCities.length === 0 ? (
                <p className="text-sm text-gray-500">Список городов пуст</p>
              ) : (
                <ul className="text-sm text-gray-700 space-y-1">
                  {resultCities.map((item, idx) => {
                    const city = item?.city || item || {};
                    const name = getLocalizedText(city?.name, resultSourceLanguage);
                    const country = getLocalizedText(city?.country, resultSourceLanguage);

                    return (
                      <li key={idx}>
                        {idx + 1}. {name} ({country})
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={creatingSessions}
                onClick={() => setResultModalOpen(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Отмена
              </button>

              <button
                type="button"
                disabled={creatingSessions || cityCount === 0}
                onClick={handleCreateSessions}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {creatingSessions ? 'Создание...' : 'Создать черновики в сессии'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}