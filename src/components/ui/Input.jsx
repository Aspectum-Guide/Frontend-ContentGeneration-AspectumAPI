import { Field, TextInput } from '@aspectum/admin-ui-web';

export default function Input({ label, error, className = '', ...props }) {
  if (!label && !error) {
    return <TextInput className={className} {...props} />;
  }
  return (
    <div className="mb-4">
      <Field label={label} error={error}>
        <TextInput className={className} {...props} />
      </Field>
    </div>
  );
}
