import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, ConfirmModal, EmptyState, Field, FileButton, LoadingOverlay, Panel, TextInput } from '@aspectum/ui';
import { parseApiError } from '../../../utils/apiError';
import { imagesAPI } from '../../../api/generation';
import { buildLangOptions } from './i18n';
import { LangBlock, LangTabs } from './LangFields';

export default function PublishedFeedEditor({ parentId, api, disabled = false }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeLang, setActiveLang] = useState('ru');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  const uploadTargetRef = useRef(null);

  const loadItems = useCallback(async () => {
    if (!parentId) return;
    setLoading(true);
    setError('');
    try {
      const r = await api.list(parentId);
      setItems(r?.data?.results || []);
    } catch (err) {
      setItems([]);
      setError(parseApiError(err, 'Ошибка загрузки ленты'));
    } finally {
      setLoading(false);
    }
  }, [api, parentId]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

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
      setError(parseApiError(err, 'Ошибка сохранения элемента'));
    } finally {
      setSavingId(null);
    }
  };

  const handleAddText = async () => {
    if (!parentId || disabled) return;
    try {
      setSavingId('new');
      const r = await api.create(parentId, {
        item_type: 'text',
        index: items.length,
        text: { ru: '' },
      });
      const item = r?.data?.item;
      if (item) setItems((prev) => [...prev, item]);
    } catch (err) {
      setError(parseApiError(err, 'Ошибка создания элемента'));
    } finally {
      setSavingId(null);
    }
  };


  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const itemId = uploadTargetRef.current;
    if (!file || !parentId || !itemId) return;
    setUploadingId(itemId);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await imagesAPI.upload(fd);
      const imageId = r?.data?.id;
      if (imageId) {
        await patchItem(itemId, { item_type: 'image', image_id: imageId });
      }
    } catch (err) {
      setError(parseApiError(err, 'Ошибка загрузки изображения'));
    } finally {
      setUploadingId(null);
      uploadTargetRef.current = null;
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !parentId) return;
    try {
      await api.remove(parentId, deleteTarget.id);
      setItems((prev) => prev.filter((item) => item.id !== deleteTarget.id));
    } catch (err) {
      setError(parseApiError(err, 'Ошибка удаления элемента'));
    } finally {
      setDeleteTarget(null);
    }
  };

  if (!parentId) {
    return (
      <p className="text-sm text-aspectum-text-muted">
        Сначала сохраните событие, чтобы редактировать ленту.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}

      {loading ? (
        <EmptyState icon={null} title="Загрузка ленты..." spacing="sm" />
      ) : items.length === 0 ? (
        <EmptyState
          icon="📰"
          title="Элементов ленты пока нет"
          description="Добавьте текстовый или графический элемент."
          className="py-5"
        />
      ) : (
        items.map((item) => {
          const isImage = item.item_type === 'image' || item.type === 'image';
          const langOptions = !isImage ? buildLangOptions([item.text || {}]) : [];
          const busy = savingId === item.id || uploadingId === item.id;
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
                <span className="text-xs font-medium uppercase tracking-wide text-aspectum-text-muted">
                  {isImage ? 'Изображение' : 'Текст'}
                </span>
                <Button
                  type="button"
                  variant="linkDanger"
                  size="md"
                  disabled={disabled || busy}
                  onClick={() => setDeleteTarget(item)}
                  className="ml-auto"
                >
                  Удалить
                </Button>
              </div>

              {isImage ? (
                <div className="space-y-2">
                  <LoadingOverlay loading={busy} label="Загрузка изображения…">
                    {item.image_url ? (
                      <img src={item.image_url} alt="" className="max-h-48 rounded-aspectum-control border border-aspectum-border" />
                    ) : (
                      <p className="text-sm text-aspectum-text-disabled">Изображение не выбрано</p>
                    )}
                  </LoadingOverlay>
                  <FileButton
                    accept="image/*"
                    onTrigger={() => { uploadTargetRef.current = item.id; }}
                    onChange={handleFileChange}
                    variant="soft"
                    size="md"
                    disabled={disabled || busy}
                  >
                    {busy ? 'Загрузка...' : 'Загрузить изображение'}
                  </FileButton>
                </div>
              ) : (
                <>
                  {langOptions.length > 0 && (
                    <LangTabs
                      active={activeLang}
                      onSwitch={setActiveLang}
                      value={item.text || {}}
                      langOptions={langOptions}
                    />
                  )}
                  <LangBlock
                    label="Текст"
                    value={item.text || {}}
                    activeLang={activeLang}
                    multiline
                    rows={4}
                    onChange={(text) => {
                      setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, text } : x)));
                    }}
                  />
                  <Button
                    type="button"
                    variant="link"
                    size="md"
                    disabled={disabled || busy}
                    onClick={() => patchItem(item.id, { item_type: 'text', text: item.text || {} })}
                  >
                    {busy ? 'Сохранение...' : 'Сохранить текст'}
                  </Button>
                </>
              )}
            </Panel>
          );
        })
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="soft"
          size="md"
          disabled={disabled || savingId === 'new'}
          onClick={handleAddText}
        >
          {savingId === 'new' ? 'Добавление...' : '+ Текстовый блок'}
        </Button>
        <Button
          type="button"
          variant="soft"
          size="md"
          disabled={disabled || savingId === 'new'}
          onClick={async () => {
            if (!parentId || disabled) return;
            try {
              setSavingId('new');
              const r = await api.create(parentId, { item_type: 'image', index: items.length });
              const item = r?.data?.item;
              if (item) setItems((prev) => [...prev, item]);
            } catch (err) {
              setError(parseApiError(err, 'Ошибка создания элемента'));
            } finally {
              setSavingId(null);
            }
          }}
        >
          + Блок с изображением
        </Button>
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Удалить элемент?"
        message="Элемент ленты будет удалён без возможности восстановления."
        confirmLabel="Удалить"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
