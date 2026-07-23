/**
 * Hook для периодической валидации JWT токенов
 * Проверяет и обновляет токены каждые 5 минут
 * Основано на логике из мобильного приложения
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import TokenManager from '../utils/TokenManager';
import { redirectToAuth as redirectToAuthPage } from '../utils/authRedirect';

export function useTokenValidation() {
  const hasRedirectedRef = useRef(false);
  const [validationStatus, setValidationStatus] = useState({
    isValid: false,
    isChecking: false,
    lastCheck: null,
  });

  const redirectToAuth = useCallback(() => {
    if (hasRedirectedRef.current) {
      return;
    }

    hasRedirectedRef.current = true;
    redirectToAuthPage();
  }, []);

  // Локальная проверка токенов без сетевых запросов.
  // Сетевой refresh выполняется только в axios-interceptor при реальном 401.
  const checkAndRefreshTokens = useCallback(async () => {
    try {
      setValidationStatus((prev) => ({ ...prev, isChecking: true }));

      const tokens = TokenManager.getTokens();
      if (!tokens?.access) {
        console.warn('⚠️ [TokenValidation] Access token is missing');
        setValidationStatus({
          isValid: false,
          isChecking: false,
          lastCheck: new Date().toISOString(),
        });
        redirectToAuth();
        return;
      }

      const accessValidation = TokenManager.validateToken(tokens.access);
      const refreshValidation = tokens?.refresh
        ? TokenManager.validateToken(tokens.refresh)
        : { isValid: false };

      // Access валиден (даже если needsRefresh=true) — пускаем пользователя.
      if (accessValidation.isValid) {
        console.log('✅ [TokenValidation] Tokens are valid');
        setValidationStatus({
          isValid: true,
          isChecking: false,
          lastCheck: new Date().toISOString(),
        });
        return;
      }

      // Access невалиден: пробуем refresh заранее, не ждём 401 на запросе
      if (refreshValidation.isValid) {
        const refreshResult = await TokenManager.refreshTokens(tokens.refresh);
        if (refreshResult.success) {
          setValidationStatus({
            isValid: true,
            isChecking: false,
            lastCheck: new Date().toISOString(),
          });
          return;
        }
        if (refreshResult.isAuthError || refreshResult.isExpired) {
          setValidationStatus({
            isValid: false,
            isChecking: false,
            lastCheck: new Date().toISOString(),
          });
          redirectToAuth();
          return;
        }
        setValidationStatus({
          isValid: true,
          isChecking: false,
          lastCheck: new Date().toISOString(),
        });
        return;
      }

      console.warn('⚠️ [TokenValidation] Access and refresh tokens are invalid');
      setValidationStatus({
        isValid: false,
        isChecking: false,
        lastCheck: new Date().toISOString(),
      });
      redirectToAuth();
    } catch (error) {
      console.error('[TokenValidation] Validation error:', error);
      setValidationStatus({
        isValid: false,
        isChecking: false,
        lastCheck: new Date().toISOString(),
      });
    }
  }, [redirectToAuth]);

  // Начальная проверка при монтировании
  useEffect(() => {
    checkAndRefreshTokens();
  }, [checkAndRefreshTokens]);

  // Периодическая локальная проверка каждые 5 минут
  useEffect(() => {
    const VALIDATION_INTERVAL = 5 * 60 * 1000; // 5 minutes
    const interval = setInterval(() => {
      console.log('[TokenValidation] Running periodic token validation...');
      checkAndRefreshTokens();
    }, VALIDATION_INTERVAL);

    return () => clearInterval(interval);
  }, [checkAndRefreshTokens]);

  return {
    ...validationStatus,
    checkAndRefreshTokens,
  };
}

export default useTokenValidation;
