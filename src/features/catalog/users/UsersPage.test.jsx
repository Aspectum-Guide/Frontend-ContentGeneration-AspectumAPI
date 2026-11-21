// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import UsersPage from './UsersPage';
import apiClient from '../../../api/client';

vi.mock('../../../components/Layout', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../../../api/client', () => ({ default: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() } }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('users management', () => {
  it('loads users and saves account changes', async () => {
    apiClient.get.mockResolvedValue({ data: { count: 1, next: null, results: [{ id: 'user-1', email: 'person@example.com', is_active: true, is_staff: false }] } });
    apiClient.patch.mockResolvedValue({});
    render(<UsersPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Открыть' }));
    fireEvent.click(screen.getByLabelText('Персонал'));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledWith('/admin/users/user-1/', expect.objectContaining({ is_staff: true })));
  });
  it('requires typing the matching email before deletion', async () => {
    apiClient.get.mockResolvedValue({ data: { count: 1, next: null, results: [{ id: 'user-1', email: 'person@example.com', is_active: true }] } });
    render(<UsersPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Открыть' }));
    const button = screen.getByRole('button', { name: 'Удалить аккаунт' });
    expect(button.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Подтверждение email для удаления'), { target: { value: 'person@example.com' } });
    expect(button.disabled).toBe(false);
  });
});
