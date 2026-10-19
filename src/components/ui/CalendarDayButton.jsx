export default function CalendarDayButton({ date, available, selected = false, vacancies = 0, onSelect, disabled = false }) {
  const isDisabled = disabled || !available;
  return (
    <button
      type="button"
      disabled={isDisabled}
      aria-pressed={selected}
      onClick={() => onSelect?.(date)}
      className={`rounded-aspectum-control border px-2 py-2 text-left text-xs transition ${selected ? 'border-aspectum-primary bg-aspectum-primary-soft text-aspectum-primary-hover' : available ? 'border-aspectum-success/20 bg-aspectum-success-soft text-aspectum-success hover:border-aspectum-success' : 'border-aspectum-border bg-aspectum-surface-muted text-aspectum-text-muted cursor-not-allowed'}`}
    >
      <span className="block font-medium">{date?.slice(8, 10)}.{date?.slice(5, 7)}</span>
      <span className="block mt-0.5">{available ? `${vacancies} мест` : 'Закрыто'}</span>
    </button>
  );
}
