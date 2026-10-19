const LAYOUTS = {
  block: 'block',
  inline: 'inline',
  row: 'flex items-center gap-2',
  rowTight: 'flex items-center gap-1.5',
  rowBare: 'flex items-center',
  rowLoose: 'flex items-center gap-3',
  rowSpread: 'flex items-center justify-between gap-3',
  inlineRow: 'inline-flex items-center gap-2',
  start: 'flex items-start gap-2',
  stack: 'flex flex-col gap-1',
};

const SIZES = { xs: 'text-xs', sm: 'text-sm' };
const WEIGHTS = { normal: 'font-normal', medium: 'font-medium', semibold: 'font-semibold' };
const TONES = {
  default: 'text-aspectum-text',
  strong: 'text-aspectum-text-strong',
  subtle: 'text-aspectum-text-subtle',
  muted: 'text-aspectum-text-muted',
  emphasis: 'text-aspectum-text-emphasis',
  violet: 'text-aspectum-violet',
};
const SPACING = { none: '', xxs: 'mb-0.5', xs: 'mb-1', sm: 'mb-2', md: 'mb-3' };

/** Нативный label с типографическими и layout-вариантами UIKit. */
export default function FormLabel({
  children,
  layout,
  size,
  weight,
  tone,
  spacing = 'none',
  interactive = false,
  unselectable = false,
  className = '',
  ...props
}) {
  return (
    <label
      className={`${LAYOUTS[layout] || ''} ${SIZES[size] || ''} ${WEIGHTS[weight] || ''} ${TONES[tone] || ''} ${SPACING[spacing] || ''} ${interactive ? 'cursor-pointer' : ''} ${unselectable ? 'select-none' : ''} ${className}`.trim()}
      {...props}
    >
      {children}
    </label>
  );
}
