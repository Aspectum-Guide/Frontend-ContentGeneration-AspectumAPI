import { useCallback, useEffect, useRef, useState } from 'react';
import { eventAudioGuidesAPI, audioAPI, eventsAPI } from '../../../api/generation';
import Layout from '../../../components/Layout';
import Modal from '../../../components/ui/Modal';
import { parseApiError } from '../../../utils/apiError';
import { getMultiLangValue } from '../shared/i18n';
import { normalizeListResponse } from '../shared/normalize';

const LANG_LABELS = { ru: 'RU', en: 'EN', it: 'IT', de: 'DE', fr: 'FR', es: 'ES' };
function langLabel(code) { return LANG_LABELS[code] || code.toUpperCase(); }

// ─── AudioPlayer ─────────────────────────────────────────────────────────────

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
  if (!blobUrl) return (
    <button onClick={load} disabled={loading}
      className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors">
      {loading ? '⏳ Загрузка…' : '▶ Слушать'}
    </button>
  );
  return <audio controls src={blobUrl} className="h-8 flex-1" />;
}

// ─── TrackRow (full form) ─────────────────────────────────────────────────────

function TrackRow({ track, guideId, onUploaded }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const linked = !!track.audio_id;

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
    <div className={`rounded-lg border px-3 py-2.5 mb-2 last:mb-0 ${linked ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
      <div className="flex items-center gap-3 flex-wrap">
        {/* Язык + статус */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="w-8 text-xs font-mono font-bold text-gray-700 uppercase">{langLabel(track.language)}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${linked ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
            {linked ? '● есть файл' : '○ нет файла'}
          </span>
        </div>

        {/* Плеер */}
        <div className="flex-1 min-w-0">
          {linked
            ? <AudioPlayer audioId={track.audio_id} />
            : <span className="text-xs text-gray-400 italic">Файл не загружен</span>
          }
        </div>

        {/* Кнопка загрузки */}
        <label className={`shrink-0 cursor-pointer px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
          uploading ? 'opacity-50 cursor-wait border-gray-300 text-gray-400' :
          linked ? 'border-blue-300 text-blue-600 bg-white hover:bg-blue-50' :
                   'border-green-400 text-green-700 bg-white hover:bg-green-50'
        }`}>
          {uploading ? 'Загрузка…' : linked ? 'Заменить' : '+ Загрузить MP3'}
          <input ref={inputRef} type="file" accept="audio/*,.mp3" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>
      {uploadError && <p className="text-xs text-red-500 mt-1">{uploadError}</p>}
    </div>
  );
}

// ─── GuideCard (compact) ──────────────────────────────────────────────────────

function LangDot({ linked }) {
  return (
    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[9px] font-bold ${
      linked ? 'border-green-400 bg-green-100 text-green-700' : 'border-gray-300 bg-white text-gray-400'
    }`}>
      {linked ? '✓' : '—'}
    </span>
  );
}

function GuideCard({ guide, onClick, eventLabel }) {
  const title = getMultiLangValue(guide.title) || `Гид #${guide.index + 1}`;
  const linked = guide.tracks.filter((t) => t.audio_id).length;
  const total = guide.tracks.length;
  const allLinked = linked === total && total > 0;
  const noneLinked = linked === 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <span className="w-6 h-6 rounded-full bg-gray-100 text-xs font-semibold text-gray-500 flex items-center justify-center shrink-0">
          {guide.index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{title}</p>
          {eventLabel && <p className="text-xs text-gray-400 truncate">{eventLabel}</p>}
        </div>
        {/* Статус покрытия */}
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
          allLinked ? 'bg-green-100 text-green-700' :
          noneLinked ? 'bg-gray-100 text-gray-400' :
                       'bg-amber-100 text-amber-700'
        }`}>
          {linked}/{total}
        </span>
      </div>

      {/* Индикаторы языков */}
      <div className="px-4 py-2.5 flex flex-wrap gap-2">
        {guide.tracks.length === 0 ? (
          <span className="text-xs text-gray-400 italic">Треков нет</span>
        ) : guide.tracks.map((t) => (
          <div key={t.id} className="flex items-center gap-1">
            <LangDot linked={!!t.audio_id} />
            <span className="text-xs text-gray-500 font-mono">{langLabel(t.language)}</span>
          </div>
        ))}
      </div>
    </button>
  );
}

// ─── GuideDetailModal ─────────────────────────────────────────────────────────

function GuideDetailModal({ guide, open, onClose, onChanged, eventLabel }) {
  if (!guide) return null;
  const title = getMultiLangValue(guide.title) || `Гид #${guide.index + 1}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="lg"
    >
      <div className="space-y-1">
        {eventLabel && (
          <p className="text-xs text-gray-400 mb-3">Событие: {eventLabel}</p>
        )}
        {guide.tracks.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Треков нет</p>
        ) : (
          guide.tracks.map((track) => (
            <TrackRow
              key={track.id}
              track={track}
              guideId={guide.id}
              onUploaded={() => { onChanged?.(); onClose(); }}
            />
          ))
        )}
      </div>
    </Modal>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AudioGuidesCatalogPage() {
  const [eventOptions, setEventOptions] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventId, setEventId] = useState('');
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedGuide, setSelectedGuide] = useState(null);

  useEffect(() => {
    setEventsLoading(true);
    eventsAPI.list({ page_size: 500 })
      .then((r) => setEventOptions(normalizeListResponse(r?.data, ['events', 'results', 'data'])))
      .catch(() => setEventOptions([]))
      .finally(() => setEventsLoading(false));
  }, []);

  const load = useCallback(async (evId) => {
    setLoading(true);
    setError(null);
    try {
      const r = await eventAudioGuidesAPI.list(evId || null);
      setGuides(r?.data?.guides || []);
    } catch (e) {
      setError(parseApiError(e, 'Ошибка загрузки аудиогидов'));
      setGuides([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(eventId); }, [eventId, load]);

  const getEventLabel = (guide) => !eventId
    ? getMultiLangValue(eventOptions.find((e) => String(e.id) === String(guide.event))?.title) || null
    : null;

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Аудиогиды</h1>
        <p className="mt-1 text-sm text-gray-500">
          Клик по карточке — открыть треки. <span className="text-green-600 font-medium">●</span> есть файл, <span className="text-gray-400">○</span> нет файла.
        </p>
      </div>

      <div className="mb-4">
        <select
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          className={`w-full md:w-96 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none ${eventsLoading ? 'opacity-60 cursor-wait' : ''}`}
          disabled={eventsLoading}
        >
          <option value="">{eventsLoading ? 'Загрузка…' : 'Все события'}</option>
          {eventOptions.map((ev) => (
            <option key={ev.id} value={ev.id}>{getMultiLangValue(ev.title) || ev.id}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-8">
          <span className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full inline-block" />
          Загрузка...
        </div>
      ) : guides.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <div className="text-4xl mb-3">🎧</div>
          <p className="text-gray-500 text-sm">{eventId ? 'У этого события нет аудиогидов' : 'Нет аудиогидов'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {guides.map((guide) => (
            <GuideCard
              key={guide.id}
              guide={guide}
              onClick={() => setSelectedGuide(guide)}
              eventLabel={getEventLabel(guide)}
            />
          ))}
        </div>
      )}

      <GuideDetailModal
        open={!!selectedGuide}
        guide={selectedGuide}
        eventLabel={selectedGuide ? getEventLabel(selectedGuide) : null}
        onClose={() => setSelectedGuide(null)}
        onChanged={() => { load(eventId); setSelectedGuide(null); }}
      />
    </Layout>
  );
}
