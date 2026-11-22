import { useCallback, useEffect, useState } from 'react';
import { FormLabel, Alert, Button, Checkbox, ConfirmModal, EmptyState, Field, FormGrid, IconButton, Panel, Select, TextInput } from '@aspectum/admin-ui-web';
import { parseApiError } from '../../../utils/apiError';
import { eventsCatalogAPI } from './api';
import { LangBlock } from '../shared/LangFields';

const ADMISSION_OPTIONS = [
  { value: '', label: '— не указано —' },
  { value: 'free', label: 'Бесплатно' },
  { value: 'included', label: 'Включено в билет' },
  { value: 'not_included', label: 'Не включено' },
];

const emptyStep = () => ({
  name: {},
  description: {},
  duration_minutes: '',
  admission_status: '',
  is_pass_by: false,
});

/**
 * "Маршрут" tab — ordered tour-route steps for a shop event.
 * Each row is its own REST resource (BookingAPI.EventItineraryStep via
 * events/<id>/itinerary/) — not part of the main event PATCH.
 */
export default function EventItineraryTab({ eventId, activeLang }) {
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addDraft, setAddDraft] = useState(emptyStep());

  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await eventsCatalogAPI.listItinerary(eventId);
      setSteps(res?.data?.results || []);
    } catch (err) {
      setError(parseApiError(err, 'Ошибка загрузки маршрута'));
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  const startEdit = (step) => {
    setEditingId(step.id);
    setEditDraft({ ...step, duration_minutes: step.duration_minutes ?? '' });
    setSaveError(null);
  };

  const cancelEdit = () => { setEditingId(null); setEditDraft(null); setSaveError(null); };

  const saveEdit = async () => {
    try {
      setSaving(true);
      setSaveError(null);
      const payload = {
        name: editDraft.name || {},
        description: editDraft.description || {},
        duration_minutes: editDraft.duration_minutes === '' ? null : Number(editDraft.duration_minutes),
        admission_status: editDraft.admission_status || '',
        is_pass_by: !!editDraft.is_pass_by,
      };
      const res = await eventsCatalogAPI.updateItineraryStep(eventId, editingId, payload);
      setSteps((prev) => prev.map((s) => (s.id === editingId ? res.data.item : s)));
      cancelEdit();
    } catch (err) {
      setSaveError(parseApiError(err, 'Ошибка сохранения шага'));
    } finally {
      setSaving(false);
    }
  };

  const submitAdd = async () => {
    try {
      setSaving(true);
      setSaveError(null);
      const payload = {
        name: addDraft.name || {},
        description: addDraft.description || {},
        duration_minutes: addDraft.duration_minutes === '' ? null : Number(addDraft.duration_minutes),
        admission_status: addDraft.admission_status || '',
        is_pass_by: !!addDraft.is_pass_by,
        index: steps.length,
      };
      const res = await eventsCatalogAPI.createItineraryStep(eventId, payload);
      setSteps((prev) => [...prev, res.data.item]);
      setAddDraft(emptyStep());
      setAddOpen(false);
    } catch (err) {
      setSaveError(parseApiError(err, 'Ошибка добавления шага'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    try {
      await eventsCatalogAPI.deleteItineraryStep(eventId, deleteTarget.id);
    } catch (err) {
      throw new Error(parseApiError(err, 'Ошибка удаления шага'));
    }
    setSteps((prev) => prev.filter((s) => s.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const move = async (step, direction) => {
    const idx = steps.findIndex((s) => s.id === step.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= steps.length) return;
    const other = steps[swapIdx];
    try {
      setError(null);
      const [a, b] = await Promise.all([
        eventsCatalogAPI.updateItineraryStep(eventId, step.id, { index: other.index }),
        eventsCatalogAPI.updateItineraryStep(eventId, other.id, { index: step.index }),
      ]);
      setSteps((prev) => {
        const next = [...prev];
        next[idx] = a.data.item;
        next[swapIdx] = b.data.item;
        return next.sort((x, y) => x.index - y.index);
      });
    } catch (err) {
      setError(parseApiError(err, 'Ошибка изменения порядка'));
    }
  };

  const renderFields = (draft, setDraft) => (
    <FormGrid>
      <LangBlock
        label="Название"
        value={draft.name || {}}
        onChange={(v) => setDraft((p) => ({ ...p, name: v }))}
        activeLang={activeLang}
      />
      <LangBlock
        label="Описание"
        value={draft.description || {}}
        onChange={(v) => setDraft((p) => ({ ...p, description: v }))}
        activeLang={activeLang}
        multiline
      />
      <Field label="Длительность, мин">
        <TextInput
          type="number"
          min="0"
          value={draft.duration_minutes}
          onChange={(e) => setDraft((p) => ({ ...p, duration_minutes: e.target.value }))}
          placeholder="40"
        />
      </Field>
      <Field label="Входной билет">
        <Select
          value={draft.admission_status || ''}
          onChange={(e) => setDraft((p) => ({ ...p, admission_status: e.target.value }))}
        >
          {ADMISSION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </Field>
      <FormLabel  layout="row" size="sm" tone="strong" className="md:col-span-2">
        <Checkbox
          checked={!!draft.is_pass_by}
          onChange={(e) => setDraft((p) => ({ ...p, is_pass_by: e.target.checked }))}
        />
        Проходной пункт (без номера, &laquo;Pass By&raquo;)
      </FormLabel>
    </FormGrid>
  );

  if (!activeLang) {
    return <p className="text-sm text-aspectum-text-disabled">Сначала укажите название события хотя бы на одном языке.</p>;
  }

  return (
    <div className="space-y-3">
      {error && <Alert tone="error">{error}</Alert>}

      {loading ? (
        <EmptyState icon={null} title="Загрузка..." spacing="sm" />
      ) : (
        <div className="space-y-2">
          {steps.length === 0 && !addOpen && (
            <EmptyState
              icon="🧭"
              title="Шагов маршрута пока нет"
              description="Добавьте первый пункт маршрута, чтобы собрать itinerary события."
              className="py-5"
            />
          )}

          {steps.map((step, i) => (
            <div key={step.id} className="border border-aspectum-border rounded-aspectum-card p-3">
              {editingId === step.id ? (
                <div className="space-y-3">
                  {renderFields(editDraft, setEditDraft)}
                  {saveError && <p className="text-xs text-aspectum-danger">{saveError}</p>}
                  <div className="flex gap-2">
                    <Button type="button" variant="primary" size="md" onClick={saveEdit} disabled={saving}>
                      {saving ? 'Сохранение...' : 'Сохранить'}
                    </Button>
                    <Button type="button" variant="secondary" size="md" onClick={cancelEdit}>
                      Отмена
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium text-aspectum-text-emphasis">
                      {step.is_pass_by ? (
                        <span className="text-xs text-aspectum-text-disabled uppercase">Pass by</span>
                      ) : (
                        <span className="w-5 h-5 rounded-full bg-aspectum-primary text-aspectum-on-accent text-xs flex items-center justify-center shrink-0">
                          {steps.slice(0, i + 1).filter((s) => !s.is_pass_by).length}
                        </span>
                      )}
                      <span className="truncate">{step.name?.[activeLang] || '(без названия)'}</span>
                    </div>
                    {step.description?.[activeLang] && (
                      <p className="text-xs text-aspectum-text-muted mt-0.5 line-clamp-2">{step.description[activeLang]}</p>
                    )}
                    <p className="text-xs text-aspectum-text-disabled mt-1">
                      {step.duration_minutes ? `${step.duration_minutes} минут` : null}
                      {step.duration_minutes && step.admission_status ? ' • ' : null}
                      {ADMISSION_OPTIONS.find((o) => o.value === step.admission_status)?.label || null}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <IconButton label="Переместить выше" type="button" onClick={() => move(step, -1)} disabled={i === 0}
                      className="w-7 h-7 p-0">↑</IconButton>
                    <IconButton label="Переместить ниже" type="button" onClick={() => move(step, 1)} disabled={i === steps.length - 1}
                      className="w-7 h-7 p-0">↓</IconButton>
                    <Button type="button" variant="soft" size="sm" onClick={() => startEdit(step)}>Изменить</Button>
                    <Button type="button" variant="softDanger" size="sm" onClick={() => setDeleteTarget(step)}>Удалить</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {addOpen ? (
        <Panel tone="info" className="border-dashed p-3 space-y-3">
          {renderFields(addDraft, setAddDraft)}
          {saveError && <p className="text-xs text-aspectum-danger">{saveError}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="primary" size="md" onClick={submitAdd} disabled={saving}>
              {saving ? 'Добавление...' : 'Добавить шаг'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => { setAddOpen(false); setAddDraft(emptyStep()); setSaveError(null); }}
            >
              Отмена
            </Button>
          </div>
        </Panel>
      ) : (
        <Button type="button" variant="soft" size="md" onClick={() => setAddOpen(true)}>
          + Добавить шаг маршрута
        </Button>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Удалить шаг маршрута?"
        message={`«${deleteTarget?.name?.[activeLang] || 'этот шаг'}» будет удалён без возможности восстановления.`}
        confirmLabel="Удалить"
        danger
      />
    </div>
  );
}
