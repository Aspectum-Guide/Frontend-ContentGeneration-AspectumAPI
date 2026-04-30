/**
 * SessionsList — grouped admin table for generation sessions.
 *
 * Each session is rendered as a compact group header, and each city draft is a
 * real table row inside that session.
 */
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionsAPI } from '../../api/generation';
import Layout from '../../components/Layout';
import { useLayoutActions } from '../../context/useLayoutActions';
import { trackEvent } from '../../utils/analytics';
import { parseApiError } from '../../utils/apiError';

const STATUS_MAP = {
  draft: { label: 'Черновик', cls: 'bg-gray-100 text-gray-600' },
  in_progress: { label: 'В процессе', cls: 'bg-yellow-100 text-yellow-800' },
  completed: { label: 'Завершена', cls: 'bg-green-100 text-green-700' },
  published: { label: 'Опубликована', cls: 'bg-blue-100 text-blue-700' },
  closed_saved: { label: 'Закрыта (сохранена)', cls: 'bg-purple-100 text-purple-700' },
  closed_discarded: { label: 'Закрыта (отменена)', cls: 'bg-red-100 text-red-700' },
  corrected: { label: 'Скорректирована', cls: 'bg-teal-100 text-teal-700' },
};

function StatusBadge({ status, label }) {
  const s = STATUS_MAP[status] || { label: label || status, cls: 'bg-gray-100 text-gray-500' };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${s.cls}`}>
      {label || s.label}
    </span>
  );
}

function Notification({ note }) {
  if (!note) return null;

  const cls = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600',
  };

  return (
    <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-lg text-white text-sm shadow-lg ${cls[note.type] || cls.info}`}>
      {note.msg}
    </div>
  );
}

function formatDateTime(value) {
  if (!value) return '—';

  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getFirstText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return '';

  return (
    value.ru ||
    value.en ||
    value.it ||
    Object.values(value).find((item) => typeof item === 'string' && item.trim()) ||
    ''
  );
}

function getAssigneeName(source) {
  if (!source) return '';

  return (
    source.assignee_name ||
    source.assigned_to_name ||
    source.owner_name ||
    source.responsible_name ||
    source.user_name ||
    source.creator_name ||
    source.created_by_name ||
    source.assignee?.full_name ||
    source.assignee?.name ||
    source.assigned_to?.full_name ||
    source.assigned_to?.name ||
    ''
  );
}

function getDraftName(draft, session) {
  return (
    draft?.display_name ||
    draft?.city_display_name ||
    draft?.title ||
    getFirstText(draft?.name) ||
    session?.city_display_name ||
    session?.name ||
    '—'
  );
}

function getDraftCountry(draft, session) {
  return (
    draft?.display_country ||
    draft?.city_country ||
    getFirstText(draft?.country) ||
    session?.city_country ||
    '—'
  );
}

function summarizeCities(cityRows) {
  const names = cityRows
    .map((row) => row.cityName)
    .filter(Boolean);

  if (names.length <= 3) return names.join(', ');
  return `${names.slice(0, 3).join(', ')} +${names.length - 3}`;
}

function buildCityRows(session) {
  const drafts = Array.isArray(session.city_drafts) && session.city_drafts.length > 0
    ? [...session.city_drafts].sort((a, b) => (a.order ?? a.upload_batch_order ?? 0) - (b.order ?? b.upload_batch_order ?? 0))
    : [{
      id: 'legacy',
      uuid: session.city_uuid || null,
      display_name: session.city_display_name || session.name || '—',
      display_country: session.city_country || null,
      status: session.status,
      status_display: session.status_display,
      created_at: session.created_at,
    }];

  return drafts.map((draft, index) => ({
    rowKey: `${session.id}:${draft.id || draft.uuid || index}`,
    cityDraftId: draft.id || draft.uuid || 'legacy',
    cityDraftUuid: draft.uuid || '',
    cityName: getDraftName(draft, session),
    country: getDraftCountry(draft, session),
    createdAt: draft.created_at || draft.updated_at || session.created_at,
    status: draft.status || session.status,
    statusDisplay: draft.status_display || session.status_display,
    assignee: getAssigneeName(draft) || getAssigneeName(session),
  }));
}

