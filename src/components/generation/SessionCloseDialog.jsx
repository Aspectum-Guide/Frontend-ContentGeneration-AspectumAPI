const CLOSE_OPTIONS = [
  {
    mode: 'save',
    title: 'Сохранить',
    desc: 'Данные сессии сохранятся, можно будет опубликовать позже',
    cls: 'border-blue-500 bg-blue-50',
  },
  {
    mode: 'discard',
    title: 'Отменить',
    desc: 'Данные сессии будут удалены без сохранения',
    cls: 'border-red-500 bg-red-50',
  },
];

/**
 * Закрытие сессии с выбором режима (сохранить / отменить).
 */
export default function SessionCloseDialog({
  open,
  session,
  closeMode,
  onCloseModeChange,
  closing,
  onBackdropClick,
  onCancel,
  onConfirm,
}) {
  if (!open || !session) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onBackdropClick}
        aria-hidden
      />

      <div className="relative bg-white rounded-xl shadow-xl p-6 w-96 space-y-4">
        <h3 className="text-base font-semibold text-gray-900">Закрыть сессию</h3>

        <p className="text-sm text-gray-600">
          Сессия{' '}
          <span className="font-medium">
            «{session.name || session.uuid || session.id}»
          </span>{' '}
          будет закрыта. Выберите режим:
        </p>

        <div className="space-y-2">
          {CLOSE_OPTIONS.map((opt) => (
            <label
              key={opt.mode}
              className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                closeMode === opt.mode ? opt.cls : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="closeMode"
                value={opt.mode}
                checked={closeMode === opt.mode}
                onChange={() => onCloseModeChange(opt.mode)}
                className="mt-0.5"
              />

              <div>
                <div className="text-sm font-medium text-gray-900">{opt.title}</div>
                <div className="text-xs text-gray-500">{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={closing}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Отмена
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={closing}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors ${
              closeMode === 'discard' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {closing ? (
              <span className="flex items-center gap-1.5">
                <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                Закрытие...
              </span>
            ) : closeMode === 'discard' ? (
              'Закрыть без сохранения'
            ) : (
              'Закрыть с сохранением'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
