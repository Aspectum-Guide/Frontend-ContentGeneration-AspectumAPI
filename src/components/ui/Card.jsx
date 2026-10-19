export default function Card({ children, className = '', ...props }) {
  return (
    <div className={`bg-aspectum-surface rounded-aspectum-card border border-aspectum-border shadow-aspectum-card ${className}`} {...props}>
      {children}
    </div>
  );
}
