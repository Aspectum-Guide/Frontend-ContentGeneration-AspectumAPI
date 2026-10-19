import { useCallback, useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { Alert, Button, EmptyState, PageContainer, PageHeader, Panel, SectionHeader, Spinner, StatusBadge, Textarea } from '@aspectum/ui';
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
      <PageContainer maxWidth="wide">
        <PageHeader
          title="Промпты генерации"
          description={(
            <>
              Базовые промпты и правила, которые использует генерация. Пустое поле —
              действует встроенный дефолт. Фигурные плейсхолдеры (например {'{name}'})
              обязательны: без них сохранение отклоняется.
            </>
          )}
        />

        {error && (
          <Alert tone="error" className="mb-4">
            {error} <Button variant="link" size="sm" onClick={load}>Повторить</Button>
          </Alert>
        )}
        {loading && <EmptyState icon={<Spinner size="sm" />} title="Загрузка…" spacing="md" />}

        <div className="space-y-6">
          {prompts.map((p) => {
            const draft = drafts[p.key] ?? '';
            const dirty = draft !== (p.override || '');
            return (
              <Panel key={p.key} className="p-4">
                <SectionHeader
                  title={p.title}
                  description={p.description}
                  size="sm"
                  descriptionSize="xs"
                  actions={(
                    <StatusBadge
                      tone={p.override ? (p.override_valid ? 'warning' : 'danger') : 'neutral'}
                      label={p.override ? (p.override_valid ? 'изменён' : 'сломан → дефолт') : 'дефолт'}
                      className="shrink-0 text-[11px]"
                    />
                  )}
                />
                {p.placeholders?.length > 0 && (
                  <p className="mt-1 text-[11px] text-aspectum-text-disabled">
                    Обязательные плейсхолдеры: {p.placeholders.join(' ')}
                  </p>
                )}

                <Textarea
                  value={draft}
                  onChange={(e) => setDrafts((d) => ({ ...d, [p.key]: e.target.value }))}
                  rows={draft ? Math.min(16, Math.max(6, draft.split('\n').length + 2)) : 4}
                  placeholder="Пусто — используется дефолт (ниже). Вставьте сюда свой вариант для правки."
                  className="mt-3 w-full rounded-aspectum-compact border border-aspectum-border-strong px-3 py-2 font-mono text-xs focus:border-aspectum-indigo-light focus:outline-none focus:ring-1 focus:ring-aspectum-indigo-light"
                />

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="indigo"
                    size="sm"
                    disabled={saving[p.key] || !dirty}
                    onClick={() => save(p.key, draft)}
                  >
                    {saving[p.key] ? 'Сохраняем…' : 'Сохранить'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    disabled={saving[p.key] || (!p.override && !draft)}
                    onClick={() => { setDrafts((d) => ({ ...d, [p.key]: '' })); save(p.key, ''); }}
                  >
                    Сбросить к дефолту
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setDrafts((d) => ({ ...d, [p.key]: p.default || '' }))}
                  >
                    Вставить дефолт для правки
                  </Button>
                  {notice[p.key] && (
                    <span className={`text-xs ${notice[p.key].startsWith('Ошибка') ? 'text-aspectum-danger' : 'text-aspectum-positive-strong'}`}>
                      {notice[p.key]}
                    </span>
                  )}
                </div>

                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-aspectum-text-muted hover:text-aspectum-text-strong">
                    Показать встроенный дефолт
                  </summary>
                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-aspectum-compact bg-aspectum-surface-muted p-3 font-mono text-[11px] text-aspectum-text-subtle">
                    {p.default || '(пусто)'}
                  </pre>
                </details>
              </Panel>
            );
          })}
        </div>
      </PageContainer>
    </Layout>
  );
}
