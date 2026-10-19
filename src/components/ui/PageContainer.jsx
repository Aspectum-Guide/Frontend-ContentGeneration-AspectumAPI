const WIDTH_CLASSES = {
  narrow: 'max-w-lg',
  medium: 'max-w-2xl',
  comfortable: 'max-w-3xl',
  wide: 'max-w-4xl',
  full: 'max-w-7xl',
};

const SPACING_CLASSES = {
  sm: 'space-y-3',
  md: 'space-y-4',
  lg: 'space-y-6',
};

export default function PageContainer({
  children,
  maxWidth,
  centered = false,
  spacing,
  className = '',
  as: Component = 'div',
  ...props
}) {
  return (
    <Component
      className={`${WIDTH_CLASSES[maxWidth] || ''} ${centered ? 'mx-auto' : ''} ${SPACING_CLASSES[spacing] || ''} ${className}`.trim()}
      {...props}
    >
      {children}
    </Component>
  );
}
