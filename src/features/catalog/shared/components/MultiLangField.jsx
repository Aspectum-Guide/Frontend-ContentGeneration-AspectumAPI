import { FormLabel, MultiField } from '@aspectum/ui';

export default function MultiLangField({ label, value = {}, onChange, langs = [], multiline = false, rows = 3, required = false }) {
  const items = langs.map((code) => ({ id: code, label: code.toUpperCase() }));
  return (
    <div>
      {label && <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="xs">{label}{required && <span className="text-aspectum-danger-subtle ml-0.5">*</span>}</FormLabel>}
      <MultiField items={items} value={value} onChange={onChange} multiline={multiline} rows={rows} placeholder={label} />
    </div>
  );
}
