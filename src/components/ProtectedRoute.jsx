import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import TokenManager from '../utils/TokenManager';
import { authAPI } from '../api/auth.ts';

// Module-level cache so navigating between routes doesn't re-fetch /auth/me
// on every mount — only re-checked when the access token actually changes.
let staffCheckCache = { accessToken: null, isStaff: null };

async function checkIsStaff(accessToken) {
  if (staffCheckCache.accessToken === accessToken && staffCheckCache.isStaff !== null) {
    return staffCheckCache.isStaff;
  }
  try {
    const res = await authAPI.me();
    const isStaff = !!res?.data?.is_staff;
    staffCheckCache = { accessToken, isStaff };
    return isStaff;
  } catch {
    // Fail closed: if we can't confirm staff status, don't grant access.
    staffCheckCache = { accessToken, isStaff: false };
    return false;
  }
}

export default function ProtectedRoute({ children }) {
  // checking | denied | staff-check | staff | not-staff
  const [gate, setGate] = useState('checking');
  const [accessToken, setAccessToken] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const tokens = TokenManager.getTokens();
      if (!tokens?.access) {
        if (!cancelled) setGate('denied');
        return;
      }

      const accessValidation = TokenManager.validateToken(tokens.access);
      if (accessValidation.isValid) {
        if (!cancelled) {
          setAccessToken(tokens.access);
          setGate('staff-check');
        }
        return;
      }

      const refreshValidation = TokenManager.validateToken(tokens.refresh);
      if (!refreshValidation.isValid) {
        if (!cancelled) setGate('denied');
        return;
      }

      // Access истёк, refresh ещё жив — обновляем до входа в защищённые страницы
      const refreshResult = await TokenManager.refreshTokens(tokens.refresh);
      if (cancelled) return;

      if (refreshResult.success) {
        setAccessToken(refreshResult.data?.access || TokenManager.getTokens()?.access || null);
        setGate('staff-check');
        return;
      }

      if (refreshResult.isAuthError || refreshResult.isExpired) {
        setGate('denied');
        return;
      }

      // Временная ошибка сети — не выкидываем, пусть interceptor попробует на 401
      setAccessToken(tokens.access);
      setGate('staff-check');
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (gate !== 'staff-check') return;
    let cancelled = false;
    checkIsStaff(accessToken).then((isStaff) => {
      if (!cancelled) setGate(isStaff ? 'staff' : 'not-staff');
    });
    return () => { cancelled = true; };
  }, [gate, accessToken]);

  if (gate === 'checking' || gate === 'staff-check') {
    return (
      <div className="min-h-[30vh] flex items-center justify-center text-sm text-gray-500">
        Проверка сессии…
      </div>
    );
  }

  if (gate === 'denied') {
    TokenManager.clearTokens();
    return <Navigate to="/token-auth" replace />;
  }

  // Эта админка управляет продажами (типы билетов/слоты/цены) и другими
  // ресурсами, доступными только сотрудникам — бэкенд требует IsAdminUser
  // на всех соответствующих эндпоинтах. Не пускаем не-staff пользователей
  // даже до первого запроса, чтобы не показывать формы, которые всё равно
  // упадут с 403.
  if (gate === 'not-staff') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-center px-4">
        <p className="text-lg font-semibold text-gray-800">Доступ только для сотрудников</p>
        <p className="text-sm text-gray-500 max-w-sm">
          Этот аккаунт не имеет прав администратора. Войдите под учётной записью сотрудника.
        </p>
        <button
          onClick={() => { TokenManager.clearTokens(); window.location.href = '/token-auth'; }}
          className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Выйти
        </button>
      </div>
    );
  }

  return children;
}
