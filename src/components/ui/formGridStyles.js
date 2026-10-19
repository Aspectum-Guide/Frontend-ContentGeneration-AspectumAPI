const COLUMN_CLASSES = { 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4' };
const FIXED_COLUMN_CLASSES = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' };
const GAP_CLASSES = { sm: 'gap-2', md: 'gap-3', lg: 'gap-4' };

export default function formGridClassName({
  columns = 2,
  responsive = true,
  gap = 'md',
  className = '',
} = {}) {
  const columnsClass = responsive
    ? `grid-cols-1 ${COLUMN_CLASSES[columns] || COLUMN_CLASSES[2]}`
    : (FIXED_COLUMN_CLASSES[columns] || FIXED_COLUMN_CLASSES[2]);

  return `grid ${columnsClass} ${GAP_CLASSES[gap] || GAP_CLASSES.md} ${className}`.trim();
}
