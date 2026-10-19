import { forwardRef } from 'react';

const TabButton = forwardRef(function TabButton({
  children,
  selected = false,
  disabled = false,
  onClick,
  role = 'tab',
  className = '',
  ...props
}, ref) {
  const isTab = role === 'tab';
  return (
    <button
      type="button"
      ref={ref}
      role={role}
      aria-selected={isTab ? selected : undefined}
      tabIndex={isTab ? (selected ? 0 : -1) : undefined}
      disabled={disabled}
      onClick={onClick}
      className={`transition-colors disabled:opacity-50 ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
});

export default TabButton;
