import { useCallback, useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { mediaRecoveryAPI } from '../../api/mediaRecovery';
import { parseApiError } from '../../utils/apiError';
import { Alert, Button, ConfirmModal, EmptyState, PageContainer, PageHeader, SectionHeader, Spinner, Tabs } from '@aspectum/admin-ui-web';

const KIND_LABELS = {
  event_audio_guide_track: 'Опубликовано',
  session_attraction_audio_guide_track: 'Черновик сессии',
};

const LANGUAGE_LABELS = {
  ru: 'Русский (ru)',
  en: 'English (en)',
  de: 'Deutsch (de)',
  it: 'Italiano (it)',
  fr: 'Français (fr)',
  es: 'Español (es)',
};

function langLabel(code) {
  if (!code) return 'язык не указан';
  return LANGUAGE_LABELS[code] || code;
}

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
    <div className="border border-aspectum-border rounded-aspectum-control p-4 mb-3 bg-aspectum-surface">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-xs font-medium px-2 py-0.5 rounded bg-aspectum-surface-subtle text-aspectum-text-strong mr-2">
            {KIND_LABELS[track.kind]}
          </span>
          <span className="font-medium">{contextLabel}</span>
          <span className="text-aspectum-text-muted ml-2">язык: {langLabel(track.language)}</span>
        </div>
        <span className="text-xs text-aspectum-text-disabled">трек {track.track_id.slice(0, 8)}…</span>
      </div>

      {error && <div className="text-aspectum-danger text-sm mb-2">{error}</div>}

      <div className="space-y-2">
        {track.candidates.map((c) => (
          <div key={c.id} className="flex items-center gap-3">
            <audio controls src={c.url} className="h-8" style={{ maxWidth: 300 }} />
            <Button
              type="button"
              disabled={attaching !== null}
              onClick={() => handleAttach(c.id)}
              variant="primary"
              size="md"
            >
              {attaching === c.id ? 'Привязываю…' : 'Это оно — привязать'}
            </Button>
            <span className="text-xs text-aspectum-text-disabled truncate" style={{ maxWidth: 260 }}>
              {c.path}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function groupTitle(group) {
  if (group.kind === 'event') {
    const title = group.context.event_title;
    const name = title ? (title.ru || title.en || Object.values(title)[0]) : null;
    return name || `событие ${group.context.event_id?.slice(0, 8)}…`;
  }
  if (group.kind === 'session') {
    return group.context.session_name || `сессия ${group.context.session_uuid?.slice(0, 8)}…`;
  }
  return 'без группы';
}

function FilePlayer({ file }) {
  return (
    <div className="flex items-center gap-3">
      <audio controls src={file.url} className="h-8" style={{ maxWidth: 280 }} />
      <span className="text-xs px-2 py-0.5 rounded bg-aspectum-surface-subtle text-aspectum-text-strong">
        {langLabel(file.language)}
      </span>
      <span className="text-xs text-aspectum-text-disabled truncate" style={{ maxWidth: 220 }}>
        {file.path}
      </span>
    </div>
  );
}

function RecoverableGroup({ group, onChanged }) {
  const [attachingFile, setAttachingFile] = useState(null);
  const [error, setError] = useState(null);
  const [files, setFiles] = useState(group.files);
  const [tracks, setTracks] = useState(group.broken_tracks);

  const handleAttach = async (fileId, track) => {
    setAttachingFile(fileId);
    setError(null);
    try {
      await mediaRecoveryAPI.attachAudio(track.kind, track.track_id, fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      setTracks((prev) => prev.filter((t) => t.track_id !== track.track_id));
      onChanged();
    } catch (err) {
      setError(parseApiError(err, 'Не удалось привязать аудио'));
    } finally {
      setAttachingFile(null);
    }
  };

  if (tracks.length === 0 || files.length === 0) return null;

  return (
    <div className="border border-aspectum-warning-border bg-aspectum-warning-soft rounded-aspectum-control p-4 mb-3">
      <div className="font-medium mb-1">{groupTitle(group)}</div>
      <p className="text-xs text-aspectum-text-muted mb-3">
        В этой {group.kind === 'event' ? 'публикации' : 'сессии'} есть недостающие треки и
        неслинкованные файлы рядом — послушай и привяжи нужный файл к нужному языку.
      </p>

      {error && <div className="text-aspectum-danger text-sm mb-2">{error}</div>}

      <div className="space-y-3">
        {tracks.map((t) => (
          <div key={t.track_id} className="flex flex-wrap items-center gap-2 bg-aspectum-surface border border-aspectum-border rounded p-2">
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-aspectum-surface-subtle text-aspectum-text-strong">
              {langLabel(t.language)}
            </span>
            <span className="text-xs text-aspectum-text-disabled">трек {t.track_id.slice(0, 8)}…</span>
            <span className="text-xs text-aspectum-text-disabled">→</span>
            {files.map((f) => (
              <Button
                key={f.id}
                type="button"
                disabled={attachingFile !== null}
                onClick={() => handleAttach(f.id, t)}
                variant="primary"
                size="sm"
              >
                {attachingFile === f.id ? 'Привязываю…' : `привязать ${langLabel(f.language)}`}
              </Button>
            ))}
          </div>
        ))}
      </div>

      <div className="mt-3 space-y-2">
        {files.map((f) => <FilePlayer key={f.id} file={f} />)}
      </div>
    </div>
  );
}

function CleanupGroup({ group, onDeleted }) {
  const [files, setFiles] = useState(group.files);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await mediaRecoveryAPI.deleteOrphanAudio(deleteTarget.id);
      setFiles((prev) => prev.filter((f) => f.id !== deleteTarget.id));
      setDeleteTarget(null);
      onDeleted();
    } catch (err) {
      throw new Error(parseApiError(err, 'Не удалось удалить файл'));
    }
  };

  if (files.length === 0) return null;

  return (
    <div className="border border-aspectum-border rounded-aspectum-control p-4 mb-3 bg-aspectum-surface">
      <div className="font-medium mb-1">{groupTitle(group)}</div>
      <p className="text-xs text-aspectum-text-muted mb-3">
        {group.kind === 'session' && group.context.session_exists === false
          ? 'Сессия удалена — эти файлы больше некуда привязывать.'
          : 'Сломанных треков в этой группе нет — файлы, судя по всему, старые/лишние копии.'}
      </p>

      <div className="space-y-2">
        {files.map((f) => (
          <div key={f.id} className="flex items-center gap-3">
            <FilePlayer file={f} />
            <Button
              variant="danger"
              size="sm"
              type="button"
              onClick={() => setDeleteTarget(f)}
              className="ml-auto"
            >
              Удалить
            </Button>
          </div>
        ))}
      </div>
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Удалить файл?"
        message="Файл будет удалён без возможности восстановления."
        confirmLabel="Удалить"
        danger
      />
    </div>
  );
}

function BrokenTracksTab() {
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

  useEffect(() => { load(); }, [load]);

  const handleAttached = (trackId) => {
    setTracks((prev) => prev.filter((t) => t.track_id !== trackId));
  };

  return (
    <div>
      <p className="text-sm text-aspectum-text-muted mb-4">
        Треки аудиогидов, у которых сломалась ссылка на файл при инциденте 04.09.2026
        (см. docs/INCIDENT_2026-09-04_dedupe_media_fk_loss.md) и которые нельзя было
        восстановить автоматически — несколько языков одного гида сломались разом,
        и без прослушивания не понять, какой файл на каком языке. Прослушай кандидатов
        и нажми «Это оно» на правильном.
      </p>

      {loading && <EmptyState icon={<Spinner size="sm" />} title="Загрузка…" spacing="sm" />}
      {error && <div className="text-aspectum-danger mb-4">{error}</div>}
      {!loading && !error && tracks.length === 0 && (
        <Alert tone="success">Сломанных треков не осталось.</Alert>
      )}

      {tracks.map((track) => (
        <TrackCard key={track.track_id} track={track} onAttached={handleAttached} />
      ))}
    </div>
  );
}

function UnlinkedAudioTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await mediaRecoveryAPI.listUnlinkedAudio();
      setData(response?.data || null);
    } catch (err) {
      setError(parseApiError(err, 'Ошибка загрузки списка'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <EmptyState icon={<Spinner size="sm" />} title="Загрузка…" spacing="sm" />;
  if (error) return <div className="text-aspectum-danger">{error}</div>;
  if (!data) return null;

  const { recoverable, cleanup, recoverable_file_count: recCount, cleanup_file_count: cleanupCount } = data;

  return (
    <div>
      <p className="text-sm text-aspectum-text-muted mb-4">
        Аудиофайлы, на которые не ссылается ни один трек/гид/пост — они пережили инцидент
        04.09.2026 (или просто остались от старых версий), но потерялись со стороны БД.
        «Можно восстановить» — рядом есть трек без аудио, которому этот файл, возможно,
        принадлежит. «Мусор» — привязывать некуда, кандидат на удаление.
      </p>

      {error && <div className="text-aspectum-danger mb-4">{error}</div>}

      <SectionHeader title={`Можно восстановить ${recCount ? `(${recCount} файлов)` : ''}`} size="xs" className="mt-4 mb-2" />
      {(!recoverable || recoverable.length === 0) && (
        <div className="text-aspectum-text-muted text-sm mb-4">Групп с недостающими треками рядом нет.</div>
      )}
      {recoverable?.map((group) => (
        <RecoverableGroup
          key={`${group.kind}-${group.context.session_uuid || group.context.event_id}`}
          group={group}
          onChanged={load}
        />
      ))}

      <SectionHeader title={`Мусор — можно удалить ${cleanupCount ? `(${cleanupCount} файлов)` : ''}`} size="xs" className="mt-6 mb-2" />
      {(!cleanup || cleanup.length === 0) && (
        <div className="text-aspectum-text-muted text-sm">Лишних файлов нет.</div>
      )}
      {cleanup?.map((group) => (
        <CleanupGroup
          key={`${group.kind}-${group.context.session_uuid || group.context.event_id || 'other'}`}
          group={group}
          onDeleted={load}
        />
      ))}
    </div>
  );
}

const TABS = [
  { key: 'broken', label: 'Сломанные треки', render: () => <BrokenTracksTab /> },
  { key: 'unlinked', label: 'Неслинкованное аудио', render: () => <UnlinkedAudioTab /> },
];

export default function MediaRecovery() {
  const [activeTab, setActiveTab] = useState(TABS[0].key);
  const tab = TABS.find((t) => t.key === activeTab) || TABS[0];

  return (
    <Layout>
      <PageContainer maxWidth="wide" centered className="py-6">
        <PageHeader title="Восстановление аудио" titleSize="sm" spacing="none" />

        <Tabs
          className="mb-4 mt-3 border-b border-aspectum-border"
          items={TABS.map(({ key, label }) => ({ id: key, label }))}
          value={activeTab}
          onChange={setActiveTab}
        />

        {tab.render()}
      </PageContainer>
    </Layout>
  );
}