function buildSearchBlob(parts) {
  return parts
    .flatMap((part) => {
      if (Array.isArray(part)) return part;
      return [part];
    })
    .map((part) => {
      if (typeof part === 'string') return part;
      if (part == null) return '';
      return String(part);
    })
    .join(' ')
    .toLowerCase();
}

function buildSessionSelectionKey(sessionId) {
  return `session:${sessionId}`;
}

function buildDraftSelectionKey(sessionId, cityDraftId) {
  return `draft:${sessionId}:${cityDraftId}`;
}

function parseSelectionKey(key) {
  if (typeof key !== 'string') return null;

  if (key.startsWith('session:')) {
    return {
      type: 'session',
      sessionId: key.slice('session:'.length),
    };
  }

  if (key.startsWith('draft:')) {
    const [, sessionId, ...draftParts] = key.split(':');

    return {
      type: 'draft',
      sessionId,
      cityDraftId: draftParts.join(':'),
    };
  }

  return null;
}

function buildRowDeleteTarget(group, row) {
  const shouldDeleteOnlyDraft =
    group.totalRowsCount > 1 &&
    row.cityDraftId &&
    row.cityDraftId !== 'legacy';

  return {
    type: shouldDeleteOnlyDraft ? 'draft' : 'session',
    session: group.session,
    cityRow: row,
    totalRowsCount: group.totalRowsCount,
  };
}

function getGroupDraftSelectionKeys(group) {
  return group.allCityRows.map((row) => (
    buildDraftSelectionKey(group.session.id, row.cityDraftId)
  ));
}

function isGroupFullySelected(group, selectedSet) {
  const sessionKey = buildSessionSelectionKey(group.session.id);
  const draftKeys = getGroupDraftSelectionKeys(group);

  return (
    selectedSet.has(sessionKey) &&
    draftKeys.length > 0 &&
    draftKeys.every((key) => selectedSet.has(key))
  );
}

