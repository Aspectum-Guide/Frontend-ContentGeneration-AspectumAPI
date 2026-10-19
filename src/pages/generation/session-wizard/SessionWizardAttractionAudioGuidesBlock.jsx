import { useEffect, useRef, useState } from 'react';
import { FormLabel, Alert, Button, ConfirmModal, EmptyState, EntityDraftsPanel, FileButton, IconButton, LocaleEditor, Panel, SectionHeader, Select, SelectableCard, Spinner, Textarea, TextInput, Glyph } from '@aspectum/ui';

import { audioAPI } from '../../../api/generation';
import AiGenerationModal from '../../../components/generation/AiGenerationModal.jsx';
import { WizardActionFooter as WizardGenerationActionFooter } from '@aspectum/ui';
import AiGenerationQualitySettings from '../../../components/generation/AiGenerationQualitySettings.jsx';

import { getAttrName, normalizeId } from './sessionWizardShared.jsx';

const getAttractionDisplayName = (attraction) => {
  if (!attraction) return 'Без названия';

  try {
    const name = getAttrName(attraction);

    if (name && name !== '(без названия)') {
      return name;
    }
  } catch {
    // ignore
  }

  if (typeof attraction.name === 'string') {
    return attraction.name || 'Без названия';
  }

  if (attraction.name && typeof attraction.name === 'object') {
    return (
      attraction.name.ru ||
      attraction.name.en ||
      attraction.name.it ||
      Object.values(attraction.name).find(Boolean) ||
      attraction.id ||
      'Без названия'
    );
  }

  if (typeof attraction.title === 'string') {
    return attraction.title || 'Без названия';
  }

  if (attraction.title && typeof attraction.title === 'object') {
    return (
      attraction.title.ru ||
      attraction.title.en ||
      attraction.title.it ||
      Object.values(attraction.title).find(Boolean) ||
      attraction.id ||
      'Без названия'
    );
  }

  return (
    attraction.display_name ||
    attraction.name_ru ||
    attraction.title_ru ||
    attraction.id ||
    'Без названия'
  );
};

const getAudioGuideName = (guide) => {
  if (!guide) return '(без названия)';

  const title = guide.title || guide.name || {};

  if (typeof title === 'string') {
    return title || '(без названия)';
  }

  if (title && typeof title === 'object') {
    return (
      title.ru ||
      title.en ||
      title.it ||
      Object.values(title).find(Boolean) ||
      '(без названия)'
    );
  }

  return guide.display_name || guide.id || '(без названия)';
};

const getDatabaseAttractionId = (guide) => {
  return normalizeId(
    guide?.event_id ??
      guide?.event ??
      guide?.attraction_id ??
      guide?.attraction
  );
};

const getSessionAttractionId = (guide) => {
  return normalizeId(
    guide?.session_attraction_id ??
      guide?.session_attraction
  );
};

const getAudioGuideBindingLabel = (
  guide,
  referenceAttractions = [],
  sessionAttractions = []
) => {
  const assignedAttractionType = guide?.assigned_attraction_type || 'none';

  if (assignedAttractionType === 'database') {
    const attractionFromGuide =
      guide?.event && typeof guide.event === 'object' ? guide.event : null;

    const attractionId = getDatabaseAttractionId(guide);

    const attraction =
      attractionFromGuide ||
      referenceAttractions.find(
        (item) => normalizeId(item.id) === attractionId
      );

    return attraction
      ? `Достопримечательность из базы: ${getAttractionDisplayName(attraction)}`
      : 'Достопримечательность из базы: не выбрана';
  }

  if (assignedAttractionType === 'draft') {
    const attractionFromGuide =
      guide?.session_attraction && typeof guide.session_attraction === 'object'
        ? guide.session_attraction
        : null;

    const attractionId = getSessionAttractionId(guide);

    const attraction =
      attractionFromGuide ||
      sessionAttractions.find(
        (item) => normalizeId(item.id) === attractionId
      );

    return attraction
      ? `Достопримечательность из сессии: ${getAttractionDisplayName(attraction)}`
      : 'Достопримечательность из сессии: не выбрана';
  }

  return 'Без достопримечательности';
};

