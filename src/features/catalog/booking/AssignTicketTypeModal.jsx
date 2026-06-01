import { useEffect, useState } from 'react';
import { bookingReferenceAPI, ticketTypesAPI } from '../../../api/booking';
import Modal from '../../../components/ui/Modal';
import { parseApiError } from '../../../utils/apiError';
import { normalizeListResponse } from '../shared/normalize';
import { getEventLabel, getTicketTypeLabel } from '../shared/labels';

export default function AssignTicketTypeModal({ open, ticketType, onClose, onDone }) {
  const [events, setEvents] = useState([]);
  const [existingByEvent, setExistingByEvent] = useState({}); // eventId → ticketTypeId
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !ticketType) return;
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
        for (const tt of ttList) map[String(tt.event)] = tt.id;
        setExistingByEvent(map);

        // Пре-чекаем ивенты у которых уже есть этот тип
        const preSelected = new Set(Object.keys(map));
        // Всегда включаем текущий ивент этого тикет-тайпа
        if (ticketType.event) preSelected.add(String(ticketType.event));
        setSelected(preSelected);
      })
      .catch((e) => setError(parseApiError(e, 'Ошибка загрузки ивентов')))
      .finally(() => setLoading(false));
  }, [open, ticketType]);

  const toggle = (eventId) => {
    const id = String(eventId);
    // Нельзя снять галочку с текущего ивента тикет-тайпа
    if (id === String(ticketType?.event)) return;
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
      const originalSet = new Set(Object.keys(existingByEvent));
      originalSet.add(String(ticketType.event)); // текущий ивент всегда был

      const toAdd = [...selected].filter((id) => !originalSet.has(id));
      const toRemove = [...originalSet].filter(
        (id) => !selected.has(id) && id !== String(ticketType.event)
      );

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
        ...toRemove.map((eventId) => {
          const ttId = existingByEvent[eventId];
          return ttId ? ticketTypesAPI.delete(ttId) : Promise.resolve();
        }),
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
                  const isCurrent = evId === String(ticketType?.event);
                  const isChecked = selected.has(evId);
                  return (
                    <label
                      key={evId}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 ${isCurrent ? 'opacity-60 cursor-default' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggle(evId)}
                        disabled={isCurrent}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-sm text-gray-800 flex-1">
                        {getEventLabel(ev) || ev.id}
                      </span>
                      {isCurrent && (
                        <span className="text-xs text-gray-400">текущий</span>
                      )}
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
