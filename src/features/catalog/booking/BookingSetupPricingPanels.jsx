import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TextInput } from '../../../components/ui/FormField';
import { getTicketTypeLabel } from '../shared/labels';
import { formatSlotLabel, priceStatusClass } from './bookingSetupPricingHelpers';

function Spinner() {
  return <span className="inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
}

export function ReadinessChecklist({ items, readyCount, totalCount }) {
  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50/80 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-gray-800">Готово к продаже</h3>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          readyCount === totalCount ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
        }`}
        >
          {readyCount}/{totalCount}
        </span>
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-2 text-sm">
            <span className={`mt-0.5 w-4 text-center ${item.ok ? 'text-emerald-600' : 'text-gray-300'}`}>
              {item.loading ? '…' : item.ok ? '✓' : '○'}
            </span>
            <div className="min-w-0 flex-1">
              <div className={item.ok ? 'text-gray-800' : 'text-gray-700'}>{item.label}</div>
              <div className="text-xs text-gray-500">{item.hint}</div>
              {item.link && (
                <Link to={item.link} className="text-xs text-blue-600 hover:underline">
                  {item.linkLabel}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PriceStatusBadge({ status }) {
  if (!status) return null;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${priceStatusClass(status.kind)}`}>
      {status.label}
    </span>
  );
}

export function PricePreviewPanel({ preview, loading, error }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500 rounded-lg bg-gray-50 px-3 py-2">
        <Spinner />
        Превью цен для ближайшего слота…
      </div>
    );
  }
  if (error) {
    return <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">{error}</p>;
  }
  if (!preview?.prices?.length) return null;
  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2 text-xs text-gray-700">
      <div className="font-medium text-gray-800 mb-1">
        Превью для слота {formatSlotLabel(preview.slotDatetime)}
      </div>
      <div className="flex flex-wrap gap-2">
        {preview.prices.map((p) => (
          <span key={p.ticket_type_id} className="px-2 py-0.5 rounded bg-white border border-gray-200">
            {p.code || p.ticket_type_id}: {p.unit_price} {p.currency}
            <span className="text-gray-400 ml-1">({p.price_source})</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function SlotPriceOverrideMatrix({
  slots,
  ticketTypes,
  slotPriceMap,
  basePriceByType,
  defaultCurrency,
  onSaveCell,
  savingKey,
}) {
  const [open, setOpen] = useState(false);
  const visibleSlots = useMemo(
    () => (slots || []).slice(0, 12),
    [slots],
  );

  if (!ticketTypes?.length) return null;

  return (
    <div className="rounded-xl border border-dashed border-gray-300">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
      >
        <span className="font-medium">Расширенно: цены по слотам</span>
        <span className="text-xs text-gray-400">{open ? 'Скрыть' : 'Показать'}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          <p className="text-xs text-gray-500">
            Переопределение на конкретном слоте перебивает базовую цену и правила. Пустая ячейка — действует базовая.
          </p>
          {!visibleSlots.length ? (
            <p className="text-sm text-gray-400">Нет открытых слотов для матрицы</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-2 py-1.5 text-left sticky left-0 bg-gray-50">Слот</th>
                    {ticketTypes.map((tt) => (
                      <th key={tt.id} className="px-2 py-1.5 text-center min-w-[88px]">
                        {getTicketTypeLabel(tt)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibleSlots.map((slot) => (
                    <tr key={slot.id}>
                      <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap sticky left-0 bg-white">
                        {formatSlotLabel(slot.slot_datetime)}
                      </td>
                      {ticketTypes.map((tt) => {
                        const typeId = String(tt.id);
                        const key = `${slot.id}:${typeId}`;
                        const existing = slotPriceMap.get(key);
                        const base = basePriceByType[typeId];
                        return (
                          <SlotPriceCell
                            key={`${key}-${existing?.id || 'new'}-${existing?.price || ''}`}
                            existing={existing}
                            fallback={base ? String(base.base_price) : ''}
                            currency={existing?.currency || base?.currency || defaultCurrency}
                            saving={savingKey === key}
                            onSave={(price, currency) => onSaveCell({
                              slotId: slot.id,
                              typeId,
                              price,
                              currency,
                              existingId: existing?.id,
                            })}
                          />
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SlotPriceCell({ existing, fallback, currency, saving, onSave }) {
  const [value, setValue] = useState(existing ? String(existing.price) : '');
  const [dirty, setDirty] = useState(false);

  const handleBlur = () => {
    if (!dirty) return;
    const price = Number(value);
    if (!Number.isFinite(price) || price < 0) return;
    onSave(price, currency);
    setDirty(false);
  };

  return (
    <td className="px-1 py-1">
      <TextInput
        type="number"
        step="0.01"
        min={0}
        value={value}
        placeholder={fallback || '—'}
        onChange={(e) => { setValue(e.target.value); setDirty(true); }}
        onBlur={handleBlur}
        disabled={saving}
        className="text-center text-xs h-8 px-1"
        title={existing ? `В БД: ${existing.price} ${currency}` : (fallback ? `Базовая: ${fallback}` : 'Пусто — базовая')}
      />
    </td>
  );
}
