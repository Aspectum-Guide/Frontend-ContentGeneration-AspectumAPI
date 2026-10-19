import Alert from './Alert';
import Button from './Button';

export default function AsyncErrorState({ error, onRetry, retryLabel = 'Повторить', className = '' }) {
  if (!error) return null;
  return (
    <Alert tone="error" className={`flex items-center justify-between gap-3 ${className}`.trim()}>
      <span>{error}</span>
      {onRetry && <Button type="button" variant="link" size="sm" onClick={onRetry}>{retryLabel}</Button>}
    </Alert>
  );
}
