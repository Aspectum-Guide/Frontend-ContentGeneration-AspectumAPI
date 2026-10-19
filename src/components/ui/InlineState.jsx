import Spinner from './Spinner';
import { renderIcon } from './glyphIcons';

const SIZES = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
};

const TONES = {
  muted: 'text-aspectum-text-muted',
  disabled: 'text-aspectum-text-disabled',
  danger: 'text-aspectum-danger',
  warning: 'text-aspectum-warning-strong',
  success: 'text-aspectum-success',
};

const ALIGNMENTS = {
  start: 'justify-start text-left',
  center: 'justify-center text-center',
  end: 'justify-end text-right',
};

/** Компактное loading/empty/info-состояние внутри панели, dropdown или таблицы. */
export default function InlineState({
  children,
  loading = false,
  icon,
  tone = 'muted',
  size = 'sm',
  align = 'start',
  as: Component = 'div',
  className = '',
  ...props
}) {
  const resolvedIcon = loading ? <Spinner size={size === 'xs' ? 'xs' : 'sm'} decorative /> : renderIcon(icon, 'size-4');
  return (
    <Component
      role={loading ? 'status' : undefined}
      className={`flex items-center gap-2 ${SIZES[size] || SIZES.sm} ${TONES[tone] || TONES.muted} ${ALIGNMENTS[align] || ALIGNMENTS.start} ${className}`.trim()}
      {...props}
    >
      {resolvedIcon}
      <span>{children}</span>
    </Component>
  );
}
