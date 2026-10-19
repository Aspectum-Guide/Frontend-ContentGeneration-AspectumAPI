export default function SidebarHeader({ children, className = '' }) {
  return (
    <div data-ui="sidebar-header" className={`border-b border-aspectum-border p-3 flex flex-col gap-3 ${className}`}>
      {children}
    </div>
  );
}
