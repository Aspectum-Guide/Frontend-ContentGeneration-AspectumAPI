import Button from './Button';

export default function IconButton({ label, children, className = '', ...props }) {
  return (
    <Button
      {...props}
      type={props.type || 'button'}
      variant={props.variant || 'ghost'}
      size={props.size || 'iconSm'}
      aria-label={label}
      title={props.title || label}
      className={`leading-none ${className}`.trim()}
    >
      {children}
    </Button>
  );
}
