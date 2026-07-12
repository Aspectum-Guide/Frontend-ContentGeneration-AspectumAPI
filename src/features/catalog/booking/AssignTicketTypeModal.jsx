import { useEffect, useState } from 'react';
import { bookingReferenceAPI, ticketTypesAPI } from '../../../api/booking';
import Modal from '../../../components/ui/Modal';
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
          <p className="text-sm text-gray-700">
            Этот тип билета глобальный (не привязан к событию) — он уже
            автоматически доступен на всех событиях по коду «{ticketType?.code || '—'}».
            Отдельное назначение по событиям не требуется.
          </p>
          <p className="text-xs text-gray-500">
            Если нужен тип билета именно для одного события, создайте новый
            в «Справочнике типов билетов» и укажите для него событие.
          </p>
          <div className="flex justify-end pt-1">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Понятно
            </button>
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
        <div className="py-8 text-center text-sm text-gray-400">Загрузка ивентов...</div>
      ) : (
        <div className="space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
          )}

          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
            Это событийный тип билета (устаревшая модель) — назначение
            создаёт отдельные копии по каждому событию вместо переиспользования
            одного типа. Для новых типов рекомендуется оставлять поле
            «Событие» пустым в «Справочнике типов билетов» — тогда тип станет
            глобальным и будет виден всем событиям без клонирования.
          </p>

          {events.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-400">
              Нет ивентов с включённым букингом.<br />
              <span className="text-xs">Включите «В сторе» в каталоге событий.</span>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500">
                Тип билета будет создан для отмеченных ивентов с теми же именем, кодом и описанием.
              </p>
              <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-lg">
                {events.map((ev) => {
                  const evId = String(ev.id);
                  const isChecked = selected.has(evId);
                  return (
                    <label
                      key={evId}
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggle(evId)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-sm text-gray-800 flex-1">
                        {getEventLabel(ev) || ev.id}
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className="text-xs text-gray-400">
                Отмечено: {selected.size} из {events.length}
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading || events.length === 0}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
