import { useCallback, useEffect, useRef, useState } from 'react';
import { aiAPI, tasksAPI } from '../../../api/generation';
import { pollGenerationTask } from '../../../utils/generationTaskPoll';

/**
 * Панель «Сгенерировать город целиком» — одно действие вместо ручной беготни
 * по шагам визарда. Дёргает оркестратор (parent GenerationTask + ThreadPool DAG).
 *
 * Устойчивость: генерация живёт на бэкенде и НЕ зависит от вкладки. После
 * обновления страницы панель сама находит активную задачу (cityFullActive)
 * и возобновляет поллинг; остановить генерацию можно только кнопкой «Стоп»
 * (cityFullCancel — оркестратор останавливается на ближайшем чекпоинте).
 * Поллинг переживает сетевые сбои (retry в pollGenerationTask).
 *
 * Props:
 *   sessionId   — UUID сессии
 *   defaultLang — язык по умолчанию (напр. 'ru')
 *   onDone      — вызывается после успешной генерации (перезагрузить сессию)
 */
export default function SessionWizardGenerateCityFull({ sessionId, defaultLang = 'ru', onDone }) {
  const [prompt, setPrompt] = useState('');
  const [bigCity, setBigCity] = useState(false);
  const [testMode, setTestMode] = useState(false);

  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [task, setTask] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(''); // нейтральные сообщения (отмена и т.п.)
  const [doneSummary, setDoneSummary] = useState(null);
  const [cost, setCost] = useState(null); // {total_usd, total_tokens, calls} по всей сессии
  const attachedRef = useRef(null); // task_id, к которому уже присоединён поллинг

  // Совокупная стоимость сессии (город целиком + перегенерации отдельных юнитов).
  // Не пропадает после завершения — показываем под полосой всегда, когда есть расход.
  const refreshCost = useCallback(async () => {
    if (!sessionId) return;
    try {
      const { data } = await aiAPI.sessionGenerationCost(sessionId);
      setCost(data || null);
    } catch {
      /* стоимость — вспомогательная, ошибки не мешают генерации */
    }
  }, [sessionId]);

  useEffect(() => {
    refreshCost();
  }, [refreshCost]);

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(refreshCost, 3000);
    return () => clearInterval(id);
  }, [running, refreshCost]);

  /**
   * Присоединяет панель к задаче (новой или найденной после обновления страницы)
   * и ведёт поллинг до терминального статуса. Единственная точка завершения.
   */
  const attach = useCallback(
    async (taskId) => {
      if (!taskId || attachedRef.current === taskId) return;
      attachedRef.current = taskId;
      setError('');
      setNotice('');
      setDoneSummary(null);
      setRunning(true);

      try {
        const finalTask = await pollGenerationTask(taskId, {
          tasksAPI,
          intervalMs: 2000,
          // Большой город (150 достопр. + 300 ИЛ + аудио/фото) может идти часами —
          // не сдаёмся раньше бэкенда (его zombie-sweep сам добьёт мёртвую задачу).
          maxWaitMs: 6 * 60 * 60 * 1000,
          onProgress: (t) => setTask(t),
        });

        setDoneSummary({
          ...(finalTask?.result_data?.summary || {}),
          cost: finalTask?.result_data?.cost_summary || null,
          issues: finalTask?.result_data?.issues || [],
        });
        if (typeof onDone === 'function') {
          await onDone();
        }
      } catch (err) {
        const msg = err?.response?.data?.error || err?.message || 'Ошибка генерации';
        if (msg === 'Генерация отменена.' || /отмен|остановлен/i.test(msg)) {
          setNotice('Генерация остановлена. Созданный до остановки контент сохранён.');
        } else {
          setError(msg);
        }
      } finally {
        setRunning(false);
        setStopping(false);
        attachedRef.current = null;
        refreshCost();
      }
    },
    [onDone, refreshCost],
  );

  // Resume после обновления страницы: находим последнюю задачу «город целиком».
  // Активная → возобновляем поллинг; завершённая → показываем итог (не пропадает).
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!sessionId) return;
      try {
        const { data } = await aiAPI.cityFullActive(sessionId);
        const t = data?.task;
        if (!alive || !t) return;
        if (t.request?.prompt) setPrompt((p) => p || t.request.prompt);
        if (t.request?.allow_large) setBigCity(true);
        if (t.request?.test_mode) setTestMode(true);
        if (t.status === 'pending' || t.status === 'processing') {
          setTask(t);
          attach(t.id);
        } else if (t.status === 'completed') {
          setDoneSummary({
            ...(t.result_data?.summary || {}),
            cost: t.result_data?.cost_summary || null,
            issues: t.result_data?.issues || [],
          });
        } else if (t.status === 'cancelled') {
          setNotice('Последняя генерация была остановлена.');
        }
        // failed показываем молча итогом стоимости — ошибка уже устарела для новой сессии работы
      } catch {
        /* нет активной задачи — обычный старт */
      }
    })();
    return () => {
      alive = false;
    };
  }, [sessionId, attach]);

  const start = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed || running) return;
    setError('');
    setNotice('');
    setDoneSummary(null);
    setTask(null);

    try {
      const { data } = await aiAPI.generateCityFull(sessionId, {
        prompt: trimmed,
        lang: defaultLang,
        allow_large: bigCity,   // многораундовый discovery: до 150 достопр. / 300 ИЛ
        test_mode: testMode,    // отладка: ≤15 основных, ≤30 ИЛ — дёшево
        // Объём (достопр., инфа, ИЛ) решает система по найденным данным.
        // Веб-поиск автономный (research через Brave).
      });
      const taskId = data?.task_id;
      if (!taskId) throw new Error('Бэкенд не вернул task_id');
      await attach(taskId);
    } catch (err) {
      // 409 — генерация уже идёт (например, повторный клик после обновления
      // страницы): присоединяемся к ней вместо ошибки.
      const existingId = err?.response?.status === 409 && err?.response?.data?.task_id;
      if (existingId) {
        await attach(existingId);
        return;
      }
      setError(err?.response?.data?.error || err?.message || 'Ошибка генерации');
    }
  }, [prompt, running, sessionId, defaultLang, bigCity, testMode, attach]);

  const stop = useCallback(async () => {
    if (!running || stopping) return;
    setStopping(true);
    try {
      await aiAPI.cityFullCancel(sessionId);
      // Дальше поллинг сам увидит cancelled и корректно завершит панель.
    } catch (err) {
      setStopping(false);
      setError(err?.response?.data?.error || err?.message || 'Не удалось остановить');
    }
  }, [running, stopping, sessionId]);

  const progress = Math.max(0, Math.min(100, Number(task?.progress) || 0));
  const summary = task?.result_data?.summary || {};
  const issues = task?.result_data?.issues || [];

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-indigo-900">
            ⚡ Сгенерировать город целиком
          </h3>
          <p className="mt-0.5 text-xs text-indigo-700/80">
            Одно действие: research → база города → полезная инфа +
            достопримечательности → теги/координаты/описания → интерактивные
            локации → текст аудиогида → фото → перевод. Объём система подбирает сама.
            Идёт в фоне — страницу можно обновлять и закрывать.
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

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-700"
            title="Многораундовый поиск: до ~150 достопримечательностей и 300 интерактивных локаций (дольше и дороже)">
            <input type="checkbox" checked={bigCity} disabled={running}
              onChange={(e) => setBigCity(e.target.checked)} />
            Большой город
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-700"
            title="Отладка: не больше 15 основных локаций и 30 ИЛ — быстро и дёшево">
            <input type="checkbox" checked={testMode} disabled={running}
              onChange={(e) => setTestMode(e.target.checked)} />
            Тест-режим (15/30)
          </label>
          <span className="text-[11px] text-gray-400 self-center max-w-[300px]">
            Объём система подбирает по данным. «Большой город» — многораундовый поиск
            (до ~150 достопр. / 300 ИЛ, дольше).
          </span>

          {running ? (
            <button
              type="button"
              onClick={stop}
              disabled={stopping}
              className="ml-auto rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {stopping ? 'Останавливаем…' : '⏹ Стоп'}
            </button>
          ) : (
            <button
              type="button"
              onClick={start}
              disabled={!prompt.trim()}
              className="ml-auto rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Запустить
            </button>
          )}
        </div>

        {running && (
          <div className="space-y-1.5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-indigo-100">
              <div className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                style={{ width: `${progress}%` }} />
            </div>
            <div className="flex justify-between text-xs text-indigo-800">
              <span>{stopping ? 'Останавливаем…' : (task?.current_step || 'Запуск…')}</span>
              <span>
                {summary?.children_done != null && summary?.children_total
                  ? `${summary.children_done}/${summary.children_total} шагов · `
                  : ''}
                {progress}%
              </span>
            </div>
          </div>
        )}

        {/* Расход по всей сессии — под полосой, не пропадает после завершения. */}
        {cost && cost.total_usd != null && (cost.total_usd > 0 || running) && (
          <div className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
            <span>
              💰 Расход сессии: <b>${Number(cost.total_usd).toFixed(4)}</b>
              {cost.total_tokens
                ? ` · ${Number(cost.total_tokens).toLocaleString()} токенов`
                : ''}
              {cost.calls ? ` · ${cost.calls} вызовов` : ''}
            </span>
            {running && <span className="text-amber-600">считаем…</span>}
          </div>
        )}

        {doneSummary && !running && (
          <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
            Готово. Шагов: {doneSummary.children_done ?? '—'}/{doneSummary.children_total ?? '—'}
            {doneSummary.children_failed ? `, с ошибками: ${doneSummary.children_failed}` : ''}.
            {doneSummary.cost && doneSummary.cost.total_usd != null && (
              <> Стоимость запуска: <b>${Number(doneSummary.cost.total_usd).toFixed(4)}</b>
                {doneSummary.cost.total_tokens
                  ? ` (${doneSummary.cost.total_tokens.toLocaleString()} токенов)`
                  : ''}.</>
            )}
            {' '}Данные обновлены ниже.
          </div>
        )}

        {(() => {
          const list = running ? issues : (doneSummary?.issues || []);
          if (!list.length) return null;
          return (
            <details className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-900">
              <summary className="cursor-pointer font-medium">
                ⚠ Журнал генерации ({list.length})
              </summary>
              <ul className="mt-1.5 space-y-0.5">
                {list.map((it, i) => (
                  <li key={i}>
                    <span className="text-orange-500">{it.at}</span>{' '}
                    <b>{it.stage}:</b> {it.message}
                  </li>
                ))}
              </ul>
            </details>
          );
        })()}

        {notice && !running && (
          <div className="rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-700">
            {notice}
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
