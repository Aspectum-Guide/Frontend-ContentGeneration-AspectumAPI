import { useEffect, useState } from 'react';
import { bookingReferenceAPI, ticketTypesAPI } from '../../../api/booking';
import { FormLabel, Alert, Button, Checkbox, EmptyState, Modal, Panel } from '@aspectum/ui';
import { parseApiError } from '../../../utils/apiError';
import { normalizeListResponse } from '../shared/normalize';
import { getEventLabel, getTicketTypeLabel } from '../shared/labels';

export default function AssignTicketTypeModal({ open, ticketType, onClose, onDone }) {
  const isGlobal = !ticketType?.event;

  const [events, setEvents] = useState([]);
  const [existingByEvent, setExistingByEvent] = useState({}); // eventId → { id, is_active }
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Глобальный тип уже доступен всем событиям — грузить список событий
    // и существующие event-owned копии для него незачем.
    if (!open || !ticketType || isGlobal) return;
    setError(null);
    setLoading(true);

    Promise.all([
      bookingReferenceAPI.bookableEvents(),
      ticketType.code
        ? ticketTypesAPI.list({ code: ticketType.code, page_size: 500 })
        : Promise.resolve({ data: { results: [] } }),
    ])
      .then(([eventsRes, ttRes]) => {
        const eventList = normalizeListResponse(eventsRes?.data, ['events', 'results', 'data']);
        setEvents(eventList);

        const ttList = normalizeListResponse(ttRes?.data, ['results', 'data']);
        const map = {};
        for (const tt of ttList) {
          map[String(tt.event)] = {
            id: tt.id,
            is_active: tt.is_active !== false,
          };
        }
        setExistingByEvent(map);

        // Чекбоксы отражают только активные привязки типа билета.
        const preSelected = new Set(
          Object.entries(map)
            .filter(([, v]) => v?.is_active)
            .map(([eventId]) => eventId)
        );
        setSelected(preSelected);
      })
      .catch((e) => setError(parseApiError(e, 'Ошибка загрузки ивентов')))
      .finally(() => setLoading(false));
    // isGlobal derives synchronously from ticketType, already covered by that dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ticketType]);

  const toggle = (eventId) => {
    const id = String(eventId);
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!ticketType) return;
    setSaving(true);
    setError(null);
    try {
      const allSet = new Set(Object.keys(existingByEvent));
      const activeSet = new Set(
        Object.entries(existingByEvent)
          .filter(([, v]) => v?.is_active)
          .map(([eventId]) => eventId)
      );

      const toAdd = [...selected].filter((id) => !allSet.has(id));
      const toEnable = [...selected].filter((id) => allSet.has(id) && !activeSet.has(id));
      const toRemove = [...activeSet].filter((id) => !selected.has(id));

      const removeTicketType = async (eventId) => {
        const ttId = existingByEvent[eventId]?.id;
        if (!ttId) return;
        // Unassign from event via soft-disable to avoid backend 500 on delete.
        await ticketTypesAPI.update(ttId, { is_active: false });
      };

      await Promise.all([
        ...toAdd.map((eventId) =>
          ticketTypesAPI.create({
            event: eventId,
            code: ticketType.code || '',
            name: ticketType.name || {},
            description: ticketType.description || {},
            sort_order: ticketType.sort_order ?? 0,
            is_active: ticketType.is_active !== false,
          })
        ),
        ...toEnable.map((eventId) => {
          const ttId = existingByEvent[eventId]?.id;
          return ttId ? ticketTypesAPI.update(ttId, { is_active: true }) : Promise.resolve();
        }),
        ...toRemove.map((eventId) => removeTicketType(eventId)),
      ]);

      onDone?.();
      onClose();
    } catch (e) {
      setError(parseApiError(e, 'Ошибка сохранения'));
    } finally {
      setSaving(false);
    }
  };

  const typeName = getTicketTypeLabel(ticketType) || '—';

  if (isGlobal) {
    return (
      <Modal open={open} onClose={onClose} title={`«${typeName}» — глобальный тип`} size="md">
        <div className="space-y-4">
          <p className="text-sm text-aspectum-text-strong">
            Этот тип билета глобальный (не привязан к событию) — он уже
            автоматически доступен на всех событиях по коду «{ticketType?.code || '—'}».
            Отдельное назначение по событиям не требуется.
          </p>
          <p className="text-xs text-aspectum-text-muted">
            Если нужен тип билета именно для одного события, создайте новый
            в «Справочнике типов билетов» и укажите для него событие.
          </p>
          <div className="flex justify-end pt-1">
            <Button type="button" variant="primary" size="md" onClick={onClose}>
              Понятно
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Назначить «${typeName}» ивентам`}
      size="md"
    >
      {loading ? (
        <EmptyState icon={null} title="Загрузка ивентов..." spacing="md" />
      ) : (
        <div className="space-y-4">
          {error && (
            <Alert tone="error">{error}</Alert>
          )}

          <Alert tone="warning" className="text-xs">
            Это событийный тип билета (устаревшая модель) — назначение
            создаёт отдельные копии по каждому событию вместо переиспользования
            одного типа. Для новых типов рекомендуется оставлять поле
            «Событие» пустым в «Справочнике типов билетов» — тогда тип станет
            глобальным и будет виден всем событиям без клонирования.
          </Alert>

          {events.length === 0 ? (
            <EmptyState
              title="Нет ивентов с включённым букингом"
              description="Включите «В сторе» в каталоге событий."
              className="py-6"
            />
          ) : (
            <>
              <p className="text-xs text-aspectum-text-muted">
                Тип билета будет создан для отмеченных ивентов с теми же именем, кодом и описанием.
              </p>
              <Panel tone="muted" className="max-h-72 overflow-y-auto p-0 divide-y divide-aspectum-border-subtle">
                {events.map((ev) => {
                  const evId = String(ev.id);
                  const isChecked = selected.has(evId);
                  return (
                    <FormLabel
                      key={evId}
                       interactive  layout="rowLoose" className="px-3 py-2.5 hover:bg-aspectum-surface-muted"
                    >
                      <Checkbox
                        checked={isChecked}
                        onChange={() => toggle(evId)}
                        className="w-4 h-4 rounded border-aspectum-border-strong text-aspectum-primary"
                      />
                      <span className="text-sm text-aspectum-text-emphasis flex-1">
                        {getEventLabel(ev) || ev.id}
                      </span>
                    </FormLabel>
                  );
                })}
              </Panel>
              <div className="text-xs text-aspectum-text-disabled">
                Отмечено: {selected.size} из {events.length}
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={saving}>
              Отмена
            </Button>
            <Button type="button" variant="primary" size="md" onClick={handleSave} disabled={saving || loading || events.length === 0}>
              {saving ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
