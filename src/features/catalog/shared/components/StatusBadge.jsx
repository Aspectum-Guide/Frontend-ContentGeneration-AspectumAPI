export default function StatusBadge({
  active,
  activeLabel = 'Активен',
  inactiveLabel = 'Отключен',
  inactiveTone = 'gray',
}) {
  const inactiveClass = inactiveTone === 'red'
    ? 'bg-red-100 text-red-700'
    : 'bg-gray-100 text-gray-500';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${active ? 'bg-green-100 text-green-700' : inactiveClass}`}>
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}
