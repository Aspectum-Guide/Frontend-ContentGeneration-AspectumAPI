import { useEffect, useState } from 'react';
import { partnersAdminAPI } from '../../../api/partners';
import { Field, FormActions, TextInput, Textarea } from '../../../components/ui/FormField';
import Modal from '../../../components/ui/Modal';
import { parseApiError } from '../../../utils/apiError';
import FormErrorAlert from '../shared/components/FormErrorAlert';
import { PARTNER_STATUSES } from './partnerFormat';

function emptyPartner() {
  return {
    name: '',
    status: 'active',
    commission_percent: '',
    attribution_months: 24,
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    legal_name: '',
    inn: '',
    notes: '',
  };
}

export default function PartnerFormModal({ open, partner, onClose, onSaved }) {
  const [values, setValues] = useState(emptyPartner());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setValues(partner ? {
      ...emptyPartner(),
      ...partner,
      commission_percent: partner.commission_percent ?? '',
    } : emptyPartner());
  }, [open, partner]);

  const set = (key) => (e) => setValues((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: values.name,
      status: values.status,
      commission_percent: values.commission_percent === '' ? null : String(values.commission_percent).replace(',', '.'),
      attribution_months: Number(values.attribution_months) || 24,
      contact_name: values.contact_name || '',
      contact_email: values.contact_email || '',
      contact_phone: values.contact_phone || '',
      legal_name: values.legal_name || '',
      inn: values.inn || '',
      notes: values.notes || '',
    };
    try {
      setSaving(true);
      setError(null);
      const response = partner?.id
        ? await partnersAdminAPI.update(partner.id, payload)
        : await partnersAdminAPI.create(payload);
      onSaved?.(response.data);
    } catch (err) {
      setError(parseApiError(err, 'Не удалось сохранить партнёра'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={partner?.id ? 'Партнёр' : 'Новый партнёр'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormErrorAlert message={error} />

        <Field label="Название" required>
          <TextInput value={values.name} onChange={set('name')} maxLength={200} required />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Статус" hint="У приостановленного коды не активируются">
            <select
              value={values.status}
              onChange={set('status')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {PARTNER_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </Field>
          <Field label="Комиссия, %" hint="Пусто — не начисляется. Меняется только для новых продаж">
            <TextInput type="number" min={0} max={100} step="0.01" value={values.commission_percent} onChange={set('commission_percent')} />
          </Field>
          <Field label="Срок начислений, мес." hint="После активации кода. Новое значение — для новых клиентов">
            <TextInput type="number" min={1} max={120} value={values.attribution_months} onChange={set('attribution_months')} />
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Юр. название">
            <TextInput value={values.legal_name} onChange={set('legal_name')} maxLength={300} />
          </Field>
          <Field label="ИНН">
            <TextInput value={values.inn} onChange={set('inn')} maxLength={12} inputMode="numeric" />
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Контактное лицо">
            <TextInput value={values.contact_name} onChange={set('contact_name')} maxLength={200} />
          </Field>
          <Field label="Почта для связи">
            <TextInput type="email" value={values.contact_email} onChange={set('contact_email')} />
          </Field>
          <Field label="Телефон">
            <TextInput value={values.contact_phone} onChange={set('contact_phone')} maxLength={40} />
          </Field>
        </div>

        <Field label="Заметки" hint="Видны только нам, партнёру не показываются">
          <Textarea rows={3} value={values.notes} onChange={set('notes')} />
        </Field>

        <FormActions saving={saving} saveLabel={partner?.id ? 'Сохранить' : 'Создать'} onCancel={onClose} />
      </form>
    </Modal>
  );
}
