export default function SidebarNav({
  sections = [],
  expanded = true,
  renderItem,
}) {
  return (
    <nav className="space-y-4">
      {sections.map((section) => (
        <div key={section.title}>
          <p className={`pb-2 text-xs font-semibold uppercase tracking-wide text-aspectum-text-muted ${expanded ? 'px-3' : 'px-1 text-center'}`}>
            {expanded ? section.title : section.title.charAt(0)}
          </p>
          <div className="space-y-0.5">
            {section.items.map((item) => renderItem(item, section))}
          </div>
        </div>
      ))}
    </nav>
  );
}
