export default function Spinner({ size = 'md', className = '', decorative = false }) {
  const sizes = {
    xs: 'h-2.5 w-2.5 border',
    sm: 'h-3.5 w-3.5 border-2',
    md: 'h-4 w-4 border-2',
    lg: 'h-6 w-6 border-2',
  };

  return (
    <span
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : 'Загрузка'}
      role={decorative ? undefined : 'status'}
      className={`inline-block animate-spin rounded-full border-aspectum-text-muted border-t-transparent ${sizes[size] || sizes.md} ${className}`}
    />
  );
}
