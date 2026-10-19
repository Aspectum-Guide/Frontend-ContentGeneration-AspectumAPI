import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, ConfirmModal, EmptyState, Field, FormGrid, MediaUploadField, Panel, TextInput } from '@aspectum/ui';
import { imagesAPI } from '../../../api/generation';
import { parseApiError } from '../../../utils/apiError';
import { createCoordinatePasteHandler, parseCoord } from '../../../utils/coordinates';
import { ilPhotosAPI } from './api';

export default function ILCityPhotosEditor({ cityId, disabled = false }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
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
      <p className="text-sm text-aspectum-text-muted">
        Выберите город для локации — фото привязаны к городу, а не к отдельной IL.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-aspectum-text-muted">
        Фото интерактивных локаций города (InteractiveLocationPhoto). Общие для всех IL этого города.
      </p>

      {error && <Alert tone="error">{error}</Alert>}

      {loading ? (
        <EmptyState icon={null} title="Загрузка..." spacing="sm" />
      ) : items.length === 0 ? (
        <EmptyState title="Фото пока нет" description="Добавьте первое изображение для локации." className="py-5" />
      ) : (
        items.map((item) => {
          const busy = savingId === item.id || uploadingId === item.id;
          return (
            <Panel key={item.id} tone="muted" className="p-4 space-y-3">
              <div className="flex flex-wrap gap-3 justify-between items-start">
                <MediaUploadField
                  previewUrl={item.image_url}
                  placeholder="Нет изображения"
                  disabled={disabled || busy}
                  uploading={uploadingId === item.id}
                  onTrigger={() => { uploadTargetRef.current = item.id; }}
                  onChange={handleFileChange}
                  uploadLabel="Загрузить изображение"
                />
                <Button
                  type="button"
                  disabled={disabled || busy}
                  onClick={() => setDeleteTarget(item)}
                  variant="softDanger"
                  size="sm"
                >
                  Удалить
                </Button>
              </div>

              <FormGrid responsive={false}>
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
              </FormGrid>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={disabled || busy}
                  onClick={() => patchItem(item.id, { lat: item.lat, lon: item.lon })}
                  variant="link"
                  size="sm"
                >
                  {busy ? 'Сохранение...' : 'Сохранить координаты'}
                </Button>
              </div>
            </Panel>
          );
        })
      )}

      <Button
        type="button"
        disabled={disabled || savingId === 'new'}
        onClick={handleAdd}
        variant="soft"
        size="md"
      >
        {savingId === 'new' ? 'Добавление...' : '+ Добавить фото'}
      </Button>

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
