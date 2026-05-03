import { StatusBadge as DefaultStatusBadge } from './sessionWizardShared.jsx';

export default function SessionWizardPublishStep({
  session,
  attractions,
  cityTags,
  translating,
  publishing,
  components = {},
  onGoToStep,
  onTranslateSession,
  onPublish,
}) {
  const StatusBadge = components.StatusBadge ?? DefaultStatusBadge;
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Публикация</h2>
        <p className="text-sm text-gray-500">Проверьте данные и опубликуйте сессию.</p>
      </div>
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-gray-500">Сессия:</span><span className="font-medium">{session.name}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Статус:</span><StatusBadge status={session.status} label={session.status_display} /></div>
        <div className="flex justify-between"><span className="text-gray-500">Достопримечательности:</span><span className="font-medium">{attractions.length}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Теги:</span><span className="font-medium">{cityTags.length > 0 ? cityTags.join(', ') : '—'}</span></div>
      </div>
      <div className="flex justify-between pt-2">
        <button onClick={() => onGoToStep(4)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          ← Назад
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={onTranslateSession}
            disabled={translating}
            className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-colors"
          >
            {translating ? 'Перевод...' : 'Перевести сессию'}
          </button>
          <button
            onClick={onPublish}
            disabled={publishing}
            className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {publishing ? 'Публикация...' : '✓ Опубликовать город'}
          </button>
        </div>
      </div>
    </div>
  );
}