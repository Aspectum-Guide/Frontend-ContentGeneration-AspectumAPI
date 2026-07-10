import { useCallback, useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { aiAPI } from '../../api/generation';

/**
 * Вкладка «Промпты» — базовые промпты/правила генерации (аудиогиды, стиль-гайд),
 * редактируемые оператором без деплоя. Дефолты живут в коде; здесь хранится
 * только оверрайд. Пустое поле = используется дефолт. Оверрайд без обязательных
 * {плейсхолдеров} бэкенд отклоняет — сломать генерацию правкой нельзя.
 */
export default function PromptSettings() {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // локальные правки: key -> text
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState({});   // key -> bool
  const [notice, setNotice] = useState({});   // key -> сообщение

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await aiAPI.listPrompts();
      setPrompts(data?.prompts || []);
      const d = {};
      (data?.prompts || []).forEach((p) => { d[p.key] = p.override || ''; });
      setDrafts(d);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Не удалось загрузить промпты');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (key, text) => {
    setSaving((s) => ({ ...s, [key]: true }));
    setNotice((n) => ({ ...n, [key]: '' }));
    try {
      const { data } = await aiAPI.savePrompt(key, text);
      setNotice((n) => ({
        ...n,
        [key]: data.reset ? 'Сброшено к дефолту' : 'Сохранено — действует со следующей генерации',
      }));
      await load();
    } catch (e) {
      setNotice((n) => ({
        ...n,
        [key]: `Ошибка: ${e?.response?.data?.error || e?.message || 'не сохранилось'}`,
      }));
    } finally {
      setSaving((s) => ({ ...s, [key]: false }));
    }
  }, [load]);

  return (
    <Layout>
      <div className="max-w-4xl">
        <h1 className="text-2xl font-bold mb-1">Промпты генерации</h1>
        <p className="text-sm text-gray-500 mb-6">
          Базовые промпты и правила, которые использует генерация. Пустое поле —
          действует встроенный дефолт. Фигурные плейсхолдеры (например {'{name}'})
          обязательны: без них сохранение отклоняется.
        </p>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error} <button className="underline" onClick={load}>Повторить</button>
          </div>
        )}
        {loading && <div className="text-sm text-gray-400">Загрузка…</div>}

        <div className="space-y-6">
          {prompts.map((p) => {
            const draft = drafts[p.key] ?? '';
            const dirty = draft !== (p.override || '');
            return (
              <div key={p.key} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">{p.title}</h2>
                    <p className="mt-0.5 text-xs text-gray-500">{p.description}</p>
                    {p.placeholders?.length > 0 && (
                      <p className="mt-1 text-[11px] text-gray-400">
                        Обязательные плейсхолдеры: {p.placeholders.join(' ')}
                      </p>
                    )}
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${
                    p.override
                      ? (p.override_valid
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-red-50 text-red-700 border border-red-200')
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {p.override ? (p.override_valid ? 'изменён' : 'сломан → дефолт') : 'дефолт'}
                  </span>
                </div>

                <textarea
                  value={draft}
                  onChange={(e) => setDrafts((d) => ({ ...d, [p.key]: e.target.value }))}
                  rows={draft ? Math.min(16, Math.max(6, draft.split('\n').length + 2)) : 4}
                  placeholder="Пусто — используется дефолт (ниже). Вставьте сюда свой вариант для правки."
                  className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={saving[p.key] || !dirty}
                    onClick={() => save(p.key, draft)}
                    className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {saving[p.key] ? 'Сохраняем…' : 'Сохранить'}
                  </button>
                  <button
                    type="button"
                    disabled={saving[p.key] || (!p.override && !draft)}
                    onClick={() => { setDrafts((d) => ({ ...d, [p.key]: '' })); save(p.key, ''); }}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Сбросить к дефолту
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrafts((d) => ({ ...d, [p.key]: p.default || '' }))}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    Вставить дефолт для правки
                  </button>
                  {notice[p.key] && (
                    <span className={`text-xs ${notice[p.key].startsWith('Ошибка') ? 'text-red-600' : 'text-green-700'}`}>
                      {notice[p.key]}
                    </span>
                  )}
                </div>

                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                    Показать встроенный дефолт
                  </summary>
                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-gray-50 p-3 font-mono text-[11px] text-gray-600">
                    {p.default || '(пусто)'}
                  </pre>
                </details>
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
