import { Navigate } from 'react-router-dom';
import TokenManager from '../utils/TokenManager';

export default function ProtectedRoute({ children }) {
  // Проверяем есть ли валидные JWT токены
  const tokens = TokenManager.getTokens();
  
  if (!tokens?.access) {
    return <Navigate to="/token-auth" replace />;
  }

  // Проверяем что access токен еще действителен
  const validation = TokenManager.validateToken(tokens.access);
  if (!validation.isValid) {
    const refreshValidation = TokenManager.validateToken(tokens.refresh);
    // Пропускаем только если refresh токен действительно валиден.
    if (!refreshValidation.isValid) {
      return <Navigate to="/token-auth" replace />;
    }
  }

  return children;
}
