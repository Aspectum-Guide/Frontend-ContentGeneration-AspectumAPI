/**
 * Подтверждение удаления города из сессии или всей сессии (список сессий).
 */
export default function SessionDeleteDialog({
  open,
  isDraftDelete,
  cityRow,
  session: targetSession,
  deleting,
  onBackdropClick,
  onCancel,
  onConfirm,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onBackdropClick}
        aria-hidden
      />

      <div className="relative bg-white rounded-xl shadow-xl p-6 w-96 space-y-4">
        <h3 className="text-base font-semibold text-gray-900">
          {isDraftDelete ? 'Удалить город?' : 'Удалить сессию?'}
        </h3>

        {isDraftDelete ? (
          <p className="text-sm text-gray-600">
            Город{' '}
            <span className="font-medium">
              «{cityRow?.cityName || cityRow?.cityDraftId || 'Без названия'}»
            </span>{' '}
            будет удалён из сессии{' '}
            <span className="font-medium">
              «{targetSession?.name || targetSession?.uuid || targetSession?.id}»
            </span>.
            <br />
            Сама сессия останется.
          </p>
        ) : (
          <p className="text-sm text-gray-600">
            Сессия{' '}
            <span className="font-medium">
              «{targetSession?.name || targetSession?.uuid || targetSession?.id}»
            </span>{' '}
            будет удалена безвозвратно.
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Отмена
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? 'Удаление...' : isDraftDelete ? 'Удалить город' : 'Удалить сессию'}
          </button>
        </div>
      </div>
    </div>
  );
}
