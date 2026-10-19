import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { aiAPI, tasksAPI } from '../../api/generation';
import AiGenerationQualitySettings from '../../components/generation/AiGenerationQualitySettings.jsx';
import {
  DEFAULT_GENERATION_MODE,
  buildGenerationPayloadFields,
  clampGenerationCount,
} from '../../components/generation/generationUtils';
import {
  Alert,
  Button,
  Field,
  Modal,
  PageHeader,
  Panel,
  ProgressBar,
  SectionHeader,
  Select,
  Spinner,
  Textarea, Glyph } from '@aspectum/ui';
import AiGenerationCountField from '../../components/generation/AiGenerationCountField.jsx';
import { useAppLanguages } from '../../hooks/useAppLanguages';
import {
  pollGenerationTask,
  isPollCancelledError,
  TASK_NOT_FOUND_MESSAGE,
} from '../../utils/generationTaskPoll';

const POLL_INTERVAL = 4000;
const POLL_MAX_WAIT_MS = 20 * 60 * 1000;

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
  const { languages: appLanguages } = useAppLanguages();

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
      <PageHeader
        title="Генерация городов"
        description="Первичная генерация данных городов с помощью ИИ на одном исходном языке"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <Panel className="p-6">
          <SectionHeader title="Параметры генерации" size="sm" className="mb-4" />

          <form onSubmit={handleStart} className="space-y-4">
            <Field label="Промпт для генерации" hint="Количество задаётся отдельным полем ниже — не нужно писать число в промпте.">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={8}
                placeholder="Например: города Италии для культурного туризма с кратким описанием"
                disabled={isRunning}
              />
            </Field>

            <AiGenerationCountField
              id="city-gen-count"
              label="Количество городов"
              value={requestedCount}
              onChange={setRequestedCount}
              generationType="cities"
              disabled={isRunning}
            />

            <Field label="Язык первичной генерации" hint="Модель должна вернуть поля name, description и country только с этим языковым ключом.">
              <Select
                value={sourceLanguage}
                onChange={(e) => setSourceLanguage(e.target.value)}
                disabled={isRunning}
              >
                {appLanguages.map((language) => (
                  <option key={language.code} value={language.code}>
                    {language.label || language.name || language.code}
                  </option>
                ))}
              </Select>
            </Field>

            <AiGenerationQualitySettings
              generationMode={generationMode}
              onGenerationModeChange={setGenerationMode}
              useWebSearch={useWebSearch}
              onUseWebSearchChange={setUseWebSearch}
              disabled={isRunning}
              advancedDisabled={!advancedGenerationAvailable}
            />

            <Field label="Провайдер ИИ (по умолчанию)">
              <Select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                disabled={isRunning}
              >
                <option value="">По умолчанию</option>
                <option value="openai">OpenAI</option>
                <option value="ollama">Ollama (локально)</option>
              </Select>
            </Field>

            {error && (
              <Alert tone="error">{error}</Alert>
            )}

            {saveSuccess && (
              <Alert tone="success">{saveSuccess}</Alert>
            )}

            <Button
              type="submit"
              disabled={isRunning || !prompt.trim()}
              variant="primary"
              size="md"
              className="w-full"
            >
              {isRunning ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner size="sm" className="border-aspectum-on-accent" />
                  Генерация...
                </span>
              ) : (
                '🤖 Запустить генерацию'
              )}
            </Button>
          </form>
        </Panel>

        {/* Status & Result */}
        <div className="space-y-4">
          {taskStatus && (
            <Panel className="p-6">
              <SectionHeader title="Статус задачи" size="sm" className="mb-4" />

              <div className="flex items-center justify-between mb-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    isDone
                      ? 'bg-aspectum-positive-muted text-aspectum-positive-emphasis'
                      : isFailed
                        ? 'bg-aspectum-danger-muted text-aspectum-danger-emphasis'
                        : 'bg-aspectum-primary-muted text-aspectum-primary-strong'
                  }`}
                >
                  {isRunning && (
                    <Spinner size="xs" className="w-2.5 h-2.5 border-2 border-current" />
                  )}
                  {isDone ? <><Glyph name="✅" /> Завершено</> : isFailed ? <><Glyph name="❌" /> Ошибка</> : <><Glyph name="⏳" /> Выполняется</>}
                </span>

                {progress != null && (
                  <span className="text-sm text-aspectum-text-muted">{progress}%</span>
                )}
              </div>

              {progress != null && (
                <ProgressBar value={progress} tone="focus" label="Прогресс генерации города" className="mb-3" />
              )}

              {taskStatus.current_step && (
                <p className="text-sm text-aspectum-text-subtle">{taskStatus.current_step}</p>
              )}

              {taskStatus.error_message && (
                <p className="text-sm text-aspectum-danger mt-2">{taskStatus.error_message}</p>
              )}
            </Panel>
          )}

          {result && (
            <Panel className="p-6">
              <SectionHeader
                title="Результат"
                size="sm"
                className="mb-3"
                actions={(
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
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
                  >
                    <Glyph name="⬇" /> Скачать JSON
                  </Button>
                )}
              />

              <pre className="text-xs bg-aspectum-surface-muted rounded-aspectum-control p-3 overflow-auto max-h-64 text-aspectum-text-strong">
                {JSON.stringify(result, null, 2)}
              </pre>
            </Panel>
          )}
        </div>
      </div>

      <Modal
        open={resultModalOpen}
        onClose={creatingSessions ? undefined : () => setResultModalOpen(false)}
        title="Результат генерации"
        size="lg"
        footer={(
          <>
            <Button
              type="button"
              disabled={creatingSessions}
              onClick={() => setResultModalOpen(false)}
              variant="outline"
              size="md"
            >
              Отмена
            </Button>
            <Button
              type="button"
              disabled={creatingSessions || cityCount === 0}
              onClick={handleCreateSessions}
              variant="primary"
              size="md"
            >
              {creatingSessions ? 'Создание...' : 'Создать черновики в сессии'}
            </Button>
          </>
        )}
      >
        <div className="space-y-4">
            <p className="text-sm text-aspectum-text-strong">
              Города найдены: <span className="font-semibold">{cityCount}</span>
            </p>

            <p className="text-xs text-aspectum-text-muted">
              Язык первичной генерации: <span className="font-semibold">{resultSourceLanguage}</span>
            </p>

            <div className="max-h-56 overflow-auto border border-aspectum-border rounded-aspectum-control p-3 bg-aspectum-surface-muted">
              {resultCities.length === 0 ? (
                <p className="text-sm text-aspectum-text-muted">Список городов пуст</p>
              ) : (
                <ul className="text-sm text-aspectum-text-strong space-y-1">
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
        </div>
      </Modal>
    </Layout>
  );
}
