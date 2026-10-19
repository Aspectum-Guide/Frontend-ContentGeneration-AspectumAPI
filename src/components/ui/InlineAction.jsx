import Button from './Button';

export default function InlineAction({ children, variant = 'link', size = 'xs', className = '', ...props }) {
  return (
    <Button
      {...props}
      type={props.type || 'button'}
      variant={variant}
      size={size}
      className={className}
    >
      {children}
    </Button>
  );
}
