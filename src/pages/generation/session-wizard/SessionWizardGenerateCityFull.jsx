import { useCallback, useEffect, useRef, useState } from 'react';
import { aiAPI, tasksAPI } from '../../../api/generation';
import apiClient from '../../../api/client';
import { pollGenerationTask } from '../../../utils/generationTaskPoll';
import { FormLabel, Alert, Button, Checkbox, InlineState, Modal, Panel, ProgressBar, Textarea, TextInput, Glyph } from '@aspectum/ui';

const SOURCE_GROUP_TITLES = { photo: 'Фото', facts: 'Фактура', discovery: 'Поиск мест' };
const SOURCE_REGION_LABELS = { RU: 'RU', 'RU-SPB': 'СПб' };

/**
 * Кнопка «Источники ▾» с выпадающим скролл-списком галочек источников
 * конвейера (реестр SourceToggle). Переключатели ГЛОБАЛЬНЫЕ — те же, что в
 * «Настройки ИИ → Источники данных»: выключил citywalls здесь — он выключен
 * для всех генераций, пока не включишь обратно.
 */
function SourcesDropdown({ disabled }) {
  const [open, setOpen] = useState(false);
  const [sources, setSources] = useState(null);
  const [busyKey, setBusyKey] = useState('');
  const boxRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/generation/sources/');
      setSources(data?.sources || []);
    } catch {
      setSources([]);
    }
  }, []);

  useEffect(() => {
    if (open && sources === null) load();
  }, [open, sources, load]);

  // клик мимо панели — закрыть
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const setToggle = async (key, enabled) => {
    setBusyKey(key);
    try {
      const { data } = await apiClient.post(`/generation/sources/${key}/`, { enabled });
      setSources(data?.sources || []);
    } catch {
      /* оставляем прежнее состояние */
    } finally {
      setBusyKey('');
    }
  };

  const offCount = (sources || []).filter(
    (s) => (s.operator_toggle ?? s.default_on) === false || !s.env_ok,
  ).length;

  return (
    <div className="relative" ref={boxRef}>
      <Button
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        variant="outline"
        size="sm"
        title="Какие источники конвейер использует для фото, фактов и поиска мест. Глобальные переключатели (те же, что в «Настройки ИИ»)"
      >
        Источники{offCount ? ` (выкл: ${offCount})` : ''} <Glyph name="▾" />
      </Button>
      {open && (
        <div className="mt-1 max-h-72 w-full max-w-md overflow-y-auto rounded-aspectum-compact border border-aspectum-border bg-aspectum-surface p-2 shadow-aspectum-elevated">
          <p className="mb-1.5 text-[10px] leading-snug text-aspectum-text-disabled">
            Глобальные переключатели — действуют на все генерации, региональные
            источники сами включаются только в своих городах.
          </p>
          {sources === null && <InlineState loading size="xs">Загрузка…</InlineState>}
          {['photo', 'facts', 'discovery'].map((g) => {
            const items = (sources || []).filter((s) => s.group === g);
            if (!items.length) return null;
            return (
              <div key={g} className="mb-2 last:mb-0">
                <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-aspectum-text-disabled">
                  {SOURCE_GROUP_TITLES[g] || g}
                </div>
                {items.map((s) => {
                  const checked = s.operator_toggle ?? s.default_on;
                  const rowDisabled = !s.env_ok || busyKey === s.key;
                  return (
                    <FormLabel
                      key={s.key}
                      title={s.description + (s.env_ok ? '' : ` — нужен ключ: ${(s.requires_env || []).join(', ')}`)}
                      className={`flex items-center gap-1.5 rounded px-1 py-0.5 text-xs ${
                        rowDisabled ? 'text-aspectum-text-disabled' : 'cursor-pointer text-aspectum-text-emphasis hover:bg-aspectum-indigo-soft'
                      }`}
                    >
                      <Checkbox
                        checked={checked && s.env_ok}
                        disabled={rowDisabled}
                        onChange={(e) => setToggle(s.key, e.target.checked)}
                      />
                      <span className="min-w-0 flex-1 truncate">{s.title}</span>
                      {s.regions.map((r) => (
                        <span key={r} className="rounded bg-aspectum-warning-soft px-1 text-[10px] text-aspectum-warning-strong">
                          {SOURCE_REGION_LABELS[r] || r}
                        </span>
                      ))}
                      {!s.env_ok && <span className="text-[10px] text-aspectum-danger-light">нет ключа</span>}
                      {s.operator_toggle != null && s.env_ok && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="xxs"
                          title="Сбросить к состоянию по умолчанию"
                          onClick={(e) => {
                            e.preventDefault();
                            setToggle(s.key, null);
                          }}
                        >
                          сброс
                        </Button>
                      )}
                    </FormLabel>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * «Сгенерировать город целиком» открывается модалкой, чтобы не занимать шаг города.
 * Дёргает оркестратор (parent GenerationTask + ThreadPool DAG).
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
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [testMode, setTestMode] = useState(false);
  // Максимальные пороги (не план!): система собирает полный пул и выбирает
  // лучшее сверху вниз по значимости; меньше порога — норма (достоверность важнее).
  const [attractionsMax, setAttractionsMax] = useState('');
  const [ilMax, setIlMax] = useState('');
  // Иконки новых фильтров через gpt-image-2 — дорого, поэтому явная галочка.
  const [genIcons, setGenIcons] = useState(false);

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
        if (t.request?.test_mode) setTestMode(true);
        if (t.request?.attractions_max) setAttractionsMax(String(t.request.attractions_max));
        if (t.request?.il_max) setIlMax(String(t.request.il_max));
        if (t.request?.generate_icons) setGenIcons(true);
        if (t.status === 'pending' || t.status === 'processing') {
          setTask(t);
          setOpen(true);
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
      const aMax = parseInt(attractionsMax, 10);
      const iMax = parseInt(ilMax, 10);
      const { data } = await aiAPI.generateCityFull(sessionId, {
        prompt: trimmed,
        lang: defaultLang,
        test_mode: testMode,    // отладка: ≤15 основных, ≤30 ИЛ — дёшево
        // Максимальные пороги: собирается ВСЁ, в итог идут лучшие по значимости
        // до порога (может быть меньше — система не выдумывает ради количества).
        attractions_max: Number.isFinite(aMax) && aMax > 0 ? aMax : undefined,
        il_max: Number.isFinite(iMax) && iMax > 0 ? iMax : undefined,
        // Большие пороги (>70 ОЛ) автоматически включают многораундовый поиск.
        allow_large: Number.isFinite(aMax) && aMax > 70,
        generate_icons: genIcons, // gpt-image-2, ~$0.1+/иконка — только осознанно
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
  }, [prompt, running, sessionId, defaultLang, testMode, attractionsMax, ilMax, genIcons, attach]);

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

  const triggerLabel = running
    ? `Генерация · ${progress}%`
    : 'Сгенерировать город целиком';

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="indigo" size="md" onClick={() => setOpen(true)}>
          {triggerLabel}
        </Button>
        {running && (
          <span className="text-xs text-aspectum-text-muted">
            {stopping ? 'Останавливаем…' : (task?.current_step || 'Идёт в фоне')}
          </span>
        )}
        {doneSummary && !running && (
          <span className="text-xs text-aspectum-success">
            Готово{doneSummary.children_failed ? `, с ошибками: ${doneSummary.children_failed}` : ''}
          </span>
        )}
        {notice && !running && !doneSummary && (
          <span className="text-xs text-aspectum-text-muted">{notice}</span>
        )}
        {error && !open && (
          <span className="text-xs text-aspectum-danger">{error}</span>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title="Сгенерировать город целиком"
        description="Research, город, достопримечательности, локации, аудиогид, фото и перевод. Идёт в фоне: окно и страницу можно закрыть."
      >
      <div className="space-y-3">
        <Textarea className="disabled:bg-aspectum-surface-subtle" value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={running} rows={2} placeholder="Напр.: Суздаль, Владимирская область, Россия — исторический туристический город" />

        <div className="flex flex-wrap items-center gap-3">
          <FormLabel  layout="rowTight" size="xs" tone="strong"
            title="Максимум основных локаций в итоге. Система собирает полный пул и берёт лучшие по значимости — может выдать меньше, если значимого мало. Пусто — авто (до 70; больше 70 включает многораундовый поиск)">
            Макс. ОЛ
            <TextInput className="w-16 disabled:bg-aspectum-surface-subtle" type="number" min="1" max="150" value={attractionsMax} disabled={running} onChange={(e) => setAttractionsMax(e.target.value)} placeholder="авто" />
          </FormLabel>
          <FormLabel  layout="rowTight" size="xs" tone="strong"
            title="Максимум интерактивных локаций (точек на карте). Пусто — авто">
            Макс. ИЛ
            <TextInput className="w-16 disabled:bg-aspectum-surface-subtle" type="number" min="1" max="300" value={ilMax} disabled={running} onChange={(e) => setIlMax(e.target.value)} placeholder="авто" />
          </FormLabel>
          <FormLabel  layout="rowTight" size="xs" tone="strong"
            title="Отладка: не больше 15 основных локаций и 30 ИЛ — быстро и дёшево">
            <Checkbox checked={testMode} disabled={running}
              onChange={(e) => setTestMode(e.target.checked)} />
            Тест-режим (15/30)
          </FormLabel>
          <FormLabel  layout="rowTight" size="xs" tone="strong"
            title="Генерировать иконки для НОВЫХ фильтров через gpt-image-2. Дорого (~$0.1+ за иконку) — включайте в случае крайней лени; иначе иконки ставятся руками">
            <Checkbox checked={genIcons} disabled={running}
              onChange={(e) => setGenIcons(e.target.checked)} />
            Иконки фильтров <span className="text-aspectum-warning">($)</span>
          </FormLabel>
          <SourcesDropdown disabled={running} />

          {running ? (
            <Button
              type="button"
              variant="danger"
              size="md"
              onClick={stop}
              disabled={stopping}
              className="ml-auto"
            >
              {stopping ? 'Останавливаем…' : <><Glyph name="⏹" /> Стоп</>}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={start}
              disabled={!prompt.trim()}
              variant="indigo"
              size="md"
              className="ml-auto"
            >
              Запустить
            </Button>
          )}
        </div>

        {running && (
          <div className="space-y-1.5">
            <ProgressBar value={progress} tone="indigo" track="indigo" transition="slow" label="Прогресс полной генерации города" />
            <div className="flex justify-between text-xs text-aspectum-indigo-emphasis">
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
          <Alert tone="warning" className="flex items-center justify-between px-3 py-1.5 text-xs">
            <span>
              <Glyph name="💰" /> Расход сессии: <b>${Number(cost.total_usd).toFixed(4)}</b>
              {cost.total_tokens
                ? ` · ${Number(cost.total_tokens).toLocaleString()} токенов`
                : ''}
              {cost.calls ? ` · ${cost.calls} вызовов` : ''}
            </span>
            {running && <span className="text-aspectum-warning">считаем…</span>}
          </Alert>
        )}

        {doneSummary && !running && (
          <Alert tone="success" className="px-3 py-2 text-xs">
            Готово. Шагов: {doneSummary.children_done ?? '—'}/{doneSummary.children_total ?? '—'}
            {doneSummary.children_failed ? `, с ошибками: ${doneSummary.children_failed}` : ''}.
            {doneSummary.cost && doneSummary.cost.total_usd != null && (
              <> Стоимость запуска: <b>${Number(doneSummary.cost.total_usd).toFixed(4)}</b>
                {doneSummary.cost.total_tokens
                  ? ` (${doneSummary.cost.total_tokens.toLocaleString()} токенов)`
                  : ''}.</>
            )}
            {' '}Данные обновлены ниже.
          </Alert>
        )}

        {(() => {
          const list = running ? issues : (doneSummary?.issues || []);
          if (!list.length) return null;
          return (
            <Panel as="details" tone="accentOrange" className="rounded-aspectum-compact px-3 py-2 text-xs text-aspectum-orange-emphasis">
              <summary className="cursor-pointer font-medium">
                <Glyph name="⚠" /> Журнал генерации ({list.length})
              </summary>
              <ul className="mt-1.5 space-y-0.5">
                {list.map((it, i) => (
                  <li key={i}>
                    <span className="text-aspectum-orange-subtle">{it.at}</span>{' '}
                    <b>{it.stage}:</b> {it.message}
                  </li>
                ))}
              </ul>
            </Panel>
          );
        })()}

        {notice && !running && (
          <Alert tone="info" className="px-3 py-2 text-xs">{notice}</Alert>
        )}

        {error && (
          <Alert tone="error">{error}</Alert>
        )}
      </div>
      </Modal>
    </>
  );
}
