/**
 * Hook для периодической валидации JWT токенов
 * Проверяет и обновляет токены каждые 5 минут
 * Основано на логике из мобильного приложения
 */

import { useEffect, useState, useCallback } from 'react';
import TokenManager from '../utils/TokenManager';

export function useTokenValidation() {
  const [validationStatus, setValidationStatus] = useState({
    isValid: false,
    isChecking: false,
    lastCheck: null,
  });

  // Функция для проверки и обновления токенов
  const checkAndRefreshTokens = useCallback(async () => {
    try {
      setValidationStatus((prev) => ({ ...prev, isChecking: true }));

      const result = await TokenManager.ensureValidTokens();

      if (result.isValid) {
        console.log('✅ [TokenValidation] Tokens are valid');
        setValidationStatus({
          isValid: true,
          isChecking: false,
          lastCheck: new Date().toISOString(),
        });
      } else {
        // Попробуем с refresh токеном
        const tokens = TokenManager.getTokens();
        if (tokens?.refresh) {
          const refreshValidation = TokenManager.validateToken(tokens.refresh);

          if (refreshValidation.isValid) {
            // Refresh токен еще валиден, попробуем обновить
            console.log('[TokenValidation] Attempting to refresh tokens...');
            const refreshResult = await TokenManager.refreshTokens(tokens.refresh);

            if (refreshResult.success) {
              setValidationStatus({
                isValid: true,
                isChecking: false,
                lastCheck: new Date().toISOString(),
              });
              return;
            }
          }
        }

        // Токены невалидны, редирект на login
        console.warn('⚠️ [TokenValidation] Tokens invalid or expired');
        setValidationStatus({
          isValid: false,
          isChecking: false,
          lastCheck: new Date().toISOString(),
        });

        TokenManager.clearTokens();
        // Редирект на страницу входа - будет обработан ProtectedRoute
      }
    } catch (error) {
      console.error('[TokenValidation] Validation error:', error);
      setValidationStatus({
        isValid: false,
        isChecking: false,
        lastCheck: new Date().toISOString(),
      });
    }
  }, []);

  // Начальная проверка при монтировании
  useEffect(() => {
    checkAndRefreshTokens();
  }, [checkAndRefreshTokens]);

  // Периодическая проверка каждые 5 минут
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
