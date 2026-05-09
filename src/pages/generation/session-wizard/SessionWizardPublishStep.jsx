import { StatusBadge as DefaultStatusBadge } from './sessionWizardShared.jsx';

const getCountLabel = (count, emptyLabel = '—') => {
  return count > 0 ? count : emptyLabel;
};

export default function SessionWizardPublishStep({
  session,

  cityDrafts = [],
  cityInfos = [],
  attractions = [],
  attractionInfos = [],
  attractionFeedItems = [],
  cityTags = [],

  translating,
  publishing,

  components = {},

  onGoToStep,
  onTranslateSession,
  onPublish,
}) {
  const StatusBadge = components.StatusBadge ?? DefaultStatusBadge;

  const hasCity = Boolean(session?.city) || cityDrafts.length > 0;
  const hasCityInfos = cityInfos.length > 0;
  const hasAttractions = attractions.length > 0;
  const hasAttractionInfos = attractionInfos.length > 0;
  const hasAttractionFeedItems = attractionFeedItems.length > 0;
  const hasTags = cityTags.length > 0;

  const hasAnythingToPublish =
    hasCity ||
    hasCityInfos ||
    hasAttractions ||
    hasAttractionInfos ||
    hasAttractionFeedItems ||
    hasTags;

  const imageFeedItemsCount = attractionFeedItems.filter(
    (item) => item?.item_type === 'image'
  ).length;

  const textFeedItemsCount = attractionFeedItems.filter(
    (item) => item?.item_type !== 'image'
  ).length;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Публикация</h2>

        <p className="text-sm text-gray-500">
          Проверьте данные и опубликуйте сессию. В публикацию могут попасть город,
          полезная информация, достопримечательности, лента и связанные блоки.
        </p>
      </div>

      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Сессия:</span>

          <span className="font-medium text-gray-900 text-right">
            {session?.name || '—'}
          </span>
        </div>

        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Статус:</span>

          <StatusBadge
            status={session?.status}
            label={session?.status_display}
          />
        </div>

        <div className="h-px bg-gray-200 my-2" />

        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Город:</span>

          <span className={`font-medium ${hasCity ? 'text-gray-900' : 'text-gray-400'}`}>
            {hasCity ? 'Есть' : 'Нет'}
          </span>
        </div>

        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Черновики городов:</span>

          <span className="font-medium text-gray-900">
            {getCountLabel(cityDrafts.length)}
          </span>
        </div>

        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Полезная информация о городе:</span>

          <span className="font-medium text-gray-900">
            {getCountLabel(cityInfos.length)}
          </span>
        </div>

        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Достопримечательности:</span>

          <span className="font-medium text-gray-900">
            {getCountLabel(attractions.length)}
          </span>
        </div>

        <div className="flex justify-between gap-4">
          <span className="text-gray-500">
            Полезная информация о достопримечательностях:
          </span>

          <span className="font-medium text-gray-900">
            {getCountLabel(attractionInfos.length)}
          </span>
        </div>

        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Элементы ленты:</span>

          <span className="font-medium text-gray-900">
            {getCountLabel(attractionFeedItems.length)}
          </span>
        </div>

        {hasAttractionFeedItems && (
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Лента, текст / изображения:</span>

            <span className="font-medium text-gray-900">
              {textFeedItemsCount} / {imageFeedItemsCount}
            </span>
          </div>
        )}

        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Теги:</span>

          <span className="font-medium text-gray-900 text-right">
            {hasTags ? `${cityTags.length} выбрано` : '—'}
          </span>
        </div>
      </div>

      {!hasAnythingToPublish && (
        <div className="p-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg">
          В сессии пока нет данных для публикации.
        </div>
      )}

      {hasAttractionFeedItems && !hasAttractions && (
        <div className="p-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg">
          В сессии есть элементы ленты, но нет достопримечательностей. Лента должна быть
          привязана к достопримечательности из базы или к достопримечательности из сессии.
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={() => onGoToStep(3)}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          ← Назад
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTranslateSession}
            disabled={translating || !hasAnythingToPublish}
            className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-colors"
          >
            {translating ? 'Перевод...' : 'Перевести сессию'}
          </button>

          <button
            type="button"
            onClick={onPublish}
            disabled={publishing || !hasAnythingToPublish}
            className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {publishing ? 'Публикация...' : '✓ Опубликовать сессию'}
          </button>
        </div>
      </div>
    </div>
  );
}