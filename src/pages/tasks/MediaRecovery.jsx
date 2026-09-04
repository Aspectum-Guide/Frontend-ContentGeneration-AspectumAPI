import { useCallback, useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { mediaRecoveryAPI } from '../../api/mediaRecovery';
import { parseApiError } from '../../utils/apiError';

const KIND_LABELS = {
  event_audio_guide_track: 'Опубликовано',
  session_attraction_audio_guide_track: 'Черновик сессии',
};

function TrackCard({ track, onAttached }) {
  const [attaching, setAttaching] = useState(null);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const handleAttach = async (audioId) => {
    setAttaching(audioId);
    setError(null);
    try {
      await mediaRecoveryAPI.attachAudio(track.kind, track.track_id, audioId);
      setDone(true);
      onAttached(track.track_id);
    } catch (err) {
      setError(parseApiError(err, 'Не удалось привязать аудио'));
    } finally {
      setAttaching(null);
    }
  };

  if (done) return null;

  const contextLabel = track.context.event_title
    ? (track.context.event_title.ru || track.context.event_title.en || track.context.event_id)
    : `сессия ${track.context.session_uuid?.slice(0, 8)}…`;

  return (
    <div className="border border-gray-200 rounded-lg p-4 mb-3 bg-white">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-700 mr-2">
            {KIND_LABELS[track.kind]}
          </span>
          <span className="font-medium">{contextLabel}</span>
          <span className="text-gray-500 ml-2">язык: {track.language}</span>
        </div>
        <span className="text-xs text-gray-400">трек {track.track_id.slice(0, 8)}…</span>
      </div>

      {error && <div className="text-red-600 text-sm mb-2">{error}</div>}

      <div className="space-y-2">
        {track.candidates.map((c) => (
          <div key={c.id} className="flex items-center gap-3">
            <audio controls src={c.url} className="h-8" style={{ maxWidth: 300 }} />
            <button
              type="button"
              disabled={attaching !== null}
              onClick={() => handleAttach(c.id)}
              className="text-sm px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50 hover:bg-blue-700"
            >
              {attaching === c.id ? 'Привязываю…' : 'Это оно — привязать'}
            </button>
            <span className="text-xs text-gray-400 truncate" style={{ maxWidth: 260 }}>
              {c.path}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MediaRecovery() {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await mediaRecoveryAPI.listBrokenAudioTracks();
      setTracks(response?.data?.tracks || []);
    } catch (err) {
      setError(parseApiError(err, 'Ошибка загрузки списка'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAttached = (trackId) => {
    setTracks((prev) => prev.filter((t) => t.track_id !== trackId));
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-6">
        <h1 className="text-xl font-semibold mb-1">Восстановление аудио</h1>
        <p className="text-sm text-gray-500 mb-4">
          Треки аудиогидов, у которых сломалась ссылка на файл при инциденте 04.09.2026
          (см. docs/INCIDENT_2026-09-04_dedupe_media_fk_loss.md) и которые нельзя было
          восстановить автоматически — несколько языков одного гида сломались разом,
          и без прослушивания не понять, какой файл на каком языке. Прослушай кандидатов
          и нажми «Это оно» на правильном.
        </p>

        {loading && <div className="text-gray-500">Загрузка…</div>}
        {error && <div className="text-red-600 mb-4">{error}</div>}
        {!loading && !error && tracks.length === 0 && (
          <div className="text-green-700 bg-green-50 border border-green-200 rounded-lg p-4">
            Сломанных треков не осталось.
          </div>
        )}

        {tracks.map((track) => (
          <TrackCard key={track.track_id} track={track} onAttached={handleAttached} />
        ))}
      </div>
    </Layout>
  );
}
