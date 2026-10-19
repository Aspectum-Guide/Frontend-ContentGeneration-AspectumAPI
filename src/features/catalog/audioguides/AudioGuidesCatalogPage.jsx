import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { eventAudioGuidesAPI, audioAPI, eventsAPI } from './api';
import Layout from '../../../components/Layout';
import { FormLabel, Alert, Button, ConfirmModal, EmptyState, Field, FileButton, FormGrid, InlineState, Modal, PageHeader, Panel, Select, SelectableCard, Switch, TextInput, Glyph } from '@aspectum/ui';
import { parseApiError } from '../../../utils/apiError';
import AudioPlayer from '../shared/components/AudioPlayer';
import { getMultiLangValue } from '../shared/i18n';
import { normalizeListResponse } from '../shared/normalize';

// Fallback для audio guide tracks: отдельного API-списка языков у каталога пока нет.
const AUDIO_GUIDE_LANGUAGES_FALLBACK = ['ru', 'en', 'it', 'fr', 'es', 'de', 'pt', 'ja', 'zh', 'ko'];
const LANG_LABELS = { ru: 'RU', en: 'EN', it: 'IT', de: 'DE', fr: 'FR', es: 'ES', pt: 'PT', ja: 'JA', zh: 'ZH', ko: 'KO' };
function langLabel(code) { return LANG_LABELS[code] || code.toUpperCase(); }

// ─── TrackRow ─────────────────────────────────────────────────────────────────

function TrackRow({ track, guideId, onUploaded, onDeleted }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await eventAudioGuidesAPI.deleteTrack(guideId, track.id);
      onDeleted?.();
    } catch (err) {
      setUploadError(parseApiError(err, 'Ошибка удаления'));
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <>
      <div className={`rounded-aspectum-control border px-3 py-2.5 mb-2 last:mb-0 ${linked ? 'border-aspectum-positive-border bg-aspectum-positive-soft' : 'border-aspectum-border bg-aspectum-surface-muted'}`}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 shrink-0">
            <span className="w-8 text-xs font-mono font-bold text-aspectum-text-strong uppercase">{langLabel(track.language)}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${linked ? 'bg-aspectum-positive-muted text-aspectum-positive-strong' : 'bg-aspectum-border text-aspectum-text-muted'}`}>
              {linked ? '● есть' : '○ нет'}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            {linked ? <AudioPlayer audioId={track.audio_id} /> : <span className="text-xs text-aspectum-text-disabled italic">Файл не загружен</span>}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <FileButton
              inputRef={inputRef}
              accept="audio/*,.mp3"
              variant="soft"
              size="sm"
              onChange={handleUpload}
              disabled={uploading}
            >
              {uploading ? '…' : linked ? 'Заменить' : '+ MP3'}
            </FileButton>
            <Button
              type="button"
              onClick={() => setConfirmDelete(true)}
              variant="softDanger"
              size="sm"
              disabled={deleting}
            >
              <Glyph name="✕" />
            </Button>
          </div>
        </div>
        {uploadError && <p className="text-xs text-aspectum-danger-subtle mt-1">{uploadError}</p>}
      </div>

      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title={`Удалить трек ${langLabel(track.language)}?`}
        message={linked ? 'Аудиофайл и запись в базе будут удалены безвозвратно.' : 'Пустой трек будет удалён.'}
        confirmLabel="Удалить"
        danger
        loading={deleting}
      />
    </>
  );
}

// ─── AddLanguageRow ───────────────────────────────────────────────────────────

function AddLanguageRow({ guideId, existingLangs, onAdded }) {
  const [adding, setAdding] = useState(false);
  const available = AUDIO_GUIDE_LANGUAGES_FALLBACK.filter((l) => !existingLangs.includes(l));
  const [selected, setSelected] = useState('');

  if (available.length === 0) return null;

  const handleAdd = async () => {
    if (!selected) return;
    setAdding(true);
    try {
      await eventAudioGuidesAPI.upsertTrack(guideId, { language: selected, audio_id: null });
      setSelected('');
      onAdded?.();
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-aspectum-border">
      <Select className="flex-1" value={selected} onChange={(e) => setSelected(e.target.value)}>
        <option value="">+ Добавить язык</option>
        {available.map((l) => (
          <option key={l} value={l}>{langLabel(l)} — {l}</option>
        ))}
      </Select>
      <Button
        type="button"
        variant="primary"
        size="md"
        onClick={handleAdd}
        disabled={!selected || adding}
      >
        {adding ? '…' : 'Добавить'}
      </Button>
    </div>
  );
}

// ─── GuideCard (compact) ──────────────────────────────────────────────────────

function LangDot({ linked }) {
  return (
    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[9px] font-bold ${
      linked ? 'border-aspectum-positive-light bg-aspectum-positive-muted text-aspectum-positive-strong' : 'border-aspectum-border-strong bg-aspectum-surface text-aspectum-text-disabled'
    }`}>
      {linked ? <Glyph name="✓" /> : '—'}
    </span>
  );
}

