import { useCallback, useEffect, useState } from 'react';
import { FormLabel, Alert, Button, ConfirmModal, EmptyState, Field, Panel, Switch, TextInput } from '@aspectum/ui';
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
      <p className="text-sm text-aspectum-text-muted">
        Сначала сохраните объект, чтобы редактировать информационные блоки.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}

      {loading ? (
        <EmptyState icon={null} title="Загрузка блоков..." spacing="sm" />
      ) : items.length === 0 ? (
        <EmptyState
          icon="ℹ️"
          title="Информационных блоков пока нет"
          description="Добавьте первый блок с дополнительной информацией."
          className="py-5"
        />
      ) : (
        items.map((item) => {
          const langOptions = buildLangOptions([item.name || {}, item.description || {}]);
          const busy = savingId === item.id;
          return (
            <Panel key={item.id} tone="muted" className="p-4 space-y-3">
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
                  <FormLabel  layout="row" size="sm" tone="strong">
                    <Switch
                      checked={!!item.is_show}
                      disabled={disabled || busy}
                      aria-label="Показывать информационный блок"
                      onChange={(is_show) => {
                        setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, is_show } : x)));
                        patchItem(item.id, { is_show });
                      }}
                    />
                    Показывать
                  </FormLabel>
                )}
                <Button
                  type="button"
                  variant="linkDanger"
                  size="md"
                  disabled={disabled || busy}
                  onClick={() => patchItem(item.id, {
                    index: Number(item.index) || 0,
                    name: item.name || {},
                    description: item.description || {},
                    ...(showVisibility ? { is_show: !!item.is_show } : {}),
                  })}
                >
                  {busy ? 'Сохранение...' : 'Сохранить блок'}
                </Button>
                <Button
                  type="button"
                  variant="link"
                  size="md"
                  disabled={disabled || busy}
                  onClick={() => setDeleteTarget(item)}
                  className="ml-auto"
                >
                  Удалить
                </Button>
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
            </Panel>
          );
        })
      )}

      <Button
        type="button"
        variant="soft"
        size="md"
        disabled={disabled || savingId === 'new'}
        onClick={handleAdd}
      >
        {savingId === 'new' ? 'Добавление...' : '+ Добавить блок'}
      </Button>

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
