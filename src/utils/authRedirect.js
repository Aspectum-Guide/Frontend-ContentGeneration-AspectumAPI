import TokenManager from './TokenManager';

let navigateFn = null;

/**
 * Регистрируется из AuthNavigationRegistrar внутри BrowserRouter.
 * Позволяет разлогинивать без полной перезагрузки SPA (сохраняет несохранённый UI в других вкладках/истории).
 */
export function registerAuthNavigate(fn) {
  navigateFn = typeof fn === 'function' ? fn : null;
}

export function redirectToAuth({ replace = true } = {}) {
  TokenManager.clearTokens();
  const target = '/token-auth';

  if (navigateFn) {
    navigateFn(target, { replace });
    return;
  }

  if (window.location.pathname !== target) {
    window.location.replace(target);
  }
}
