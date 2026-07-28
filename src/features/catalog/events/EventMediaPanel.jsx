import { useEffect, useRef, useState } from 'react';
import CommonsImagePicker from '../../../components/generation/CommonsImagePicker';
import { Field, TextInput } from '../../../components/ui/FormField';
import { ConfirmModal } from '../../../components/ui/Modal';
import { audioAPI } from '../../../api/generation';
import { parseApiError } from '../../../utils/apiError';
import { getMultiLangValue } from '../shared/i18n';

const LANG_OPTIONS = ['ru', 'en', 'it', 'de', 'fr', 'es'];

function AudioPlayer({ audioId }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const blobRef = useRef(null);

  const load = async () => {
    if (blobUrl || loading) return;
    setLoading(true);
    setError(null);
    try {
      const r = await audioAPI.getBlobByAudioId(audioId);
      const blob = new Blob([r.data], { type: 'audio/mpeg' });
      const u = URL.createObjectURL(blob);
      blobRef.current = u;
      setBlobUrl(u);
    } catch {
      setError('Не удалось загрузить');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => () => { if (blobRef.current) URL.revokeObjectURL(blobRef.current); }, []);

  if (error) return <span className="text-xs text-red-500">{error}</span>;
  if (!blobUrl) {
    return (
      <button
        type="button"
        onClick={load}
        disabled={loading}
        className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50"
      >
        {loading ? '⏳' : '▶ Слушать'}
      </button>
    );
  }
  return <audio controls src={blobUrl} className="h-8 flex-1 min-w-0" />;
}

function ImageBlock({ label, url, onPick, onClear, disabled, hint }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">{label}</p>
      {url ? (
        <div className="relative w-full h-[180px] rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
          <img src={url} alt="" className="w-full h-full object-contain" />
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="absolute top-2 right-2 w-7 h-7 bg-black/60 text-white rounded-full text-sm flex items-center justify-center hover:bg-black/80 disabled:opacity-50"
            title="Убрать"
          >
            ×
          </button>
        </div>
      ) : (
        <div className="w-full h-[180px] rounded-xl border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-sm text-gray-400">
          Не выбрано
        </div>
      )}
      <button
        type="button"
        onClick={onPick}
        disabled={disabled}
        className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50"
      >
        🖼️ Выбрать из Wikimedia Commons
      </button>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
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
      <p className="text-sm text-gray-500">
        Сначала сохраните событие, чтобы редактировать медиа.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {(mediaError || audioError) && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {mediaError || audioError}
        </div>
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

      <div className="space-y-3 pt-2 border-t border-gray-100">
        <p className="text-sm font-medium text-gray-700">Аудио (EventMedia.audio)</p>
        {audioItems.length === 0 ? (
          <p className="text-sm text-gray-400">Аудиофайлов пока нет.</p>
        ) : (
          audioItems.map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50">
              <span className="text-xs font-mono uppercase text-gray-600 w-8 shrink-0">
                {(item.language || '—').slice(0, 2)}
              </span>
              <div className="flex-1 min-w-0">
                <AudioPlayer audioId={item.id} />
              </div>
              <button
                type="button"
                disabled={disabled || mediaSaving}
                onClick={() => setRemoveAudioTarget(item)}
                className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                Удалить
              </button>
            </div>
          ))
        )}

        <div className="flex flex-wrap items-end gap-3">
          <Field label="Язык дорожки">
            <select
              value={uploadLang}
              onChange={(e) => setUploadLang(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              {LANG_OPTIONS.map((code) => (
                <option key={code} value={code}>{code.toUpperCase()}</option>
              ))}
            </select>
          </Field>
          <label className={`cursor-pointer px-3 py-2 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 ${audioUploading || disabled ? 'opacity-50 cursor-wait' : ''}`}>
            {audioUploading ? 'Загрузка...' : '+ Загрузить MP3'}
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*,.mp3"
              className="hidden"
              disabled={audioUploading || disabled || mediaSaving}
              onChange={handleAudioUpload}
            />
          </label>
        </div>
      </div>

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
