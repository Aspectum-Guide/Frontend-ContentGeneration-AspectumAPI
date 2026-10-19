import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./components/Layout', () => ({
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}));

vi.mock('./utils/TokenManager', () => ({
  default: {
    getTokens: vi.fn(() => null),
    validateToken: vi.fn(),
    refreshTokens: vi.fn(),
    clearTokens: vi.fn(),
  },
}));

vi.mock('./api/auth.ts', () => ({
  authAPI: {
    me: vi.fn(),
    loginJson: vi.fn(),
  },
}));

import { routes } from './App.jsx';
import TokenManager from './utils/TokenManager';

const renderRoute = (path) => {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
};

describe('application routes', () => {
  beforeEach(() => {
    TokenManager.getTokens.mockReturnValue(null);
    TokenManager.clearTokens.mockClear();
  });

  it('renders the public authentication route', () => {
    renderRoute('/token-auth');

    expect(screen.getByRole('heading', { name: 'Aspectum Admin' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Войти с passkey' })).toBeTruthy();
  });

  it('renders the public home route', () => {
    renderRoute('/');

    expect(screen.getByText('Платформа генерации контента для городов и достопримечательностей')).toBeTruthy();
  });

  it('renders the not-found route for an unknown URL', () => {
    renderRoute('/definitely-missing');

    expect(screen.getByRole('heading', { name: '404' })).toBeTruthy();
  });

  it('redirects a protected route to authentication without tokens', async () => {
    const router = renderRoute('/generation');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/token-auth');
    });
    expect(TokenManager.clearTokens).toHaveBeenCalled();
  });
});
