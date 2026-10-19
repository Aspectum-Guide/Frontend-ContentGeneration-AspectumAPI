export default function RadioGroup({ name, options = [], value, onChange, disabled = false, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`.trim()}>
      {options.map((option) => {
        const optionDisabled = disabled || option.disabled;
        return (
          <label
            key={option.value}
            className={`flex items-start gap-3 rounded-aspectum-control border px-3 py-2 ${
              value === option.value ? (option.activeClass || 'border-aspectum-primary bg-aspectum-primary-soft') : 'border-aspectum-border'
            } ${optionDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange?.(option.value)}
              disabled={optionDisabled}
              className="mt-1"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-aspectum-text">{option.label}</span>
              {option.description && <span className="block text-xs text-aspectum-text-muted mt-0.5">{option.description}</span>}
            </span>
          </label>
        );
      })}
    </div>
  );
}
