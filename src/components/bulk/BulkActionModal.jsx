import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import { FormActions } from '../ui/FormField';

/**
 * BulkActionModal — лёгкая обёртка для bulk-операций.
 *
 * Идея: страница переопределяет форму через renderFields(),
 * а этот компонент берёт на себя:
 * - submit lifecycle (saving/error/result)
 * - единый footer с кнопками
 *
 * Props:
 * - open, onClose, title, size
 * - initialValues: object
 * - renderFields: ({ values, setValues, saving, error, result }) => ReactNode
 * - onSubmit: async (values) => result
 * - renderResult: ({ result }) => ReactNode (optional)
 * - submitLabel
 * - parseError: (err) => string
 */
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

  // Reset state on open (so repeated opens start clean)
  useEffect(() => {
    if (!open) return;
    setValues(initialValues || {});
    setSaving(false);
    setError(null);
    setResult(null);
  }, [open, initialValues]);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!onSubmit) return;
    try {
      setSaving(true);
      setError(null);
      const res = await onSubmit(values);
      setResult(res ?? { success: true });
    } catch (err) {
      setError(parseError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title} size={size}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {renderFields?.({ values, setValues, saving, error, result })}

        {renderResult && result ? renderResult({ result }) : null}

        <FormActions
          saving={saving}
          saveLabel={submitLabel}
          onCancel={onClose}
        />
      </form>
    </Modal>
  );
}

