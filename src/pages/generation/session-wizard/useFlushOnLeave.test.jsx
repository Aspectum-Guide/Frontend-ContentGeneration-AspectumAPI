import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import useFlushOnLeave from './useFlushOnLeave';

describe('useFlushOnLeave', () => {
  it('flushes the latest callback when the page is hidden', () => {
    const firstFlush = vi.fn();
    const latestFlush = vi.fn();
    const { rerender } = renderHook(
      ({ flush }) => useFlushOnLeave(flush),
      { initialProps: { flush: firstFlush } },
    );
    rerender({ flush: latestFlush });

    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(firstFlush).not.toHaveBeenCalled();
    expect(latestFlush).toHaveBeenCalledOnce();
    visibility.mockRestore();
  });

  it('flushes on pagehide and on SPA unmount', () => {
    const flush = vi.fn();
    const { unmount } = renderHook(() => useFlushOnLeave(flush));

    window.dispatchEvent(new Event('pagehide'));
    expect(flush).toHaveBeenCalledOnce();

    unmount();
    expect(flush).toHaveBeenCalledTimes(2);
  });

  it('does not surface synchronous or asynchronous flush failures', () => {
    const syncFailure = vi.fn(() => { throw new Error('sync'); });
    const asyncFailure = vi.fn(() => Promise.reject(new Error('async')));

    const first = renderHook(() => useFlushOnLeave(syncFailure));
    expect(() => window.dispatchEvent(new Event('pagehide'))).not.toThrow();
    first.unmount();

    const second = renderHook(() => useFlushOnLeave(asyncFailure));
    expect(() => window.dispatchEvent(new Event('pagehide'))).not.toThrow();
    second.unmount();
  });
});
