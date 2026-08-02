import { useCallback, useEffect, useState } from 'react';
import { Field, Select, TextInput } from '../../../components/ui/FormField';
import { ConfirmModal } from '../../../components/ui/Modal';
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
      <label className="flex items-center gap-2 text-sm text-gray-700 md:col-span-2">
        <input
          type="checkbox"
          checked={!!draft.is_pass_by}
          onChange={(e) => setDraft((p) => ({ ...p, is_pass_by: e.target.checked }))}
        />
        Проходной пункт (без номера, &laquo;Pass By&raquo;)
      </label>
    </div>
  );

  if (!activeLang) {
    return <p className="text-sm text-gray-400">Сначала укажите название события хотя бы на одном языке.</p>;
  }

  return (
    <div className="space-y-3">
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="text-sm text-gray-400">Загрузка...</div>
      ) : (
        <div className="space-y-2">
          {steps.length === 0 && !addOpen && (
            <p className="text-sm text-gray-400">Шагов маршрута пока нет.</p>
          )}

          {steps.map((step, i) => (
            <div key={step.id} className="border border-gray-200 rounded-xl p-3">
              {editingId === step.id ? (
                <div className="space-y-3">
                  {renderFields(editDraft, setEditDraft)}
                  {saveError && <p className="text-xs text-red-600">{saveError}</p>}
                  <div className="flex gap-2">
                    <button type="button" onClick={saveEdit} disabled={saving}
                      className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                      {saving ? 'Сохранение...' : 'Сохранить'}
                    </button>
                    <button type="button" onClick={cancelEdit}
                      className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
                      {step.is_pass_by ? (
                        <span className="text-xs text-gray-400 uppercase">Pass by</span>
                      ) : (
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center shrink-0">
                          {steps.slice(0, i + 1).filter((s) => !s.is_pass_by).length}
                        </span>
                      )}
                      <span className="truncate">{step.name?.[activeLang] || '(без названия)'}</span>
                    </div>
                    {step.description?.[activeLang] && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{step.description[activeLang]}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {step.duration_minutes ? `${step.duration_minutes} минут` : null}
                      {step.duration_minutes && step.admission_status ? ' • ' : null}
                      {ADMISSION_OPTIONS.find((o) => o.value === step.admission_status)?.label || null}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => move(step, -1)} disabled={i === 0}
                      className="w-7 h-7 text-gray-500 hover:text-gray-800 disabled:opacity-30" title="Выше">↑</button>
                    <button type="button" onClick={() => move(step, 1)} disabled={i === steps.length - 1}
                      className="w-7 h-7 text-gray-500 hover:text-gray-800 disabled:opacity-30" title="Ниже">↓</button>
                    <button type="button" onClick={() => startEdit(step)}
                      className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100">Изменить</button>
                    <button type="button" onClick={() => setDeleteTarget(step)}
                      className="px-2 py-1 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100">Удалить</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {addOpen ? (
        <div className="border border-dashed border-blue-300 rounded-xl p-3 space-y-3 bg-blue-50/30">
          {renderFields(addDraft, setAddDraft)}
          {saveError && <p className="text-xs text-red-600">{saveError}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={submitAdd} disabled={saving}
              className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Добавление...' : 'Добавить шаг'}
            </button>
            <button type="button" onClick={() => { setAddOpen(false); setAddDraft(emptyStep()); setSaveError(null); }}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAddOpen(true)}
          className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100">
          + Добавить шаг маршрута
        </button>
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
