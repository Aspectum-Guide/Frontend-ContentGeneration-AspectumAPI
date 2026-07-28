import { useCallback, useEffect, useRef, useState } from 'react';
import { Field, TextInput } from '../../../components/ui/FormField';
import { ConfirmModal } from '../../../components/ui/Modal';
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
  const fileInputRef = useRef(null);
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

  const handleImagePick = (itemId) => {
    uploadTargetRef.current = itemId;
    fileInputRef.current?.click();
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
      <p className="text-sm text-gray-500">
        Сначала сохраните событие, чтобы редактировать ленту.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Загрузка ленты...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">Элементов ленты пока нет.</p>
      ) : (
        items.map((item) => {
          const isImage = item.item_type === 'image' || item.type === 'image';
          const langOptions = !isImage ? buildLangOptions([item.text || {}]) : [];
          const busy = savingId === item.id || uploadingId === item.id;
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
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {isImage ? 'Изображение' : 'Текст'}
                </span>
                <button
                  type="button"
                  disabled={disabled || busy}
                  onClick={() => setDeleteTarget(item)}
                  className="ml-auto text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  Удалить
                </button>
              </div>

              {isImage ? (
                <div className="space-y-2">
                  {item.image_url ? (
                    <img src={item.image_url} alt="" className="max-h-48 rounded-lg border border-gray-200" />
                  ) : (
                    <p className="text-sm text-gray-400">Изображение не выбрано</p>
                  )}
                  <button
                    type="button"
                    disabled={disabled || busy}
                    onClick={() => handleImagePick(item.id)}
                    className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                  >
                    {busy ? 'Загрузка...' : 'Загрузить изображение'}
                  </button>
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
                  <button
                    type="button"
                    disabled={disabled || busy}
                    onClick={() => patchItem(item.id, { item_type: 'text', text: item.text || {} })}
                    className="text-sm text-blue-700 hover:text-blue-800 disabled:opacity-50"
                  >
                    {busy ? 'Сохранение...' : 'Сохранить текст'}
                  </button>
                </>
              )}
            </div>
          );
        })
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || savingId === 'new'}
          onClick={handleAddText}
          className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50"
        >
          {savingId === 'new' ? 'Добавление...' : '+ Текстовый блок'}
        </button>
        <button
          type="button"
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
          className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50"
        >
          + Блок с изображением
        </button>
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
