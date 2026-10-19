/**
 * SessionsList — grouped admin table for generation sessions.
 *
 * Each session is rendered as a compact group header with its single city row.
 */
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { sessionsAPI } from '../../api/generation';
import Layout from '../../components/Layout';
import { Alert, AsyncErrorState, Button, Checkbox, DataTableSurface, IconButton, Panel, Spinner, TextInput, ConfirmModal as DefaultConfirmModal, InlineProgressBanner as DefaultInlineProgressBanner, SessionStatusBadge as DefaultStatusBadge, Toast as DefaultToast, useConfirmModal, useToast } from '@aspectum/ui';
import DefaultSessionDeleteDialog from '../../components/generation/SessionDeleteDialog.jsx';
import DefaultSessionCloseDialog from '../../components/generation/SessionCloseDialog.jsx';
import { useLayoutActions } from '../../context/useLayoutActions';
import { trackEvent } from '../../utils/analytics';
import { parseApiError } from '../../utils/apiError';

const EMPTY_SESSIONS = [];

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

function sessionHasCityDraftRows(session) {
  return Array.isArray(session?.city_drafts) && session.city_drafts.length > 0;
}

/**
 * Имя черновика только из полей этого SessionCityDraft.
 * Не подставлять session.city_display_name / первый черновик — иначе пустой черновик B показывает данные A.
 */
function getDraftName(draft, session) {
  const fromDraft = (
    draft?.display_name ||
    draft?.city_display_name ||
    draft?.title ||
    getFirstText(draft?.name) ||
    ''
  ).trim();

  if (fromDraft) return fromDraft;

  const hasDrafts = sessionHasCityDraftRows(session);
  const isLegacyRow = draft?.id === 'legacy';

  if (!hasDrafts || isLegacyRow) {
    return session?.city_display_name || session?.name || 'без названия';
  }

  return 'без названия';
}

