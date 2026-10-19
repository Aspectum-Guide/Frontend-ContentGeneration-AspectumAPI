import Chip from './Chip';

export default function TagPicker({ options = [], selected = [], onToggle, getOptionLabel = (option) => option.label ?? option.name ?? option.id, disabled = false, ariaLabel = 'Выбор тегов', className = '' }) {
  const selectedSet = new Set(selected.map(String));
  return <div role="group" aria-label={ariaLabel} className={`flex flex-wrap gap-2 ${className}`.trim()}>{options.map((option) => { const id = String(option.id ?? option.value); return <Chip key={id} selected={selectedSet.has(id)} disabled={disabled} onClick={() => onToggle?.(id)}>{getOptionLabel(option)}</Chip>; })}</div>;
}
