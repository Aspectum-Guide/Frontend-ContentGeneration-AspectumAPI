/**
 * Унифицированный футер действий для шагов мастера.
 */
export default function WizardActionFooter({ children, className = '' }) {
  return (
    <div data-ui="wizard-action-footer" className={`flex justify-end gap-2 flex-wrap ${className}`.trim()}>
      {children}
    </div>
  );
}
