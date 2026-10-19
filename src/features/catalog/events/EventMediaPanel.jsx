import { useRef, useState } from 'react';
import CommonsImagePicker from '../../../components/generation/CommonsImagePicker';
import { Alert, Button, ConfirmModal, EmptyState, Field, FileButton, IconButton, LoadingOverlay, MediaPreview, Panel, Select } from '@aspectum/ui';
import { audioAPI } from '../../../api/generation';
import { parseApiError } from '../../../utils/apiError';
import AudioPlayer from '../shared/components/AudioPlayer';
import { getMultiLangValue } from '../shared/i18n';
import { useAppLanguages } from '../../../hooks/useAppLanguages';

function ImageBlock({ label, url, onPick, onClear, disabled, hint }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-aspectum-text-strong">{label}</p>
      {url ? (
        <MediaPreview src={url} alt="" fit="contain" className="h-[180px] w-full">
          <IconButton
            label={`Убрать ${label.toLowerCase()}`}
            onClick={onClear}
            disabled={disabled}
            variant="overlay"
            size="iconOverlay"
            className="absolute top-2 right-2"
          >
            ×
          </IconButton>
        </MediaPreview>
      ) : (
        <div className="w-full h-[180px] rounded-aspectum-card border border-dashed border-aspectum-border-strong bg-aspectum-surface-muted flex items-center justify-center text-sm text-aspectum-text-disabled">
          Не выбрано
        </div>
      )}
      <Button type="button" variant="soft" size="md" onClick={onPick} disabled={disabled}>
        🖼️ Выбрать из Wikimedia Commons
      </Button>
      {hint && <p className="text-xs text-aspectum-text-disabled">{hint}</p>}
    </div>
  );
}

export default function EventMediaPanel({
  event,
  disabled,
  mediaSaving,
  mediaError,
  onPatchMedia,
}) {
  const { languages: appLanguages } = useAppLanguages();
  const languageOptions = appLanguages.map((language) => language.code);
  const [commonsTarget, setCommonsTarget] = useState(null);
  const [uploadLang, setUploadLang] = useState('ru');
  const [audioUploading, setAudioUploading] = useState(false);
  const [audioError, setAudioError] = useState('');
  const [removeAudioTarget, setRemoveAudioTarget] = useState(null);
  const audioInputRef = useRef(null);

  const media = event?.media || {};
  const coverUrl = event?.image_url || media?.image?.url || null;
  const titleUrl = media?.title_image?.url || null;
  const audioItems = Array.isArray(media?.audio) ? media.audio : [];

  const handleAudioUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !event?.id) return;
    setAudioUploading(true);
    setAudioError('');
    try {
      const fd = new FormData();
      fd.append('audio', file);
      fd.append('language', uploadLang);
      fd.append('event_id', event.id);
      const r = await audioAPI.upload(fd);
      const audioId = r?.data?.audio?.id || r?.data?.audio?.audio_id || r?.data?.id;
      if (!audioId) throw new Error('Нет ID аудио в ответе');
      await onPatchMedia?.({ add_audio_id: audioId });
    } catch (err) {
      setAudioError(parseApiError(err, 'Ошибка загрузки аудио'));
    } finally {
      setAudioUploading(false);
    }
  };

  const confirmRemoveAudio = async () => {
    if (!removeAudioTarget) return;
    try {
      await onPatchMedia?.({ remove_audio_id: removeAudioTarget.id });
    } finally {
      setRemoveAudioTarget(null);
    }
  };

  if (!event?.id) {
    return (
      <p className="text-sm text-aspectum-text-muted">
        Сначала сохраните событие, чтобы редактировать медиа.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {(mediaError || audioError) && (
        <Alert tone="error">{mediaError || audioError}</Alert>
      )}

      <ImageBlock
        label="Обложка"
        url={coverUrl}
        disabled={disabled || mediaSaving}
        hint="Основное изображение события в приложении."
        onPick={() => setCommonsTarget('cover')}
        onClear={() => onPatchMedia?.({ image_id: null })}
      />

      <ImageBlock
        label="Title-изображение"
        url={titleUrl}
        disabled={disabled || mediaSaving}
        hint="Дополнительное изображение (EventMedia.title)."
        onPick={() => setCommonsTarget('title')}
        onClear={() => onPatchMedia?.({ title_image_id: null })}
      />

      <LoadingOverlay loading={audioUploading} label="Загрузка аудио…">
      <Panel tone="muted" className="space-y-3 pt-3">
        <p className="text-sm font-medium text-aspectum-text-strong">Аудио (EventMedia.audio)</p>
        {audioItems.length === 0 ? (
          <EmptyState
            icon="🔊"
            title="Аудиофайлов пока нет"
            description="Загрузите MP3-дорожку и выберите язык."
            className="py-4"
          />
        ) : (
          audioItems.map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-3 rounded-aspectum-control border border-aspectum-border bg-aspectum-surface-muted">
              <span className="text-xs font-mono uppercase text-aspectum-text-subtle w-8 shrink-0">
                {(item.language || '—').slice(0, 2)}
              </span>
              <div className="flex-1 min-w-0">
                <AudioPlayer audioId={item.id} />
              </div>
              <Button
                type="button"
                variant="linkDanger"
                size="sm"
                disabled={disabled || mediaSaving}
                onClick={() => setRemoveAudioTarget(item)}
              >
                Удалить
              </Button>
            </div>
          ))
        )}

        <div className="flex flex-wrap items-end gap-3">
          <Field label="Язык дорожки">
            <Select value={uploadLang} onChange={(e) => setUploadLang(e.target.value)}>
              {languageOptions.map((code) => (
                <option key={code} value={code}>{code.toUpperCase()}</option>
              ))}
            </Select>
          </Field>
          <FileButton
            inputRef={audioInputRef}
            accept="audio/*,.mp3"
            variant="soft"
            size="md"
            disabled={audioUploading || disabled || mediaSaving}
            onChange={handleAudioUpload}
          >
            {audioUploading ? 'Загрузка...' : '+ Загрузить MP3'}
          </FileButton>
        </div>
      </Panel>
      </LoadingOverlay>

      <CommonsImagePicker
        isOpen={!!commonsTarget}
        onClose={() => setCommonsTarget(null)}
        onImageSelected={async ({ imageId }) => {
          setCommonsTarget(null);
          if (commonsTarget === 'title') {
            await onPatchMedia?.({ title_image_id: imageId });
          } else {
            await onPatchMedia?.({ image_id: imageId });
          }
        }}
        getSessionUuid={() => ''}
        defaultQuery={getMultiLangValue(event?.title || '')}
      />

      <ConfirmModal
        open={!!removeAudioTarget}
        onClose={() => setRemoveAudioTarget(null)}
        onConfirm={confirmRemoveAudio}
        title="Удалить аудио?"
        message="Файл будет отвязан от события."
        confirmLabel="Удалить"
        danger
      />
    </div>
  );
}
