const TONES = {
  neutral: 'bg-aspectum-surface border-aspectum-border',
  muted: 'bg-aspectum-surface-muted border-aspectum-border',
  info: 'bg-aspectum-primary-soft border-aspectum-primary/20',
  warning: 'bg-aspectum-warning-soft border-aspectum-warning/20',
  danger: 'bg-aspectum-danger-soft border-aspectum-danger/20',
  critical: 'bg-aspectum-surface border-aspectum-danger-muted',
  accentPurple: 'bg-aspectum-purple-soft border-aspectum-purple-border',
  accentIndigo: 'bg-aspectum-indigo-soft border-aspectum-indigo-border',
  accentOrange: 'bg-aspectum-orange-soft border-aspectum-orange-border',
};

const RADII = {
  compact: 'rounded-aspectum-compact',
  control: 'rounded-aspectum-control',
  card: 'rounded-aspectum-card',
  modal: 'rounded-aspectum-modal',
};

export default function Panel({ children, tone = 'neutral', radius = 'card', className = '', as: Component = 'section', ...props }) {
  return (
    <Component className={`${RADII[radius] || RADII.card} border ${TONES[tone] || TONES.neutral} ${className}`.trim()} {...props}>
      {children}
    </Component>
  );
}
