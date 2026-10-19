export default function DropdownPanel({ children, className = '', ...props }) {
  return (
    <div className={`rounded-aspectum-card border border-aspectum-border bg-aspectum-surface p-3 shadow-aspectum-elevated ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
