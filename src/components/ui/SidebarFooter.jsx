export default function SidebarFooter({ children, className = '' }) {
  return (
    <div data-ui="sidebar-footer" className={`border-t border-aspectum-border p-3 space-y-2 ${className}`}>
      {children}
    </div>
  );
}
