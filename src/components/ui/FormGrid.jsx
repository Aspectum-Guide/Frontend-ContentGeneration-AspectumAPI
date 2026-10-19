import formGridClassName from './formGridStyles';

export default function FormGrid({ children, ...props }) {
  const { columns, responsive, gap, className, ...elementProps } = props;

  return (
    <div className={formGridClassName({ columns, responsive, gap, className })} {...elementProps}>
      {children}
    </div>
  );
}
