import { useCallback, useEffect, useState } from 'react';
import { ticketTypesAPI } from '../../../api/booking';
import Layout from '../../../components/Layout';
import { Alert, Button, CheckboxField, ConfirmModal, DataTable, Field, FormActions, Modal, PageHeader, Panel, Select, StatusBadge, TableRowActions, TextInput, formGridClassName } from '@aspectum/admin-ui-web';
import AssignTicketTypeModal from './AssignTicketTypeModal';
import { useLayoutActions } from '../../../context/useLayoutActions';
import { parseApiError } from '../../../utils/apiError';
import { useCatalogCrud } from '../core/useCatalogCrud';
import { useCatalogFilters } from '../core/useCatalogFilters';
import { useCatalogResource } from '../core/useCatalogResource';
import { useEventOptions } from '../shared/bookingOptions';
import BlockingReservationsList from '../shared/components/BlockingReservationsList';
import EventSelect from '../shared/components/EventSelect';
import { buildLangOptions, getMultiLangValue, pickPrimaryLangCode } from '../shared/i18n';
import { getEventLabelById, getTicketTypeLabel } from '../shared/labels';
import { useAppLanguages } from '../../../hooks/useAppLanguages';
import { LangBlock, LangTabs } from '../shared/LangFields';

const PAGE_SIZE = 20;

function createEmptyTicketType() {
  return {
    id: null,
    code: '',
    name: {},
    description: {},
    sort_order: 0,
    is_active: true,
  };
}

function mapRowToEdit(row) {
  return {
    id: row.id,
    event: row.event || '',
    code: row.code || '',
    name:
      typeof row.name === 'object' && row.name
        ? row.name
        : (row.name ? { ru: String(row.name) } : {}),
    description:
      typeof row.description === 'object' && row.description
        ? row.description
        : (row.description ? { ru: String(row.description) } : {}),
    sort_order: Number.isFinite(row.sort_order) ? row.sort_order : 0,
    is_active: row.is_active !== false,
  };
}

function mapEditToPayload(item) {
  const code = (item.code || '').trim().toLowerCase();
  return {
    // Пусто = глобальный тип, переиспользуемый на всех событиях по `code`.
    event: item.event || null,
    code,
    name: item.name || {},
    description: item.description || {},
    sort_order: Number(item.sort_order || 0),
    is_active: !!item.is_active,
  };
}

