import { useEffect, useState } from 'react';
import { authAPI } from '../api/auth.ts';
import { getThemeMode, setThemeMode } from '../theme/themeBootstrap';
import { Alert, Button, ConfirmModal, EmptyState, PageContainer, PageHeader, Panel, SectionHeader, Spinner } from '@aspectum/ui';

const fromBase64Url = (value) => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)).buffer;
};

const toBase64Url = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export default function AccountSettings() {
  const [themeMode, updateThemeMode] = useState(getThemeMode);
  const [passkeys, setPasskeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [passkeyToRemove, setPasskeyToRemove] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const { data } = await authAPI.passkeys();
      setPasskeys(data.passkeys || []);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Не удалось загрузить настройки безопасности.');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const addPasskey = async () => {
    if (!window.PublicKeyCredential) { setError('Этот браузер не поддерживает passkeys.'); return; }
    try {
      setSaving(true); setError('');
      const { data } = await authAPI.passkeyRegistrationOptions();
      const options = data.options;
      options.challenge = fromBase64Url(options.challenge);
      options.user.id = fromBase64Url(options.user.id);
      options.excludeCredentials = (options.excludeCredentials || []).map((item) => ({ ...item, id: fromBase64Url(item.id) }));
      const credential = await navigator.credentials.create({ publicKey: options });
      if (!credential) return;
      const response = credential.response;
      await authAPI.passkeyRegistrationVerify({
        challenge_id: data.challenge_id,
        name: `Passkey ${new Date().toLocaleDateString('ru-RU')}`,
        credential: {
          id: credential.id, rawId: toBase64Url(credential.rawId), type: credential.type,
          authenticatorAttachment: credential.authenticatorAttachment,
          clientExtensionResults: credential.getClientExtensionResults(),
          response: {
            attestationObject: toBase64Url(response.attestationObject),
            clientDataJSON: toBase64Url(response.clientDataJSON),
            transports: typeof response.getTransports === 'function' ? response.getTransports() : [],
          },
        },
      });
      await load();
    } catch (err) {
      if (err?.name !== 'NotAllowedError') setError(err?.response?.data?.detail || 'Не удалось добавить passkey.');
    } finally { setSaving(false); }
  };

  const removePasskey = async () => {
    if (!passkeyToRemove) return;
    try {
      await authAPI.deletePasskey(passkeyToRemove.id);
      setPasskeys((items) => items.filter((item) => item.id !== passkeyToRemove.id));
      setPasskeyToRemove(null);
    } catch (err) {
      throw new Error(err?.response?.data?.detail || 'Не удалось удалить passkey.');
    }
  };

  return <>
    <PageContainer maxWidth="comfortable" centered className="p-4 md:p-8">
    <PageHeader
      title="Настройки аккаунта"
      description="Настройте внешний вид и безопасный вход в контент-админку."
    />
    <Panel className="p-5 mb-5 shadow-aspectum-card">
      <SectionHeader title="Внешний вид" description="Выбор сохраняется в этом браузере и применяется сразу." size="sm" />
      <label htmlFor="theme-mode" className="block mt-4 mb-2 text-sm font-medium text-aspectum-text-emphasis">Тема оформления</label>
      <select
        id="theme-mode"
        className="w-full sm:w-64 rounded-lg border border-aspectum-border-subtle bg-aspectum-surface p-3 text-sm text-aspectum-text-emphasis"
        value={themeMode}
        onChange={(event) => {
          const mode = event.target.value;
          setThemeMode(mode);
          updateThemeMode(mode);
        }}
      >
        <option value="light">Светлая</option>
        <option value="dark">Тёмная</option>
        <option value="auto">Авто — как в системе</option>
      </select>
    </Panel>
    <Panel className="p-5 shadow-aspectum-card">
      <SectionHeader
        title="Passkeys"
        description="Вход по Face ID, Touch ID, PIN устройства или ключу безопасности — без пароля."
        size="sm"
        actions={<Button type="button" onClick={addPasskey} disabled={saving}>{saving ? 'Добавляем…' : 'Добавить passkey'}</Button>}
      />
      {error && <Alert tone="error">{error}</Alert>}
      {loading ? (
        <EmptyState icon={<Spinner size="sm" />} title="Загрузка…" spacing="md" className="mt-5" />
      ) : passkeys.length === 0 ? (
        <EmptyState icon="🔑" title="Passkeys ещё не добавлены" description="Пароль остаётся способом восстановления доступа." spacing="md" className="mt-5" />
      ) : (
        <ul className="mt-5 divide-y divide-aspectum-border-subtle border-t border-b border-aspectum-border-subtle">
          {passkeys.map((item) => <li className="py-3 flex justify-between items-center gap-4" key={item.id}><div><p className="text-sm font-medium text-aspectum-text-emphasis">{item.name}</p><p className="text-xs text-aspectum-text-muted">Добавлен {new Date(item.created_at).toLocaleDateString('ru-RU')}{item.last_used_at ? ` · использован ${new Date(item.last_used_at).toLocaleDateString('ru-RU')}` : ''}</p></div><Button type="button" variant="danger" size="sm" onClick={() => setPasskeyToRemove(item)}>Удалить</Button></li>)}
        </ul>
      )}
    </Panel>
    </PageContainer>
    <ConfirmModal
      open={!!passkeyToRemove}
      onClose={() => setPasskeyToRemove(null)}
      onConfirm={removePasskey}
      title="Удалить passkey?"
      message="Вход с этого устройства больше не будет доступен."
      confirmLabel="Удалить"
      danger
    />
  </>;
}
