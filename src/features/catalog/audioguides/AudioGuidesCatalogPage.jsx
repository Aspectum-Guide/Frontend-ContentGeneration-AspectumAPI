import { useCallback, useEffect, useRef, useState } from 'react';
import { eventAudioGuidesAPI, audioAPI } from '../../../api/generation';
import Layout from '../../../components/Layout';
import { parseApiError } from '../../../utils/apiError';
import { useEventOptions } from '../shared/bookingOptions';
import { getMultiLangValue } from '../shared/i18n';

const LANG_LABELS = { ru: 'RU', en: 'EN', it: 'IT', de: 'DE', fr: 'FR', es: 'ES' };

function langLabel(code) {
  return LANG_LABELS[code] || code.toUpperCase();
}

function AudioPlayer({ url, audioId }) {
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
  if (!blobUrl) return (
    <button onClick={load} disabled={loading}
      className="px-2 py-1 text-xs text-blue-600 bg-blue-50 rounded hover:bg-blue-100 disabled:opacity-50 transition-colors">
      {loading ? '⏳' : '▶ Слушать'}
    </button>
  );
  return <audio controls src={blobUrl} className="h-8 max-w-[200px]" />;
}

function TrackRow({ track, guideId, onUploaded }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append('audio', file);
      fd.append('language', track.language);
      const r = await audioAPI.upload(fd);
      const audioId = r?.data?.id || r?.data?.audio_id;
      if (!audioId) throw new Error('Нет ID аудио в ответе');
      await eventAudioGuidesAPI.upsertTrack(guideId, { language: track.language, audio_id: audioId });
      onUploaded?.();
    } catch (err) {
      setUploadError(parseApiError(err, 'Ошибка загрузки'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
      <span className="w-8 text-xs font-mono font-semibold text-gray-500 uppercase">{langLabel(track.language)}</span>
      {track.audio_id ? (
        <AudioPlayer audioId={track.audio_id} url={track.audio_url} />
      ) : (
        <span className="text-xs text-gray-300 italic">нет файла</span>
      )}
      <label className={`ml-auto cursor-pointer px-2 py-1 text-xs rounded border transition-colors ${uploading ? 'opacity-50 cursor-wait' : 'border-gray-300 text-gray-500 hover:bg-gray-50'}`}>
        {uploading ? 'Загрузка…' : track.audio_id ? 'Заменить' : '+ MP3'}
        <input ref={inputRef} type="file" accept="audio/*" className="hidden" onChange={handleUpload} disabled={uploading} />
      </label>
      {uploadError && <span className="text-xs text-red-500">{uploadError}</span>}
    </div>
  );
}

function GuideCard({ guide, onChanged }) {
  const [toggling, setToggling] = useState(false);

  const toggleShow = async () => {
    setToggling(true);
    try {
      await eventAudioGuidesAPI.update(guide.id, { is_show: !guide.is_show });
      onChanged?.();
    } finally {
      setToggling(false);
    }
  };

  const title = getMultiLangValue(guide.title) || `Гид #${guide.index + 1}`;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <span className="w-6 h-6 rounded-full bg-gray-100 text-xs font-semibold text-gray-500 flex items-center justify-center shrink-0">
          {guide.index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{title}</p>
          <p className="text-xs text-gray-400">{guide.tracks.length} треков</p>
        </div>
        <button
          onClick={toggleShow}
          disabled={toggling}
          title={guide.is_show ? 'Скрыть' : 'Показать'}
          className={`relative w-9 h-5 rounded-full transition-colors focus:outline-none disabled:opacity-50 ${guide.is_show ? 'bg-green-500' : 'bg-gray-300'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${guide.is_show ? 'left-4' : 'left-0.5'}`} />
        </button>
      </div>

      <div className="px-4 py-2">
        {guide.tracks.length === 0 ? (
          <p className="text-xs text-gray-400 py-2">Треков нет</p>
        ) : (
          guide.tracks.map((track) => (
            <TrackRow key={track.id} track={track} guideId={guide.id} onUploaded={onChanged} />
          ))
        )}
      </div>
    </div>
  );
}

export default function AudioGuidesCatalogPage() {
  const { eventOptions, eventsLoading } = useEventOptions();
  const [eventId, setEventId] = useState('');
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (evId) => {
    if (!evId) { setGuides([]); return; }
    setLoading(true);
    setError(null);
    try {
      const r = await eventAudioGuidesAPI.list(evId);
      setGuides(r?.data?.guides || []);
    } catch (e) {
      setError(parseApiError(e, 'Ошибка загрузки аудиогидов'));
      setGuides([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(eventId); }, [eventId, load]);

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Аудиогиды</h1>
        <p className="mt-1 text-sm text-gray-500">Опубликованные аудиогиды событий — треки по языкам</p>
      </div>

      <div className="mb-4">
        <select
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          className={`w-full md:w-96 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none ${eventsLoading ? 'opacity-60 cursor-wait' : ''}`}
          disabled={eventsLoading}
        >
          <option value="">{eventsLoading ? 'Загрузка…' : '— Выберите событие —'}</option>
          {eventOptions.map((ev) => (
            <option key={ev.id} value={ev.id}>{getMultiLangValue(ev.title) || ev.id}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      )}

      {!eventId ? (
        <div className="text-sm text-gray-400 text-center py-12">Выберите событие чтобы увидеть аудиогиды</div>
      ) : loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-8">
          <span className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full inline-block" />
          Загрузка...
        </div>
      ) : guides.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <div className="text-4xl mb-3">🎧</div>
          <p className="text-gray-500 text-sm">У этого события нет опубликованных аудиогидов</p>
          <p className="text-gray-400 text-xs mt-1">Аудиогиды создаются при публикации сессии</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {guides.map((guide) => (
            <GuideCard key={guide.id} guide={guide} onChanged={() => load(eventId)} />
          ))}
        </div>
      )}
    </Layout>
  );
}