function AttractionAudioTrackPreview({
  trackAudioId,
  trackAudioUrl,
  chapters = [],
  downloadName = 'audio-guide.mp3',
  durationSeconds = null,
  onRegenerateChapter = null,
  regeneratingChapterId = null,
}) {
  const audioRef = useRef(null);
  const blobUrlRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const normalizedChapters = Array.isArray(chapters)
    ? chapters.filter((chapter) => Number.isFinite(Number(chapter?.start_seconds)))
    : [];
  const durationLabel = formatAudioDuration(durationSeconds);

  const seekToChapter = (chapter) => {
    const startSeconds = Number(chapter?.start_seconds);
    const audio = audioRef.current;

    if (!audio || !Number.isFinite(startSeconds)) return;

    const wasPaused = audio.paused;
    audio.currentTime = Math.max(0, startSeconds);

    if (!wasPaused) {
      audio.play().catch(() => {});
    }
  };

  useEffect(() => {
    let cancelled = false;

    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setPreviewUrl(null);
    setLoadError(false);

    if (!trackAudioId) {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);

    (async () => {
      try {
        const res = await audioAPI.getBlobByAudioId(trackAudioId);
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(res.data);
        blobUrlRef.current = objectUrl;
        setPreviewUrl(objectUrl);
      } catch {
        if (!cancelled) {
          setLoadError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [trackAudioId]);

  if (!trackAudioUrl && !trackAudioId) {
    return null;
  }

  if (trackAudioUrl && !trackAudioId) {
    return (
      <div className="space-y-2">
        <Alert tone="warning" className="text-xs">
          Не удалось загрузить аудио для прослушивания (нет audio_id; защищённое
          воспроизведение недоступно).
        </Alert>

        <p className="text-xs text-aspectum-text-muted break-all">
          <span className="text-aspectum-text-disabled">URL:</span> {trackAudioUrl}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {durationLabel ? (
        <p className="text-xs font-medium text-aspectum-text-subtle">
          Итоговый аудиофайл: {durationLabel}
        </p>
      ) : null}

      {normalizedChapters.length > 0 ? (
        <Panel tone="muted" className="space-y-1 p-2">
          <p className="text-xs font-medium text-aspectum-text-subtle">Главы и тайм-коды</p>
          <div className="flex flex-wrap gap-2">
            {normalizedChapters.map((chapter, index) => {
              const startLabel = formatAudioDuration(chapter.start_seconds);
              const endLabel = formatAudioDuration(chapter.end_seconds);
              const title = chapter.title || `Глава ${index + 1}`;
              const planItemId = chapter.plan_item_id;
              const isRegenerating =
                planItemId && regeneratingChapterId === planItemId;
              const regenBusy = Boolean(regeneratingChapterId);

              return (
                <div
                  key={`${planItemId || index}-${chapter.start_seconds}`}
                  className="flex items-stretch overflow-hidden rounded-aspectum-compact border border-aspectum-primary-muted bg-aspectum-surface shadow-aspectum-card"
                >
                  <Button
                    type="button"
                    onClick={() => seekToChapter(chapter)}
                    title={`Перейти к главе: ${title}`}
                    variant="soft"
                    size="sm"
                  >
                    <span className="font-semibold">{startLabel}</span>
                    {endLabel ? <span className="text-aspectum-primary-light">-{endLabel}</span> : null}
                    <span className="ml-1 text-aspectum-text-strong">{title}</span>
                  </Button>

                  {onRegenerateChapter && planItemId ? (
                    <Button
                      type="button"
                      onClick={() => onRegenerateChapter(planItemId)}
                      disabled={regenBusy}
                      title="Перегенерировать эту главу"
                      variant="joinedGhost"
                      size="sm"
                    >
                      {isRegenerating ? '…' : <Glyph name="↻" />}
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Panel>
      ) : (
        <p className="text-xs text-aspectum-text-muted">
          Тайминги глав пока не сохранены. После перегенерации аудио здесь
          появятся кликабельные переходы по главам.
        </p>
      )}

      {loading ? (
        <p className="text-xs text-aspectum-text-subtle">Загрузка аудио...</p>
      ) : null}

      {loadError ? (
        <Alert tone="error" className="text-xs">
          Не удалось загрузить аудио для прослушивания
        </Alert>
      ) : null}

      {!loading && !loadError && previewUrl ? (
        <>
          <audio
            key={previewUrl}
            ref={audioRef}
            controls
            preload="metadata"
            src={previewUrl}
            className="w-full"
          />
          {/* blob-URL прячет встроенное «Скачать» в плеере Chrome — даём явную кнопку */}
          <a
            href={previewUrl}
            download={downloadName}
            className="inline-flex items-center gap-1 text-xs font-medium text-aspectum-primary-hover hover:text-aspectum-primary-emphasis"
          >
            <Glyph name="⬇" /> Скачать MP3
          </a>
        </>
      ) : null}
    </div>
  );
}

function AudioGuideDraftsPanel({
  attractionAudioGuides = [],
  currentAttractionAudioGuide,
  onSelectAudioGuide,
  onAddAudioGuide,
}) {
  const currentId = normalizeId(currentAttractionAudioGuide?.id);

  return (
    <EntityDraftsPanel
      title="Черновики аудиогидов"
      items={attractionAudioGuides}
      emptyText="Пока нет аудиогидов"
      actions={(
        <Button type="button" onClick={onAddAudioGuide} variant="softStrong" size="sm">
          + Добавить
        </Button>
      )}
      renderItem={(guide, index) => {
        const guideId = normalizeId(guide.id);
        const isActive = guideId === currentId;
        return (
              <SelectableCard
                key={guide.id}
                onSelect={() => {
                  if (!isActive) {
                    onSelectAudioGuide?.(guide.id);
                  }
                }}
                ariaLabel={getAudioGuideName(guide)}
                className={`flex items-center gap-1 px-2 py-1 rounded-aspectum-control border text-xs transition-colors ${
                  isActive
                    ? 'bg-aspectum-primary-soft border-aspectum-primary-border-strong text-aspectum-primary-hover font-medium'
                    : 'bg-aspectum-surface border-aspectum-border text-aspectum-text-strong hover:border-aspectum-primary-border-strong hover:bg-aspectum-primary-soft'
                }`}
                title={getAudioGuideName(guide)}
              >
                <span className="text-aspectum-text-disabled">{index + 1}.</span>
                <span>{getAudioGuideName(guide)}</span>
              </SelectableCard>
        );
      }}
    />
  );
}

const resolveElevenLabsSettingsDisplayMessage = (settings, error = '') => {
  const voices = Array.isArray(settings?.voices) ? settings.voices : [];
  const hasVoices = voices.length > 0;

  if (hasVoices) {
    return '';
  }

  if (settings?.configured === false) {
    return 'ElevenLabs не настроен: отсутствует ELEVENLABS_API_KEY';
  }

  const category = settings?.error_category || '';

  if (category === 'elevenlabs_access_restricted') {
    return (
      'ElevenLabs недоступен с текущего IP или региона сервера. Список голосов нельзя загрузить. ' +
      'Генерация аудио также может быть недоступна, пока backend запущен с этого IP.'
    );
  }

  if (category === 'elevenlabs_network_error' || category === 'elevenlabs_unavailable') {
    return (
      'Не удалось загрузить список голосов ElevenLabs. Генерация будет выполнена голосом по умолчанию.'
    );
  }

  if (error) {
    return error;
  }

  return '';
};

const buildElevenLabsVoiceLabel = (voice) => {
  if (!voice) return '';

  const parts = [`${voice.name || voice.voice_id}`, voice.category || 'voice'];
  const labels = voice.labels || {};
  const labelParts = [labels.gender, labels.accent, labels.language, labels.age].filter(
    Boolean,
  );

  if (labelParts.length) {
    parts.push(labelParts.join(', '));
  }

  return parts.join(' · ');
};

const formatAudioDuration = (seconds) => {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value < 0) return '';

  const total = Math.max(0, Math.round(value));
  const minutes = Math.floor(total / 60);
  const restSeconds = total % 60;

  return `${minutes}:${String(restSeconds).padStart(2, '0')}`;
};

const getTrackChapters = (track) => {
  if (Array.isArray(track?.chapters)) return track.chapters;
  if (Array.isArray(track?.chapter_timings)) return track.chapter_timings;
  return [];
};

export function TTSProviderSettingsPanel({
  provider = 'fish_audio',
  providerSettings = null,
  providerSettingsLoading = false,
  providerSettingsError = '',
  elevenLabsSettings = null,
  elevenLabsLoading = false,
  elevenLabsError = '',
  voiceId = '',
  modelId = '',
  onProviderChange,
  onVoiceChange,
  onModelChange,
  onLoadProviderSettings,
  onLoadElevenLabsSettings,
  disabled = false,
}) {
  const loadTriggeredRef = useRef(false);
  const previewAudioRef = useRef(null);
  const [fishVoiceMode, setFishVoiceMode] = useState(() =>
    voiceId ? 'custom' : 'default',
  );

  useEffect(() => {
    if (!loadTriggeredRef.current) {
      loadTriggeredRef.current = true;
      onLoadProviderSettings?.();
    }
  }, [onLoadProviderSettings]);

  useEffect(() => {
    if (provider === 'elevenlabs') onLoadElevenLabsSettings?.();
  }, [provider, onLoadElevenLabsSettings]);

  useEffect(() => {
    if (provider === 'fish_audio' && voiceId) {
      setFishVoiceMode('custom');
    }
  }, [provider, voiceId]);

  const providerList = Array.isArray(providerSettings?.providers)
    ? providerSettings.providers
    : [];
  const providerConfig = providerList.find((item) => item?.id === provider) || null;
  const projectVoiceLanguages = Object.keys(
    providerConfig?.defaults?.voice_ids || {},
  );
  const providerModels = Array.isArray(providerConfig?.models) ? providerConfig.models : [];
  const elevenLabsModels = Array.isArray(elevenLabsSettings?.models)
    ? elevenLabsSettings.models
    : [];
  const models = provider === 'elevenlabs' && elevenLabsModels.length
    ? elevenLabsModels
    : providerModels;
  const voices = Array.isArray(elevenLabsSettings?.voices)
    ? elevenLabsSettings.voices
    : [];
  const hasVoices = voices.length > 0;
  const selectedVoice = voices.find((voice) => voice.voice_id === voiceId);
  const previewUrl = selectedVoice?.preview_url || '';
  const displayMessage = resolveElevenLabsSettingsDisplayMessage(
    elevenLabsSettings,
    elevenLabsError,
  );
  const voiceSelectDisabledState = disabled || elevenLabsLoading || !hasVoices;

  const handlePreview = () => {
    if (!previewUrl) return;

    if (!previewAudioRef.current) {
      previewAudioRef.current = new Audio(previewUrl);
    } else {
      previewAudioRef.current.pause();
      previewAudioRef.current.src = previewUrl;
    }

    previewAudioRef.current.play().catch(() => {});
  };

  return (
    <Panel className="space-y-3 px-3 py-3">
      <div>
        <FormLabel  layout="block" size="sm" weight="medium" tone="emphasis" spacing="xs">
          Провайдер озвучки
        </FormLabel>
        <Select className="disabled:opacity-50" value={provider} onChange={(event) => onProviderChange?.(event.target.value)} disabled={disabled || providerSettingsLoading}>
          <option value="fish_audio">Fish Audio — S2.1 Pro Free (по умолчанию)</option>
          <option value="elevenlabs">ElevenLabs</option>
        </Select>
      </div>

      {providerSettingsLoading ? (
        <p className="text-xs text-aspectum-text-muted">Загружаем настройки TTS…</p>
      ) : null}
      {providerSettingsError ? (
        <Alert tone="warning" className="text-xs">{providerSettingsError}</Alert>
      ) : null}
      {providerConfig?.configured === false ? (
        <Alert tone="error" className="text-xs">
          Ключ этого провайдера не настроен на сервере.
        </Alert>
      ) : null}
      {provider === 'fish_audio' &&
      modelId !== 's2.1-pro-free' &&
      providerConfig?.credit &&
      Number(providerConfig.credit.credit || 0) <= 0 &&
      !providerConfig.credit.has_free_credit ? (
        <Alert tone="error" className="text-xs">
          На Fish Audio нет доступного API-кредита. Активируйте промо или пополните
          API credit в кабинете Fish Audio.
        </Alert>
      ) : null}
      {providerConfig?.warning ? (
        <Alert tone="warning" className="text-xs">{providerConfig.warning}</Alert>
      ) : null}

      {provider === 'fish_audio' ? (
        <>
          <div>
            <FormLabel  layout="block" size="sm" weight="medium" tone="emphasis" spacing="xs">Модель</FormLabel>
            <Select className="disabled:opacity-50" value={modelId || 's2.1-pro-free'} onChange={(event) => onModelChange?.(event.target.value)} disabled={disabled}>
              {(models.length ? models : [
                { model_id: 's2.1-pro-free', name: 'S2.1 Pro Free', recommended: true },
                { model_id: 's2-pro', name: 'S2-Pro' },
                { model_id: 's1', name: 'S1' },
              ]).map((model) => (
                <option key={model.model_id} value={model.model_id}>
                  {model.name || model.model_id}
                  {model.recommended ? ' — рекомендуется' : ''}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FormLabel  layout="block" size="sm" weight="medium" tone="emphasis" spacing="xs">Голос</FormLabel>
            <Select className="disabled:opacity-50" value={fishVoiceMode} onChange={(event) => { const nextMode = event.target.value; setFishVoiceMode(nextMode); if (nextMode === 'default') { onVoiceChange?.(''); } }} disabled={disabled}>
              <option value="default">
                {projectVoiceLanguages.length
                  ? 'Голос проекта для каждого языка'
                  : 'Стандартный голос Fish Audio'}
              </option>
              <option value="custom">Конкретный голос по Reference ID</option>
            </Select>
            {fishVoiceMode === 'default' && projectVoiceLanguages.length ? (
              <p className="mt-1 text-xs text-aspectum-text-muted">
                Сервер сам подберёт голос по языку дорожки:{' '}
                {projectVoiceLanguages.map((lang) => lang.toUpperCase()).join(', ')}.
              </p>
            ) : null}
            {fishVoiceMode === 'custom' && projectVoiceLanguages.length ? (
              <Alert tone="warning" className="mt-1 text-xs">
                Этот голос уйдёт на все выбранные языки.
              </Alert>
            ) : null}
          </div>
          {fishVoiceMode === 'custom' ? (
            <div>
              <FormLabel  layout="block" size="sm" weight="medium" tone="emphasis" spacing="xs">
                Reference ID голоса
              </FormLabel>
              <TextInput className="disabled:opacity-50" value={voiceId} onChange={(event) => onVoiceChange?.(event.target.value)} disabled={disabled} placeholder="Введите Reference ID из Fish Audio" />
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div>
            <FormLabel  layout="block" size="sm" weight="medium" tone="emphasis" spacing="xs">Модель</FormLabel>
            <Select className="disabled:opacity-50" value={modelId || ''} onChange={(event) => onModelChange?.(event.target.value)} disabled={disabled || elevenLabsLoading}>
              {models.length ? (
                models.map((model) => (
                  <option key={model.model_id} value={model.model_id}>
                    {model.name || model.model_id}
                  </option>
                ))
              ) : (
                <option value="">Модель ElevenLabs по умолчанию</option>
              )}
            </Select>
          </div>
          <FormLabel  layout="block" size="sm" weight="medium" tone="emphasis">Голос</FormLabel>
          {elevenLabsLoading ? (
            <p className="text-xs text-aspectum-text-muted">Загружаем голоса…</p>
          ) : null}
          {displayMessage ? (
            <Alert tone="warning" className="text-xs">{displayMessage}</Alert>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Select className="min-w-[220px] flex-1 disabled:opacity-50" value={voiceId || ''} onChange={(event) => onVoiceChange?.(event.target.value)} disabled={voiceSelectDisabledState}>
              {!hasVoices ? (
                <option value="">Голоса недоступны</option>
              ) : (
                voices.map((voice) => (
                  <option key={voice.voice_id} value={voice.voice_id}>
                    {buildElevenLabsVoiceLabel(voice)}
                  </option>
                ))
              )}
            </Select>
            <Button
              type="button"
              onClick={handlePreview}
              disabled={!previewUrl || voiceSelectDisabledState}
              variant="outline"
              size="sm"
            >
              <Glyph name="▶" /> Прослушать
            </Button>
          </div>
        </>
      )}
    </Panel>
  );
}

export default function SessionWizardAttractionAudioGuidesBlock({
  embedded = false,
  scopedToAttractionId = '',

  attractionAudioGuides = [],
  currentAttractionAudioGuide,
  attractionAudioGuideLocaleData = {},
  attractionAudioGuideActiveLocale = 'ru-RU',
  attractionAudioGuideSaving = false,
  attractionAudioGuideAutoSaving = false,
  attractionAudioGuideAutoSaved = false,
  attractionAudioUploading = false,
  audioGuideGeneratingPlan = false,
  audioGuidePlanGenerateModalOpen = false,
  audioGuidePlanGeneratePrompt = '',
  audioGuidePlanGenerationError = '',
  audioGuideGeneratingAllMainText = false,
  audioGuideMainTextGenerateModalOpen = false,
  audioGuideMainTextGeneratePrompt = '',
  audioGuideMainTextGenerationError = '',
  audioGuideGeneratingItemTextById = {},
  audioGuideItemTextGenerateModalOpen = false,
  audioGuideItemTextGenerateItemId = null,
  audioGuideItemTextGenerateItemTitle = '',
  audioGuideItemTextGeneratePrompt = '',
  audioGuideItemTextGenerationError = '',
  generatingAudioGuideTrack = false,
  audioGuideTrackGenerationError = null,
  audioGuidePlanGenerationState = {},

  referenceAttractions = [],
  attractions = [],

  onOpenAttractionAudioGuideDetail,
  onAddAttractionAudioGuide,
  onSetCurrentAttractionAudioGuide,
  onSetAttractionAudioGuideActiveLocale,
  onUpdateAttractionAudioGuideLocaleField,
  onUpdateCurrentAttractionAudioGuidePatch,
  onUpdateAttractionAudioGuidePlanPoint,
  onAddAttractionAudioGuidePlanPoint,
  onRemoveAttractionAudioGuidePlanPoint,
  onUpdateAttractionAudioGuidePlanItemText,
  onImportAttractionAudioGuidePlanFromText,
  onShowNote,
  onSaveCurrentAttractionAudioGuide,
  onDeleteCurrentAttractionAudioGuide,
  onUploadAttractionAudioGuideTrack,
  onRemoveAttractionAudioGuideTrack,
  onGenerateAttractionAudioGuidePlan,
  onOpenAttractionAudioGuidePlanGenerateModal,
  onCloseAttractionAudioGuidePlanGenerateModal,
  onSetAudioGuidePlanGeneratePrompt,
  onSetAttractionAudioGuidePlanItemsCount,
  onOpenAttractionAudioGuideMainTextGenerateModal,
  onCloseAttractionAudioGuideMainTextGenerateModal,
  onSetAudioGuideMainTextGeneratePrompt,
  onGenerateAttractionAudioGuideMainText,
  onGenerateAttractionAudioGuideMainTextItem,
  onOpenAttractionAudioGuideMainTextItemGenerateModal,
  onCloseAttractionAudioGuideMainTextItemGenerateModal,
  onSetAudioGuideItemTextGeneratePrompt,
  aiGenerationMode = 'instant',
  aiUseWebSearch = false,
  aiAdvancedGenerationAvailable = true,
  onAiGenerationModeChange,
  onAiUseWebSearchChange,
  onGenerateAttractionAudioGuideTrackAudio,
  onRegenerateAttractionAudioGuideChapter,
  audioGuideRegeneratingChapterId = null,
  onGenerateAttractionAudioGuideTtsStress,
  onSetAttractionAudioGuideStressText,
  audioGuideStressBusyId = null,
  onBuildSessionStressDictionary,
  buildingStressDictionary = false,
  elevenLabsSettingsLoading = false,
  elevenLabsSettingsError = '',
  elevenLabsSettings = null,
  ttsSettingsLoading = false,
  ttsSettingsError = '',
  ttsSettings = null,
  audioGuideTtsProvider = 'fish_audio',
  audioGuideTtsVoiceId = '',
  audioGuideTtsModelId = 's2.1-pro-free',
  onLoadTtsSettings,
  onSetAudioGuideTtsProvider,
  onLoadElevenLabsSettings,
  onSetAudioGuideTtsVoiceId,
  onSetAudioGuideTtsModelId,
  onGoToStep,
}) {
  const audioFileRef = useRef(null);
  const [planImportText, setPlanImportText] = useState('');
  const [planImportConfirmOpen, setPlanImportConfirmOpen] = useState(false);
  // Провайдер для расстановки ударений: '' = по настройке AI_PROVIDER
  const [stressProvider, setStressProvider] = useState('');

  const itemTextModalGenerating = Boolean(
    audioGuideItemTextGenerateItemId &&
      audioGuideGeneratingItemTextById?.[audioGuideItemTextGenerateItemId],
  );

  const currentLocale =
    attractionAudioGuideLocaleData[attractionAudioGuideActiveLocale] || {};

  const assignedAttractionType =
    currentAttractionAudioGuide?.assigned_attraction_type || 'none';

  const selectedDatabaseAttractionId = getDatabaseAttractionId(
    currentAttractionAudioGuide
  );

  const selectedSessionAttractionId = getSessionAttractionId(
    currentAttractionAudioGuide
  );

  const updatePatch = (patch) => {
    onUpdateCurrentAttractionAudioGuidePatch?.(patch);
  };

  const handleAudioFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    onUploadAttractionAudioGuideTrack?.(file);
  };

  if (!currentAttractionAudioGuide) {
    return (
      <section className="space-y-4">
        <SectionHeader title="Аудиогид к достопримечательности" description="Загружайте мультиязычные аудиогиды к достопримечательностям." actions={<Button
            type="button"
            onClick={onAddAttractionAudioGuide}
            variant="primary"
            size="md"
          >
            + Добавить
          </Button>} />

        {attractionAudioGuides.length === 0 ? (
          <EmptyState
            icon="🎧"
            title={scopedToAttractionId
              ? 'Для этой достопримечательности пока нет аудиогидов.'
              : 'Нет аудиогидов'}
            description={scopedToAttractionId ? 'Добавьте первый аудиогид.' : 'Нажмите «+ Добавить», чтобы начать.'}
            className="py-10"
          />
        ) : (
          <div className="space-y-2">
            {attractionAudioGuides.map((guide, idx) => (
              <div
                key={guide.id}
                onClick={() => onOpenAttractionAudioGuideDetail?.(guide.id)}
                className="flex items-center justify-between p-3 bg-aspectum-surface border border-aspectum-border rounded-aspectum-control hover:border-aspectum-primary-border-strong hover:bg-aspectum-primary-soft cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 h-6 flex items-center justify-center rounded-full bg-aspectum-surface-subtle text-xs font-medium text-aspectum-text-subtle shrink-0">
                    {idx + 1}
                  </span>

                  <div className="min-w-0">
                    <div className="text-sm font-medium text-aspectum-text truncate">
                      {getAudioGuideName(guide)}
                    </div>

                    <div className="text-xs text-aspectum-text-muted">
                      {getAudioGuideBindingLabel(
                        guide,
                        referenceAttractions,
                        attractions
                      )}
                    </div>
                  </div>
                </div>

                <span className="text-xs text-aspectum-primary font-medium shrink-0">
                  Открыть →
                </span>
              </div>
            ))}
          </div>
        )}

        {!embedded && (
          <div className="flex justify-between pt-2">
            <Button
              type="button"
              onClick={() => onGoToStep?.(3)}
              variant="outline"
              size="md"
            >
              ← Назад
            </Button>

            <Button
              type="button"
              onClick={() => onGoToStep?.(4)}
              variant="primary"
              size="md"
            >
              Далее: Публикация →
            </Button>
          </div>
        )}
      </section>
    );
  }

  const planPoints = Array.isArray(currentLocale.contentPlan)
    ? currentLocale.contentPlan
    : [];

  const currentGuideId = normalizeId(currentAttractionAudioGuide?.id);
  const planContentLang = currentLocale.lang || 'ru';
  const planGenLocaleState =
    audioGuidePlanGenerationState?.[currentGuideId]?.[planContentLang];
  const planItemsCountRaw =
    typeof planGenLocaleState === 'object' && planGenLocaleState !== null
      ? planGenLocaleState.desiredItemsCount
      : 6;
  const planGenerationControlsDisabled =
    audioGuideGeneratingPlan ||
    attractionAudioGuideSaving ||
    audioGuideGeneratingAllMainText;

  const trackAudioId = currentLocale.track?.audio_id || null;
  const trackAudioUrl = currentLocale.track?.audio_url || '';
  const hasTrackAudio = Boolean(trackAudioId || trackAudioUrl);
  const trackChapters = getTrackChapters(currentLocale.track);
  const planLang = currentLocale.lang || 'ru';

  const hasTextForEveryPlanItem =
    planPoints.length > 0 &&
    planPoints.every((point) => {
      const itemId = point?.id;
      if (!itemId) return false;
      const text =
        currentAttractionAudioGuide?.content_texts?.[planLang]?.[itemId];
      return typeof text === 'string' && text.trim().length > 0;
    });

  const canGenerateFullAudio =
    hasTextForEveryPlanItem &&
    !generatingAudioGuideTrack &&
    !audioGuideGeneratingPlan &&
    !audioGuideGeneratingAllMainText &&
    !attractionAudioGuideSaving &&
    !attractionAudioUploading;

  const importPlanFromText = () => {
    const raw = planImportText.trim();
    if (!raw) return;

    const created = onImportAttractionAudioGuidePlanFromText?.(
      currentLocale.lang,
      raw,
    );

    if (!created) {
      onShowNote?.(
        'Не удалось распознать пункты. Заголовки глав должны начинаться с «# ».',
        'error',
      );
      return;
    }

    setPlanImportText('');
    onShowNote?.(`Импортировано пунктов плана: ${created}`, 'success');
  };

  const handleImportPlanFromText = () => {
    if (planPoints.length > 0) {
      setPlanImportConfirmOpen(true);
      return;
    }
    importPlanFromText();
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <IconButton
          label="Вернуться к списку аудиогидов"
          type="button"
          onClick={() => onSetCurrentAttractionAudioGuide?.(null)}
          variant="outline"
          className="w-8 h-8"
        >
          ←
        </IconButton>

        <span className="text-base font-semibold text-aspectum-text">
          {getAudioGuideName(currentAttractionAudioGuide)}
        </span>

        <Button
          type="button"
          onClick={onDeleteCurrentAttractionAudioGuide}
          variant="softDanger"
          size="sm"
          className="ml-auto"
        >
          Удалить
        </Button>
      </div>

      <AudioGuideDraftsPanel
        attractionAudioGuides={attractionAudioGuides}
        currentAttractionAudioGuide={currentAttractionAudioGuide}
        onSelectAudioGuide={onOpenAttractionAudioGuideDetail}
        onAddAudioGuide={onAddAttractionAudioGuide}
      />

      <LocaleEditor
        localeData={attractionAudioGuideLocaleData}
        activeLocale={attractionAudioGuideActiveLocale}
        onSwitch={onSetAttractionAudioGuideActiveLocale}
        showStatus={false}
      />

      <main className="space-y-4">
        <div>
          <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="xs">
            Название ({currentLocale.lang?.toUpperCase() || 'RU'})
          </FormLabel>

          <TextInput type="text" value={currentLocale.title || ''} onChange={(e) => onUpdateAttractionAudioGuideLocaleField?.('title', e.target.value) } placeholder="Например: Аудиогид по Колизею" />
        </div>

        <Panel tone="muted" className="p-3 space-y-3">
          <div>
            <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="xs">
              Привязка к достопримечательности
            </FormLabel>

            <Select className="bg-aspectum-surface" value={assignedAttractionType} onChange={(e) => { const type = e.target.value; updatePatch({ assigned_attraction_type: type, event: null, event_id: null, attraction: null, attraction_id: null, session_attraction: null, session_attraction_id: null, }); }}>
              <option value="none">Без достопримечательности</option>
              <option value="database">Достопримечательность из базы</option>
              <option value="draft">Достопримечательность из сессии</option>
            </Select>
          </div>

          {assignedAttractionType === 'database' && (
            <div>
              <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="xs">
                Достопримечательность из базы
              </FormLabel>

              <Select className="bg-aspectum-surface" value={selectedDatabaseAttractionId} onChange={(e) => { const attractionId = e.target.value || null; updatePatch({ assigned_attraction_type: 'database', event: attractionId, event_id: attractionId, attraction: attractionId, attraction_id: attractionId, session_attraction: null, session_attraction_id: null, }); }}>
                <option value="">Выберите достопримечательность из базы</option>

                {referenceAttractions.map((attraction) => (
                  <option key={attraction.id} value={attraction.id}>
                    {getAttractionDisplayName(attraction)}
                  </option>
                ))}
              </Select>

              {referenceAttractions.length === 0 && (
                <Alert tone="warning" className="mt-1 text-xs">
                  Список достопримечательностей из базы не загружен.
                </Alert>
              )}
            </div>
          )}

          {assignedAttractionType === 'draft' && (
            <div>
              <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="xs">
                Достопримечательность из сессии
              </FormLabel>

              <Select className="bg-aspectum-surface" value={selectedSessionAttractionId} onChange={(e) => { const attractionId = e.target.value || null; updatePatch({ assigned_attraction_type: 'draft', session_attraction: attractionId, session_attraction_id: attractionId, event: null, event_id: null, attraction: null, attraction_id: null, }); }}>
                <option value="">Выберите достопримечательность из сессии</option>

                {attractions.map((attraction) => (
                  <option key={attraction.id} value={attraction.id}>
                    {getAttractionDisplayName(attraction)}
                  </option>
                ))}
              </Select>

              {attractions.length === 0 && (
                <Alert tone="warning" className="mt-1 text-xs">
                  В текущей сессии пока нет достопримечательностей.
                </Alert>
              )}
            </div>
          )}
        </Panel>

        <div>
          <div className="flex items-center justify-between mb-1">
            <FormLabel  size="sm" weight="medium" tone="strong">
              План содержания ({currentLocale.lang?.toUpperCase() || 'RU'})
            </FormLabel>

          </div>

          <div className="space-y-2 mb-3">
            <div>
              <FormLabel  layout="block" size="xs" weight="medium" tone="subtle" spacing="xs">
                Количество пунктов плана
              </FormLabel>
              <TextInput className="block w-24 disabled:opacity-50 disabled:cursor-not-allowed" type="number" min={1} max={20} value={planItemsCountRaw ?? 6} onChange={(e) => onSetAttractionAudioGuidePlanItemsCount?.( currentGuideId, planContentLang, e.target.value, ) } disabled={planGenerationControlsDisabled} />
            </div>

            <Panel className="p-3 space-y-2">
              <div>
                <FormLabel
                  htmlFor="audio-guide-plan-import"
                   layout="block" size="xs" weight="medium" tone="strong"
                >
                  Вставить готовый план и тексты
                </FormLabel>
                <p className="mt-0.5 text-[11px] leading-snug text-aspectum-text-muted">
                  Строки с «# Заголовок» станут пунктами плана, а текст под каждым
                  заголовком — основным текстом соответствующего пункта. Заполнит план
                  для текущего языка ({currentLocale.lang?.toUpperCase() || 'RU'}).
                </p>
              </div>

              <Textarea className="disabled:bg-aspectum-surface-subtle" id="audio-guide-plan-import" rows={5} value={planImportText} onChange={(e) => setPlanImportText(e.target.value)} disabled={planGenerationControlsDisabled} placeholder={ '# Красный песчаник фасада\n\nТекст первого пункта…\n\n# От выставки к коллекции\n\nТекст второго пункта…' } />

              <Button
                type="button"
                onClick={handleImportPlanFromText}
                disabled={planGenerationControlsDisabled || !planImportText.trim()}
                variant="softStrong"
                size="sm"
                className="w-fit"
              >
                Заполнить план из текста
              </Button>
            </Panel>

            <Button
              type="button"
              onClick={() => onOpenAttractionAudioGuidePlanGenerateModal?.()}
              disabled={planGenerationControlsDisabled}
              variant="secondary"
              size="sm"
              className="w-fit"
            >
              {audioGuideGeneratingPlan ? 'Генерация...' : 'Сгенерировать план'}
            </Button>
          </div>

          <AiGenerationModal
            open={audioGuidePlanGenerateModalOpen}
            onBackdropClick={() => {
              if (!audioGuideGeneratingPlan) {
                onCloseAttractionAudioGuidePlanGenerateModal?.();
              }
            }}
            titleId="audio-guide-plan-gen-title"
            busy={audioGuideGeneratingPlan}
            busyLabel="Генерация плана…"
            footer={(
              <WizardGenerationActionFooter>
                <Button
                  type="button"
                  onClick={() => onCloseAttractionAudioGuidePlanGenerateModal?.()}
                  disabled={audioGuideGeneratingPlan}
                  variant="outline"
                  size="md"
                >
                  Отмена
                </Button>
                <Button
                  type="button"
                  onClick={() => onGenerateAttractionAudioGuidePlan?.()}
                  disabled={audioGuideGeneratingPlan}
                  variant="primary"
                  size="md"
                >
                  Сгенерировать
                </Button>
              </WizardGenerationActionFooter>
            )}
          >
            <SectionHeader headingId="audio-guide-plan-gen-title" title="Настройки генерации плана аудиогида" />

            <p className="text-sm text-aspectum-text-subtle">
              Выберите качество генерации и добавьте указания для структуры плана.
            </p>

            {audioGuidePlanGenerationError ? (
              <Alert tone="error">{audioGuidePlanGenerationError}</Alert>
            ) : null}

            <AiGenerationQualitySettings
              generationMode={aiGenerationMode}
              onGenerationModeChange={onAiGenerationModeChange}
              useWebSearch={aiUseWebSearch}
              onUseWebSearchChange={onAiUseWebSearchChange}
              disabled={audioGuideGeneratingPlan}
              advancedDisabled={!aiAdvancedGenerationAvailable}
            />

            <div>
              <FormLabel
                htmlFor="audio-guide-plan-gen-prompt"
                 layout="block" size="sm" weight="medium" tone="strong" spacing="xs"
              >
                Дополнительный промпт
              </FormLabel>

              <Textarea className="disabled:bg-aspectum-surface-subtle" id="audio-guide-plan-gen-prompt" rows={4} value={audioGuidePlanGeneratePrompt} onChange={(e) => onSetAudioGuidePlanGeneratePrompt?.(e.target.value) } disabled={audioGuideGeneratingPlan} placeholder="Например: Сделай план на 6 пунктов, с акцентом на архитектуру и ключевые экспонаты." />
            </div>
          </AiGenerationModal>

          <div className="space-y-2">
            {planPoints.length === 0 ? (
            <EmptyState
              icon="📝"
              title="Пока нет пунктов плана"
              description="Добавьте пункт вручную или сгенерируйте план аудиогида."
              className="py-4"
            />
            ) : (
              planPoints.map((point, index) => {
                const itemId = point?.id;
                const title = point?.title ?? '';

                return (
                  <div
                    key={point.id}
                    className="flex items-center gap-2"
                  >
                    <span className="w-6 text-xs text-aspectum-text-muted text-right">
                      {index + 1}.
                    </span>

                    <TextInput className="flex-1" type="text" value={title} onChange={(e) => onUpdateAttractionAudioGuidePlanPoint?.( currentLocale.lang, itemId, e.target.value ) } placeholder="Например: История строительства" />

                    <Button
                      type="button"
                      variant="softDanger"
                      size="sm"
                      onClick={() =>
                        onRemoveAttractionAudioGuidePlanPoint?.(
                          currentLocale.lang,
                          itemId
                        )
                      }
                      title="Удалить пункт"
                    >
                      Удалить
                    </Button>
                  </div>
                );
              })
            )}

            <Button
              type="button"
              onClick={() =>
                onAddAttractionAudioGuidePlanPoint?.(currentLocale.lang)
              }
              variant="softStrong"
              size="sm"
            >
              + Добавить пункт
            </Button>
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <FormLabel  size="sm" weight="medium" tone="strong">
              Основной текст аудиогида ({currentLocale.lang?.toUpperCase() || 'RU'})
            </FormLabel>

          </div>

          <Button
            type="button"
            variant="soft"
            size="sm"
            onClick={() => onOpenAttractionAudioGuideMainTextGenerateModal?.()}
            disabled={
              audioGuideGeneratingAllMainText ||
              audioGuideGeneratingPlan ||
              attractionAudioGuideSaving
            }
          >
            {audioGuideGeneratingAllMainText
              ? 'Генерация...'
              : 'Сгенерировать весь основной текст'}
          </Button>

          <AiGenerationModal
            open={audioGuideMainTextGenerateModalOpen}
            onBackdropClick={() => {
              if (!audioGuideGeneratingAllMainText) {
                onCloseAttractionAudioGuideMainTextGenerateModal?.();
              }
            }}
            titleId="audio-guide-main-text-gen-title"
            busy={audioGuideGeneratingAllMainText}
            busyLabel="Генерация основного текста…"
            footer={(
              <WizardGenerationActionFooter>
                <Button
                  type="button"
                  onClick={() => onCloseAttractionAudioGuideMainTextGenerateModal?.()}
                  disabled={audioGuideGeneratingAllMainText}
                  variant="outline"
                  size="md"
                >
                  Отмена
                </Button>
                <Button
                  type="button"
                  onClick={() => onGenerateAttractionAudioGuideMainText?.()}
                  disabled={audioGuideGeneratingAllMainText}
                  variant="primary"
                  size="md"
                >
                  Сгенерировать
                </Button>
              </WizardGenerationActionFooter>
            )}
          >
            <SectionHeader headingId="audio-guide-main-text-gen-title" title="Сгенерировать весь основной текст" />

            <p className="text-sm text-aspectum-text-subtle">
              Будет сгенерирован основной текст для всех пунктов плана текущего языка.
            </p>

            {audioGuideMainTextGenerationError ? (
              <Alert tone="error">{audioGuideMainTextGenerationError}</Alert>
            ) : null}

            <AiGenerationQualitySettings
              generationMode={aiGenerationMode}
              onGenerationModeChange={onAiGenerationModeChange}
              useWebSearch={aiUseWebSearch}
              onUseWebSearchChange={onAiUseWebSearchChange}
              disabled={audioGuideGeneratingAllMainText}
              advancedDisabled={!aiAdvancedGenerationAvailable}
            />

            <div>
              <FormLabel
                htmlFor="audio-guide-main-text-gen-prompt"
                 layout="block" size="sm" weight="medium" tone="strong" spacing="xs"
              >
                Дополнительный промпт
              </FormLabel>

              <Textarea className="disabled:bg-aspectum-surface-subtle" id="audio-guide-main-text-gen-prompt" rows={4} value={audioGuideMainTextGeneratePrompt} onChange={(e) => onSetAudioGuideMainTextGeneratePrompt?.(e.target.value) } disabled={audioGuideGeneratingAllMainText} placeholder="Например: сделай стиль спокойным, как профессиональный аудиогид" />
            </div>
          </AiGenerationModal>

          {planPoints.length > 0 && onGenerateAttractionAudioGuideTtsStress ? (
            <Panel tone="accentPurple" className="flex flex-wrap items-center justify-between gap-2 p-2.5">
              <span className="text-xs text-aspectum-purple-emphasis">
                Произносимая версия для TTS с ударениями (U+0301).
              </span>
              <div className="flex items-center gap-2">
                {onBuildSessionStressDictionary ? (
                  <Button
                    type="button"
                    variant="outlinePurple"
                    size="sm"
                    onClick={() =>
                      onBuildSessionStressDictionary(currentLocale.lang)
                    }
                    disabled={buildingStressDictionary}
                    title="Найти правильные ударения в названиях города и достопримечательностей (Викисловарь + веб) и пополнить словарь"
                    className="shrink-0"
                  >
                    {buildingStressDictionary
                      ? 'Сбор...'
                      : <><Glyph name="📖" /> Собрать ударения города</>}
                  </Button>
                ) : null}
                <Select className="bg-aspectum-surface text-aspectum-purple-emphasis disabled:opacity-50" value={stressProvider} onChange={(e) => setStressProvider(e.target.value)} disabled={audioGuideStressBusyId != null} title="Провайдер ИИ для расстановки ударений">
                  <option value="">Провайдер: по умолчанию</option>
                  <option value="deepseek">DeepSeek (дёшево)</option>
                  <option value="openai">OpenAI</option>
                </Select>
                <Button
                  type="button"
                  variant="purple"
                  size="sm"
                  onClick={() =>
                    onGenerateAttractionAudioGuideTtsStress(
                      currentAttractionAudioGuide,
                      currentLocale.lang,
                      null,
                      stressProvider || null,
                    )
                  }
                  disabled={
                    audioGuideStressBusyId != null || attractionAudioGuideSaving
                  }
                  className="shrink-0"
                >
                  {audioGuideStressBusyId === 'all'
                    ? 'Расстановка...'
                    : <><Glyph name="↻" /> Расставить ударения во всех пунктах</>}
                </Button>
              </div>
            </Panel>
          ) : null}

          {planPoints.length === 0 ? (
            <EmptyState
              icon="📝"
              title="План аудиогида пока пуст"
              description="Сначала добавьте или сгенерируйте пункты плана."
              className="py-4"
            />
          ) : (
            <div className="space-y-4">
              {planPoints.map((point, index) => {
                const itemId = point?.id;
                const planTitle = (point?.title ?? '').trim();
                const headerLabel = planTitle || 'Без названия';
                const planLang = currentLocale.lang;
                const rawText =
                  planLang &&
                  currentAttractionAudioGuide?.content_texts?.[planLang]?.[
                    itemId
                  ];
                const spokenText =
                  rawText != null && rawText !== undefined
                    ? String(rawText)
                    : '';
                const itemGenerating = Boolean(
                  itemId && audioGuideGeneratingItemTextById?.[itemId],
                );
                const rawStress =
                  planLang &&
                  currentAttractionAudioGuide?.content_texts_tts?.[planLang]?.[
                    itemId
                  ];
                const stressValue =
                  rawStress != null && rawStress !== undefined
                    ? String(rawStress)
                    : '';
                const stressBusy =
                  audioGuideStressBusyId === itemId ||
                  audioGuideStressBusyId === 'all';
                return (
                  <Panel
                    key={`ag-main-text-${point.id}`}
                    tone="muted"
                    className="p-3 space-y-2"
                  >
                    <div className="text-sm font-medium text-aspectum-text">
                      {index + 1}. {headerLabel}
                    </div>

                    <FormLabel  layout="block" size="xs" weight="medium" tone="muted">
                      Основной текст для озвучки ({currentLocale.lang?.toUpperCase() || 'RU'})
                    </FormLabel>

                    <Textarea className="min-h-[88px]" value={spokenText} onChange={(e) => onUpdateAttractionAudioGuidePlanItemText?.( planLang, itemId, e.target.value, ) } rows={4} placeholder="Текст, который будет озвучен для этого пункта плана" />

                    <Button
                      type="button"
                      variant="soft"
                      size="sm"
                      onClick={() =>
                        onOpenAttractionAudioGuideMainTextItemGenerateModal?.(point)
                      }
                      disabled={
                        itemGenerating ||
                        audioGuideGeneratingPlan ||
                        audioGuideGeneratingAllMainText ||
                        attractionAudioGuideSaving
                      }
                    >
                      {itemGenerating ? 'Генерация...' : 'Сгенерировать этот пункт'}
                    </Button>

                    {onGenerateAttractionAudioGuideTtsStress ? (
                      <div className="mt-2 pt-2 border-t border-dashed border-aspectum-border space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <FormLabel  layout="block" size="xs" weight="medium" tone="violet">
                            Текст с ударениями (для TTS)
                          </FormLabel>
                          <Button
                            type="button"
                            variant="softPurple"
                            size="sm"
                            onClick={() =>
                              onGenerateAttractionAudioGuideTtsStress(
                                currentAttractionAudioGuide,
                                planLang,
                                itemId,
                                stressProvider || null,
                              )
                            }
                            disabled={
                              stressBusy ||
                              !spokenText.trim() ||
                              attractionAudioGuideSaving
                            }
                            title="Расставить ударения на основе основного текста"
                            className="shrink-0"
                          >
                            {stressBusy ? 'Расстановка...' : <><Glyph name="↻" /> Расставить ударения</>}
                          </Button>
                        </div>
                        <Textarea className="bg-aspectum-violet/10 min-h-[72px]" value={stressValue} onChange={(e) => onSetAttractionAudioGuideStressText?.( currentAttractionAudioGuide, planLang, itemId, e.target.value, ) } rows={3} placeholder="Версия с ударениями (U+0301). Если пусто — озвучка возьмёт основной текст." />
                      </div>
                    ) : null}
                  </Panel>
                );
              })}
            </div>
          )}

          <AiGenerationModal
            open={audioGuideItemTextGenerateModalOpen}
            onBackdropClick={() => {
              if (!itemTextModalGenerating) {
                onCloseAttractionAudioGuideMainTextItemGenerateModal?.();
              }
            }}
            titleId="audio-guide-item-text-gen-title"
            busy={itemTextModalGenerating}
            busyLabel="Генерация текста пункта…"
            footer={(
              <WizardGenerationActionFooter>
                <Button
                  type="button"
                  onClick={() => onCloseAttractionAudioGuideMainTextItemGenerateModal?.()}
                  disabled={itemTextModalGenerating}
                  variant="outline"
                  size="md"
                >
                  Отмена
                </Button>
                <Button
                  type="button"
                  onClick={() => onGenerateAttractionAudioGuideMainTextItem?.()}
                  disabled={itemTextModalGenerating}
                  variant="primary"
                  size="md"
                >
                  Сгенерировать
                </Button>
              </WizardGenerationActionFooter>
            )}
          >
            <SectionHeader headingId="audio-guide-item-text-gen-title" title="Настройки генерации пункта аудиогида" />

            <p className="text-sm text-aspectum-text-subtle">
              Выберите качество генерации и добавьте указания для текста этого пункта.
            </p>

            {audioGuideItemTextGenerateItemTitle ? (
              <p className="text-sm text-aspectum-text-emphasis bg-aspectum-surface-muted border border-aspectum-border rounded-aspectum-control px-3 py-2">
                {audioGuideItemTextGenerateItemTitle}
              </p>
            ) : null}

            {audioGuideItemTextGenerationError ? (
              <Alert tone="error">{audioGuideItemTextGenerationError}</Alert>
            ) : null}

            <AiGenerationQualitySettings
              generationMode={aiGenerationMode}
              onGenerationModeChange={onAiGenerationModeChange}
              useWebSearch={aiUseWebSearch}
              onUseWebSearchChange={onAiUseWebSearchChange}
              disabled={itemTextModalGenerating}
              advancedDisabled={!aiAdvancedGenerationAvailable}
            />

            <div>
              <FormLabel
                htmlFor="audio-guide-item-text-gen-prompt"
                 layout="block" size="sm" weight="medium" tone="strong" spacing="xs"
              >
                Дополнительный промпт
              </FormLabel>

              <Textarea className="disabled:bg-aspectum-surface-subtle" id="audio-guide-item-text-gen-prompt" rows={4} value={audioGuideItemTextGeneratePrompt} onChange={(e) => onSetAudioGuideItemTextGeneratePrompt?.(e.target.value) } disabled={itemTextModalGenerating} placeholder="Например: добавь больше дат и исторических деталей" />
            </div>
          </AiGenerationModal>

          <Panel tone="muted" className="mt-4 p-3 space-y-2">
            <FormLabel  layout="block" size="sm" weight="medium" tone="emphasis">
              Аудиофайл аудиогида ({currentLocale.lang?.toUpperCase() || 'RU'})
            </FormLabel>

            <p className="text-xs text-aspectum-text-subtle">
              Аудио будет создано из всех пунктов основного текста в порядке плана.
            </p>

            {planPoints.length > 0 && !hasTextForEveryPlanItem ? (
              <Alert tone="warning">Сначала заполните тексты всех пунктов аудиогида.</Alert>
            ) : null}

            {audioGuideTrackGenerationError ? (
              <Alert tone="error">{audioGuideTrackGenerationError}</Alert>
            ) : null}

            <TTSProviderSettingsPanel
              provider={audioGuideTtsProvider}
              providerSettings={ttsSettings}
              providerSettingsLoading={ttsSettingsLoading}
              providerSettingsError={ttsSettingsError}
              elevenLabsSettings={elevenLabsSettings}
              elevenLabsLoading={elevenLabsSettingsLoading}
              elevenLabsError={elevenLabsSettingsError}
              voiceId={audioGuideTtsVoiceId}
              modelId={audioGuideTtsModelId}
              onProviderChange={onSetAudioGuideTtsProvider}
              onVoiceChange={onSetAudioGuideTtsVoiceId}
              onModelChange={onSetAudioGuideTtsModelId}
              onLoadProviderSettings={onLoadTtsSettings}
              onLoadElevenLabsSettings={() =>
                onLoadElevenLabsSettings?.({ refresh: true })
              }
              disabled={generatingAudioGuideTrack}
            />

            {hasTrackAudio ? (
              <AttractionAudioTrackPreview
                trackAudioId={trackAudioId}
                trackAudioUrl={trackAudioUrl}
                chapters={trackChapters}
                downloadName={`audio-guide-${currentLocale.lang || 'ru'}.mp3`}
                durationSeconds={currentLocale.track?.duration_seconds}
                regeneratingChapterId={audioGuideRegeneratingChapterId}
                onRegenerateChapter={
                  onRegenerateAttractionAudioGuideChapter
                    ? (planItemId) =>
                        onRegenerateAttractionAudioGuideChapter(
                          currentAttractionAudioGuide,
                          currentLocale.lang,
                          planItemId,
                        )
                    : null
                }
              />
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={() =>
                  onGenerateAttractionAudioGuideTrackAudio?.({
                    languageCode: planLang,
                    replaceExisting: hasTrackAudio,
                  })
                }
                disabled={!canGenerateFullAudio}
                variant="primary"
                size="sm"
              >
                {generatingAudioGuideTrack
                  ? 'Генерируем аудио...'
                  : hasTrackAudio
                    ? 'Перегенерировать аудиофайл'
                    : 'Сгенерировать аудиофайл'}
              </Button>

              {hasTrackAudio ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onGenerateAttractionAudioGuideTrackAudio?.({
                      languageCode: planLang,
                      replaceExisting: true,
                      force: true,
                    })
                  }
                  disabled={!canGenerateFullAudio}
                  title="Переозвучить все главы заново, даже если текст не менялся"
                >
                  <Glyph name="↻" /> Заново, без кэша
                </Button>
              ) : null}
            </div>
          </Panel>
        </div>

        <Panel tone="muted" className="p-3 space-y-2">
          <FormLabel  layout="block" size="sm" weight="medium" tone="strong">
            Загрузить аудиофайл вручную ({currentLocale.lang?.toUpperCase() || 'RU'})
          </FormLabel>

          {trackAudioUrl || trackAudioId ? (
            <p className="text-xs text-aspectum-text-muted">
              Можно заменить текущий файл загрузкой с диска.
            </p>
          ) : (
            <p className="text-xs text-aspectum-text-muted">
              Альтернатива генерации: загрузите готовый mp3.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <FileButton
              inputRef={audioFileRef}
              accept="audio/*"
              onChange={handleAudioFileChange}
              disabled={attractionAudioUploading || generatingAudioGuideTrack}
              variant="primary"
              size="sm"
            >
              {attractionAudioUploading
                ? 'Загрузка…'
                : trackAudioUrl || trackAudioId
                  ? 'Заменить файл'
                  : 'Загрузить аудио'}
            </FileButton>

            {trackAudioUrl || trackAudioId ? (
              <Button
                type="button"
                variant="softDanger"
                size="sm"
                onClick={() => onRemoveAttractionAudioGuideTrack?.()}
                disabled={attractionAudioUploading || generatingAudioGuideTrack}
              >
                Удалить аудио
              </Button>
            ) : null}
          </div>
        </Panel>

        <div className="flex items-center justify-end gap-3">
          {(attractionAudioGuideAutoSaving || attractionAudioGuideAutoSaved) &&
            !attractionAudioGuideSaving && (
              <div
                className={`flex items-center gap-1.5 text-xs transition-opacity ${
                  attractionAudioGuideAutoSaved && !attractionAudioGuideAutoSaving
                    ? 'text-aspectum-success'
                    : 'text-aspectum-text-disabled'
                }`}
              >
                {attractionAudioGuideAutoSaving ? (
                  <>
                    <Spinner size="xs" className="border-2 border-aspectum-border-strong" />
                    <span>Сохранение...</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>Сохранено</span>
                  </>
                )}
              </div>
            )}
          <Button
            type="button"
            onClick={onSaveCurrentAttractionAudioGuide}
            disabled={attractionAudioGuideSaving}
            variant="primary"
            size="md"
          >
            {attractionAudioGuideSaving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </main>
      <ConfirmModal
        open={planImportConfirmOpen}
        onClose={() => setPlanImportConfirmOpen(false)}
        onConfirm={() => {
          importPlanFromText();
          setPlanImportConfirmOpen(false);
        }}
        title="Заменить текущий план?"
        message={`Текущий план (${planPoints.length} пункт(ов)) и тексты пунктов для этого языка будут заменены содержимым из вставленного текста.`}
        confirmLabel="Заменить"
        danger
      />
    </section>
  );
}
