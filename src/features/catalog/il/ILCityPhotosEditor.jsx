import { useCallback, useEffect, useRef, useState } from 'react';
import { Field, TextInput } from '../../../components/ui/FormField';
import { ConfirmModal } from '../../../components/ui/Modal';
import { imagesAPI } from '../../../api/generation';
import { parseApiError } from '../../../utils/apiError';
import { createCoordinatePasteHandler } from '../../../utils/coordinates';
import { ilPhotosAPI } from './api';

const parseCoord = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

export default function ILCityPhotosEditor({ cityId, disabled = false }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  const fileInputRef = useRef(null);
  const uploadTargetRef = useRef(null);

  const loadItems = useCallback(async () => {
    if (!cityId) return;
    setLoading(true);
    setError('');
    try {
      const r = await ilPhotosAPI.list(cityId);
      setItems(r?.data?.results || []);
    } catch (err) {
      setItems([]);
      setError(parseApiError(err, 'Ошибка загрузки фото'));
    } finally {
      setLoading(false);
    }
  }, [cityId]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const patchItem = async (photoId, patch) => {
    if (!cityId || disabled) return;
    setSavingId(photoId);
    try {
      const r = await ilPhotosAPI.update(cityId, photoId, patch);
      const updated = r?.data?.item;
      if (updated) {
        setItems((prev) => prev.map((item) => (item.id === photoId ? updated : item)));
      }
    } catch (err) {
      setError(parseApiError(err, 'Ошибка сохранения'));
    } finally {
      setSavingId(null);
    }
  };

  const handleAdd = async () => {
    if (!cityId || disabled) return;
    try {
      setSavingId('new');
      const r = await ilPhotosAPI.create(cityId, { lat: null, lon: null });
      const item = r?.data?.item;
      if (item) setItems((prev) => [...prev, item]);
    } catch (err) {
      setError(parseApiError(err, 'Ошибка создания'));
    } finally {
      setSavingId(null);
    }
  };

  const handleImagePick = (photoId) => {
    uploadTargetRef.current = photoId;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const photoId = uploadTargetRef.current;
    if (!file || !cityId || !photoId) return;
    setUploadingId(photoId);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await imagesAPI.upload(fd);
      const imageId = r?.data?.id;
      if (imageId) await patchItem(photoId, { image_id: imageId });
    } catch (err) {
      setError(parseApiError(err, 'Ошибка загрузки изображения'));
    } finally {
      setUploadingId(null);
      uploadTargetRef.current = null;
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !cityId) return;
    try {
      await ilPhotosAPI.remove(cityId, deleteTarget.id);
      setItems((prev) => prev.filter((item) => item.id !== deleteTarget.id));
    } catch (err) {
      setError(parseApiError(err, 'Ошибка удаления'));
    } finally {
      setDeleteTarget(null);
    }
  };

  if (!cityId) {
    return (
      <p className="text-sm text-gray-500">
        Выберите город для локации — фото привязаны к городу, а не к отдельной IL.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Фото интерактивных локаций города (InteractiveLocationPhoto). Общие для всех IL этого города.
      </p>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Загрузка...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">Фото пока нет.</p>
      ) : (
        items.map((item) => {
          const busy = savingId === item.id || uploadingId === item.id;
          return (
            <div key={item.id} className="p-4 border border-gray-200 rounded-xl space-y-3 bg-gray-50/50">
              <div className="flex flex-wrap gap-3 justify-between items-start">
                {item.image_url ? (
                  <img src={item.image_url} alt="" className="max-h-36 rounded-lg border border-gray-200" />
                ) : (
                  <div className="w-40 h-28 rounded-lg border border-dashed border-gray-300 bg-white flex items-center justify-center text-xs text-gray-400">
                    Нет изображения
                  </div>
                )}
                <button
                  type="button"
                  disabled={disabled || busy}
                  onClick={() => setDeleteTarget(item)}
                  className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  Удалить
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Широта">
                  <TextInput
                    type="number"
                    step="any"
                    value={item.lat ?? ''}
                    disabled={disabled || busy}
                    onChange={(e) => {
                      const lat = e.target.value === '' ? null : parseCoord(e.target.value);
                      setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, lat } : x)));
                    }}
                    onPaste={createCoordinatePasteHandler(({ lat, lon }) => {
                      setItems((prev) => prev.map((x) => (
                        x.id === item.id ? { ...x, lat, lon } : x
                      )));
                    })}
                  />
                </Field>
                <Field label="Долгота">
                  <TextInput
                    type="number"
                    step="any"
                    value={item.lon ?? ''}
                    disabled={disabled || busy}
                    onChange={(e) => {
                      const lon = e.target.value === '' ? null : parseCoord(e.target.value);
                      setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, lon } : x)));
                    }}
                  />
                </Field>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={disabled || busy}
                  onClick={() => patchItem(item.id, { lat: item.lat, lon: item.lon })}
                  className="text-sm text-blue-700 hover:text-blue-800 disabled:opacity-50"
                >
                  {busy ? 'Сохранение...' : 'Сохранить координаты'}
                </button>
                <button
                  type="button"
                  disabled={disabled || busy}
                  onClick={() => handleImagePick(item.id)}
                  className="text-sm text-blue-700 hover:text-blue-800 disabled:opacity-50"
                >
                  {uploadingId === item.id ? 'Загрузка...' : 'Загрузить изображение'}
                </button>
              </div>
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
        {savingId === 'new' ? 'Добавление...' : '+ Добавить фото'}
      </button>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Удалить фото?"
        message="Фото будет удалено без возможности восстановления."
        confirmLabel="Удалить"
        danger
      />
    </div>
  );
}
