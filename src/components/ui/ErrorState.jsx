import { TriangleAlert } from 'lucide-react';
import Panel from './Panel';

/** Полноэкранное критическое состояние с диагностикой и действиями восстановления. */
export default function ErrorState({ title, description, details, detailsLabel = 'Подробности ошибки', actions }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-aspectum-surface-muted p-6">
      <Panel radius="modal" tone="critical" className="w-full max-w-md p-8 text-center shadow-aspectum-card">
        <div className="mb-4 flex justify-center text-aspectum-warning" aria-hidden="true"><TriangleAlert className="size-10" /></div>
        <h1 className="mb-2 text-lg font-semibold text-aspectum-text">{title}</h1>
        {description ? <p className="mb-6 text-sm text-aspectum-text-muted">{description}</p> : null}
        {details ? (
          <details className="mb-6 text-left">
            <summary className="cursor-pointer text-xs text-aspectum-text-disabled hover:text-aspectum-text-subtle">
              {detailsLabel}
            </summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-aspectum-control bg-aspectum-danger-soft p-3 text-xs text-aspectum-danger-subtle">
              {details}
            </pre>
          </details>
        ) : null}
        {actions ? <div className="flex justify-center gap-3">{actions}</div> : null}
      </Panel>
    </div>
  );
}