function getDraftCountry(draft, session) {
  const fromDraft = (
    draft?.display_country ||
    draft?.city_country ||
    getFirstText(draft?.country) ||
    ''
  ).trim();

  if (fromDraft) return fromDraft;

  const hasDrafts = sessionHasCityDraftRows(session);
  const isLegacyRow = draft?.id === 'legacy';

  if (!hasDrafts || isLegacyRow) {
    return session?.city_country || '—';
  }

  return '—';
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

function pruneSelectionToSessions(selection, sessionsList) {
  if (!selection?.size) return selection;

  const validKeys = new Set();
  sessionsList.forEach((session) => {
    const group = { session, allCityRows: buildCityRows(session) };
    validKeys.add(buildSessionSelectionKey(session.id));
    getGroupDraftSelectionKeys(group).forEach((key) => validKeys.add(key));
  });

  const next = new Set();
  let changed = false;

  selection.forEach((key) => {
    if (validKeys.has(key)) {
      next.add(key);
    } else {
      changed = true;
    }
  });

  return changed ? next : selection;
}

function removeDeletedItemsFromSelection(selection, { sessionId, cityDraftId, type }) {
  if (!selection?.size) return selection;

  const next = new Set(selection);
  const normalizedSessionId = String(sessionId);

  if (type === 'draft' && cityDraftId) {
    next.delete(buildDraftSelectionKey(normalizedSessionId, cityDraftId));
    next.delete(buildSessionSelectionKey(normalizedSessionId));
    return next;
  }

  selection.forEach((key) => {
    const parsed = parseSelectionKey(key);
    if (parsed?.sessionId === normalizedSessionId) {
      next.delete(key);
    }
  });

  return next;
}

export default function SessionsList({ components = {} } = {}) {
  const StatusBadge = components.StatusBadge ?? DefaultStatusBadge;
  const ToastComp = components.Toast ?? DefaultToast;
  const ConfirmModalComp = components.ConfirmModal ?? DefaultConfirmModal;
  const ProgressBanner = components.ProgressBanner ?? DefaultInlineProgressBanner;
  const dialogs = components.dialogs || {};
  const SessionDeleteDialogComp =
    components.SessionDeleteDialog ?? dialogs.SessionDeleteDialog ?? DefaultSessionDeleteDialog;
  const SessionCloseDialogComp =
    components.SessionCloseDialog ?? dialogs.SessionCloseDialog ?? DefaultSessionCloseDialog;
  const { confirm, confirmModal } = useConfirmModal(ConfirmModalComp);
  const { note, showNote } = useToast();
  const { setMobileActions } = useLayoutActions();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    data: sessionsData,
    isLoading: loading,
    error: sessionsError,
    refetch: refetchSessions,
  } = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const res = await sessionsAPI.list();
      const data = res?.data;
      return Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
    },
  });

  const sessions = sessionsData ?? EMPTY_SESSIONS;
  const error = sessionsError ? parseApiError(sessionsError, 'Не удалось загрузить сессии') : null;

  const invalidateSessions = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
    [queryClient],
  );

  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  const [selected, setSelected] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    setSelected((prev) => pruneSelectionToSessions(prev, sessions));
  }, [sessions]);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [closeTarget, setCloseTarget] = useState(null);
  const [closeMode, setCloseMode] = useState('save');
  const [closing, setClosing] = useState(false);

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
        await invalidateSessions();
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
  }, [navigate, invalidateSessions]);

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
      await invalidateSessions();
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
      setSelected((prev) => removeDeletedItemsFromSelection(prev, {
        sessionId: session.id,
        cityDraftId: row?.cityDraftId,
        type: isDraftDelete ? 'draft' : 'session',
      }));
      await invalidateSessions();
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

    if (!(await confirm({
      title: 'Удаление',
      message: `Удалить ${confirmLabel}? Действие нельзя отменить.`,
      danger: true,
      confirmLabel: 'Удалить',
    }))) return;

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
    setSelected(new Set());

    if (failed) {
      showNote(`Удалено с ошибками: ${failed} элементов не удалось`, 'error');
    } else {
      showNote(`Удалено ${totalCount} элементов`, 'success');
    }

    await invalidateSessions();
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
        onClick: () => refetchSessions(),
      },
    ]);

    return () => setMobileActions([]);
  }, [setMobileActions, creating, refetchSessions, handleCreate]);

  const isDeleteDraftTarget = deleteTarget?.type === 'draft';
  const deleteTargetSession = deleteTarget?.session;
  const deleteTargetCityRow = deleteTarget?.cityRow;

  return (
    <Layout
      pageHeader={{
        title: 'Сессии генерации',
        description: 'Одна сессия — один рабочий город',
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
      {confirmModal}
      <ToastComp note={note} />

      <ProgressBanner
        show={creating || bulkDeleting || deleting || closing}
        message={[
          creating && 'Создаем новую сессию...',
          bulkDeleting && 'Удаляем выбранные элементы...',
          deleting && (deleteTarget?.type === 'draft' ? 'Удаляем город...' : 'Удаляем сессию...'),
          closing && 'Закрываем сессию...',
        ]
          .filter(Boolean)
          .join(' ')}
      />

      {createError && (
        <Alert tone="error" className="mb-4 flex items-center justify-between">
          <span>{createError}</span>
          <IconButton
            label="Закрыть ошибку"
            onClick={() => setCreateError(null)}
            variant="ghostDanger"
            className="ml-4"
          >
            ✕
          </IconButton>
        </Alert>
      )}

      <Panel className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-aspectum-border-subtle">
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1 max-w-lg">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-aspectum-text-disabled"
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

              <TextInput className="pl-9 pr-3" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по городу, стране, UUID, статусу или ответственному..." />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!loading && filteredGroups.length > 0 && (
              <div className="hidden sm:block text-xs text-aspectum-text-muted">
                {filteredGroups.length} сессий
              </div>
            )}

            {selectedDisplayCount > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-aspectum-text-muted">Выбрано: {selectedDisplayCount}</span>

                <Button type="button" variant="softDanger" size="sm" onClick={handleBulkDelete} disabled={bulkDeleting}>
                  {bulkDeleting ? '...' : 'Удалить'}
                </Button>
              </div>
            )}
          </div>
        </div>

        <AsyncErrorState error={error} onRetry={refetchSessions} className="mb-3" />

        <DataTableSurface className="rounded-aspectum-card">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="bg-aspectum-surface-muted border-b border-aspectum-border-subtle">
                <th className="w-10 px-3 py-2.5">
                  <Checkbox
                    checked={allSelected}
                    onChange={toggleAll}
                  />
                </th>

                <th className="px-3 py-2.5 text-left text-xs font-semibold text-aspectum-text-muted uppercase tracking-wide">
                  Город
                </th>

                <th className="px-3 py-2.5 text-left text-xs font-semibold text-aspectum-text-muted uppercase tracking-wide">
                  Страна
                </th>

                <th className="px-3 py-2.5 text-left text-xs font-semibold text-aspectum-text-muted uppercase tracking-wide">
                  Дата
                </th>

                <th className="px-3 py-2.5 text-left text-xs font-semibold text-aspectum-text-muted uppercase tracking-wide">
                  Статус
                </th>

                <th className="px-3 py-2.5 text-left text-xs font-semibold text-aspectum-text-muted uppercase tracking-wide">
                  Ответственный
                </th>

                <th className="px-3 py-2.5 text-right text-xs font-semibold text-aspectum-text-muted uppercase tracking-wide">
                  Действия
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-aspectum-border-subtle">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-aspectum-text-disabled">
                    <div className="flex items-center justify-center gap-2">
                      <Spinner size="md" className="border-aspectum-focus" />
                      <span>Загрузка...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredGroups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-aspectum-text-disabled">
                    <div className="text-3xl mb-2">📋</div>
                    <div>{search ? 'По вашему запросу города не найдены' : 'Сессий ещё нет'}</div>

                    {!search && (
                      <Button type="button" variant="link" size="md" onClick={handleCreate} className="mt-3">
                        Создать первую сессию
                      </Button>
                    )}
                  </td>
                </tr>
              ) : filteredGroups.map((group) => (
                <Fragment key={group.session.id}>
                  <tr className="bg-aspectum-ink-soft border-y border-aspectum-ink-border">
                    <td colSpan={7} className="px-3 py-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="pt-0.5">
                            <Checkbox
                              checked={isGroupFullySelected(group, selected)}
                              onChange={() => toggleSelect(group)}
                              className="w-4 h-4 rounded border-aspectum-border-strong text-aspectum-primary focus:ring-aspectum-focus"
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                              <span className="font-semibold text-aspectum-ink">
                                {group.session.name || 'Сессия без названия'}
                              </span>
                            </div>

                          </div>
                        </div>

                        <div className="text-xs text-aspectum-ink-muted">
                          Один город
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
                        className="cursor-pointer bg-aspectum-surface hover:bg-aspectum-primary-soft transition-colors group"
                      >
                        <td className="w-10 px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selected.has(buildDraftSelectionKey(group.session.id, row.cityDraftId))}
                            onChange={() => toggleDraftDelete(group, row)}
                            title={deletesOnlyDraft ? 'Удалить город из сессии' : 'Удалить сессию'}
                            className="w-4 h-4 rounded border-aspectum-border-strong text-aspectum-primary focus:ring-aspectum-focus"
                          />
                        </td>

                        <td className="px-3 py-3">
                          <div className="font-medium text-aspectum-text">{row.cityName}</div>
                        </td>

                        <td className="px-3 py-3 text-aspectum-text-subtle">
                          {row.country}
                        </td>

                        <td className="px-3 py-3 text-aspectum-text-subtle whitespace-nowrap">
                          {formatDateTime(row.createdAt)}
                        </td>

                        <td className="px-3 py-3">
                          <StatusBadge status={row.status} label={row.statusDisplay} />
                        </td>

                        <td className="px-3 py-3 text-aspectum-text-subtle">
                          {row.assignee || '—'}
                        </td>

                        <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <Button
                              type="button"
                              variant="soft"
                              size="sm"
                              onClick={() => openSession(group.session, row, 'action')}
                            >
                              Открыть
                            </Button>

                            {isActive(group.session) && (
                              <Button
                                type="button"
                                variant="softOrange"
                                size="sm"
                                onClick={() => {
                                  setCloseMode('save');
                                  setCloseTarget(group.session);
                                }}
                              >
                                Закрыть
                              </Button>
                            )}

                            {group.session.status === 'draft' && (
                              <Button
                                type="button"
                                variant="softDanger"
                                size="sm"
                                onClick={() => setDeleteTarget(rowDeleteTarget)}
                                title={deletesOnlyDraft ? 'Удалить только этот город' : 'Удалить всю сессию'}
                              >
                                Удалить
                              </Button>
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
        </DataTableSurface>

        {!loading && filteredGroups.length > 0 && (
          <div className="px-4 py-2.5 border-t border-aspectum-border-subtle text-xs text-aspectum-text-disabled">
            Показано сессий: {filteredGroups.length} из {sessions.length}
          </div>
        )}
      </Panel>

      <SessionDeleteDialogComp
        open={!!deleteTarget}
        isDraftDelete={isDeleteDraftTarget}
        cityRow={deleteTargetCityRow}
        session={deleteTargetSession}
        deleting={deleting}
        onBackdropClick={() => !deleting && setDeleteTarget(null)}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

      <SessionCloseDialogComp
        open={!!closeTarget}
        session={closeTarget}
        closeMode={closeMode}
        onCloseModeChange={setCloseMode}
        closing={closing}
        onBackdropClick={() => !closing && setCloseTarget(null)}
        onCancel={() => setCloseTarget(null)}
        onConfirm={handleClose}
      />
    </Layout>
  );
}
