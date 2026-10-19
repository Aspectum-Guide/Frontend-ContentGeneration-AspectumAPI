import { useEffect, useState } from 'react';
import Modal from './Modal';
import { FormActions } from './FormField';

/** Универсальная модалка для bulk-операций с async submit lifecycle. */
export default function BulkActionModal({
  open,
  onClose,
  title,
  size = 'lg',
  initialValues,
  renderFields,
  onSubmit,
  renderResult,
  submitLabel = 'Выполнить',
  parseError = (err) => err?.message || 'Ошибка выполнения',
}) {
  const [values, setValues] = useState(initialValues || {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!open) return;
    setValues(initialValues || {});
    setSaving(false);
    setError(null);
    setResult(null);
  }, [open, initialValues]);

  const handleSubmit = async (event) => {
    event?.preventDefault?.();
    if (!onSubmit) return;
    try {
      setSaving(true);
      setError(null);
      const response = await onSubmit(values);
      setResult(response ?? { success: true });
    } catch (submitError) {
      setError(parseError(submitError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title} size={size}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {renderFields?.({ values, setValues, saving, error, result })}
        {renderResult && result ? renderResult({ result }) : null}
        <FormActions saving={saving} saveLabel={submitLabel} onCancel={onClose} />
      </form>
    </Modal>
  );
}
