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
  const tokens = TokenManager.getTokens();
  const [staffStatus, setStaffStatus] = useState('checking'); // 'checking' | 'staff' | 'not-staff'

  const hasValidTokens = (() => {
    if (!tokens?.access) return false;
    const validation = TokenManager.validateToken(tokens.access);
    if (validation.isValid) return true;
    const refreshValidation = TokenManager.validateToken(tokens.refresh);
    return refreshValidation.isValid;
  })();

  useEffect(() => {
    if (!hasValidTokens) return;
    let cancelled = false;
    checkIsStaff(tokens.access).then((isStaff) => {
      if (!cancelled) setStaffStatus(isStaff ? 'staff' : 'not-staff');
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasValidTokens, tokens?.access]);

  if (!hasValidTokens) {
    return <Navigate to="/token-auth" replace />;
  }

  // Эта админка управляет продажами (типы билетов/слоты/цены) и другими
  // ресурсами, доступными только сотрудникам — бэкенд требует IsAdminUser
  // на всех соответствующих эндпоинтах. Не пускаем не-staff пользователей
  // даже до первого запроса, чтобы не показывать формы, которые всё равно
  // упадут с 403.
  if (staffStatus === 'checking') {
    return (
      <div className="flex items-center justify-center min-h-screen text-sm text-gray-400">
        Проверка доступа...
      </div>
    );
  }

  if (staffStatus === 'not-staff') {
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
