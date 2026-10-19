const SIZES = {
  xs: 'text-sm',
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-2xl',
};

const WEIGHTS = {
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
};

const TONES = {
  default: 'text-aspectum-text',
  strong: 'text-aspectum-text-strong',
  emphasis: 'text-aspectum-text-emphasis',
  primary: 'text-aspectum-primary-emphasis',
  danger: 'text-aspectum-danger',
  indigo: 'text-aspectum-indigo-deep',
};

/** Семантический заголовок без layout-обёртки. */
export default function Heading({ children, level = 2, size = 'md', weight = 'semibold', tone = 'default', className = '', ...props }) {
  const safeLevel = Math.min(6, Math.max(1, Number(level) || 2));
  const Component = `h${safeLevel}`;
  return (
    <Component className={`${SIZES[size] || SIZES.md} ${WEIGHTS[weight] || WEIGHTS.semibold} ${TONES[tone] || TONES.default} ${className}`.trim()} {...props}>
      {children}
    </Component>
  );
}
