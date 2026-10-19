import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TokenManager from '../utils/TokenManager';
import { authAPI } from '../api/auth.ts';
import { resolveNavScope } from '../config/nav';
import { landingPath } from '../config/scope';
import { Alert, Button, Field, PageHeader, Panel, TextInput } from '@aspectum/admin-ui-web';

export default function TokenAuth() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Проверяем есть ли уже валидные токены
    const tokens = TokenManager.getTokens();
    if (tokens) {
      const validation = TokenManager.validateToken(tokens.access);
      if (validation.isValid) {
        // Есть валидный токен, редирект на главную
        navigate(landingPath(resolveNavScope()));
      }
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError(null);

      if (!login.trim() || !password.trim()) {
        setError('Пожалуйста, введите email (или логин) и пароль');
        return;
      }

      const { resp: response, data: parsed } = await authAPI.loginJson({
        login: login.trim(),
        password: password.trim(),
      });

      if (response.status === 401) {
        setError('Email или пароль некорректны');
        return;
      }

      if (!response.ok) {
        setError(`Ошибка сервера: ${response.status}`);
        return;
      }

      if (!parsed.success) {
        setError('Сервер вернул некорректные токены');
        return;
      }

      const data = parsed.data;
      TokenManager.saveTokens({
        access: data.access,
        refresh: data.refresh,
        expiresAt: Date.now() + 3600000, // ~1 час
      });

      console.log('✅ Токены сохранены успешно');
      navigate(landingPath(resolveNavScope()));
    } catch (err) {
      console.error('Ошибка при входе:', err);
      setError('Ошибка подключения к серверу. Проверьте данные и интернет');
    } finally {
      setLoading(false);
    }
  };

  const toBase64Url = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  const normalizeCredential = (credential) => ({
    id: credential.id,
    rawId: toBase64Url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: {
      authenticatorData: toBase64Url(credential.response.authenticatorData),
      clientDataJSON: toBase64Url(credential.response.clientDataJSON),
      signature: toBase64Url(credential.response.signature),
      userHandle: credential.response.userHandle ? toBase64Url(credential.response.userHandle) : null,
    },
  });

  const fromBase64Url = (value) => {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0)).buffer;
  };

  const handlePasskeyLogin = async () => {
    if (!window.PublicKeyCredential) {
      setError('Этот браузер не поддерживает passkeys. Используйте пароль.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const optionsResponse = await authAPI.passkeyAuthenticationOptions();
      const options = optionsResponse.data.options;
      options.challenge = fromBase64Url(options.challenge);
      if (options.allowCredentials) {
        options.allowCredentials = options.allowCredentials.map((item) => ({ ...item, id: fromBase64Url(item.id) }));
      }
      const credential = await navigator.credentials.get({ publicKey: options });
      if (!credential) return;
      const result = await authAPI.passkeyAuthenticationVerify({
        challenge_id: optionsResponse.data.challenge_id,
        credential: normalizeCredential(credential),
      });
      const data = result.data;
      TokenManager.saveTokens({ access: data.access, refresh: data.refresh, expiresAt: Date.now() + 3600000 });
      navigate(landingPath(resolveNavScope()));
    } catch (err) {
      if (err?.name !== 'NotAllowedError') setError(err?.response?.data?.detail || 'Не удалось войти с passkey.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-aspectum-primary-soft to-aspectum-indigo-muted flex items-center justify-center p-4">
      <Panel radius="modal" className="w-full max-w-md p-8 shadow-aspectum-prominent">
        <PageHeader title="Aspectum Admin" description="Введите учетные данные для доступа" titleSize="lg" spacing="lg" />

        <form onSubmit={handleLogin} className="space-y-6">
          <Field label="Email или логин">
            <TextInput
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="your@example.com или username"
              disabled={loading}
              autoFocus
            />
          </Field>

          <Field label="Пароль">
            <TextInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
            />
          </Field>

          {error && (
            <Alert tone="error">{error}</Alert>
          )}

          <Button
            type="submit"
            variant="primary"
            size="xl"
            className="w-full"
            disabled={loading || !login.trim() || !password.trim()}
          >
            {loading ? 'Вход в процессе...' : 'Войти'}
          </Button>
        </form>

        <div className="flex items-center gap-3 my-5 text-xs text-aspectum-text-disabled"><span className="h-px bg-aspectum-border flex-1" />или<span className="h-px bg-aspectum-border flex-1" /></div>
        <Button type="button" variant="secondary" size="xl" className="w-full" disabled={loading} onClick={handlePasskeyLogin}>
          Войти с passkey
        </Button>

        <Panel tone="info" radius="control" className="mt-6 p-4">
          <p className="text-xs text-aspectum-primary-emphasis">
            <strong>Информация по входу:</strong><br/>
            Введите email или логин и пароль. Если passkey уже добавлен в настройках аккаунта, можно войти без пароля.
          </p>
        </Panel>
      </Panel>
    </div>
  );
}
