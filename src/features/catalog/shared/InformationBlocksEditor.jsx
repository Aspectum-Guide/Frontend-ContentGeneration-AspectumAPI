import { useCallback, useEffect, useState } from 'react';
import { Field, TextInput } from '../../../components/ui/FormField';
import { ConfirmModal } from '../../../components/ui/Modal';
import { parseApiError } from '../../../utils/apiError';
import { buildLangOptions } from './i18n';
import { LangBlock, LangTabs } from './LangFields';

export default function InformationBlocksEditor({
  parentId,
  api,
  showVisibility = false,
  disabled = false,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeLang, setActiveLang] = useState('ru');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [savingId, setSavingId] = useState(null);

  const loadItems = useCallback(async () => {
    if (!parentId) return;
    setLoading(true);
    setError('');
    try {
      const r = await api.list(parentId);
      const list = r?.data?.results || [];
      setItems(list);
    } catch (err) {
      setItems([]);
      setError(parseApiError(err, 'Ошибка загрузки блоков'));
    } finally {
      setLoading(false);
    }
  }, [api, parentId]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleAdd = async () => {
    if (!parentId || disabled) return;
    try {
      setSavingId('new');
      const r = await api.create(parentId, {
        index: items.length,
        name: { ru: '' },
        description: { ru: '' },
        ...(showVisibility ? { is_show: true } : {}),
      });
      const item = r?.data?.item;
      if (item) setItems((prev) => [...prev, item].sort((a, b) => (a.index ?? 0) - (b.index ?? 0)));
    } catch (err) {
      setError(parseApiError(err, 'Ошибка создания блока'));
    } finally {
      setSavingId(null);
    }
  };

  const patchItem = async (itemId, patch) => {
    if (!parentId || disabled) return;
    setSavingId(itemId);
    setError('');
    try {
      const r = await api.update(parentId, itemId, patch);
      const updated = r?.data?.item;
      if (updated) {
        setItems((prev) => prev.map((item) => (item.id === itemId ? updated : item)));
      }
    } catch (err) {
      setError(parseApiError(err, 'Ошибка сохранения блока'));
    } finally {
      setSavingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !parentId) return;
    try {
      await api.remove(parentId, deleteTarget.id);
      setItems((prev) => prev.filter((item) => item.id !== deleteTarget.id));
    } catch (err) {
      setError(parseApiError(err, 'Ошибка удаления блока'));
    } finally {
      setDeleteTarget(null);
    }
  };

  if (!parentId) {
    return (
      <p className="text-sm text-gray-500">
        Сначала сохраните объект, чтобы редактировать информационные блоки.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Загрузка блоков...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">Информационных блоков пока нет.</p>
      ) : (
        items.map((item) => {
          const langOptions = buildLangOptions([item.name || {}, item.description || {}]);
          const busy = savingId === item.id;
          return (
            <div key={item.id} className="p-4 border border-gray-200 rounded-xl space-y-3 bg-gray-50/50">
              <div className="flex flex-wrap items-center gap-3 justify-between">
                <Field label="Индекс" className="w-28">
                  <TextInput
                    type="number"
                    min={0}
                    value={item.index ?? 0}
                    disabled={disabled || busy}
                    onChange={(e) => {
                      const index = Number(e.target.value) || 0;
                      setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, index } : x)));
                    }}
                  />
                </Field>
                {showVisibility && (
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={!!item.is_show}
                      disabled={disabled || busy}
                      onChange={(e) => {
                        const is_show = e.target.checked;
                        setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, is_show } : x)));
                        patchItem(item.id, { is_show });
                      }}
                    />
                    Показывать
                  </label>
                )}
                <button
                  type="button"
                  disabled={disabled || busy}
                  onClick={() => patchItem(item.id, {
                    index: Number(item.index) || 0,
                    name: item.name || {},
                    description: item.description || {},
                    ...(showVisibility ? { is_show: !!item.is_show } : {}),
                  })}
                  className="text-sm text-blue-700 hover:text-blue-800 disabled:opacity-50"
                >
                  {busy ? 'Сохранение...' : 'Сохранить блок'}
                </button>
                <button
                  type="button"
                  disabled={disabled || busy}
                  onClick={() => setDeleteTarget(item)}
                  className="ml-auto text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  Удалить
                </button>
              </div>

              {langOptions.length > 0 && (
                <LangTabs
                  active={activeLang}
                  onSwitch={setActiveLang}
                  value={item.name || {}}
                  langOptions={langOptions}
                />
              )}

              <LangBlock
                label="Заголовок"
                value={item.name || {}}
                activeLang={activeLang}
                onChange={(name) => {
                  setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, name } : x)));
                }}
              />
              <LangBlock
                label="Описание"
                value={item.description || {}}
                activeLang={activeLang}
                multiline
                rows={3}
                onChange={(description) => {
                  setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, description } : x)));
                }}
              />
            </div>
          );
        })
      )}

      <button
        type="button"
        disabled={disabled || savingId === 'new'}
        onClick={handleAdd}
        className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50"
      >
        {savingId === 'new' ? 'Добавление...' : '+ Добавить блок'}
      </button>

      <ConfirmModal
        open={!!deleteTarget}
        title="Удалить блок?"
        message="Блок будет удалён без возможности восстановления."
        confirmLabel="Удалить"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
