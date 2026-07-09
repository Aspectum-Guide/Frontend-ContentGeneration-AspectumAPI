import { useCallback, useRef, useState } from 'react';
import { aiAPI, tasksAPI } from '../../../api/generation';
import { pollGenerationTask } from '../../../utils/generationTaskPoll';

/**
 * Панель «Сгенерировать город целиком» — одно действие вместо ручной беготни
 * по шагам визарда. Дёргает оркестратор (parent GenerationTask + ThreadPool DAG):
 * база города → (параллельно) полезная инфа + достопримечательности →
 * (параллельно) инфо по каждой достопримечательности.
 *
 * Провайдер/модель/поиск на каждом листе резолвит бэкенд (routing.resolve_route,
 * hot-swap без редеплоя). Аудиогиды и интерактивные локации сюда не входят.
 *
 * Props:
 *   sessionId   — UUID сессии
 *   defaultLang — язык по умолчанию (напр. 'ru')
 *   onDone      — вызывается после успешной генерации (перезагрузить сессию)
 */
export default function SessionWizardGenerateCityFull({ sessionId, defaultLang = 'ru', onDone }) {
  const [prompt, setPrompt] = useState('');

  const [running, setRunning] = useState(false);
  const [task, setTask] = useState(null);
  const [error, setError] = useState('');
  const [doneSummary, setDoneSummary] = useState(null);
  const cancelledRef = useRef(false);

  const start = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed || running) return;
    setError('');
    setDoneSummary(null);
    setTask(null);
    setRunning(true);
    cancelledRef.current = false;

    try {
      const { data } = await aiAPI.generateCityFull(sessionId, {
        prompt: trimmed,
        lang: defaultLang,
        // Объём (достопр., инфа) полностью решает система по найденным данным
        // (до 70 основных для обычного города; больше — если промт указывает).
        // Веб-поиск автономный (research через Brave).
      });
      const taskId = data?.task_id;
      if (!taskId) throw new Error('Бэкенд не вернул task_id');

      const finalTask = await pollGenerationTask(taskId, {
        tasksAPI,
        intervalMs: 2000,
        maxWaitMs: 30 * 60 * 1000, // город целиком может генерироваться долго
        isCancelled: () => cancelledRef.current,
        onProgress: (t) => setTask(t),
      });

      setDoneSummary({
        ...(finalTask?.result_data?.summary || {}),
        cost: finalTask?.result_data?.cost_summary || null,
      });
      if (typeof onDone === 'function') {
        await onDone();
      }
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Ошибка генерации');
    } finally {
      setRunning(false);
    }
  }, [prompt, running, sessionId, defaultLang, onDone]);

  const progress = Math.max(0, Math.min(100, Number(task?.progress) || 0));
  const summary = task?.result_data?.summary || {};

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-indigo-900">
            ⚡ Сгенерировать город целиком
          </h3>
          <p className="mt-0.5 text-xs text-indigo-700/80">
            Одно действие: база города → полезная инфа + достопримечательности →
            инфо по каждой (параллельно). Аудиогиды не входят.
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={running}
          rows={2}
          placeholder="Напр.: Суздаль, Владимирская область, Россия — исторический туристический город"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:bg-gray-100"
        />

        <div className="flex flex-wrap items-end gap-3">
          <span className="text-[11px] text-gray-400 self-center max-w-[340px]">
            Объём (достопримечательности, полезная инфа) система подбирает сама по
            найденным данным. Для большого города укажи это в запросе.
          </span>

          <button
            type="button"
            onClick={start}
            disabled={running || !prompt.trim()}
            className="ml-auto rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? 'Генерация…' : 'Запустить'}
          </button>
        </div>

        {running && (
          <div className="space-y-1.5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-indigo-100">
              <div className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                style={{ width: `${progress}%` }} />
            </div>
            <div className="flex justify-between text-xs text-indigo-800">
              <span>{task?.current_step || 'Запуск…'}</span>
              <span>
                {summary?.children_done != null && summary?.children_total
                  ? `${summary.children_done}/${summary.children_total} шагов · `
                  : ''}
                {progress}%
              </span>
            </div>
          </div>
        )}

        {doneSummary && !running && (
          <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
            Готово. Шагов: {doneSummary.children_done ?? '—'}/{doneSummary.children_total ?? '—'}
            {doneSummary.children_failed ? `, с ошибками: ${doneSummary.children_failed}` : ''}.
            {doneSummary.cost && doneSummary.cost.total_usd != null && (
              <> Стоимость: <b>${Number(doneSummary.cost.total_usd).toFixed(4)}</b>
                {doneSummary.cost.total_tokens
                  ? ` (${doneSummary.cost.total_tokens.toLocaleString()} токенов)`
                  : ''}.</>
            )}
            {' '}Данные обновлены ниже.
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

function NumField({ label, value, onChange, disabled }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-gray-700">
      <span>{label}</span>
      <input
        type="number"
        min={1}
        max={50}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:bg-gray-100"
      />
    </label>
  );
}
