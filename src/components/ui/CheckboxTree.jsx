import { useMemo, useState } from 'react';
import Checkbox from './Checkbox';
import { ChevronDown, ChevronRight } from 'lucide-react';

export default function CheckboxTree({ groups = [], selected = [], onToggle, getGroupLabel = (group) => group.label, getItemLabel = (item) => item.label ?? item.name ?? item.id, disabled = false, showGroupHeaders = true, collapsible = false, showSelectAll = false, showSelectedCount = false, className = '' }) {
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());
  const selectedSet = useMemo(() => new Set(selected.map(String)), [selected]);
  const toggleGroup = (group) => {
    const ids = (group.items || []).map((item) => String(item.id ?? item.value));
    const allSelected = ids.length > 0 && ids.every((id) => selectedSet.has(id));
    ids.forEach((id) => { if (allSelected || !selectedSet.has(id)) onToggle?.(id); });
  };
  return <div role="tree" aria-disabled={disabled || undefined} className={`divide-y divide-aspectum-border-subtle ${className}`.trim()}>{groups.map((group) => {
    const items = group.items || [];
    const ids = items.map((item) => String(item.id ?? item.value));
    const selectedCount = ids.filter((id) => selectedSet.has(id)).length;
    const collapsed = collapsedGroups.has(String(group.id));
    return <div key={String(group.id)} role="group" aria-label={String(getGroupLabel(group))}>{showGroupHeaders && <div className="sticky top-0 flex items-center gap-2 bg-aspectum-surface-muted px-3 py-2 text-xs font-semibold text-aspectum-text-subtle">
      {collapsible ? <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={!collapsed} onClick={() => setCollapsedGroups((current) => { const next = new Set(current); const id = String(group.id); if (next.has(id)) next.delete(id); else next.add(id); return next; })}><span aria-hidden="true">{collapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}</span><span className="truncate">{getGroupLabel(group)}</span></button> : <span className="min-w-0 flex-1 truncate">{getGroupLabel(group)}</span>}
      {showSelectedCount && <span className="font-normal">{selectedCount}/{ids.length}</span>}
      {showSelectAll && ids.length > 0 && <button type="button" aria-label={`${selectedCount === ids.length ? 'Снять' : 'Выбрать'} все элементы группы ${getGroupLabel(group)}`} className="font-medium text-aspectum-primary hover:underline" onClick={() => toggleGroup(group)} disabled={disabled}>{selectedCount === ids.length ? 'Снять всё' : 'Выбрать всё'}</button>}
    </div>}{(!showGroupHeaders || !collapsed) && items.map((item) => { const id = String(item.id ?? item.value); return <label key={id} role="treeitem" className="flex items-center gap-2 px-3 py-2 text-sm text-aspectum-text-strong hover:bg-aspectum-surface-muted"><Checkbox aria-label={String(getItemLabel(item))} checked={selectedSet.has(id)} disabled={disabled} onChange={() => onToggle?.(id)} /><span>{getItemLabel(item)}</span></label>; })}</div>;
  })}</div>;
}
