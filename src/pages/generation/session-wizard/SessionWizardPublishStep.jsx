import { Alert, Button, Panel, SectionHeader, SessionStatusBadge as DefaultStatusBadge, Glyph } from '@aspectum/ui';

const getCountLabel = (count, emptyLabel = '—') => {
  return count > 0 ? count : emptyLabel;
};

export default function SessionWizardPublishStep({
  session,

  cityDrafts = [],
  cityInfos = [],
  attractions = [],
  interactiveLocations = [],
  attractionInfos = [],
  attractionFeedItems = [],
  attractionAudioGuides = [],
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
  const hasInteractiveLocations = interactiveLocations.length > 0;
  const hasAttractionInfos = attractionInfos.length > 0;
  const hasAttractionFeedItems = attractionFeedItems.length > 0;
  const hasAttractionAudioGuides = attractionAudioGuides.length > 0;
  const hasTags = cityTags.length > 0;

  const hasAnythingToPublish =
    hasCity ||
    hasCityInfos ||
    hasAttractions ||
    hasInteractiveLocations ||
    hasAttractionInfos ||
    hasAttractionFeedItems ||
    hasAttractionAudioGuides ||
    hasTags;

  const imageFeedItemsCount = attractionFeedItems.filter(
    (item) => item?.item_type === 'image'
  ).length;

  const textFeedItemsCount = attractionFeedItems.filter(
    (item) => item?.item_type !== 'image'
  ).length;

  return (
    <div className="space-y-4">
      <SectionHeader title="Публикация" description="Проверьте данные и опубликуйте сессию. В публикацию могут попасть город, полезная информация, достопримечательности, лента и связанные блоки." />

      <Panel tone="muted" className="p-4 space-y-3 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-aspectum-text-muted">Сессия:</span>

          <span className="font-medium text-aspectum-text text-right">
            {session?.name || '—'}
          </span>
        </div>

        <div className="flex justify-between gap-4">
          <span className="text-aspectum-text-muted">Статус:</span>

          <StatusBadge
            status={session?.status}
            label={session?.status_display}
          />
        </div>

        <div className="h-px bg-aspectum-border my-2" />

        <div className="flex justify-between gap-4">
          <span className="text-aspectum-text-muted">Город:</span>

          <span className={`font-medium ${hasCity ? 'text-aspectum-text' : 'text-aspectum-text-disabled'}`}>
            {hasCity ? 'Есть' : 'Нет'}
          </span>
        </div>

        <div className="flex justify-between gap-4">
          <span className="text-aspectum-text-muted">Черновики городов:</span>

          <span className="font-medium text-aspectum-text">
            {getCountLabel(cityDrafts.length)}
          </span>
        </div>

        <div className="flex justify-between gap-4">
          <span className="text-aspectum-text-muted">Полезная информация о городе:</span>

          <span className="font-medium text-aspectum-text">
            {getCountLabel(cityInfos.length)}
          </span>
        </div>

        <div className="flex justify-between gap-4">
          <span className="text-aspectum-text-muted">Достопримечательности:</span>

          <span className="font-medium text-aspectum-text">
            {getCountLabel(attractions.length)}
          </span>
        </div>

        <div className="flex justify-between gap-4">
          <span className="text-aspectum-text-muted">Интерактивные локации:</span>

          <span className="font-medium text-aspectum-text">
            {getCountLabel(interactiveLocations.length)}
          </span>
        </div>

        <div className="flex justify-between gap-4">
          <span className="text-aspectum-text-muted">
            Полезная информация о достопримечательностях:
          </span>

          <span className="font-medium text-aspectum-text">
            {getCountLabel(attractionInfos.length)}
          </span>
        </div>

        <div className="flex justify-between gap-4">
          <span className="text-aspectum-text-muted">Элементы ленты:</span>

          <span className="font-medium text-aspectum-text">
            {getCountLabel(attractionFeedItems.length)}
          </span>
        </div>

        {hasAttractionFeedItems && (
          <div className="flex justify-between gap-4">
            <span className="text-aspectum-text-muted">Лента, текст / изображения:</span>

            <span className="font-medium text-aspectum-text">
              {textFeedItemsCount} / {imageFeedItemsCount}
            </span>
          </div>
        )}

        <div className="flex justify-between gap-4">
          <span className="text-aspectum-text-muted">Теги:</span>

          <span className="font-medium text-aspectum-text text-right">
            {hasTags ? `${cityTags.length} выбрано` : '—'}
          </span>
        </div>
      </Panel>

      {!hasAnythingToPublish && (
        <Alert tone="warning">В сессии пока нет данных для публикации.</Alert>
      )}

      {hasAttractionFeedItems && !hasAttractions && (
        <Alert tone="warning">
          В сессии есть элементы ленты, но нет достопримечательностей. Лента должна быть
          привязана к достопримечательности из базы или к достопримечательности из сессии.
        </Alert>
      )}

      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" size="md" onClick={() => onGoToStep(4)}>
          ← Назад
        </Button>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="softIndigo"
            size="md"
            onClick={onTranslateSession}
            disabled={translating || !hasAnythingToPublish}
          >
            {translating ? 'Перевод...' : 'Перевести сессию'}
          </Button>

          <Button type="button" variant="success" size="md" onClick={onPublish} disabled={publishing || !hasAnythingToPublish}>
            {publishing ? 'Публикация...' : <><Glyph name="✓" /> Опубликовать сессию</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
