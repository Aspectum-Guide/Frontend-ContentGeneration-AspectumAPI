import { useEffect, useRef, useState } from 'react';
import { activationCodesAPI } from '../../../api/subscription';
import { Field, TextInput } from '../../../components/ui/FormField';
import Modal from '../../../components/ui/Modal';
import { parseApiError } from '../../../utils/apiError';
import FormErrorAlert from '../shared/components/FormErrorAlert';
import { formatIsoForInput } from '../shared/scheduleParsers';
import { resolveTypeId, typeToFormValue } from './codeTypes';
import TypeSelect from './TypeSelect';

// Дата для поля «Действует до» в часовом поясе браузера — как в таблице кодов.
const isoToLocalDate = (iso) => formatIsoForInput(iso).slice(0, 10);

const SELECT_CLASS = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none';
const BUTTON = 'px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50';
const PRIMARY = 'px-3 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50';

/** Найти полную запись кода (с id) по его тексту — список кабинета id не отдаёт. */
export async function findCodeRecord(partnerId, codeText) {
  const response = await activationCodesAPI.list({ search: codeText, partner: partnerId });
  const data = response?.data;
  const list = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
  return list.find((item) => String(item.code).toUpperCase() === String(codeText).toUpperCase()) || null;
}

// Правка кода партнёра: текст, что открывает, активации, срок, включён ли.
export default function CodeEditModal({ partnerId, codeText, types, onClose, onSaved }) {
  const [record, setRecord] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  // Список типов читаем через ref: его обновление на странице не должно
  // перезагружать открытое окно и стирать введённые правки.
  const typesRef = useRef(types);
  useEffect(() => {
    typesRef.current = types;
  }, [types]);

  useEffect(() => {
    if (!codeText) return undefined;
    let cancelled = false;
    setRecord(null);
    setForm(null);
    setError(null);
    findCodeRecord(partnerId, codeText)
      .then((found) => {
        if (cancelled) return;
        if (!found) {
          setError('Код не найден — обновите страницу.');
          return;
        }
        setRecord(found);
        setForm({
          code: found.code,
          type: typeToFormValue(found.subscription_type, typesRef.current),
          max_uses: found.max_uses ?? '',
          expiry: isoToLocalDate(found.expiry_date),
          is_active: !!found.is_active,
          description: found.description || '',
        });
      })
      .catch((err) => !cancelled && setError(parseApiError(err, 'Не удалось загрузить код')));
    return () => {
      cancelled = true;
    };
  }, [partnerId, codeText]);

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));
  // Коды выдаются заглавными — и набираются сразу заглавными.
  const setUpper = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value.toUpperCase() }));

  const save = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      const payload = {
        code: (form.code || '').trim().toUpperCase(),
        subscription_type: await resolveTypeId(form.type, types),
        max_uses: form.max_uses === '' ? null : Number(form.max_uses),
        is_active: !!form.is_active,
        description: form.description || '',
      };
      // Срок отправляем, только если его поменяли: иначе остаётся точное прежнее время.
      if (form.expiry !== isoToLocalDate(record.expiry_date)) {
        payload.expiry_date = form.expiry ? new Date(`${form.expiry}T23:59:59`).toISOString() : null;
      }
      await activationCodesAPI.update(record.id, payload);
      await onSaved();
      onClose();
    } catch (err) {
      setError(parseApiError(err, 'Не удалось сохранить код'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={!!codeText} onClose={onClose} title={`Код ${codeText || ''}`} size="lg">
      <FormErrorAlert message={error} />
      {!form && !error ? <p className="text-sm text-gray-500">Загружаем…</p> : null}
      {form ? (
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Текст кода" hint="Если код уже напечатан или разослан, старые ссылки и QR перестанут работать" required>
              <TextInput value={form.code} maxLength={40} onChange={setUpper('code')} required />
            </Field>
            <Field label="Что открывает" required>
              <TypeSelect className={SELECT_CLASS} value={form.type} onChange={set('type')} types={types} required />
            </Field>
            <Field label="Активаций" hint={`Уже активировали: ${record?.current_uses ?? 0}. Пусто — без ограничения`}>
              <TextInput type="number" min={1} value={form.max_uses} onChange={set('max_uses')} />
            </Field>
            <Field label="Действует до" hint="Пусто — бессрочно">
              <TextInput type="date" value={form.expiry} onChange={set('expiry')} />
            </Field>
          </div>
          <Field label="Описание">
            <TextInput value={form.description} maxLength={500} onChange={set('description')} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
            />
            Код включён (выключенный код не активируется; уже открытые города у людей остаются)
          </label>
          <div className="flex gap-2">
            <button type="submit" className={PRIMARY} disabled={saving}>{saving ? 'Сохраняю…' : 'Сохранить'}</button>
            <button type="button" className={BUTTON} onClick={onClose} disabled={saving}>Отмена</button>
          </div>
        </form>
      ) : null}
    </Modal>
  );
}