export default function SessionsList() {
  const { setMobileActions } = useLayoutActions();
  const navigate = useNavigate();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  const [selected, setSelected] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [closeTarget, setCloseTarget] = useState(null);
  const [closeMode, setCloseMode] = useState('save');
  const [closing, setClosing] = useState(false);

  const [note, setNote] = useState(null);

  const showNote = useCallback((msg, type = 'info') => {
    setNote({ msg, type });
    setTimeout(() => setNote(null), 3500);
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await sessionsAPI.list();
      const data = res?.data;

      const list = Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data)
          ? data
          : [];

      setSessions(list);
      setSelected(new Set());
    } catch (err) {
      setError(parseApiError(err, 'Не удалось загрузить сессии'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleCreate = useCallback(async () => {
    trackEvent('create_session_requested', { source: 'sessions_list' });

    setCreating(true);
    setCreateError(null);

    try {
      const res = await sessionsAPI.create({});
      const data = res?.data;
      const sessionId = data?.session?.id || data?.session?.uuid || data?.id;

      if (sessionId) {
        trackEvent('create_session_success', {
          source: 'sessions_list',
          sessionId: String(sessionId),
        });

        navigate(`/generation/${sessionId}`);
      } else {
        setCreateError('Сессия создана, но не удалось получить ID. Обновите страницу.');
        await loadSessions();
      }
    } catch (err) {
      trackEvent('create_session_fail', {
        source: 'sessions_list',
        reason: parseApiError(err, 'Ошибка создания'),
      });

      setCreateError(parseApiError(err, 'Ошибка создания сессии'));
    } finally {
      setCreating(false);
    }
  }, [navigate, loadSessions]);

  const openSession = useCallback((session, cityRow, source = 'row') => {
    if (!session?.id) return;

    const cityDraftId = cityRow?.cityDraftId ? String(cityRow.cityDraftId) : null;

    trackEvent('open_session', {
      sessionId: String(session.id),
      status: session.status || 'unknown',
      source,
      cityDraftId,
    });

    navigate(
      {
        pathname: `/generation/${session.id}`,
        search: cityDraftId ? `?cityDraftId=${encodeURIComponent(cityDraftId)}` : '',
      },
      {
        state: cityDraftId ? { cityDraftId } : null,
      }
    );
  }, [navigate]);

  const handleClose = async () => {
    if (!closeTarget) return;

    setClosing(true);

    try {
      await sessionsAPI.close(closeTarget.id, closeMode);
      setCloseTarget(null);
      showNote('Сессия закрыта', 'success');
      await loadSessions();
    } catch (err) {
      showNote(parseApiError(err, 'Ошибка закрытия сессии'), 'error');
    } finally {
      setClosing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    const session = deleteTarget.session;
    const row = deleteTarget.cityRow;
    const isDraftDelete = deleteTarget.type === 'draft';

    if (!session?.id) return;

    setDeleting(true);

    try {
      if (isDraftDelete) {
        await sessionsAPI.deleteCityDraft(session.id, row.cityDraftId);
        showNote('Город удалён из сессии', 'success');
      } else {
        await sessionsAPI.delete(session.id);
        showNote('Сессия удалена', 'success');
      }

      setDeleteTarget(null);
      await loadSessions();
    } catch (err) {
      showNote(
        parseApiError(
          err,
          isDraftDelete ? 'Ошибка удаления города' : 'Ошибка удаления сессии'
        ),
        'error'
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!selected.size) return;

    const sessionsToDelete = new Set();
    const draftsToDelete = [];

    selected.forEach((key) => {
      const parsed = parseSelectionKey(key);
      if (!parsed) return;

      if (parsed.type === 'session') {
        sessionsToDelete.add(parsed.sessionId);
        return;
      }

      const session = sessions.find((item) => String(item.id) === parsed.sessionId);
      if (!session) return;

      const cityRows = buildCityRows(session);

      if (cityRows.length === 1) {
        sessionsToDelete.add(parsed.sessionId);
        return;
      }

      draftsToDelete.push({
        sessionId: parsed.sessionId,
        cityDraftId: parsed.cityDraftId,
      });
    });

    const uniqueDrafts = draftsToDelete.filter((item, index, arr) => (
      !sessionsToDelete.has(item.sessionId) &&
      arr.findIndex((candidate) => (
        candidate.sessionId === item.sessionId &&
        candidate.cityDraftId === item.cityDraftId
      )) === index
    ));

    const sessionsCount = sessionsToDelete.size;
    const draftsCount = uniqueDrafts.length;
    const totalCount = sessionsCount + draftsCount;

    if (!totalCount) return;

    const confirmLabel = [
      sessionsCount ? `${sessionsCount} ${sessionsCount === 1 ? 'сессию' : sessionsCount < 5 ? 'сессии' : 'сессий'}` : null,
      draftsCount ? `${draftsCount} ${draftsCount === 1 ? 'город' : draftsCount < 5 ? 'города' : 'городов'}` : null,
    ].filter(Boolean).join(' и ');

    if (!confirm(`Удалить ${confirmLabel}? Действие нельзя отменить.`)) return;

    setBulkDeleting(true);

    let failed = 0;

    for (const sessionId of sessionsToDelete) {
      try {
        await sessionsAPI.delete(sessionId);
      } catch {
        failed += 1;
      }
    }

    for (const item of uniqueDrafts) {
      if (sessionsToDelete.has(item.sessionId)) continue;

      try {
        await sessionsAPI.deleteCityDraft(item.sessionId, item.cityDraftId);
      } catch {
        failed += 1;
      }
    }

    setBulkDeleting(false);

    if (failed) {
      showNote(`Удалено с ошибками: ${failed} элементов не удалось`, 'error');
    } else {
      showNote(`Удалено ${totalCount} элементов`, 'success');
    }

    await loadSessions();
  };

  const isActive = (session) => session.status === 'draft' || session.status === 'in_progress';

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();

    return sessions
      .map((session) => {
        const allCityRows = buildCityRows(session);
        const sessionAssignee = getAssigneeName(session);

        const sessionSearchBlob = buildSearchBlob([
          session.name,
          session.uuid,
          session.id,
          session.status,
          session.status_display,
          sessionAssignee,
        ]);

        let visibleCityRows = allCityRows;

        if (q) {
          const sessionMatches = sessionSearchBlob.includes(q);

          visibleCityRows = sessionMatches
            ? allCityRows
            : allCityRows.filter((row) => buildSearchBlob([
              row.cityName,
              row.country,
              row.cityDraftId,
              row.cityDraftUuid,
              session.uuid,
              session.id,
              row.status,
              row.statusDisplay,
              row.assignee,
            ]).includes(q));
        }

        if (!visibleCityRows.length) return null;

        return {
          session,
          allCityRows,
          cityRows: visibleCityRows,
          citySummary: summarizeCities(visibleCityRows),
          matchedRowsCount: visibleCityRows.length,
          totalRowsCount: allCityRows.length,
        };
      })
      .filter(Boolean);
  }, [sessions, search]);

  const visibleRowCount = useMemo(
    () => filteredGroups.reduce((sum, group) => sum + group.cityRows.length, 0),
    [filteredGroups]
  );

  const allSelected =
    filteredGroups.length > 0 &&
    filteredGroups.every((group) => isGroupFullySelected(group, selected));

  const selectedDisplayCount = useMemo(() => {
    const selectedSessionIds = new Set();
    const selectedDrafts = [];

    selected.forEach((key) => {
      const parsed = parseSelectionKey(key);
      if (!parsed) return;

      if (parsed.type === 'session') {
        selectedSessionIds.add(parsed.sessionId);
      }

      if (parsed.type === 'draft') {
        selectedDrafts.push(parsed);
      }
    });

    const draftCount = selectedDrafts.filter((draft) => (
      !selectedSessionIds.has(draft.sessionId)
    )).length;

    return selectedSessionIds.size + draftCount;
  }, [selected]);

  const toggleSelect = (group) => {
    const sessionKey = buildSessionSelectionKey(group.session.id);
    const draftKeys = getGroupDraftSelectionKeys(group);

    setSelected((prev) => {
      const next = new Set(prev);
      const shouldUnselect = isGroupFullySelected(group, next);

      if (shouldUnselect) {
        next.delete(sessionKey);
        draftKeys.forEach((key) => next.delete(key));
      } else {
        next.add(sessionKey);
        draftKeys.forEach((key) => next.add(key));
      }

      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);

      filteredGroups.forEach((group) => {
        const sessionKey = buildSessionSelectionKey(group.session.id);
        const draftKeys = getGroupDraftSelectionKeys(group);

        if (allSelected) {
          next.delete(sessionKey);
          draftKeys.forEach((key) => next.delete(key));
        } else {
          next.add(sessionKey);
          draftKeys.forEach((key) => next.add(key));
        }
      });

      return next;
    });
  };

  const toggleDraftDelete = useCallback((group, row) => {
    const sessionKey = buildSessionSelectionKey(group.session.id);
    const draftKey = buildDraftSelectionKey(group.session.id, row.cityDraftId);
    const allDraftKeys = getGroupDraftSelectionKeys(group);

    setSelected((prev) => {
      const next = new Set(prev);

      if (next.has(draftKey)) {
        next.delete(draftKey);
      } else {
        next.add(draftKey);
      }

      const allDraftsSelected =
        allDraftKeys.length > 0 &&
        allDraftKeys.every((key) => next.has(key));

      if (allDraftsSelected) {
        next.add(sessionKey);
      } else {
        next.delete(sessionKey);
      }

      return next;
    });
  }, []);

  useEffect(() => {
    setMobileActions([
      {
        id: 'create-session',
        label: creating ? 'Создание...' : 'Создать сессию',
        onClick: () => {
          if (!creating) handleCreate();
        },
        disabled: creating,
        variant: 'primary',
      },
      {
        id: 'refresh-sessions',
        label: 'Обновить список',
        onClick: () => loadSessions(),
      },
    ]);

    return () => setMobileActions([]);
  }, [setMobileActions, creating, loadSessions, handleCreate]);

  const isDeleteDraftTarget = deleteTarget?.type === 'draft';
  const deleteTargetSession = deleteTarget?.session;
  const deleteTargetCityRow = deleteTarget?.cityRow;

  return (
    <Layout
      pageHeader={{
        title: 'Сессии генерации',
        description: 'Каждая строка — отдельный рабочий город внутри сессии',
        actions: [
          {
            id: 'create-session-header',
            label: creating ? 'Создание...' : '+ Новая сессия',
            onClick: () => {
              if (!creating) handleCreate();
            },
            disabled: creating,
            variant: 'primary',
          },
        ],
      }}
      pageHeaderMode="desktop"
    >
      <Notification note={note} />

      {(creating || bulkDeleting || deleting || closing) && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 flex items-center gap-2">
          <span className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
          <span>
            {creating && 'Создаем новую сессию...'}
            {bulkDeleting && 'Удаляем выбранные элементы...'}
            {deleting && (deleteTarget?.type === 'draft' ? 'Удаляем город...' : 'Удаляем сессию...')}
            {closing && 'Закрываем сессию...'}
          </span>
        </div>
      )}

      {createError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
          <span>{createError}</span>
          <button
            onClick={() => setCreateError(null)}
            className="ml-4 text-red-400 hover:text-red-600"
          >
            ✕
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1 max-w-lg">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>

              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по городу, стране, UUID, статусу или ответственному..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!loading && filteredGroups.length > 0 && (
              <div className="hidden sm:block text-xs text-gray-500">
                {visibleRowCount} городов в {filteredGroups.length} сессиях
              </div>
            )}

            {selectedDisplayCount > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Выбрано: {selectedDisplayCount}</span>

                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                >
                  {bulkDeleting ? '...' : 'Удалить'}
                </button>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="px-4 py-3 bg-red-50 text-sm text-red-700 border-b border-red-100">
            {error}
            <button onClick={loadSessions} className="ml-3 underline">
              Повторить
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
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

                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Город
                </th>

                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Страна
                </th>

                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Дата
                </th>

                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Статус
                </th>

                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Ответственный
                </th>

                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Действия
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
                      <span>Загрузка...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredGroups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    <div className="text-3xl mb-2">📋</div>
                    <div>{search ? 'По вашему запросу города не найдены' : 'Сессий ещё нет'}</div>

                    {!search && (
                      <button
                        onClick={handleCreate}
                        className="mt-3 text-sm text-blue-600 hover:underline"
                      >
                        Создать первую сессию
                      </button>
                    )}
                  </td>
                </tr>
              ) : filteredGroups.map((group) => (
                <Fragment key={group.session.id}>
                  <tr className="bg-slate-50 border-y border-slate-200">
                    <td colSpan={7} className="px-3 py-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="pt-0.5">
                            <input
                              type="checkbox"
                              checked={isGroupFullySelected(group, selected)}
                              onChange={() => toggleSelect(group)}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                              <span className="font-semibold text-slate-900">
                                {group.session.name || 'Сессия без названия'}
                              </span>
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                              {group.matchedRowsCount !== group.totalRowsCount && (
                                <span>
                                  Показано {group.matchedRowsCount} из {group.totalRowsCount} городов
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-xs text-slate-500">
                          {group.totalRowsCount}{' '}
                          {group.totalRowsCount === 1 ? 'город' : group.totalRowsCount < 5 ? 'города' : 'городов'}
                        </div>
                      </div>
                    </td>
                  </tr>

                  {group.cityRows.map((row) => {
                    const rowDeleteTarget = buildRowDeleteTarget(group, row);
                    const deletesOnlyDraft = rowDeleteTarget.type === 'draft';

                    return (
                      <tr
                        key={row.rowKey}
                        onClick={() => openSession(group.session, row, 'row')}
                        className="cursor-pointer bg-white hover:bg-blue-50 transition-colors group"
                      >
                        <td className="w-10 px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selected.has(buildDraftSelectionKey(group.session.id, row.cityDraftId))}
                            onChange={() => toggleDraftDelete(group, row)}
                            title={deletesOnlyDraft ? 'Удалить город из сессии' : 'Удалить сессию'}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>

                        <td className="px-3 py-3">
                          <div className="font-medium text-gray-900">{row.cityName}</div>
                        </td>

                        <td className="px-3 py-3 text-gray-600">
                          {row.country}
                        </td>

                        <td className="px-3 py-3 text-gray-600 whitespace-nowrap">
                          {formatDateTime(row.createdAt)}
                        </td>

                        <td className="px-3 py-3">
                          <StatusBadge status={row.status} label={row.statusDisplay} />
                        </td>

                        <td className="px-3 py-3 text-gray-600">
                          {row.assignee || '—'}
                        </td>

                        <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => openSession(group.session, row, 'action')}
                              className="px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
                            >
                              Открыть
                            </button>

                            {isActive(group.session) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCloseMode('save');
                                  setCloseTarget(group.session);
                                }}
                                className="px-2.5 py-1 text-xs font-medium text-orange-600 bg-orange-50 rounded-md hover:bg-orange-100 transition-colors"
                              >
                                Закрыть
                              </button>
                            )}

                            {group.session.status === 'draft' && (
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(rowDeleteTarget)}
                                title={deletesOnlyDraft ? 'Удалить только этот город' : 'Удалить всю сессию'}
                                className="px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
                              >
                                Удалить
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && filteredGroups.length > 0 && (
          <div className="px-4 py-2.5 border-t border-gray-100 text-xs text-gray-400">
            Показано: {visibleRowCount} городов в {filteredGroups.length} сессиях из {sessions.length} сессий
          </div>
        )}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !deleting && setDeleteTarget(null)}
          />

          <div className="relative bg-white rounded-xl shadow-xl p-6 w-96 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">
              {isDeleteDraftTarget ? 'Удалить город?' : 'Удалить сессию?'}
            </h3>

            {isDeleteDraftTarget ? (
              <p className="text-sm text-gray-600">
                Город{' '}
                <span className="font-medium">
                  «{deleteTargetCityRow?.cityName || deleteTargetCityRow?.cityDraftId || 'Без названия'}»
                </span>{' '}
                будет удалён из сессии{' '}
                <span className="font-medium">
                  «{deleteTargetSession?.name || deleteTargetSession?.uuid || deleteTargetSession?.id}»
                </span>.
                <br />
                Сама сессия останется.
              </p>
            ) : (
              <p className="text-sm text-gray-600">
                Сессия{' '}
                <span className="font-medium">
                  «{deleteTargetSession?.name || deleteTargetSession?.uuid || deleteTargetSession?.id}»
                </span>{' '}
                будет удалена безвозвратно.
              </p>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Отмена
              </button>

              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Удаление...' : isDeleteDraftTarget ? 'Удалить город' : 'Удалить сессию'}
              </button>
            </div>
          </div>
        </div>
      )}

      {closeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !closing && setCloseTarget(null)}
          />

          <div className="relative bg-white rounded-xl shadow-xl p-6 w-96 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">
              Закрыть сессию
            </h3>

            <p className="text-sm text-gray-600">
              Сессия{' '}
              <span className="font-medium">
                «{closeTarget.name || closeTarget.uuid || closeTarget.id}»
              </span>{' '}
              будет закрыта. Выберите режим:
            </p>

            <div className="space-y-2">
              {[
                {
                  mode: 'save',
                  title: 'Сохранить',
                  desc: 'Данные сессии сохранятся, можно будет опубликовать позже',
                  cls: 'border-blue-500 bg-blue-50',
                },
                {
                  mode: 'discard',
                  title: 'Отменить',
                  desc: 'Данные сессии будут удалены без сохранения',
                  cls: 'border-red-500 bg-red-50',
                },
              ].map((opt) => (
                <label
                  key={opt.mode}
                  className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${closeMode === opt.mode ? opt.cls : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <input
                    type="radio"
                    name="closeMode"
                    value={opt.mode}
                    checked={closeMode === opt.mode}
                    onChange={() => setCloseMode(opt.mode)}
                    className="mt-0.5"
                  />

                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {opt.title}
                    </div>

                    <div className="text-xs text-gray-500">
                      {opt.desc}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setCloseTarget(null)}
                disabled={closing}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Отмена
              </button>

              <button
                onClick={handleClose}
                disabled={closing}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors ${closeMode === 'discard' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
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