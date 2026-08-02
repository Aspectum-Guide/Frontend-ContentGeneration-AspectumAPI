import { useCallback, useEffect, useState } from 'react';
import { Select } from '../../../components/ui/FormField';
import { ConfirmModal } from '../../../components/ui/Modal';
import { parseApiError } from '../../../utils/apiError';
import { eventsCatalogAPI } from './api';
import { LangBlock } from '../shared/LangFields';

const KIND_OPTIONS = [
  { value: 'included', label: 'Включено', icon: '✓' },
  { value: 'excluded', label: 'Не включено', icon: '✗' },
];

const emptyItem = (kind) => ({ kind, text: {} });

/**
 * "Что включено" tab — the two-column included/excluded checklist for a
 * shop event. Same REST-per-row shape as EventItineraryTab.
 */
export default function EventInclusionsTab({ eventId, activeLang }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [addKind, setAddKind] = useState(null);
  const [addDraft, setAddDraft] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await eventsCatalogAPI.listInclusions(eventId);
      setItems(res?.data?.results || []);
    } catch (err) {
      setError(parseApiError(err, 'Ошибка загрузки списка включений'));
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  const startEdit = (item) => { setEditingId(item.id); setEditDraft({ ...item }); setSaveError(null); };
  const cancelEdit = () => { setEditingId(null); setEditDraft(null); setSaveError(null); };

  const saveEdit = async () => {
    try {
      setSaving(true);
      setSaveError(null);
      const res = await eventsCatalogAPI.updateInclusion(eventId, editingId, {
        kind: editDraft.kind, text: editDraft.text || {},
      });
      setItems((prev) => prev.map((it) => (it.id === editingId ? res.data.item : it)));
      cancelEdit();
    } catch (err) {
      setSaveError(parseApiError(err, 'Ошибка сохранения пункта'));
    } finally {
      setSaving(false);
    }
  };

  const submitAdd = async () => {
    try {
      setSaving(true);
      setSaveError(null);
      const groupLen = items.filter((it) => it.kind === addDraft.kind).length;
      const res = await eventsCatalogAPI.createInclusion(eventId, {
        kind: addDraft.kind, text: addDraft.text || {}, index: groupLen,
      });
      setItems((prev) => [...prev, res.data.item]);
      setAddKind(null);
      setAddDraft(null);
    } catch (err) {
      setSaveError(parseApiError(err, 'Ошибка добавления пункта'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    try {
      await eventsCatalogAPI.deleteInclusion(eventId, deleteTarget.id);
    } catch (err) {
      throw new Error(parseApiError(err, 'Ошибка удаления пункта'));
    }
    setItems((prev) => prev.filter((it) => it.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const move = async (item, direction, group) => {
    const idx = group.findIndex((it) => it.id === item.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= group.length) return;
    const other = group[swapIdx];
    try {
      setError(null);
      const [a, b] = await Promise.all([
        eventsCatalogAPI.updateInclusion(eventId, item.id, { index: other.index }),
        eventsCatalogAPI.updateInclusion(eventId, other.id, { index: item.index }),
      ]);
      setItems((prev) => prev.map((it) => {
        if (it.id === a.data.item.id) return a.data.item;
        if (it.id === b.data.item.id) return b.data.item;
        return it;
      }));
    } catch (err) {
      setError(parseApiError(err, 'Ошибка изменения порядка'));
    }
  };

  if (!activeLang) {
    return <p className="text-sm text-gray-400">Сначала укажите название события хотя бы на одном языке.</p>;
  }

  return (
    <div className="space-y-3">
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="text-sm text-gray-400">Загрузка...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {KIND_OPTIONS.map(({ value: kind, label, icon }) => {
            const group = items.filter((it) => it.kind === kind).sort((a, b) => a.index - b.index);
            return (
              <div key={kind}>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">{icon} {label}</h4>
                <div className="space-y-2">
                  {group.length === 0 && addKind !== kind && (
                    <p className="text-xs text-gray-400">Пунктов пока нет.</p>
                  )}
                  {group.map((item, i) => (
                    <div key={item.id} className="border border-gray-200 rounded-lg p-2.5">
                      {editingId === item.id ? (
                        <div className="space-y-2">
                          <Select
                            value={editDraft.kind}
                            onChange={(e) => setEditDraft((p) => ({ ...p, kind: e.target.value }))}
                          >
                            {KIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </Select>
                          <LangBlock
                            label="Текст"
                            value={editDraft.text || {}}
                            onChange={(v) => setEditDraft((p) => ({ ...p, text: v }))}
                            activeLang={activeLang}
                          />
                          {saveError && <p className="text-xs text-red-600">{saveError}</p>}
                          <div className="flex gap-2">
                            <button type="button" onClick={saveEdit} disabled={saving}
                              className="px-2.5 py-1 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                              {saving ? '...' : 'Сохранить'}
                            </button>
                            <button type="button" onClick={cancelEdit}
                              className="px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                              Отмена
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-gray-700 min-w-0 truncate">
                            {item.text?.[activeLang] || '(без текста)'}
                          </p>
                          <div className="flex items-center gap-1 shrink-0">
                            <button type="button" onClick={() => move(item, -1, group)} disabled={i === 0}
                              className="w-6 h-6 text-gray-500 hover:text-gray-800 disabled:opacity-30 text-xs" title="Выше">↑</button>
                            <button type="button" onClick={() => move(item, 1, group)} disabled={i === group.length - 1}
                              className="w-6 h-6 text-gray-500 hover:text-gray-800 disabled:opacity-30 text-xs" title="Ниже">↓</button>
                            <button type="button" onClick={() => startEdit(item)}
                              className="px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100">✎</button>
                            <button type="button" onClick={() => setDeleteTarget(item)}
                              className="px-2 py-0.5 text-xs font-medium text-red-700 bg-red-50 rounded hover:bg-red-100">✕</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {addKind === kind ? (
                    <div className="border border-dashed border-blue-300 rounded-lg p-2.5 space-y-2 bg-blue-50/30">
                      <LangBlock
                        label="Текст"
                        value={addDraft?.text || {}}
                        onChange={(v) => setAddDraft((p) => ({ ...p, text: v }))}
                        activeLang={activeLang}
                      />
                      {saveError && <p className="text-xs text-red-600">{saveError}</p>}
                      <div className="flex gap-2">
                        <button type="button" onClick={submitAdd} disabled={saving}
                          className="px-2.5 py-1 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                          {saving ? '...' : 'Добавить'}
                        </button>
                        <button type="button" onClick={() => { setAddKind(null); setAddDraft(null); setSaveError(null); }}
                          className="px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => { setAddKind(kind); setAddDraft(emptyItem(kind)); }}
                      className="px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100">
                      + Добавить
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Удалить пункт?"
        message={`«${deleteTarget?.text?.[activeLang] || 'этот пункт'}» будет удалён без возможности восстановления.`}
        confirmLabel="Удалить"
        danger
      />
    </div>
  );
}
