import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import AudioQueue from './AudioQueue.jsx';

vi.mock('../../components/Layout', () => ({ default: ({ children }) => <div>{children}</div> }));

const overview = {
  ok: true,
  max_parallel_per_session: 2,
  stalled_after_minutes: 5,
  resume_after_minutes: 15,
  hours: 24,
  sessions: [{
    session_id: 'florence',
    session_name: 'Сессия от 27.08.2026 19:08',
    place_name: 'Флоренция',
    active: true,
    busy_languages: ['de', 'es'],
    items: [
      { task_id: 't1', language_code: 'de', state: 'running', queue_position: 0, total: 58, processed: 29,
        failed: 0, failed_guides: [], eta_seconds: 1800, current_step: '30/58: озвучиваем «Уффици»',
        resume_attempts: 0, created_at: '2026-10-16T09:23:00Z', started_at: '2026-10-16T09:23:00Z' },
      { task_id: 't2', language_code: 'en', state: 'queued', queue_position: 1, total: 0, processed: 0,
        failed: 0, failed_guides: [], eta_seconds: null, current_step: '', resume_attempts: 0,
        created_at: '2026-10-16T09:23:00Z' },
      { task_id: 't3', language_code: 'ru', state: 'completed', queue_position: 0, total: 58, processed: 58,
        failed: 1, failed_guides: ['Капелла Медичи'], eta_seconds: null, current_step: 'Озвучено 57 из 58',
        resume_attempts: 0, created_at: '2026-10-16T08:00:00Z', completed_at: '2026-10-16T09:00:00Z' },
    ],
  }],
};

vi.mock('../../api/generation', () => ({
  audioQueueAPI: { overview: vi.fn(() => Promise.resolve({ data: overview })) },
}));

describe('AudioQueue', () => {
  it('explains why a language waits and what failed', async () => {
    render(<MemoryRouter><AudioQueue /></MemoryRouter>);

    const link = await screen.findByRole('link', { name: 'Флоренция' });
    expect(link.getAttribute('href')).toBe('/generation/florence');
    expect(screen.getByText('В очереди · №1')).toBeTruthy();
    expect(screen.getByText(/Сейчас озвучиваются DE, ES/)).toBeTruthy();
    expect(screen.getByText('29 из 58')).toBeTruthy();
    expect(screen.getByText(/осталось ≈ 30 мин/)).toBeTruthy();
    const failed = screen.getByText(/Не озвучены \(1\)/).closest('details');
    expect(within(failed).getByText('Капелла Медичи')).toBeTruthy();
  });
});
