import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, ConfirmModal, EmptyState, Heading, IconButton, Panel, Select } from '@aspectum/ui';
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
    return <p className="text-sm text-aspectum-text-disabled">Сначала укажите название события хотя бы на одном языке.</p>;
  }

  return (
    <div className="space-y-3">
      {error && <Alert tone="error">{error}</Alert>}

      {loading ? (
        <EmptyState icon={null} title="Загрузка..." spacing="sm" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {KIND_OPTIONS.map(({ value: kind, label, icon }) => {
            const group = items.filter((it) => it.kind === kind).sort((a, b) => a.index - b.index);
            return (
              <div key={kind}>
                <Heading level={4} size="xs" tone="strong" className="mb-2">{icon} {label}</Heading>
                <div className="space-y-2">
                  {group.length === 0 && addKind !== kind && (
                    <EmptyState
                      icon={icon}
                      title="Пунктов пока нет"
                      className="py-3"
                    />
                  )}
                  {group.map((item, i) => (
                    <div key={item.id} className="border border-aspectum-border rounded-aspectum-control p-2.5">
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
                          {saveError && <p className="text-xs text-aspectum-danger">{saveError}</p>}
                          <div className="flex gap-2">
                            <Button type="button" variant="primary" size="sm" onClick={saveEdit} disabled={saving}>
                              {saving ? '...' : 'Сохранить'}
                            </Button>
                            <Button type="button" variant="secondary" size="sm" onClick={cancelEdit}>
                              Отмена
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-aspectum-text-strong min-w-0 truncate">
                            {item.text?.[activeLang] || '(без текста)'}
                          </p>
                          <div className="flex items-center gap-1 shrink-0">
                            <IconButton label="Переместить выше" type="button" onClick={() => move(item, -1, group)} disabled={i === 0}
                              className="w-6 h-6 p-0 text-xs">↑</IconButton>
                            <IconButton label="Переместить ниже" type="button" onClick={() => move(item, 1, group)} disabled={i === group.length - 1}
                              className="w-6 h-6 p-0 text-xs">↓</IconButton>
                            <Button type="button" variant="soft" size="sm" onClick={() => startEdit(item)}>✎</Button>
                            <Button type="button" variant="softDanger" size="sm" onClick={() => setDeleteTarget(item)}>✕</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {addKind === kind ? (
                    <Panel tone="info" className="border-dashed p-2.5 space-y-2">
                      <LangBlock
                        label="Текст"
                        value={addDraft?.text || {}}
                        onChange={(v) => setAddDraft((p) => ({ ...p, text: v }))}
                        activeLang={activeLang}
                      />
                      {saveError && <p className="text-xs text-aspectum-danger">{saveError}</p>}
                      <div className="flex gap-2">
                        <Button type="button" variant="primary" size="sm" onClick={submitAdd} disabled={saving}>
                          {saving ? '...' : 'Добавить'}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => { setAddKind(null); setAddDraft(null); setSaveError(null); }}
                        >
                          Отмена
                        </Button>
                      </div>
                    </Panel>
                  ) : (
                    <Button
                      type="button"
                      variant="soft"
                      size="sm"
                      onClick={() => { setAddKind(kind); setAddDraft(emptyItem(kind)); }}
                    >
                      + Добавить
                    </Button>
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