export default function TicketTypesCatalog() {
  const { languages: appLanguages } = useAppLanguages();
  const { setMobileActions } = useLayoutActions();
  const { page, setPage, search, setSearch, debouncedSearch } = useCatalogFilters();

  const resource = useCatalogResource({
    listRequest: ticketTypesAPI.list,
    removeRequest: ticketTypesAPI.delete,
    listKeys: ['results'],
    defaultErrorMessage: 'Ошибка загрузки типов билетов',
  });

  const { eventOptions, eventsLoading } = useEventOptions();

  const [eventFilter, setEventFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [ordering, setOrdering] = useState('sort_order');

  const [activeLang, setActiveLang] = useState('');
  const [assignTarget, setAssignTarget] = useState(null);
  const [forceDeleteTarget, setForceDeleteTarget] = useState(null);
  const [forceDeleteError, setForceDeleteError] = useState('');

  const loadTicketTypes = resource.load;
  const reload = useCallback(async (pageNum) => {
    const isActiveParam =
      statusFilter === 'active' ? 'true' : statusFilter === 'inactive' ? 'false' : undefined;

    await loadTicketTypes(
      {
        page: pageNum,
        page_size: PAGE_SIZE,
        event: eventFilter || undefined,
        is_active: isActiveParam,
        search: debouncedSearch || undefined,
        ordering: ordering || undefined,
      },
      (err) => parseApiError(err, 'Ошибка загрузки типов билетов')
    );
  }, [loadTicketTypes, eventFilter, statusFilter, debouncedSearch, ordering]);

  const crud = useCatalogCrud({
    createEmpty: createEmptyTicketType,
    createRequest: ticketTypesAPI.create,
    updateRequest: ticketTypesAPI.update,
    deleteRequest: ticketTypesAPI.delete,
    mapRowToEdit,
    mapEditToPayload: (item) => {
      const code = (item.code || '').trim().toLowerCase();
      if (!code) throw new Error('Поле «Код» обязательно для заполнения.');
      return mapEditToPayload(item);
    },
    onAfterSave: () => reload(page),
    onAfterDelete: () => reload(page),
    parseError: (err, fallback) => parseApiError(err, fallback),
    createErrorMessage: 'Ошибка создания типа билета',
    updateErrorMessage: 'Ошибка сохранения типа билета',
    deleteErrorMessage: 'Ошибка удаления типа билета',
  });
  const {
    editingItem: editingType,
    setEditingItem: setEditingType,
    saving,
    saveError,
    deleteTarget,
    deleting,
    deleteError,
    deleteErrorDetails,
  } = crud;

  const openCreate = useCallback(() => {
    setActiveLang('');
    crud.openCreate();
  }, [crud]);

  const openEdit = useCallback((row) => {
    setActiveLang(pickPrimaryLangCode([row?.name]));
    crud.openEdit(row);
  }, [crud]);

  useEffect(() => { reload(page); }, [page, reload]);
  useEffect(() => { setPage(1); reload(1); }, [eventFilter, statusFilter, ordering, debouncedSearch, reload, setPage]);

  useEffect(() => {
    const actions = [
      {
        id: 'create-ticket-type',
        label: editingType ? 'Новый тип' : 'Создать тип билета',
        onClick: openCreate,
        variant: editingType ? 'secondary' : 'primary',
      },
    ];

    if (editingType) {
      actions.push({
        id: 'close-ticket-type-editor',
        label: 'Закрыть форму',
        onClick: crud.closeEdit,
        variant: 'secondary',
      });
    }

    setMobileActions(actions);
    return () => setMobileActions([]);
  }, [editingType, openCreate, crud.closeEdit, setMobileActions]);

  const columns = [
    {
      key: 'name',
      label: 'Тип билета',
      render: (value, row) => (
        <div>
          <div className="text-sm font-medium text-aspectum-text">
            {getTicketTypeLabel(row) || value || '—'}
          </div>
          {row.code ? (
            <div className="text-xs text-aspectum-text-disabled mt-0.5 font-mono">{row.code}</div>
          ) : null}
          {row.description ? (
            <div className="text-xs text-aspectum-text-muted mt-0.5 line-clamp-2">
              {getMultiLangValue(row.description) || (typeof row.description === 'string' ? row.description : '')}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'event',
      label: 'Событие',
      render: (eventId) => (
        <span className="text-sm text-aspectum-text-strong">{getEventLabelById(eventOptions, eventId) || eventId || '—'}</span>
      ),
    },
    {
      key: 'code',
      label: 'Код',
      className: 'text-sm text-aspectum-text-subtle font-mono',
      render: (value) => <span>{value || '—'}</span>,
    },
    {
      key: 'sort_order',
      label: 'Порядок',
      className: 'text-sm text-aspectum-text-strong',
      render: (value) => <span>{Number.isFinite(value) ? value : 0}</span>,
    },
    {
      key: 'is_active',
      label: 'Статус',
      render: (active) => <StatusBadge active={active} />,
    },
  ];

  return (
    <Layout>
      <PageHeader
        title="Справочник типов билетов"
        description="Управление типами билетов для событий"
        createLabel="Создать тип билета"
        onCreate={openCreate}
      />

      <DataTable
        columns={columns}
        rows={resource.items}
        loading={resource.loading}
        error={resource.error}
        emptyIcon="🎟️"
        isFiltered={!!(search || eventFilter || statusFilter)}
        emptyText="Типов билетов пока нет"
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Поиск по названию или описанию..."
        page={page}
        totalCount={resource.total}
        pageSize={PAGE_SIZE}
        onPage={setPage}
        filters={(
          <>
            <EventSelect
              value={eventFilter}
              onChange={setEventFilter}
              options={eventOptions}
              disabled={eventsLoading}
              placeholder={eventsLoading ? 'Загрузка событий…' : 'Все события'}
              className={eventsLoading ? 'opacity-60 cursor-wait' : undefined}
            />

            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Любой статус</option>
              <option value="active">Активные</option>
              <option value="inactive">Отключенные</option>
            </Select>

            <Select value={ordering} onChange={(e) => setOrdering(e.target.value)}>
              <option value="sort_order">Сортировка: порядок ↑</option>
              <option value="-sort_order">Сортировка: порядок ↓</option>
              <option value="code">Сортировка: код А-Я</option>
              <option value="-code">Сортировка: код Я-А</option>
            </Select>
          </>
        )}
        actions={(row) => (
          <div className="flex items-center gap-1">
            <Button type="button" variant="softPurple" size="sm" onClick={() => setAssignTarget(row)} title="Назначить ивентам">
              Ивенты
            </Button>
            <TableRowActions
              onEdit={() => openEdit(row)}
              onDelete={() => crud.askDelete(row)}
            />
          </div>
        )}
      />

      <Modal
        open={!!editingType}
        onClose={crud.closeEdit}
        title={editingType?.id
          ? `Редактировать тип билета: ${getTicketTypeLabel(editingType)}`
          : 'Создать тип билета'}
        size="lg"
      >
        {editingType && (
          <form onSubmit={crud.save} className="space-y-4">
            <Alert tone="error">{saveError}</Alert>

            <div className={formGridClassName()}>
              <Field
                label="Событие"
                hint="Пусто — глобальный тип, переиспользуемый на всех событиях по коду. Выберите событие только если тип нужен именно для него."
              >
                <EventSelect
                  value={editingType.event}
                  onChange={(v) => setEditingType((prev) => ({ ...prev, event: v }))}
                  options={eventOptions}
                  placeholder="Глобальный (все события)"
                />
              </Field>

              <Field
                label="Код"
                required
                hint="Стабильный идентификатор для аналитики между ивентами. Например: adult, child, vip."
              >
                <TextInput
                  value={editingType.code || ''}
                  onChange={(e) => setEditingType((prev) => ({ ...prev, code: e.target.value }))}
                  placeholder="adult / child / vip"
                  required
                />
              </Field>

              <Field label="Порядок сортировки">
                <TextInput
                  type="number"
                  min={0}
                  value={editingType.sort_order}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const parsed = raw === '' ? '' : Number(raw);
                    setEditingType((prev) => ({
                      ...prev,
                      sort_order: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
                    }));
                  }}
                />
              </Field>
            </div>

            {(() => {
              const nameVal = typeof editingType?.name === 'object' ? editingType.name : {};
              const descVal = typeof editingType?.description === 'object' ? editingType.description : {};
              const langOptions = buildLangOptions(
                [nameVal, descVal],
                appLanguages.map((language) => language.code),
              );
              return (
                <div className="space-y-3">
                  <Panel tone="muted" className="p-3">
                    <p className="text-xs font-medium text-aspectum-text-muted mb-2 uppercase tracking-wide">Переводы</p>
                    <LangTabs
                      active={activeLang}
                      onSwitch={setActiveLang}
                      value={nameVal}
                      langOptions={langOptions}
                      onAddLang={(code) => {
                        setEditingType((p) => ({
                          ...p,
                          name: { ...(p?.name || {}), [code]: p?.name?.[code] ?? '' },
                          description: { ...(p?.description || {}), [code]: p?.description?.[code] ?? '' },
                        }));
                      }}
                      onRemoveLang={(code) => {
                        setEditingType((p) => {
                          const nextName = { ...(p?.name || {}) };
                          const nextDesc = { ...(p?.description || {}) };
                          delete nextName[code];
                          delete nextDesc[code];
                          return { ...p, name: nextName, description: nextDesc };
                        });
                      }}
                    />
                  </Panel>
                  <LangBlock
                    label="Название"
                    value={nameVal}
                    onChange={(v) => setEditingType((prev) => ({ ...prev, name: v }))}
                    activeLang={activeLang}
                    required
                  />
                  <LangBlock
                    label="Описание"
                    value={descVal}
                    onChange={(v) => setEditingType((prev) => ({ ...prev, description: v }))}
                    activeLang={activeLang}
                    multiline
                    rows={3}
                  />
                </div>
              );
            })()}

            <CheckboxField
              checked={editingType.is_active}
              onChange={(next) => setEditingType((prev) => ({ ...prev, is_active: next }))}
              text="Активный тип билета"
            />

            <FormActions
              saving={saving}
              saveLabel={editingType.id ? 'Сохранить' : 'Создать'}
              onCancel={crud.closeEdit}
            />
          </form>
        )}
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={crud.cancelDelete}
        onConfirm={crud.confirmDelete}
        title="Удалить тип билета?"
        message={deleteError || `Тип «${getTicketTypeLabel(deleteTarget) || deleteTarget?.id || ''}» будет удален без возможности восстановления.`}
        confirmLabel="Удалить"
        danger
        loading={deleting}
      >
        <BlockingReservationsList details={deleteErrorDetails} />
        {deleteErrorDetails?.blocking_count ? (
          <Button
            type="button"
            variant="linkDanger"
            size="sm"
            onClick={() => {
              setForceDeleteError('');
              setForceDeleteTarget(deleteTarget);
            }}
            className="mt-2"
          >
            Удалить принудительно вместе с этими бронированиями
          </Button>
        ) : null}
      </ConfirmModal>

      <ConfirmModal
        open={!!forceDeleteTarget}
        onClose={() => setForceDeleteTarget(null)}
        onConfirm={async () => {
          try {
            await ticketTypesAPI.forceDelete(forceDeleteTarget.id);
            setForceDeleteTarget(null);
            crud.cancelDelete();
            await reload(page);
          } catch (err) {
            const msg = parseApiError(err, 'Ошибка принудительного удаления');
            setForceDeleteError(msg);
            throw new Error(msg);
          }
        }}
        title="Удалить принудительно?"
        message={
          forceDeleteError
          || `Это безвозвратно удалит тип «${getTicketTypeLabel(forceDeleteTarget) || forceDeleteTarget?.id || ''}» И все связанные с ним бронирования (историю заказов). Отменить нельзя.`
        }
        confirmLabel="Удалить всё"
        danger
      />

      <AssignTicketTypeModal
        open={!!assignTarget}
        ticketType={assignTarget}
        onClose={() => setAssignTarget(null)}
        onDone={() => reload(page)}
      />
    </Layout>
  );
}
