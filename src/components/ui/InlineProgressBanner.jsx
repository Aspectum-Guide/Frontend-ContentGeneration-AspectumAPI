/**
 * Синий баннер «идёт операция» (спиннер + текст).
 * Текст передаётте через children или message.
 */
export default function InlineProgressBanner({
  show,
  message,
  children,
  className = '',
}) {
  if (!show) return null;

  const text = children ?? message ?? '';

  return (
    <div
      className={`mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 flex items-center gap-2 ${className}`.trim()}
    >
      <span className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full shrink-0" />
      {text ? <span>{text}</span> : null}
    </div>
  );
}