function GuideCard({ guide, onClick, eventLabel }) {
  const title = getMultiLangValue(guide.title) || `Гид #${guide.index + 1}`;
  const linked = guide.tracks.filter((t) => t.audio_id).length;
  const total = guide.tracks.length;
  const allLinked = linked === total && total > 0;

  return (
    <SelectableCard onSelect={onClick} ariaLabel={title}
      className="w-full text-left bg-aspectum-surface rounded-aspectum-card border border-aspectum-border hover:border-aspectum-primary-border-strong hover:shadow-aspectum-card transition-all overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-aspectum-border-subtle">
        <span className="w-6 h-6 rounded-full bg-aspectum-surface-subtle text-xs font-semibold text-aspectum-text-muted flex items-center justify-center shrink-0">
          {guide.index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-aspectum-text truncate">{title}</p>
          {eventLabel && <p className="text-xs text-aspectum-text-disabled truncate">{eventLabel}</p>}
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
          allLinked ? 'bg-aspectum-positive-muted text-aspectum-positive-strong' :
          linked === 0 ? 'bg-aspectum-surface-subtle text-aspectum-text-disabled' : 'bg-aspectum-warning-muted text-aspectum-warning-strong'
        }`}>
          {linked}/{total}
        </span>
      </div>
      <div className="px-4 py-2.5 flex flex-wrap gap-2">
        {guide.tracks.length === 0
          ? <span className="text-xs text-aspectum-text-disabled italic">Треков нет</span>
          : guide.tracks.map((t) => (
            <div key={t.id} className="flex items-center gap-1">
              <LangDot linked={!!t.audio_id} />
              <span className="text-xs text-aspectum-text-muted font-mono">{langLabel(t.language)}</span>
            </div>
          ))}
      </div>
    </SelectableCard>
  );
}

// ─── GuideDetailModal ─────────────────────────────────────────────────────────

function GuideDetailModal({
  guide,
  open,
  onClose,
  onChanged,
  onDeleted,
  eventLabel,
}) {
  const [meta, setMeta] = useState({ titleRu: '', index: 0, is_show: true });
  const [savingMeta, setSavingMeta] = useState(false);
  const [metaError, setMetaError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const guideRef = useRef(guide);
  guideRef.current = guide;

  useEffect(() => {
    const guide = guideRef.current;
    if (!guide) return;
    setMeta({
      titleRu: guide.title?.ru || getMultiLangValue(guide.title) || '',
      index: guide.index ?? 0,
      is_show: guide.is_show !== false,
    });
    setMetaError('');
  }, [guide?.id, open]);

  if (!guide) return null;
  const title = getMultiLangValue(guide.title) || `Гид #${guide.index + 1}`;
  const existingLangs = guide.tracks.map((t) => t.language);

  const handleSaveMeta = async () => {
    setSavingMeta(true);
    setMetaError('');
    try {
      const titleObj = { ...(guide.title || {}), ru: meta.titleRu.trim() };
      await eventAudioGuidesAPI.update(guide.id, {
        title: titleObj,
        index: Number(meta.index) || 0,
        is_show: meta.is_show,
      });
      onChanged?.();
    } catch (err) {
      setMetaError(parseApiError(err, 'Ошибка сохранения'));
    } finally {
      setSavingMeta(false);
    }
  };

  const handleDeleteGuide = async () => {
    setDeleting(true);
    try {
      await eventAudioGuidesAPI.delete(guide.id);
      setConfirmDelete(false);
      onDeleted?.();
    } catch (err) {
      setMetaError(parseApiError(err, 'Ошибка удаления'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title={title} size="lg">
        {eventLabel && <p className="text-xs text-aspectum-text-disabled mb-3">Событие: {eventLabel}</p>}

        <Panel tone="muted" className="mb-5 p-4 space-y-3">
          <p className="text-sm font-medium text-aspectum-text-strong">Метаданные гида</p>
          <Field label="Название (RU)">
            <TextInput
              value={meta.titleRu}
              onChange={(e) => setMeta((p) => ({ ...p, titleRu: e.target.value }))}
              disabled={savingMeta}
            />
          </Field>
          <FormGrid responsive={false}>
            <Field label="Индекс">
              <TextInput
                type="number"
                min={0}
                value={meta.index}
                onChange={(e) => setMeta((p) => ({ ...p, index: e.target.value }))}
                disabled={savingMeta}
              />
            </Field>
            <FormLabel  layout="row" size="sm" tone="strong" className="pt-6">
              <Switch
                checked={meta.is_show}
                onChange={(is_show) => setMeta((p) => ({ ...p, is_show }))}
                disabled={savingMeta}
                aria-label="Показывать аудиогид в приложении"
              />
              Показывать в приложении
            </FormLabel>
          </FormGrid>
          {metaError && <p className="text-xs text-aspectum-danger">{metaError}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="primary" size="md" onClick={handleSaveMeta} disabled={savingMeta}>
              {savingMeta ? 'Сохранение...' : 'Сохранить метаданные'}
            </Button>
            <Button type="button" variant="softDanger" size="md" onClick={() => setConfirmDelete(true)} disabled={savingMeta || deleting}>
              Удалить гид
            </Button>
          </div>
        </Panel>

        {guide.tracks.length === 0
          ? <p className="text-sm text-aspectum-text-disabled py-4 text-center">Треков нет</p>
          : guide.tracks.map((track) => (
            <TrackRow
              key={track.id}
              track={track}
              guideId={guide.id}
              onUploaded={onChanged}
              onDeleted={onChanged}
            />
          ))
        }
        <AddLanguageRow
          guideId={guide.id}
          existingLangs={existingLangs}
          onAdded={onChanged}
        />
      </Modal>

      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDeleteGuide}
        title="Удалить аудиогид?"
        message="Гид и все его треки будут удалены безвозвратно."
        confirmLabel="Удалить"
        danger
        loading={deleting}
      />
    </>
  );
}

// ─── Coverage summary ─────────────────────────────────────────────────────────

function CoverageSummary({ guides }) {
  if (!guides.length) return null;
  const langStats = {};
  for (const g of guides) {
    for (const t of g.tracks) {
      if (!langStats[t.language]) langStats[t.language] = { ok: 0, total: 0 };
      langStats[t.language].total++;
      if (t.audio_id) langStats[t.language].ok++;
    }
  }
  const langs = Object.entries(langStats).sort((a, b) => b[1].ok / b[1].total - a[1].ok / a[1].total);
  const incomplete = langs.filter(([, s]) => s.ok < s.total);

  if (!incomplete.length) return (
    <Alert tone="success" className="mb-4"><Glyph name="✓" /> Все языки заполнены полностью</Alert>
  );

  return (
    <Alert tone="warning" className="mb-4">
      <p className="text-xs font-semibold text-aspectum-warning-strong mb-2">Неполное покрытие:</p>
      <div className="flex flex-wrap gap-3">
        {incomplete.map(([lang, s]) => (
          <div key={lang} className="flex items-center gap-1">
            <span className="text-xs font-mono font-bold text-aspectum-text-subtle">{langLabel(lang)}</span>
            <span className="text-xs text-aspectum-warning-strong">{s.ok}/{s.total}</span>
          </div>
        ))}
      </div>
    </Alert>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AudioGuidesCatalogPage() {
  const [searchParams] = useSearchParams();
  const [cityOptions, setCityOptions] = useState([]);
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [cityId, setCityId] = useState(() => searchParams.get('city_id') || '');
  const [eventOptions, setEventOptions] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventId, setEventId] = useState(() => searchParams.get('event_id') || '');
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedGuide, setSelectedGuide] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createTitle, setCreateTitle] = useState('');

  useEffect(() => {
    const fromUrl = searchParams.get('event_id');
    if (fromUrl) setEventId(fromUrl);
    const cityFromUrl = searchParams.get('city_id');
    if (cityFromUrl) setCityId(cityFromUrl);
  }, [searchParams]);

  useEffect(() => {
    setCitiesLoading(true);
    eventsAPI.cities()
      .then((r) => setCityOptions(r?.data?.cities || []))
      .catch(() => setCityOptions([]))
      .finally(() => setCitiesLoading(false));
  }, []);

  useEffect(() => {
    setEventsLoading(true);
    eventsAPI.list({ page_size: 500, ...(cityId ? { city_id: cityId } : {}) })
      .then((r) => {
        const list = normalizeListResponse(r?.data, ['events', 'results', 'data']);
        setEventOptions(list);
        // Selected event no longer belongs to the chosen city — clear it
        // instead of silently showing a mismatched event's guides.
        if (eventId && !list.some((ev) => String(ev.id) === String(eventId))) {
          setEventId('');
        }
      })
      .catch(() => setEventOptions([]))
      .finally(() => setEventsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityId]);

  const load = useCallback(async (evId) => {
    setLoading(true);
    setError(null);
    try {
      const r = await eventAudioGuidesAPI.list(evId || null);
      setGuides(r?.data?.guides || []);
    } catch (e) {
      setError(parseApiError(e, 'Ошибка загрузки'));
      setGuides([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(eventId); }, [eventId, load]);

  const handleChanged = async () => {
    try {
      const r = await eventAudioGuidesAPI.list(eventId || null);
      const nextGuides = r?.data?.guides || [];
      setGuides(nextGuides);
      if (selectedGuide) {
        setSelectedGuide(nextGuides.find((g) => g.id === selectedGuide.id) || null);
      }
    } catch (e) {
      setError(parseApiError(e, 'Ошибка обновления'));
    }
  };

  const handleCreate = async (e) => {
    e?.preventDefault();
    if (!eventId) {
      setCreateError('Выберите событие');
      return;
    }
    if (!createTitle.trim()) {
      setCreateError('Введите название');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const r = await eventAudioGuidesAPI.create({
        event_id: eventId,
        title: { ru: createTitle.trim() },
        index: guides.length,
        is_show: true,
      });
      const created = r?.data?.guide;
      setCreateOpen(false);
      setCreateTitle('');
      await load(eventId);
      if (created?.id) setSelectedGuide(created);
    } catch (err) {
      setCreateError(parseApiError(err, 'Ошибка создания'));
    } finally {
      setCreating(false);
    }
  };

  const getEventLabel = (guide) => !eventId
    ? getMultiLangValue(eventOptions.find((ev) => String(ev.id) === String(guide.event))?.title) || null
    : null;

  // eventOptions is already scoped to the selected city (see the effect
  // above), so when no specific event is chosen this is just "does this
  // guide's event belong to the current city's event list" — no extra
  // per-guide city lookup needed.
  const eventIdsInScope = cityId ? new Set(eventOptions.map((ev) => String(ev.id))) : null;
  const visibleGuides = (!cityId || eventId)
    ? guides
    : guides.filter((g) => eventIdsInScope.has(String(g.event)));

  return (
    <Layout>
      <PageHeader
        title="Аудиогиды"
        className="flex-wrap"
        description={(
          <>
            <span className="text-aspectum-positive font-medium">●</span> есть файл &nbsp;
            <span className="text-aspectum-text-disabled">○</span> нет файла · клик → управление треками
          </>
        )}
        actions={<Button
          type="button"
          variant="primary"
          size="md"
          onClick={() => { setCreateError(''); setCreateTitle(''); setCreateOpen(true); }}
          disabled={!eventId || creating}
        >
          + Создать аудиогид
        </Button>}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Select className={`w-full md:w-64 ${citiesLoading ? 'opacity-60 cursor-wait' : ''}`} value={cityId} onChange={(e) => setCityId(e.target.value)} disabled={citiesLoading}>
          <option value="">{citiesLoading ? 'Загрузка…' : 'Все города'}</option>
          {cityOptions.map((c) => (
            <option key={c.id} value={c.id}>{c.name} ({c.events_count})</option>
          ))}
        </Select>
        <Select className={`w-full md:w-96 ${eventsLoading ? 'opacity-60 cursor-wait' : ''}`} value={eventId} onChange={(e) => setEventId(e.target.value)} disabled={eventsLoading}>
          <option value="">{eventsLoading ? 'Загрузка…' : cityId ? 'Все события города' : 'Все события'}</option>
          {eventOptions.map((ev) => (
            <option key={ev.id} value={ev.id}>{getMultiLangValue(ev.title) || ev.id}</option>
          ))}
        </Select>
      </div>

      {error && <Alert tone="error" className="mb-4">{error}</Alert>}

      {!loading && visibleGuides.length > 0 && <CoverageSummary guides={visibleGuides} />}

      {loading ? (
        <InlineState loading tone="disabled" className="py-8">Загрузка...</InlineState>
      ) : visibleGuides.length === 0 ? (
        <EmptyState
          icon="🎧"
          title={eventId ? 'У этого события нет аудиогидов' : cityId ? 'У этого города нет аудиогидов' : 'Нет аудиогидов'}
          className="py-12"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleGuides.map((guide) => (
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
        onChanged={handleChanged}
        onDeleted={() => { setSelectedGuide(null); load(eventId); }}
      />

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Создать аудиогид"
        size="md"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {createError && (
            <Alert tone="error">{createError}</Alert>
          )}
          {!eventId && (
            <p className="text-sm text-aspectum-warning-strong bg-aspectum-warning-soft border border-aspectum-warning-border rounded-aspectum-control px-3 py-2">
              Сначала выберите событие в фильтре выше.
            </p>
          )}
          <Field label="Название (RU)" required>
            <TextInput
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              disabled={creating}
              autoFocus
              placeholder="Название аудиогида"
            />
          </Field>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="secondary" size="md" onClick={() => setCreateOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" variant="primary" size="md" disabled={creating || !eventId}>
              {creating ? 'Создание...' : 'Создать'}
            </Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
