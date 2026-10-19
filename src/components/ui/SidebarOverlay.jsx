export default function SidebarOverlay({ onClick, label = 'Закрыть меню', className = '' }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      data-ui="sidebar-overlay"
      className={`fixed inset-0 z-30 bg-aspectum-overlay-medium ${className}`}
    />
  );
}
