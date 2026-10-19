import Spinner from './Spinner';

export default function LoadingOverlay({ loading = false, children, label = 'Загрузка…', className = '' }) {
  return <div className={`relative ${className}`.trim()} aria-busy={loading || undefined}>{children}{loading && <div className="absolute inset-0 z-10 flex items-center justify-center bg-aspectum-overlay-medium" role="status" aria-live="polite"><div className="flex items-center gap-2 rounded-aspectum-control bg-aspectum-surface px-3 py-2 text-sm text-aspectum-text-emphasis shadow-aspectum-elevated"><Spinner size="sm" />{label}</div></div>}</div>;
}
