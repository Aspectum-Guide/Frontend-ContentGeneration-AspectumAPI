const SIZE_CLASSES = {
  sm: 'h-1.5',
  md: 'h-2',
};

const TONE_CLASSES = {
  primary: 'bg-aspectum-primary',
  focus: 'bg-aspectum-focus',
  info: 'bg-aspectum-info',
  indigo: 'bg-aspectum-indigo-subtle',
};

const TRACK_CLASSES = {
  border: 'bg-aspectum-border',
  surface: 'bg-aspectum-surface-subtle',
  info: 'bg-aspectum-info-muted',
  indigo: 'bg-aspectum-indigo-muted',
};

const TRANSITION_CLASSES = {
  normal: 'duration-300',
  slow: 'duration-500',
};

function toFiniteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function ProgressBar({
  value = 0,
  max = 100,
  size = 'md',
  tone = 'primary',
  track = 'border',
  transition = 'normal',
  label,
  className = '',
}) {
  const safeMax = Math.max(1, toFiniteNumber(max, 100));
  const safeValue = Math.min(safeMax, Math.max(0, toFiniteNumber(value, 0)));
  const percent = safeMax > 0 ? (safeValue / safeMax) * 100 : 0;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={safeValue}
      className={`w-full overflow-hidden rounded-full ${SIZE_CLASSES[size] || SIZE_CLASSES.md} ${TRACK_CLASSES[track] || TRACK_CLASSES.border} ${className}`.trim()}
    >
      <div
        className={`h-full rounded-full transition-[width] ${TRANSITION_CLASSES[transition] || TRANSITION_CLASSES.normal} ${TONE_CLASSES[tone] || TONE_CLASSES.primary}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
