import Alert from './Alert';
import Spinner from './Spinner';

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
    <Alert tone="info" className={`mb-4 flex items-center gap-2 ${className}`.trim()}>
      <Spinner className="shrink-0 border-aspectum-primary" />
      {text ? <span>{text}</span> : null}
    </Alert>
  );
}
