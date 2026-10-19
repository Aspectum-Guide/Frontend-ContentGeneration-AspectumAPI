import { Alert } from '@aspectum/ui';

const STATUS_LABELS = {
  reserved: 'забронировано',
  cancelled: 'отменено',
  expired: 'истекло',
};

function formatMoney(row) {
  if (row.total_price == null) return null;
  return `${row.total_price} ${row.currency || ''}`.trim();
}

/**
 * Renders the `blocking_objects`/`blocking_count` payload that the backend's
 * ProtectedError handler (AspectumBack/exceptions.py) attaches to a failed
 * DELETE — the actual BookingReservation rows keeping the object alive.
 */
export default function BlockingReservationsList({ details }) {
  const objects = Array.isArray(details?.blocking_objects) ? details.blocking_objects : [];
  const count = Number.isFinite(details?.blocking_count) ? details.blocking_count : objects.length;

  if (!count) return null;

  return (
    <Alert tone="warning" className="mt-2 p-2.5 text-xs">
      <div className="font-medium text-aspectum-warning-emphasis">
        Связанных бронирований: {count}
        {objects.length < count ? ` (показаны первые ${objects.length})` : ''}
      </div>
      <div className="mt-1.5 max-h-40 overflow-y-auto divide-y divide-aspectum-warning-muted">
        {objects.map((row) => (
          <div key={row.id} className="py-1 flex flex-wrap items-baseline gap-x-2">
            <span className="font-mono text-aspectum-text-muted">{String(row.id).slice(0, 8)}</span>
            <span className="text-aspectum-text-strong">{STATUS_LABELS[row.status] || row.status || '—'}</span>
            {row.qty != null && <span className="text-aspectum-text-muted">× {row.qty}</span>}
            {formatMoney(row) && <span className="text-aspectum-text-muted">{formatMoney(row)}</span>}
            {row.guest_email && <span className="text-aspectum-text-disabled">{row.guest_email}</span>}
            {row.created_at && (
              <span className="text-aspectum-text-disabled">{new Date(row.created_at).toLocaleDateString()}</span>
            )}
          </div>
        ))}
      </div>
    </Alert>
  );
}
