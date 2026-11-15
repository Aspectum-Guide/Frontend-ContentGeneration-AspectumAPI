import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import UserSubscriptionsWorkbenchPage from './UserSubscriptionsWorkbenchPage';

vi.mock('../../../components/Layout', () => ({
  default: ({ children }) => <div>{children}</div>,
}));

vi.mock('../../../api/generation', () => ({
  citiesAPI: { list: vi.fn(async () => ({ data: [] })) },
}));

vi.mock('../../../api/subscription', () => ({
  subscriptionTypesAPI: { list: vi.fn(async () => ({ data: [] })) },
  subscriptionUsersAdminAPI: {
    list: vi.fn(async () => ({ data: [{ id: 'user-1', email: 'reader@example.com' }] })),
    get: vi.fn(async () => ({ data: {
      id: 'user-1',
      email: 'reader@example.com',
      ai_prompts_balance: 12,
      ai_prompt_grants: [{
        id: 'grant-1',
        amount: 12,
        created_at: '2026-10-27T09:15:00Z',
        reason: 'Тестовое начисление',
        granted_by: 'admin@example.com',
      }],
    } })),
  },
  citySubscriptionsAPI: {},
  iapPurchasesAdminAPI: {},
}));

describe('UserSubscriptionsWorkbenchPage', () => {
  it('opens a user with AI grants and displays the grant date and details', async () => {
    render(<UserSubscriptionsWorkbenchPage />);
    fireEvent.click((await screen.findAllByText('reader@example.com'))[0]);

    const reason = await screen.findByText('Тестовое начисление');
    const row = within(reason.closest('tr'));
    expect(row.getByText(new Date('2026-10-27T09:15:00Z').toLocaleString())).toBeTruthy();
    expect(row.getByText('+12')).toBeTruthy();
    expect(row.getByText('admin@example.com')).toBeTruthy();
    expect(screen.getByText('Осталось: 12')).toBeTruthy();
  });
});
