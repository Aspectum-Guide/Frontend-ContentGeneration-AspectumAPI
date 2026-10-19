import TabButton from './TabButton';

export default function WizardStepButton({ step, label, completed = false, active = false, disabled = false, ...props }) {
  return (
    <TabButton {...props} role="button" aria-current={active ? 'step' : undefined} selected={active} disabled={disabled} className={`flex-1 text-xs py-1 px-1 text-center border-b-2 ${active ? 'border-aspectum-primary text-aspectum-primary-hover font-semibold' : completed ? 'border-aspectum-primary/40 text-aspectum-primary hover:text-aspectum-primary-hover cursor-pointer' : 'border-transparent text-aspectum-text-muted hover:text-aspectum-text cursor-pointer'} ${disabled ? 'cursor-wait opacity-60' : ''}`}>
      {step}. {label}
    </TabButton>
  );
}
