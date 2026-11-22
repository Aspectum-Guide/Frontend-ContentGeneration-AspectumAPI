import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, DataTableSurface, EmptyState, Heading, Panel, Spinner, TextInput, Glyph } from '@aspectum/admin-ui-web';
import { getTicketTypeLabel } from '../shared/labels';
import { formatSlotLabel, priceStatusClass } from './bookingSetupPricingHelpers';

export function ReadinessChecklist({ items, readyCount, totalCount, onAction }) {
  return (
    <Panel tone="muted" className="mt-4 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <Heading level={3} size="xs" tone="emphasis">Готово к продаже</Heading>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          readyCount === totalCount ? 'bg-aspectum-success-muted text-aspectum-success-emphasis' : 'bg-aspectum-warning-muted text-aspectum-warning-emphasis'
        }`}
        >
          {readyCount}/{totalCount}
        </span>
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-2 text-sm">
            <span className={`mt-0.5 w-4 text-center ${item.ok ? 'text-aspectum-success' : 'text-aspectum-text-faint'}`}>
              {item.loading ? '…' : item.ok ? <Glyph name="✓" /> : '○'}
            </span>
            <div className="min-w-0 flex-1">
              <div className={item.ok ? 'text-aspectum-text-emphasis' : 'text-aspectum-text-strong'}>{item.label}</div>
              <div className="text-xs text-aspectum-text-muted">{item.hint}</div>
              {item.link && (
                <Link to={item.link} className="text-xs text-aspectum-primary hover:underline">
                  {item.linkLabel}
                </Link>
              )}
              {item.actionLabel && onAction && (
                <Button
                  type="button"
                  onClick={() => onAction(item.actionId, item)}
                  variant="link"
                  size="sm"
                  className="block"
                >
                  {item.actionLabel}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Panel>
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
      <Panel tone="muted" className="flex items-center gap-2 text-xs px-3 py-2">
        <Spinner className="border-aspectum-focus" />
        Превью цен для ближайшего слота…
      </Panel>
    );
  }
  if (error) {
    return <Alert tone="warning" className="text-xs">{error}</Alert>;
  }
  if (!preview?.prices?.length) return null;
  return (
    <Panel tone="info" className="px-3 py-2 text-xs">
      <div className="font-medium text-aspectum-text-emphasis mb-1">
        Превью для слота {formatSlotLabel(preview.slotDatetime)}
      </div>
      <div className="flex flex-wrap gap-2">
        {preview.prices.map((p) => (
          <span key={p.ticket_type_id} className="px-2 py-0.5 rounded bg-aspectum-surface border border-aspectum-border">
            {p.code || p.ticket_type_id}: {p.unit_price} {p.currency}
            <span className="text-aspectum-text-disabled ml-1">({p.price_source})</span>
          </span>
        ))}
      </div>
    </Panel>
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
    <Panel tone="muted" className="border-dashed">
      <Button
        type="button"
        onClick={() => setOpen((v) => !v)}
        variant="ghost"
        size="md"
        className="w-full justify-between"
      >
        <span className="font-medium">Расширенно: цены по слотам</span>
        <span className="text-xs text-aspectum-text-disabled">{open ? 'Скрыть' : 'Показать'}</span>
      </Button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          <p className="text-xs text-aspectum-text-muted">
            Переопределение на конкретном слоте перебивает базовую цену и правила. Пустая ячейка — действует базовая.
          </p>
          {!visibleSlots.length ? (
            <EmptyState title="Нет открытых слотов для матрицы" className="py-4" />
          ) : (
            <DataTableSurface className="rounded-aspectum-control">
              <table className="w-full text-xs">
                <thead className="bg-aspectum-surface-muted text-aspectum-text-muted">
                  <tr>
                    <th className="px-2 py-1.5 text-left sticky left-0 bg-aspectum-surface-muted">Слот</th>
                    {ticketTypes.map((tt) => (
                      <th key={tt.id} className="px-2 py-1.5 text-center min-w-[88px]">
                        {getTicketTypeLabel(tt)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-aspectum-border-subtle">
                  {visibleSlots.map((slot) => (
                    <tr key={slot.id}>
                      <td className="px-2 py-1.5 text-aspectum-text-subtle whitespace-nowrap sticky left-0 bg-aspectum-surface">
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
            </DataTableSurface>
          )}
        </div>
      )}
    </Panel>
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
