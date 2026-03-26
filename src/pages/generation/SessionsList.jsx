/**
 * SessionsList — полная миграция Django _section_session_list.html
 *
 * Таблица сессий с колонками: Город, Страна, Дата, Статус, Ответственный, Действия
 * Поиск, мультиселект для массового удаления, создание новой сессии.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import Modal from '../../components/ui/Modal';
import { sessionsAPI } from '../../api/generation';

// ─── Status badge ──────────────────────────────────────────────────────────────
const STATUS_MAP = {
  draft:            { label: 'Черновик',            cls: 'bg-gray-100 text-gray-600' },
  in_progress:      { label: 'В процессе',           cls: 'bg-yellow-100 text-yellow-800' },
  completed:        { label: 'Завершена',             cls: 'bg-green-100 text-green-700' },
  published:        { label: 'Опубликована',          cls: 'bg-blue-100 text-blue-700' },
  closed_saved:     { label: 'Закрыта (сохранена)',   cls: 'bg-purple-100 text-purple-700' },
  closed_discarded: { label: 'Закрыта (отменена)',    cls: 'bg-red-100 text-red-700' },
  corrected:        { label: 'Скорректирована',       cls: 'bg-teal-100 text-teal-700' },
};

function StatusBadge({ status, label }) {
  const s = STATUS_MAP[status] || { label: label || status, cls: 'bg-gray-100 text-gray-500' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${s.cls}`}>
      {label || s.label}
    </span>
  );
}

// ─── Notification toast ────────────────────────────────────────────────────────
function Notification({ note }) {
  if (!note) return null;
  const cls = { success: 'bg-green-600', error: 'bg-red-600', info: 'bg-blue-600' };
  return (
    <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-lg text-white text-sm shadow-lg ${cls[note.type] || cls.info}`}>
      {note.msg}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function SessionsList() {
  const navigate = useNavigate();

  // State
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  // Selection
  const [selected, setSelected] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null); // single session or null
  const [deleting, setDeleting] = useState(false);

  // Close modal (single session)
  const [closeTarget, setCloseTarget] = useState(null);
  const [closeMode, setCloseMode] = useState('save');
  const [closing, setClosing] = useState(false);

  // Notification
  const [note, setNote] = useState(null);
  const showNote = useCallback((msg, type = 'info') => {
    setNote({ msg, type });
    setTimeout(() => setNote(null), 3500);
  }, []);

  // ─── Load sessions ────────────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await sessionsAPI.list();
      const data = res?.data;
      const list = Array.isArray(data?.results) ? data.results
        : Array.isArray(data) ? data : [];
      setSessions(list);
      setSelected(new Set());
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Не удалось загрузить сессии');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // ─── Create session ───────────────────────────────────────────────────────
  const handleCreate = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await sessionsAPI.create({});
      const data = res?.data;
      const sessionId = data?.session?.id || data?.session?.uuid || data?.id;
      if (sessionId) {
        navigate(`/generation/${sessionId}`);
      } else {
        setCreateError('Сессия создана, но не удалось получить ID. Обновите страницу.');
        await loadSessions();
      }
    } catch (err) {
      setCreateError(err?.response?.data?.error || err.message || 'Ошибка создания сессии');
    } finally {
      setCreating(false);
    }
  };

  // ─── Close session ────────────────────────────────────────────────────────
  const handleClose = async () => {
    if (!closeTarget) return;
    setClosing(true);
    try {
      await sessionsAPI.close(closeTarget.id, closeMode);
      setCloseTarget(null);
      showNote('Сессия закрыта', 'success');
      await loadSessions();
    } catch (err) {
      showNote(err?.response?.data?.error || 'Ошибка закрытия сессии', 'error');
    } finally {
      setClosing(false);
    }
  };

  // ─── Delete single session ────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await sessionsAPI.delete(deleteTarget.id);
      setDeleteTarget(null);
      showNote('Сессия удалена', 'success');
      await loadSessions();
    } catch (err) {
      showNote(err?.response?.data?.error || 'Ошибка удаления', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // ─── Bulk delete ──────────────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    if (!selected.size) return;
    if (!confirm(`Удалить ${selected.size} сессий? Действие нельзя отменить.`)) return;
    setBulkDeleting(true);
    let failed = 0;
    for (const id of selected) {
      try { await sessionsAPI.delete(id); } catch { failed++; }
    }
    setBulkDeleting(false);
    if (failed) showNote(`Удалено с ошибками: ${failed} сессий не удалось`, 'error');
    else showNote(`Удалено ${selected.size} сессий`, 'success');
    await loadSessions();
  };

  // ─── Checkbox helpers ─────────────────────────────────────────────────────
  const isActive = (s) => s.status === 'draft' || s.status === 'in_progress';
  const toggleSelect = (id) => setSelected(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(s => s.id)));
  };

  // ─── Search filter ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return sessions;
    const q = search.toLowerCase();
    return sessions.filter(s => (
      (s.city_display_name || '').toLowerCase().includes(q) ||
      (s.name || '').toLowerCase().includes(q) ||
      (s.uuid || '').toLowerCase().includes(q) ||
      (s.city_country || '').toLowerCase().includes(q) ||
      (s.status || '').toLowerCase().includes(q) ||
      (s.status_display || '').toLowerCase().includes(q) ||
      (s.creator_name || '').toLowerCase().includes(q)
    ));
  }, [sessions, search]);

  const allSelected = filtered.length > 0 && selected.size === filtered.length;

  return (
    <Layout>
      <Notification note={note} />

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Сессии генерации</h1>
          <p className="mt-0.5 text-sm text-gray-500">Каждая сессия — один рабочий цикл создания контента</p>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {creating ? (
            <><span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />Создание...</>
          ) : (
            <>+ Новая сессия</>
          )}
        </button>
      </div>

      {/* Create error */}
      {createError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
          <span>{createError}</span>
          <button onClick={() => setCreateError(null)} className="ml-4 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* ── Table card ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1 max-w-md">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Поиск по городу, UUID, стране, статусу..."
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Выбрано: {selected.size}</span>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                >
                  {bulkDeleting ? '...' : (
                    <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>Удалить</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-3 bg-red-50 text-sm text-red-700 border-b border-red-100">
            {error}
            <button onClick={loadSessions} className="ml-3 underline">Повторить</button>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Город</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Страна</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Дата</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Статус</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Ответственный</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
                      <span>Загрузка...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    <div className="text-3xl mb-2">📋</div>
                    <div>{search ? 'По вашему запросу сессий не найдено' : 'Сессий ещё нет'}</div>
                    {!search && (
                      <button onClick={handleCreate} className="mt-3 text-sm text-blue-600 hover:underline">
                        Создать первую сессию
                      </button>
                    )}
                  </td>
                </tr>
              ) : filtered.map(s => (
                <tr
                  key={s.id}
                  onClick={() => navigate(`/generation/${s.id}`)}
                  className="hover:bg-blue-50 cursor-pointer transition-colors group"
                >
                  <td className="w-10 px-3 py-2.5" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(s.id)}
                      onChange={() => toggleSelect(s.id)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-gray-900">
                      {s.city_display_name || s.name || '—'}
                    </div>
                    <div className="text-xs text-gray-400 font-mono mt-0.5">{String(s.uuid || s.id || '').slice(0, 16)}…</div>
                  </td>
                  <td className="px-3 py-2.5 text-gray-600">
                    {s.city_country || '—'}
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                    {s.created_at ? new Date(s.created_at).toLocaleString('ru-RU', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    }) : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={s.status} label={s.status_display} />
                  </td>
                  <td className="px-3 py-2.5 text-gray-600">
                    {s.creator_name || '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link
                        to={`/generation/${s.id}`}
                        className="px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
                      >
                        Открыть
                      </Link>
                      {isActive(s) && (
                        <button
                          onClick={() => { setCloseMode('save'); setCloseTarget(s); }}
                          className="px-2.5 py-1 text-xs font-medium text-orange-600 bg-orange-50 rounded-md hover:bg-orange-100 transition-colors"
                        >
                          Закрыть
                        </button>
                      )}
                      {s.status === 'draft' && (
                        <button
                          onClick={() => setDeleteTarget(s)}
                          className="px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
                        >
                          Удалить
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t border-gray-100 text-xs text-gray-400">
            Показано: {filtered.length} из {sessions.length} сессий
          </div>
        )}
      </div>

      {/* ── Delete confirm modal ──────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => !deleting && setDeleteTarget(null)} />
          <div className="relative bg-white rounded-xl shadow-xl p-6 w-96 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">Удалить сессию?</h3>
            <p className="text-sm text-gray-600">
              Сессия <span className="font-medium">«{deleteTarget.city_display_name || deleteTarget.name || deleteTarget.id}»</span> будет удалена безвозвратно.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                Отмена
              </button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'Удаление...' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Close session modal ───────────────────────────────────────────── */}
      {closeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => !closing && setCloseTarget(null)} />
          <div className="relative bg-white rounded-xl shadow-xl p-6 w-96 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">Закрыть сессию</h3>
            <p className="text-sm text-gray-600">
              Сессия <span className="font-medium">«{closeTarget.city_display_name || closeTarget.name || closeTarget.id}»</span> будет закрыта. Выберите режим:
            </p>
            <div className="space-y-2">
              {[
                { mode: 'save', title: 'Сохранить', desc: 'Данные сессии сохранятся, можно будет опубликовать позже', cls: 'border-blue-500 bg-blue-50' },
                { mode: 'discard', title: 'Отменить', desc: 'Данные сессии будут удалены без сохранения', cls: 'border-red-500 bg-red-50' },
              ].map(opt => (
                <label key={opt.mode} className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${closeMode === opt.mode ? opt.cls : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="closeMode" value={opt.mode} checked={closeMode === opt.mode} onChange={() => setCloseMode(opt.mode)} className="mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{opt.title}</div>
                    <div className="text-xs text-gray-500">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setCloseTarget(null)} disabled={closing} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                Отмена
              </button>
              <button
                onClick={handleClose}
                disabled={closing}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors ${closeMode === 'discard' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {closing ? (
                  <span className="flex items-center gap-1.5">
                    <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                    Закрытие...
                  </span>
                ) : closeMode === 'discard' ? 'Закрыть без сохранения' : 'Закрыть с сохранением'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
