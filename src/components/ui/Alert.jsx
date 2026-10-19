const tones = {
  error: 'border-aspectum-danger/20 bg-aspectum-danger-soft text-aspectum-danger',
  warning: 'border-aspectum-warning/20 bg-aspectum-warning-soft text-aspectum-warning',
  success: 'border-aspectum-success/20 bg-aspectum-success-soft text-aspectum-success',
  info: 'border-aspectum-primary/20 bg-aspectum-primary-soft text-aspectum-primary-hover',
};

export default function Alert({ tone = 'info', children, className = '' }) {
  return (
    <div className={`rounded-aspectum-control border px-3 py-2 text-sm ${tones[tone] || tones.info} ${className}`}>
      {children}
    </div>
  );
}
