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
    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-gray-700">
      <div className="font-medium text-amber-800">
        Связанных бронирований: {count}
        {objects.length < count ? ` (показаны первые ${objects.length})` : ''}
      </div>
      <div className="mt-1.5 max-h-40 overflow-y-auto divide-y divide-amber-100">
        {objects.map((row) => (
          <div key={row.id} className="py-1 flex flex-wrap items-baseline gap-x-2">
            <span className="font-mono text-gray-500">{String(row.id).slice(0, 8)}</span>
            <span className="text-gray-700">{STATUS_LABELS[row.status] || row.status || '—'}</span>
            {row.qty != null && <span className="text-gray-500">× {row.qty}</span>}
            {formatMoney(row) && <span className="text-gray-500">{formatMoney(row)}</span>}
            {row.guest_email && <span className="text-gray-400">{row.guest_email}</span>}
            {row.created_at && (
              <span className="text-gray-400">{new Date(row.created_at).toLocaleDateString()}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
