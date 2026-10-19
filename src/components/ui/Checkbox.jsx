/**
 * Общий чекбокс для выбора строк, тегов и опций.
 * onChange получает стандартное событие input.
 */
export default function Checkbox({ className = '', ...props }) {
  return (
    <input
      type="checkbox"
      className={`h-4 w-4 rounded border-aspectum-border text-aspectum-primary focus:ring-aspectum-primary disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}
