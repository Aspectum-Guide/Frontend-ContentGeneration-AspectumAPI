import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCatalogPagedReload } from './useCatalogPagedReload';

describe('useCatalogPagedReload', () => {
  it('reloads current page when only page changes', async () => {
    const reload = vi.fn();
    const setPage = vi.fn();

    const { rerender } = renderHook(
      ({ page, filterSignature }) =>
        useCatalogPagedReload({ page, setPage, reload, filterSignature }),
      { initialProps: { page: 2, filterSignature: 'a|b' } }
    );

    await waitFor(() => expect(reload).toHaveBeenCalledWith(2));
    reload.mockClear();

    rerender({ page: 3, filterSignature: 'a|b' });
    await waitFor(() => expect(reload).toHaveBeenCalledWith(3));
    expect(setPage).not.toHaveBeenCalled();
  });

  it('resets to page 1 and reloads once when filters change on page 1', async () => {
    const reload = vi.fn();
    const setPage = vi.fn();

    const { rerender } = renderHook(
      ({ page, filterSignature }) =>
        useCatalogPagedReload({ page, setPage, reload, filterSignature }),
      { initialProps: { page: 1, filterSignature: 'a|b' } }
    );

    await waitFor(() => expect(reload).toHaveBeenCalledWith(1));
    reload.mockClear();

    rerender({ page: 1, filterSignature: 'a|c' });
    await waitFor(() => expect(reload).toHaveBeenCalledWith(1));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(setPage).not.toHaveBeenCalled();
  });

  it('sets page to 1 when filters change while not on page 1', async () => {
    const reload = vi.fn();
    const setPage = vi.fn();

    const { rerender } = renderHook(
      ({ page, filterSignature }) =>
        useCatalogPagedReload({ page, setPage, reload, filterSignature }),
      { initialProps: { page: 3, filterSignature: 'a|b' } }
    );

    await waitFor(() => expect(reload).toHaveBeenCalledWith(3));
    reload.mockClear();

    rerender({ page: 3, filterSignature: 'x|b' });
    await waitFor(() => expect(setPage).toHaveBeenCalledWith(1));
    expect(reload).not.toHaveBeenCalled();
  });
});
