/**
 * Универсальная древовидная навигация.
 * Данные и действия остаются у вызывающего feature-компонента.
 */
export default function TreeNav({
  items = [],
  getItemId = (item) => item.id,
  getChildren = (item) => item.children || [],
  expandedIds = new Set(),
  selectedId,
  onSelect,
  onToggle,
  renderItem,
  empty = null,
}) {
  if (!items.length) return empty;

  return (
    <div role="tree" className="space-y-2">
      {items.map((item) => {
        const id = getItemId(item);
        const children = getChildren(item) || [];
        const expanded = expandedIds.has(id);

        return (
          <div key={id} role="treeitem" aria-selected={selectedId === id}>
            {renderItem?.(item, {
              id,
              children,
              expanded,
              selected: selectedId === id,
              onSelect: () => onSelect?.(item),
              onToggle: () => onToggle?.(item, !expanded),
            })}
            {expanded && children.length > 0 && (
              <div role="group" className="ml-4 mt-1">
                <TreeNav
                  items={children}
                  getItemId={getItemId}
                  getChildren={getChildren}
                  expandedIds={expandedIds}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  onToggle={onToggle}
                  renderItem={renderItem}
                  empty={empty}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
