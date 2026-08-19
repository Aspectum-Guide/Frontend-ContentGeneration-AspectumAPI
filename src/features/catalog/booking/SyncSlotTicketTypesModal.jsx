import { useEffect, useMemo, useState } from 'react';
import Modal from '../../../components/ui/Modal';
import { eventSlotAvailabilitiesAPI } from '../../../api/booking';
import { getTicketTypeLabel } from '../shared/labels';
import { formatSlotLabel } from './bookingSetupPricingHelpers';

const CONCURRENCY = 6;

// Runs `worker` over `items` with at most `limit` in flight at once, and
// resolves once every item settled (never rejects — failures are reported
// per item so a few bad slots don't abort the rest of the batch).
async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const lanes = new Array(Math.min(limit, items.length)).fill(null).map(async () => {
    while (cursor < items.length) {
      const i = cursor++;
      try {
        results[i] = { ok: true, value: await worker(items[i], i) };
      } catch (e) {
        results[i] = { ok: false, error: e };
      }
    }
  });
  await Promise.all(lanes);
  return results;
}

/**
 * Applies a chosen set of ticket types to a chosen subset of slots — the
 * fix for "N слотов без типов" in the readiness checklist. Slot selection
 * defaults to everything passed in, but is editable per-slot since bulk
 * changes across an event's whole calendar are hard to undo.
 */
export default function SyncSlotTicketTypesModal({
  open,
  onClose,
  slots,
  ticketTypeOptions,
  defaultTicketTypeIds,
  onDone,
}) {
  const [selectedSlotIds, setSelectedSlotIds] = useState(new Set());
  const [selectedTypeIds, setSelectedTypeIds] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const sortedSlots = useMemo(
    () => [...(slots || [])].sort((a, b) => new Date(a.slot_datetime) - new Date(b.slot_datetime)),
    [slots],
  );

  useEffect(() => {
    if (!open) return;
    setSelectedSlotIds(new Set(sortedSlots.map((s) => String(s.id))));
    const optionIds = (ticketTypeOptions || []).map((tt) => String(tt.id));
    const preselected = defaultTicketTypeIds
      ? optionIds.filter((id) => defaultTicketTypeIds.has(id))
      : [];
    setSelectedTypeIds(new Set(preselected.length ? preselected : optionIds));
    setError('');
    setResult(null);
    setProgress(0);
    // sortedSlots/ticketTypeOptions/defaultTicketTypeIds all derive from
    // `open`-gated parent state — re-running only on `open` avoids resetting
    // the user's picks on every unrelated parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggleSlot = (id) => {
    const key = String(id);
    setSelectedSlotIds((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleType = (id) => {
    const key = String(id);
    setSelectedTypeIds((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleSync = async () => {
    if (!selectedSlotIds.size || !selectedTypeIds.size) return;
    setSaving(true);
    setError('');
    setResult(null);
    setProgress(0);

    const typeIds = [...selectedTypeIds];
    const targets = sortedSlots.filter((s) => selectedSlotIds.has(String(s.id)));
    let done = 0;

    const outcomes = await runWithConcurrency(targets, CONCURRENCY, async (slot) => {
      try {
        return await eventSlotAvailabilitiesAPI.update(slot.id, { ticket_types: typeIds });
      } finally {
        done += 1;
        setProgress(done);
      }
    });

    const failed = outcomes.filter((o) => !o.ok).length;
    setSaving(false);
    setResult({ ok: targets.length - failed, fail: failed });
    if (failed) {
      setError(`Не удалось обновить ${failed} из ${targets.length} слот(ов)`);
    } else {
      onDone?.();
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? undefined : onClose}
      title="Синхронизировать типы билетов"
      size="lg"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Отмеченным слотам будут проставлены отмеченные типы билетов
          (текущая привязка на слоте заменяется целиком).
        </p>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
        )}
        {result && !result.fail && (
          <div className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
            Готово — обновлено {result.ok} слот(ов).
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-1.5">Типы билетов</h3>
          {ticketTypeOptions?.length ? (
            <div className="flex flex-wrap gap-2">
              {ticketTypeOptions.map((tt) => {
                const id = String(tt.id);
                const checked = selectedTypeIds.has(id);
                return (
                  <label
                    key={id}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-sm cursor-pointer transition-colors ${
                      checked
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleType(id)}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600"
                    />
                    {getTicketTypeLabel(tt)}
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Нет доступных глобальных типов билетов для этого события</p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-sm font-semibold text-gray-800">
              Слоты без типов ({sortedSlots.length})
            </h3>
            <div className="flex gap-3 text-xs">
              <button
                type="button"
                onClick={() => setSelectedSlotIds(new Set(sortedSlots.map((s) => String(s.id))))}
                className="text-blue-600 hover:underline"
              >
                Все
              </button>
              <button
                type="button"
                onClick={() => setSelectedSlotIds(new Set())}
                className="text-blue-600 hover:underline"
              >
                Ничего
              </button>
            </div>
          </div>
          {sortedSlots.length ? (
            <>
              <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-lg">
                {sortedSlots.map((s) => {
                  const id = String(s.id);
                  const checked = selectedSlotIds.has(id);
                  return (
                    <label
                      key={id}
                      className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSlot(id)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-gray-800">{formatSlotLabel(s.slot_datetime)}</span>
                      {s.available_seats != null && (
                        <span className="text-gray-400 ml-auto">{s.available_seats} мест</span>
                      )}
                    </label>
                  );
                })}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Отмечено: {selectedSlotIds.size} из {sortedSlots.length}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400">Все открытые слоты уже с типами</p>
          )}
        </div>

        {saving && (
          <div className="text-xs text-gray-500">
            Синхронизировано {progress} из {selectedSlotIds.size}...
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {result && !result.fail ? 'Закрыть' : 'Отмена'}
          </button>
          <button
            onClick={handleSync}
            disabled={saving || !selectedSlotIds.size || !selectedTypeIds.size}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Синхронизация...' : `Синхронизировать (${selectedSlotIds.size})`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
