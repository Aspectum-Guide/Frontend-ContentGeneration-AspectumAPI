import IconButton from './IconButton';

export default function SidebarIconButton({
  children,
  onClick,
  label,
  title,
  className = '',
  ...props
}) {
  return (
    <IconButton
      {...props}
      label={label}
      title={title || label}
      onClick={onClick}
      variant="ghost"
      size="iconSm"
      data-ui="sidebar-icon-button"
      className={`shrink-0 ${className}`.trim()}
    >
      {children}
    </IconButton>
  );
}
