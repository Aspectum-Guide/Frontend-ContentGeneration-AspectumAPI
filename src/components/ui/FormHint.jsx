export default function FormHint({ children }) {
  if (!children) return null;

  return (
    <div className="p-3 bg-aspectum-surface-muted border border-aspectum-border rounded-aspectum-control text-xs text-aspectum-text-subtle">
      {children}
    </div>
  );
}
