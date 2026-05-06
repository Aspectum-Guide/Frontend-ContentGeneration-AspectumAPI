import { useCallback, useMemo, useState } from 'react';

/**
 * Общий CRUD-контроллер для справочников:
 * - создание/редактирование (editingItem)
 * - сохранение (saving/saveError)
 * - удаление (deleteTarget/deleting)
 *
 * Этот хук специально оставляет "гибкие места" через mapper-функции,
 * чтобы страница могла переопределять payload/поведение без копипасты.
 */
export function useCatalogCrud({
  createEmpty,
  createRequest,
  updateRequest,
  deleteRequest,
  mapRowToEdit,
  mapEditToPayload,
  onAfterSave,
  onAfterDelete,
  parseError = (err, fallback) => fallback || err?.message || 'Ошибка',
  createErrorMessage = 'Ошибка создания',
  updateErrorMessage = 'Ошибка сохранения',
  deleteErrorMessage = 'Ошибка удаления',
} = {}) {
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const openCreate = useCallback(() => {
    setSaveError(null);
    setEditingItem(createEmpty ? createEmpty() : {});
  }, [createEmpty]);

  const openEdit = useCallback(
    async (row) => {
      setSaveError(null);
      setEditingItem(mapRowToEdit ? mapRowToEdit(row) : row);
    },
    [mapRowToEdit]
  );

  const closeEdit = useCallback(() => setEditingItem(null), []);

  const askDelete = useCallback((row) => {
    setDeleteError(null);
    setDeleteTarget(row || null);
  }, []);

  const cancelDelete = useCallback(() => setDeleteTarget(null), []);

  const save = useCallback(
    async (e) => {
      e?.preventDefault?.();
      if (!editingItem) return;

      const payload = mapEditToPayload ? mapEditToPayload(editingItem) : editingItem;

      try {
        setSaving(true);
        setSaveError(null);

        if (editingItem?.id) {
          if (!updateRequest) throw new Error('updateRequest is not provided');
          await updateRequest(editingItem.id, payload);
        } else {
          if (!createRequest) throw new Error('createRequest is not provided');
          await createRequest(payload);
        }

        setEditingItem(null);
        await onAfterSave?.();
      } catch (err) {
        const msg = parseError(
          err,
          editingItem?.id ? updateErrorMessage : createErrorMessage
        );
        setSaveError(msg);
      } finally {
        setSaving(false);
      }
    },
    [
      createRequest,
      updateRequest,
      editingItem,
      mapEditToPayload,
      onAfterSave,
      parseError,
      createErrorMessage,
      updateErrorMessage,
    ]
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget?.id) return;
    try {
      setDeleting(true);
      setDeleteError(null);
      if (!deleteRequest) throw new Error('deleteRequest is not provided');
      await deleteRequest(deleteTarget.id);
      setDeleteTarget(null);
      await onAfterDelete?.();
    } catch (err) {
      const msg = parseError(err, deleteErrorMessage);
      setDeleteError(msg);
      throw err;
    } finally {
      setDeleting(false);
    }
  }, [deleteRequest, deleteTarget, onAfterDelete, parseError, deleteErrorMessage]);

  return useMemo(
    () => ({
      editingItem,
      setEditingItem,
      saving,
      saveError,
      setSaveError,

      deleteTarget,
      deleting,
      deleteError,
      askDelete,
      cancelDelete,
      confirmDelete,

      openCreate,
      openEdit,
      closeEdit,
      save,
    }),
    [
      editingItem,
      saving,
      saveError,
      deleteTarget,
      deleting,
      deleteError,
      askDelete,
      cancelDelete,
      confirmDelete,
      openCreate,
      openEdit,
      closeEdit,
      save,
    ]
  );
}

